"use server";

// PartAsset server actions — the verification GATE (design §4, Stage C).
//
// Each part can carry a per-kind CAD bundle (SYMBOL / FOOTPRINT / MODEL_3D), and
// each asset moves through `UNVERIFIED → VERIFIED → FLAGGED` ONLY via these
// deliberate server actions, each behind `requireUser` first; every MUTATING
// action uses OPTIMISTIC CONCURRENCY (a conditional
// `updateMany({ where: { id, updatedAt, trust:<pin> } })` — the same fence as
// `part-facts.ts`, with `PartAsset.updatedAt` as the lock). A 0-row result means
// the row changed since the caller loaded it → we throw "reload" and never write.
//
// VERIFY precondition (design §4, simplified for assets): a non-empty `source`
// (its provenance basis — SnapEDA / SamacSys / manufacturer / hand-made) is the
// editorial sign-off. SELF-VERIFICATION is allowed (`verifiedById === createdById`
// is fine). A FLAGGED row can't be verified directly — the only exit from FLAGGED
// is `clearPartAssetFlag` (→ UNVERIFIED), after which it must re-earn VERIFIED.
//
// AUTO-DEMOTE (field-granular). Editing the `ref` OR `source` of a VERIFIED row
// demotes it to UNVERIFIED + clears the verifier. A `license`-only edit does NOT
// demote (it's cosmetic, not load-bearing provenance). The decision is the pure,
// unit-testable `shouldDemoteAsset`.
//
// EDIT contract: `editPartAsset` writes `ref/source/license` as `?? null`, so an
// edit that OMITS a field CLEARS it. The inline editor (Task 6) must always send
// all three current values. (Same strict-envelope contract as the fact editor.)
//
// NB: a "use server" module may export ONLY async functions — the local
// `idWithLockSchema` + `CONFLICT_MESSAGE` consts are module-private (never
// exported), and the pure `shouldDemoteAsset` lives in `@/lib/schemas/part-asset`.
//
// Task 5 (separate commit) APPENDS the R2 upload actions
// (`createPartAssetUploadUrl` / `recordPartAsset` / `getPartAssetDownloadUrl`)
// to THIS file — the gate half below is self-contained and R2-free.

import { type PartAsset } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { editPartAssetSchema, shouldDemoteAsset } from "@/lib/schemas/part-asset";

// ─── Messages ───────────────────────────────────────────
const CONFLICT_MESSAGE =
  "This asset changed since you opened it — reload and try again.";

// ─── Envelope schema (strict) ───────────────────────────────────────────────
// verify / unverify / flag / clear carry only an id + the optimistic-lock fence.
const idWithLockSchema = z
  .object({
    id: z.cuid(),
    updatedAt: z.coerce.date(),
  })
  .strict();

// ─── Revalidation ──────────────────────────────────────
// Refresh the part detail route on every mutation (mirrors part-facts.ts).
function revalidatePartRoute(partId: string): void {
  revalidatePath(`/parts/${partId}`);
}

// ─── verifyPartAsset ────────────────────────────────────
/**
 * Enforce the VERIFIED precondition (a non-empty `source`), then stamp
 * `trust: VERIFIED` + `verifiedById`/`verifiedAt` via a conditional update on
 * `updatedAt`. Self-verification is allowed. A FLAGGED row is rejected (the only
 * exit from FLAGGED is `clearPartAssetFlag`). A 0-row result → "reload".
 */
export async function verifyPartAsset(input: unknown): Promise<PartAsset> {
  const { id, updatedAt } = idWithLockSchema.parse(input);
  const user = await requireUser();

  const row = await db.partAsset.findUniqueOrThrow({
    where: { id },
    select: { partId: true, trust: true, source: true },
  });

  // A FLAGGED asset must NOT be verifiable directly: the only exit from FLAGGED
  // is clearPartAssetFlag (→ UNVERIFIED), after which it must re-earn VERIFIED.
  if (row.trust === "FLAGGED") {
    throw new Error(
      "A flagged asset must be cleared and re-reviewed before it can be verified.",
    );
  }

  if (!row.source || row.source.trim().length === 0) {
    throw new Error(
      "Cannot verify: an asset needs a stated source (its provenance basis).",
    );
  }

  const { count } = await db.partAsset.updateMany({
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
  return db.partAsset.findUniqueOrThrow({ where: { id } });
}

// ─── editPartAsset ──────────────────────────────────────
/**
 * Edit the metadata (`ref` / `source` / `license`) via a conditional
 * `updateMany({ where: { id, updatedAt } })` (optimistic lock). A 0-row result →
 * the row changed since the caller loaded it → throw "reload" (no write). Stamps
 * `lastEditedById`. A VERIFIED row whose `ref` OR `source` changed demotes to
 * UNVERIFIED + clears `verifiedById`/`verifiedAt`; a `license`-only edit does NOT
 * demote. Fields are written `?? null` — OMITTING a field CLEARS it.
 */
export async function editPartAsset(input: unknown): Promise<PartAsset> {
  const env = editPartAssetSchema.parse(input);
  const user = await requireUser();

  const existing = await db.partAsset.findUniqueOrThrow({
    where: { id: env.id },
    select: { partId: true, trust: true, ref: true, source: true },
  });

  const demote =
    existing.trust === "VERIFIED" &&
    shouldDemoteAsset(existing, { ref: env.ref, source: env.source });

  const { count } = await db.partAsset.updateMany({
    where: { id: env.id, updatedAt: env.updatedAt },
    data: {
      ref: env.ref ?? null,
      source: env.source ?? null,
      license: env.license ?? null,
      lastEditedById: user.id,
      ...(demote
        ? { trust: "UNVERIFIED", verifiedById: null, verifiedAt: null }
        : {}),
    },
  });
  if (count === 0) throw new Error(CONFLICT_MESSAGE);

  revalidatePartRoute(existing.partId);
  return db.partAsset.findUniqueOrThrow({ where: { id: env.id } });
}

// ─── unverifyPartAsset ──────────────────────────────────
/**
 * Undo an accidental verify: move VERIFIED → UNVERIFIED and clear the verifier
 * stamp (`verifiedById`/`verifiedAt`). The conditional WHERE pins
 * `trust: "VERIFIED"` so the action is idempotent + race-safe and can NEVER
 * touch a FLAGGED row (a flag is a dispute, cleared only via clearPartAssetFlag)
 * nor a row that changed underneath. Optimistic lock on `updatedAt`. Any signed-in
 * user may unverify — it strictly REDUCES trust, so it needs no precondition.
 */
export async function unverifyPartAsset(input: unknown): Promise<PartAsset> {
  const { id, updatedAt } = idWithLockSchema.parse(input);
  await requireUser();

  const row = await db.partAsset.findUniqueOrThrow({
    where: { id },
    select: { partId: true, trust: true },
  });
  if (row.trust !== "VERIFIED") {
    throw new Error("Only a VERIFIED asset can be unverified.");
  }

  const { count } = await db.partAsset.updateMany({
    // Pin trust: VERIFIED so the unverify is idempotent + race-safe: if another
    // caller moved it off VERIFIED (e.g. a flag landed), count is 0 → rejected.
    where: { id, updatedAt, trust: "VERIFIED" },
    data: { trust: "UNVERIFIED", verifiedById: null, verifiedAt: null },
  });
  if (count === 0) throw new Error(CONFLICT_MESSAGE);

  revalidatePartRoute(row.partId);
  return db.partAsset.findUniqueOrThrow({ where: { id } });
}

// ─── flagPartAsset ──────────────────────────────────────
/**
 * Set `trust: FLAGGED` (any signed-in user). NO reason column in v1. Conditional
 * update on `updatedAt`.
 */
export async function flagPartAsset(input: unknown): Promise<PartAsset> {
  const { id, updatedAt } = idWithLockSchema.parse(input);
  await requireUser();

  const row = await db.partAsset.findUniqueOrThrow({
    where: { id },
    select: { partId: true },
  });

  const { count } = await db.partAsset.updateMany({
    where: { id, updatedAt },
    data: { trust: "FLAGGED" },
  });
  if (count === 0) throw new Error(CONFLICT_MESSAGE);

  revalidatePartRoute(row.partId);
  return db.partAsset.findUniqueOrThrow({ where: { id } });
}

// ─── clearPartAssetFlag ─────────────────────────────────
/**
 * Move FLAGGED → UNVERIFIED ONLY ("acknowledge & re-review"); NEVER straight to
 * VERIFIED — a cleared asset must re-earn VERIFIED through `verifyPartAsset`. The
 * conditional WHERE pins `trust: "FLAGGED"` so a non-flagged row is left
 * untouched (count 0 → rejected). Optimistic lock on `updatedAt`.
 */
export async function clearPartAssetFlag(input: unknown): Promise<PartAsset> {
  const { id, updatedAt } = idWithLockSchema.parse(input);
  await requireUser();

  const row = await db.partAsset.findUniqueOrThrow({
    where: { id },
    select: { partId: true, trust: true },
  });
  if (row.trust !== "FLAGGED") {
    throw new Error("Only a FLAGGED asset can be cleared.");
  }

  const { count } = await db.partAsset.updateMany({
    // Pin trust: FLAGGED in the WHERE so the clear is idempotent + race-safe:
    // if another caller moved it off FLAGGED, count is 0.
    where: { id, updatedAt, trust: "FLAGGED" },
    data: { trust: "UNVERIFIED" },
  });
  if (count === 0) throw new Error(CONFLICT_MESSAGE);

  revalidatePartRoute(row.partId);
  return db.partAsset.findUniqueOrThrow({ where: { id } });
}
