"use server";

// PartFact server actions — the verification GATE (design §4).
//
// This is the trust foundation of the parts-knowledge system. Every fact-group
// moves through `UNVERIFIED → VERIFIED → FLAGGED` ONLY via these deliberate
// server actions, each behind `requireUser` first; every MUTATING action uses
// OPTIMISTIC CONCURRENCY (a conditional `updateMany({ where: { id, updatedAt } })`
// — the `stages.ts` optimistic-lock pattern, with `PartFact.updatedAt` as the
// fence). A 0-row result means the row changed since the caller loaded it →
// we throw "reload" and never write.
//
// INPUT VALIDATION. Create/edit parse a `.strict()` Zod ENVELOPE so a typo'd
// provenance key (e.g. `sourcePag`) is REJECTED, not silently dropped — losing
// a provenance anchor silently would corrupt the gate. The `data` payload is
// validated SEPARATELY via `factDataSchema(group, part.category)` (we load the
// part to get its category, which drives the per-category required-keys).
//
// AUTO-DEMOTE (field-granular, design §4). Editing the `data` OR any ROW
// provenance anchor (`partDatasheetId`, `sourcePage`, `sourceUrl`, `sourceKind`)
// of a VERIFIED row demotes it to UNVERIFIED + clears the verifier. A
// `sourceNote`-only edit does NOT demote (it's descriptive, not load-bearing).
// Element-level anchors live INSIDE `data`, so they're covered by "data
// differs". The decision is the pure, unit-testable `shouldDemote`.
//
// VERIFY precondition (per `sourceKind`, design §4): DATASHEET ⇒ a source
// (`partDatasheetId` OR `sourceUrl`) AND a page anchor (row `sourcePage`, OR
// ≥1 element inside `data` carrying a `sourcePage`); MANUAL ⇒ a non-empty
// `sourceNote` (an editorial "reviewed" sign-off); API ⇒ `sourceUrl`.
// SELF-VERIFICATION is allowed in v1 (`verifiedById === createdById` is fine).
//
// FLAGGED: any signed-in user may flag (NO reason column in v1 — a `reason` is
// a future addition; we omit it here). The only exit is `clearFlag`
// (FLAGGED → UNVERIFIED) — NEVER straight to VERIFIED; a cleared fact must
// re-earn VERIFIED through the gate.

import {
  Prisma,
  type FactSourceKind,
  type PartFact,
  type PartFactGroup,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { factDataSchema } from "@/lib/schemas/part-fact";

// ─── Messages ───────────────────────────────────────────
const CONFLICT_MESSAGE =
  "This fact changed since you opened it — reload and try again.";
const DUPLICATE_GROUP_MESSAGE =
  "A fact for this group already exists on this part.";

// ─── Envelope schemas (strict) ─────────────────────────────────────────────
// `.strict()` is the whole point: an unrecognized key (a typo'd provenance
// field) yields an `unrecognized_keys` ZodError instead of being dropped. The
// `data` field is parsed as a passthrough here (`z.unknown()`) and validated
// SEPARATELY against `factDataSchema(group, part.category)` once we've loaded
// the part — the per-category required-keys can't be known until then.
const sourceKindSchema = z.enum(["DATASHEET", "MANUAL", "API"]);

const createFactSchema = z
  .object({
    partId: z.string().min(1),
    group: z.enum([
      "PARAMETRICS",
      "PINOUT",
      "POWER",
      "DERATING",
      "MECHANICAL",
      "NOTES",
    ]),
    data: z.unknown(),
    sourceKind: sourceKindSchema,
    partDatasheetId: z.string().min(1).optional(),
    sourcePage: z.number().int().positive().optional(),
    // The R2-off fallback uses the real `datasheetUrl`, which is a URL; an
    // API source is also a URL. Reject free text like "see page 4".
    sourceUrl: z.string().url().optional(),
    sourceNote: z.string().trim().min(1).optional(),
  })
  .strict();
export type CreateFactInput = z.infer<typeof createFactSchema>;

// NOTE: `group` is intentionally ABSENT — a fact's group (and thus its `data`
// shape) is IMMUTABLE by construction. The group is read from the stored row
// and `data` is validated against it; a curator cannot re-point a row to a
// foreign shape (which would bypass the per-category required-keys and leave
// the row reporting a `group` it no longer holds).
const editFactSchema = z
  .object({
    id: z.string().min(1),
    // The optimistic-lock fence — the `updatedAt` the caller loaded.
    updatedAt: z.coerce.date(),
    data: z.unknown(),
    sourceKind: sourceKindSchema,
    partDatasheetId: z.string().min(1).optional(),
    sourcePage: z.number().int().positive().optional(),
    sourceUrl: z.string().url().optional(),
    sourceNote: z.string().trim().min(1).optional(),
  })
  .strict();
export type EditFactInput = z.infer<typeof editFactSchema>;

// flag / verify / clear carry only an id + the optimistic-lock fence.
const idWithLockSchema = z
  .object({
    id: z.string().min(1),
    updatedAt: z.coerce.date(),
  })
  .strict();

// ─── shouldDemote (pure) ────────────────────────────────────────────────────
/**
 * The field-granular auto-demote decision (design §4). Returns `true` when the
 * edit changed the `data` (deep-equal) OR any of the four ROW provenance
 * ANCHORS (`partDatasheetId`, `sourcePage`, `sourceUrl`, `sourceKind`).
 * `sourceNote` is intentionally IGNORED — a cosmetic note change must not
 * demote a verified fact. Element-level anchors live inside `data`, so they're
 * covered by the deep `data` comparison.
 *
 * Pure + exported so the demote logic is unit-testable independently of the DB.
 */
export interface DemoteRelevant {
  data: unknown;
  partDatasheetId: string | null;
  sourcePage: number | null;
  sourceUrl: string | null;
  sourceKind: FactSourceKind;
}

export function shouldDemote(
  stored: DemoteRelevant,
  next: DemoteRelevant,
): boolean {
  if (stored.partDatasheetId !== next.partDatasheetId) return true;
  if (stored.sourcePage !== next.sourcePage) return true;
  if (stored.sourceUrl !== next.sourceUrl) return true;
  if (stored.sourceKind !== next.sourceKind) return true;
  return !deepEqual(stored.data, next.data);
}

// Structural deep-equality for the JSON `data` blob. Stored data round-trips
// through Postgres JSON (object key order is not guaranteed), so we compare by
// value, key-order-independent. Sufficient for the JSON-serializable shapes the
// per-group Zod schemas admit (objects / arrays / primitives).
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (typeof a === "object" && typeof b === "object") {
    const ao = a as Record<string, unknown>;
    const bo = b as Record<string, unknown>;
    const ak = Object.keys(ao);
    const bk = Object.keys(bo);
    if (ak.length !== bk.length) return false;
    for (const k of ak) {
      if (!Object.prototype.hasOwnProperty.call(bo, k)) return false;
      if (!deepEqual(ao[k], bo[k])) return false;
    }
    return true;
  }
  return false;
}

// ─── Revalidation ──────────────────────────────────────
// Refresh the part detail route on every mutation (mirrors guides.ts).
function revalidatePartRoute(partId: string): void {
  revalidatePath(`/parts/${partId}`);
}

// ─── Provenance guards (shared by create + edit) ────────────────────────────
/**
 * NOTES is editorial narrative (design §4): `MANUAL` only, exempt from the
 * datasheet-page rule. A NOTES row carrying a `DATASHEET`/`API` kind would
 * imply page-checked provenance it can't have, so reject it outright.
 */
function assertNotesSourceKind(
  group: PartFactGroup,
  sourceKind: FactSourceKind,
): void {
  if (group === "NOTES" && sourceKind !== "MANUAL") {
    throw new Error("NOTES facts must use sourceKind MANUAL.");
  }
}

/**
 * When a `partDatasheetId` is supplied, it must reference a real `PartDatasheet`
 * whose `partId` matches THIS fact's part — a cached PDF for a different part is
 * not valid provenance. (Real `PartDatasheet` rows arrive in Task 9; until then
 * this simply rejects bogus ids.)
 */
async function assertDatasheetBelongsToPart(
  partDatasheetId: string | undefined,
  partId: string,
): Promise<void> {
  if (!partDatasheetId) return;
  const ds = await db.partDatasheet.findUnique({
    where: { id: partDatasheetId },
    select: { partId: true },
  });
  if (!ds || ds.partId !== partId) {
    throw new Error("Unknown datasheet for this part.");
  }
}

// ─── Verify precondition (per sourceKind) ───────────────────────────────────
/**
 * Returns `null` when the row satisfies its `sourceKind`'s VERIFIED
 * precondition, or a human-readable rejection reason otherwise (design §4).
 *
 * DATASHEET ⇒ a source (`partDatasheetId` OR `sourceUrl`) AND a page anchor
 * (row `sourcePage` set, OR ≥1 element inside `data` carries a `sourcePage`).
 * MANUAL ⇒ a non-empty `sourceNote` (editorial sign-off).
 * API ⇒ `sourceUrl`.
 */
function verifyPreconditionReason(row: {
  sourceKind: FactSourceKind;
  partDatasheetId: string | null;
  sourcePage: number | null;
  sourceUrl: string | null;
  sourceNote: string | null;
  data: unknown;
}): string | null {
  switch (row.sourceKind) {
    case "DATASHEET": {
      const hasSource =
        !!row.partDatasheetId || (!!row.sourceUrl && row.sourceUrl.length > 0);
      if (!hasSource) {
        return "Cannot verify: a DATASHEET fact needs a cached datasheet or a source URL.";
      }
      const hasPageAnchor =
        row.sourcePage != null || dataHasElementPage(row.data);
      if (!hasPageAnchor) {
        return "Cannot verify: a DATASHEET fact needs a page anchor (a group page, or a page on at least one element).";
      }
      return null;
    }
    case "MANUAL": {
      if (!row.sourceNote || row.sourceNote.trim().length === 0) {
        return "Cannot verify: a MANUAL fact needs a stated basis (a non-empty source note).";
      }
      return null;
    }
    case "API": {
      if (!row.sourceUrl || row.sourceUrl.length === 0) {
        return "Cannot verify: an API fact needs a source URL.";
      }
      return null;
    }
    default: {
      const _exhaustive: never = row.sourceKind;
      return `Unknown sourceKind: ${String(_exhaustive)}`;
    }
  }
}

/**
 * Does any leaf element inside `data` carry a numeric `sourcePage`? Walks the
 * known per-group element arrays (pins / curves / entries / bypass). A row page
 * is the fallback; this covers the element-level anchor case.
 */
function dataHasElementPage(data: unknown): boolean {
  if (data == null || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  const candidateArrays = [d.entries, d.pins, d.curves, d.bypass];
  for (const arr of candidateArrays) {
    if (!Array.isArray(arr)) continue;
    for (const el of arr) {
      if (
        el != null &&
        typeof el === "object" &&
        typeof (el as Record<string, unknown>).sourcePage === "number"
      ) {
        return true;
      }
    }
  }
  return false;
}

// ─── createFact ─────────────────────────────────────────
/**
 * Validate the strict envelope + `data` (via `factDataSchema(group,
 * part.category)`), then insert with `trust: UNVERIFIED` + `createdById`.
 * Respects `@@unique([partId, group])` with a friendly duplicate-group error.
 */
export async function createFact(input: unknown): Promise<PartFact> {
  const env = createFactSchema.parse(input);
  const user = await requireUser();

  // NOTES is MANUAL-only (design §4).
  assertNotesSourceKind(env.group, env.sourceKind);

  // Load the part to get its category — the per-category required-keys for
  // PARAMETRICS can't be validated without it.
  const part = await db.part.findUniqueOrThrow({
    where: { id: env.partId },
    select: { category: true },
  });

  // A supplied cached-datasheet id must belong to this part.
  await assertDatasheetBelongsToPart(env.partDatasheetId, env.partId);

  const data = factDataSchema(env.group, part.category).parse(env.data);

  let fact: PartFact;
  try {
    fact = await db.partFact.create({
      data: {
        partId: env.partId,
        group: env.group,
        data: data as Prisma.InputJsonValue,
        trust: "UNVERIFIED",
        sourceKind: env.sourceKind,
        partDatasheetId: env.partDatasheetId ?? null,
        sourcePage: env.sourcePage ?? null,
        sourceUrl: env.sourceUrl ?? null,
        sourceNote: env.sourceNote ?? null,
        createdById: user.id,
      },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      throw new Error(DUPLICATE_GROUP_MESSAGE);
    }
    throw e;
  }

  revalidatePartRoute(env.partId);
  return fact;
}

// ─── editFact ───────────────────────────────────────────
/**
 * Re-validate `data`, compute the field-granular auto-demote, then apply via a
 * conditional `updateMany({ where: { id, updatedAt } })` (optimistic lock). A
 * 0-row result → the row changed since the caller loaded it → throw "reload"
 * (no write). Stamps `lastEditedById`. A VERIFIED row that `shouldDemote`
 * demotes to UNVERIFIED + clears `verifiedById`/`verifiedAt`.
 */
export async function editFact(input: unknown): Promise<PartFact> {
  const env = editFactSchema.parse(input);
  const user = await requireUser();

  // Load the existing row (for the part category + the stored values the
  // demote decision diffs against). Crucially, `group` and `partId` come from
  // the STORED row — never from the caller — so the row's shape is immutable.
  const existing = await db.partFact.findUniqueOrThrow({
    where: { id: env.id },
    select: {
      partId: true,
      group: true,
      trust: true,
      data: true,
      partDatasheetId: true,
      sourcePage: true,
      sourceUrl: true,
      sourceKind: true,
      part: { select: { category: true } },
    },
  });

  // NOTES is MANUAL-only (design §4) — re-checked on edit so a curator can't
  // promote an editorial note to a page-checked kind.
  assertNotesSourceKind(existing.group, env.sourceKind);

  // A supplied cached-datasheet id must belong to this fact's part.
  await assertDatasheetBelongsToPart(env.partDatasheetId, existing.partId);

  // Validate `data` against the STORED group (immutable). A foreign-shaped
  // payload (e.g. NOTES `{blocks}` on a PARAMETRICS row) is rejected here.
  const data = factDataSchema(existing.group, existing.part.category).parse(
    env.data,
  );

  // Editing a FLAGGED row intentionally KEEPS the FLAG: FLAGGED is excluded
  // from all retrieval, so re-pointing the flag at edited content is acceptable
  // for v1 (the only exit remains clearFlag → UNVERIFIED, then re-verify).

  const next = {
    data,
    partDatasheetId: env.partDatasheetId ?? null,
    sourcePage: env.sourcePage ?? null,
    sourceUrl: env.sourceUrl ?? null,
    sourceKind: env.sourceKind,
  };
  const demote =
    existing.trust === "VERIFIED" &&
    shouldDemote(
      {
        data: existing.data,
        partDatasheetId: existing.partDatasheetId,
        sourcePage: existing.sourcePage,
        sourceUrl: existing.sourceUrl,
        sourceKind: existing.sourceKind,
      },
      next,
    );

  const patch: Prisma.PartFactUpdateManyMutationInput = {
    data: data as Prisma.InputJsonValue,
    sourceKind: env.sourceKind,
    partDatasheetId: env.partDatasheetId ?? null,
    sourcePage: env.sourcePage ?? null,
    sourceUrl: env.sourceUrl ?? null,
    sourceNote: env.sourceNote ?? null,
    lastEditedById: user.id,
  };
  if (demote) {
    patch.trust = "UNVERIFIED";
    patch.verifiedById = null;
    patch.verifiedAt = null;
  }

  // Conditional write — the optimistic-lock fence is `updatedAt`.
  const { count } = await db.partFact.updateMany({
    where: { id: env.id, updatedAt: env.updatedAt },
    data: patch,
  });
  if (count === 0) throw new Error(CONFLICT_MESSAGE);

  revalidatePartRoute(existing.partId);
  return db.partFact.findUniqueOrThrow({ where: { id: env.id } });
}

// ─── verifyFact ─────────────────────────────────────────
/**
 * Enforce the per-`sourceKind` VERIFIED precondition, then stamp
 * `trust: VERIFIED` + `verifiedById`/`verifiedAt` via a conditional update on
 * `updatedAt`. Self-verification is allowed (`verifiedById === createdById` is
 * fine). A 0-row conditional result → "reload" (no write).
 */
export async function verifyFact(input: unknown): Promise<PartFact> {
  const { id, updatedAt } = idWithLockSchema.parse(input);
  const user = await requireUser();

  const row = await db.partFact.findUniqueOrThrow({
    where: { id },
    select: {
      partId: true,
      trust: true,
      sourceKind: true,
      partDatasheetId: true,
      sourcePage: true,
      sourceUrl: true,
      sourceNote: true,
      data: true,
    },
  });

  // A FLAGGED fact must NOT be verifiable directly (design §4): the only exit
  // from FLAGGED is clearFlag (→ UNVERIFIED), after which it must re-earn
  // VERIFIED through the gate. Verifying straight from FLAGGED would silently
  // erase the dispute.
  if (row.trust === "FLAGGED") {
    throw new Error(
      "A flagged fact must be cleared and re-reviewed before it can be verified.",
    );
  }

  const reason = verifyPreconditionReason(row);
  if (reason) throw new Error(reason);

  const { count } = await db.partFact.updateMany({
    // Pin `trust: { not: "FLAGGED" }` so a flag landing concurrently between the
    // load above and this write still blocks the verify (count 0 → rejected).
    where: { id, updatedAt, trust: { not: "FLAGGED" } },
    data: {
      trust: "VERIFIED",
      verifiedById: user.id,
      verifiedAt: new Date(),
    },
  });
  if (count === 0) throw new Error(CONFLICT_MESSAGE);

  revalidatePartRoute(row.partId);
  return db.partFact.findUniqueOrThrow({ where: { id } });
}

// ─── flagFact ───────────────────────────────────────────
/**
 * Set `trust: FLAGGED` (any signed-in user). NO reason column in v1 — a
 * `reason` is a future addition (would need a schema column). Conditional
 * update on `updatedAt`.
 */
export async function flagFact(input: unknown): Promise<PartFact> {
  const { id, updatedAt } = idWithLockSchema.parse(input);
  await requireUser();

  const row = await db.partFact.findUniqueOrThrow({
    where: { id },
    select: { partId: true },
  });

  const { count } = await db.partFact.updateMany({
    where: { id, updatedAt },
    data: { trust: "FLAGGED" },
  });
  if (count === 0) throw new Error(CONFLICT_MESSAGE);

  revalidatePartRoute(row.partId);
  return db.partFact.findUniqueOrThrow({ where: { id } });
}

// ─── clearFlag ──────────────────────────────────────────
/**
 * Move FLAGGED → UNVERIFIED ONLY ("acknowledge & re-review"); NEVER straight to
 * VERIFIED — a cleared fact must re-earn VERIFIED through `verifyFact`. The
 * conditional WHERE pins `trust: "FLAGGED"` so a non-flagged row is left
 * untouched (count 0 → rejected). Optimistic lock on `updatedAt`.
 */
export async function clearFlag(input: unknown): Promise<PartFact> {
  const { id, updatedAt } = idWithLockSchema.parse(input);
  await requireUser();

  const row = await db.partFact.findUniqueOrThrow({
    where: { id },
    select: { partId: true, trust: true },
  });
  if (row.trust !== "FLAGGED") {
    throw new Error("Only a FLAGGED fact can be cleared.");
  }

  const { count } = await db.partFact.updateMany({
    // Pin trust: FLAGGED in the WHERE so the clear is idempotent + race-safe:
    // if another caller moved it off FLAGGED, count is 0.
    where: { id, updatedAt, trust: "FLAGGED" },
    data: { trust: "UNVERIFIED" },
  });
  if (count === 0) throw new Error(CONFLICT_MESSAGE);

  revalidatePartRoute(row.partId);
  return db.partFact.findUniqueOrThrow({ where: { id } });
}
