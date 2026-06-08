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

export async function deleteBomLineAction(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Missing bom-line id");
  }
  await deleteBomLine({ id });
}
