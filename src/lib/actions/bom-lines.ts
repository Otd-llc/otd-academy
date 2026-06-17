"use server";

// BomLine server actions (design §4.3 / §5.3).
//
// Every write asserts (a) the parent revision isn't frozen and (b) the
// per-revision BOM isn't frozen (`bomFrozenAt IS NULL`). Both helpers live
// in src/lib/assertions.ts and run inside the same Serializable transaction
// as the mutation so the snapshot the assert sees is the one the write
// would commit against.
//
// The refdes-count invariant is enforced at three layers:
//   1. Zod schema → clean error before the DB sees the row.
//   2. CHECK constraint check_bomline_refdes_count → defense in depth.
//   3. Prisma @@unique([revisionId, partId]) blocks duplicates per revision.

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-helpers";
import { assertBomNotFrozen, assertNotFrozen } from "@/lib/assertions";
import { withTxRetry } from "@/lib/tx-retry";
import { parseBomCsv } from "@/lib/bom-csv";
import {
  createBomLineSchema,
  deleteBomLineSchema,
  editBomLineSchema,
} from "@/lib/schemas/bom-line";

async function loadRevisionRouteContext(revisionId: string) {
  const rev = await db.revision.findUniqueOrThrow({
    where: { id: revisionId },
    select: { id: true, label: true, project: { select: { slug: true } } },
  });
  return { revLabel: rev.label, projectSlug: rev.project.slug };
}

export async function createBomLine(input: unknown) {
  const data = createBomLineSchema.parse(input);
  const user = await requireAdmin();

  const result = await withTxRetry(() =>
    db.$transaction(
      async (tx) => {
        await assertNotFrozen(tx, data.revisionId);
        await assertBomNotFrozen(tx, data.revisionId);
        return tx.bomLine.create({
          data: {
            revisionId: data.revisionId,
            partId: data.partId,
            refDes: data.refDes,
            quantity: data.quantity,
            notes: data.notes ?? null,
            altMpn: data.altMpn ?? null,
            altManufacturer: data.altManufacturer ?? null,
            unitPriceCents: data.unitPriceCents ?? null,
            createdById: user.id,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );

  const { revLabel, projectSlug } = await loadRevisionRouteContext(
    data.revisionId,
  );
  revalidatePath(`/projects/${projectSlug}/${revLabel}`);
  return result;
}

export async function editBomLine(input: unknown) {
  const { id, ...rest } = editBomLineSchema.parse(input);
  await requireAdmin();

  // Drop undefined keys so Prisma only updates supplied fields.
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (v !== undefined) data[k] = v;
  }

  const result = await withTxRetry(() =>
    db.$transaction(
      async (tx) => {
        const row = await tx.bomLine.findUniqueOrThrow({
          where: { id },
          select: { revisionId: true },
        });
        await assertNotFrozen(tx, row.revisionId);
        await assertBomNotFrozen(tx, row.revisionId);
        return tx.bomLine.update({ where: { id }, data });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );

  const { revLabel, projectSlug } = await loadRevisionRouteContext(
    result.revisionId,
  );
  revalidatePath(`/projects/${projectSlug}/${revLabel}`);
  return result;
}

export async function deleteBomLine(input: unknown) {
  const { id } = deleteBomLineSchema.parse(input);
  await requireAdmin();

  const { revisionId } = await withTxRetry(() =>
    db.$transaction(
      async (tx) => {
        const row = await tx.bomLine.findUniqueOrThrow({
          where: { id },
          select: { revisionId: true },
        });
        await assertNotFrozen(tx, row.revisionId);
        await assertBomNotFrozen(tx, row.revisionId);
        await tx.bomLine.delete({ where: { id } });
        return { revisionId: row.revisionId };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );

  const { revLabel, projectSlug } = await loadRevisionRouteContext(revisionId);
  revalidatePath(`/projects/${projectSlug}/${revLabel}`);
}

// ─── CSV import (WS3) ──────────────────────────────────────────────────
//
// Strict-match each parsed row's (manufacturer, mpn) against a curated Part
// (Prisma composite-unique input name `manufacturer_mpn`); unmatched rows are
// reported and skipped. Matched rows upsert on the per-revision composite
// unique `[revisionId, partId]` (input name `revisionId_partId`) so a re-import
// updates instead of duplicating. The whole batch runs in the same
// Serializable retry transaction `createBomLine` uses and is guarded by BOTH
// freeze asserts (`assertNotFrozen` + `assertBomNotFrozen`).
//
// The parser (Task 3) already guarantees every accepted row's refDes
// comma-count equals its quantity with no blank segments, so the DB CHECK
// `bomline_refdes_count` won't abort the tx for parser-accepted rows.

export async function importBomCsv(input: {
  revisionId: string;
  csv: string;
}): Promise<{
  created: number;
  updated: number;
  unmatched: { manufacturer: string; mpn: string; row: number }[];
  rowErrors: { row: number; message: string }[];
}> {
  const { revisionId, csv } = input;
  const user = await requireAdmin();

  const { rows, errors } = parseBomCsv(csv);

  const result = await withTxRetry(() =>
    db.$transaction(
      async (tx) => {
        await assertNotFrozen(tx, revisionId);
        await assertBomNotFrozen(tx, revisionId);

        let created = 0;
        let updated = 0;
        const unmatched: { manufacturer: string; mpn: string; row: number }[] =
          [];

        for (const [i, r] of rows.entries()) {
          const part = await tx.part.findUnique({
            where: {
              manufacturer_mpn: { manufacturer: r.manufacturer, mpn: r.mpn },
            },
            select: { id: true },
          });
          if (!part) {
            // Parser rows are 1-indexed by source line (header = 1, first
            // data row = 2); `rows` only holds accepted rows so we can't
            // recover the exact line — report manufacturer/mpn + position.
            unmatched.push({
              manufacturer: r.manufacturer,
              mpn: r.mpn,
              row: i + 2,
            });
            continue;
          }

          const data = {
            refDes: r.refDes,
            quantity: r.quantity,
            unitPriceCents: r.unitPriceCents,
            altMpn: r.altMpn,
            altManufacturer: r.altManufacturer,
            notes: r.notes,
          };

          const existing = await tx.bomLine.findUnique({
            where: { revisionId_partId: { revisionId, partId: part.id } },
            select: { id: true },
          });
          await tx.bomLine.upsert({
            where: { revisionId_partId: { revisionId, partId: part.id } },
            create: {
              revisionId,
              partId: part.id,
              createdById: user.id,
              ...data,
            },
            update: data,
          });
          if (existing) updated++;
          else created++;
        }

        return { created, updated, unmatched };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );

  const { revLabel, projectSlug } = await loadRevisionRouteContext(revisionId);
  revalidatePath(`/projects/${projectSlug}/${revLabel}`);
  return { ...result, rowErrors: errors };
}

// ─── Form action wrappers (useActionState-compatible) ──────────────────

export type BomLineFormState = {
  errors?: Record<string, string[]>;
  message?: string;
};

function pickString(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  return trimmed === "" ? undefined : trimmed;
}

// Dollars string from a form field → integer cents, or null when blank/invalid.
function dollarsToCents(v: string | null | undefined): number | null {
  if (v == null || v.trim() === "") return null;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

export async function createBomLineFormAction(
  _prev: BomLineFormState,
  formData: FormData,
): Promise<BomLineFormState> {
  const raw = {
    revisionId: pickString(formData, "revisionId"),
    partId: pickString(formData, "partId"),
    refDes: pickString(formData, "refDes"),
    quantity: pickString(formData, "quantity"),
    notes: pickString(formData, "notes"),
    altMpn: pickString(formData, "altMpn"),
    altManufacturer: pickString(formData, "altManufacturer"),
    unitPriceCents: dollarsToCents(pickString(formData, "unitPrice")),
  };
  try {
    await createBomLine(raw);
    return {};
  } catch (err) {
    if (err instanceof ZodError) {
      const errors: Record<string, string[]> = {};
      for (const issue of err.issues) {
        const key = issue.path.join(".") || "_root";
        (errors[key] ??= []).push(issue.message);
      }
      return { errors };
    }
    return { message: err instanceof Error ? err.message : "Unknown error" };
  }
}

// Form-action wrapper for the editor's Import-CSV panel. The return type is
// structural (no exported type alias — this `"use server"` file may export
// only async functions). The editor mirrors this shape as `ImportBomState`.
export async function importBomCsvFormAction(
  _prev: {
    report?: {
      created: number;
      updated: number;
      unmatched: { manufacturer: string; mpn: string; row: number }[];
      rowErrors: { row: number; message: string }[];
    };
    message?: string;
  },
  formData: FormData,
): Promise<{
  report?: {
    created: number;
    updated: number;
    unmatched: { manufacturer: string; mpn: string; row: number }[];
    rowErrors: { row: number; message: string }[];
  };
  message?: string;
}> {
  const revisionId = pickString(formData, "revisionId");
  const csv = pickString(formData, "csv");
  if (!revisionId || !csv) {
    return { message: "Provide a revision and CSV." };
  }
  try {
    const report = await importBomCsv({ revisionId, csv });
    return { report };
  } catch (err) {
    return {
      message: err instanceof Error ? err.message : "Import failed.",
    };
  }
}

export async function deleteBomLineAction(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Missing bom-line id");
  }
  await deleteBomLine({ id });
}
