"use server";

// PartAsset server actions — the verification GATE (design §4, Stage C).
//
// Each part can carry a per-kind CAD bundle (SYMBOL / FOOTPRINT / MODEL_3D), and
// each asset moves through `UNVERIFIED → VERIFIED → FLAGGED` ONLY via these
// deliberate server actions, each behind `requireAdmin` (curation is admin-only); every MUTATING
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

import { Prisma, type PartAsset } from "@prisma/client";
import { createId } from "@paralleldrive/cuid2";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { env } from "@/env";
import { db } from "@/lib/db";
import { requireUser, requireAdmin } from "@/lib/auth-helpers";
import { partAssetKey, partRenderKey } from "@/lib/r2";
import {
  deleteR2Object,
  ensureR2Enabled,
  headVerifySize,
  presignGet,
  presignGetInline,
  presignPut,
} from "@/lib/part-r2";
import {
  editPartAssetSchema,
  shouldDemoteAsset,
  ASSET_KIND_CONFIG,
  createPartAssetUploadUrlSchema,
  createPartAssetRenderUploadUrlSchema,
  recordPartAssetSchema,
  extOf,
  PART_ASSET_KINDS,
  RENDER_MIME,
  RENDER_MAX_BYTES,
} from "@/lib/schemas/part-asset";

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
  const user = await requireAdmin();

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
  const data = editPartAssetSchema.parse(input);
  const user = await requireAdmin();

  const existing = await db.partAsset.findUniqueOrThrow({
    where: { id: data.id },
    select: { partId: true, trust: true, ref: true, source: true },
  });

  const demote =
    existing.trust === "VERIFIED" &&
    shouldDemoteAsset(existing, { ref: data.ref, source: data.source });

  const { count } = await db.partAsset.updateMany({
    where: { id: data.id, updatedAt: data.updatedAt },
    data: {
      ref: data.ref ?? null,
      source: data.source ?? null,
      license: data.license ?? null,
      lastEditedById: user.id,
      ...(demote
        ? { trust: "UNVERIFIED", verifiedById: null, verifiedAt: null }
        : {}),
    },
  });
  if (count === 0) throw new Error(CONFLICT_MESSAGE);

  revalidatePartRoute(existing.partId);
  return db.partAsset.findUniqueOrThrow({ where: { id: data.id } });
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
  await requireAdmin();

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
 * Set `trust: FLAGGED` (admin-only). NO reason column in v1. Conditional
 * update on `updatedAt`.
 */
export async function flagPartAsset(input: unknown): Promise<PartAsset> {
  const { id, updatedAt } = idWithLockSchema.parse(input);
  await requireAdmin();

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
  await requireAdmin();

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

// ─── deletePartAsset ────────────────────────────────────
/**
 * Deliberately remove an asset (e.g. a wrong footprint), reverting that kind's
 * row to the empty "Upload" affordance. An admin may delete from ANY
 * trust state (UNVERIFIED/VERIFIED/FLAGGED) — there is NO trust precondition;
 * the deliberate confirm lives in the UI. The optimistic-lock fence still
 * applies: a conditional `deleteMany({ where: { id, updatedAt } })` returns 0
 * rows if the row changed since the caller loaded it → "reload" (no delete).
 * AFTER the row is gone we best-effort delete the R2 object; a failure is
 * swallowed (the orphan is the design's accepted fallback, swept later).
 */
export async function deletePartAsset(input: unknown): Promise<void> {
  const { id, updatedAt } = idWithLockSchema.parse(input);
  await requireAdmin();

  const row = await db.partAsset.findUniqueOrThrow({
    where: { id },
    select: { partId: true, r2Key: true, renderKey: true },
  });

  // Optimistic lock: don't delete a row that changed since the caller loaded it.
  const { count } = await db.partAsset.deleteMany({ where: { id, updatedAt } });
  if (count === 0) throw new Error(CONFLICT_MESSAGE);

  // Best-effort R2 cleanup AFTER the row is gone. A failure here leaves an
  // orphan object — the design's accepted fallback (swept later), so swallow it.
  if (env.R2_ENABLED && env.R2_BUCKET) {
    try {
      await deleteR2Object(row.r2Key);
    } catch {
      /* leave orphan — the design's accepted fallback; swept later */
    }
    // Also drop the derived .glb render object (MODEL_3D), same best-effort policy.
    if (row.renderKey) {
      try {
        await deleteR2Object(row.renderKey);
      } catch {
        /* orphan swept later */
      }
    }
  }

  revalidatePartRoute(row.partId);
}

// ─── R2 upload pipeline (design §3.1, Stage C Task 5) ───
//
// Three R2 actions clone the Stage A datasheet pipeline (part-datasheet.ts)
// per-kind, parameterized by `ASSET_KIND_CONFIG` (extension allowlist + a
// SERVER-FORCED content-type + a size cap). Upload + record are `requireAdmin`-
// gated (and `ensureR2Enabled`-gated); the download action is `requireUser` (any
// signed-in user) and returns `null` (not a throw) on the disabled / missing
// path so the part page can render a graceful fallback.
//
// CONTENT-TYPE is load-bearing. KiCad files (`.kicad_sym` / `.kicad_mod` /
// `.step`) usually report an EMPTY browser `file.type`, so we validate by
// EXTENSION and the server FORCES a per-kind content-type. That forced value is
// (a) signed into the presigned PUT and (b) RETURNED to the client, which MUST
// echo it in the PUT `Content-Type` header — R2's presigned signature requires
// the request header match the signed `ContentType` exactly.

// ─── createPartAssetUploadUrl ───────────────────────────
/**
 * Mint a presigned PUT URL for a part's per-kind CAD asset. The upload schema
 * parses FIRST — so its ext/cap `superRefine` runs BEFORE the R2 gate — then
 * `requireAdmin` + `ensureR2Enabled` + a part-exists check, then `presignPut`
 * over the minted `parts/{partId}/{kind}-{cuid}.{ext}` key with the kind's
 * forced content-type. Returns `{ uploadUrl, r2Key, contentType }`; the client
 * MUST send `contentType` (NOT `file.type`) in the PUT `Content-Type` header.
 */
export async function createPartAssetUploadUrl(
  input: unknown,
): Promise<{ uploadUrl: string; r2Key: string; contentType: string }> {
  // Parse FIRST so the ext/cap superRefine runs before the R2 gate (lets the
  // extension/cap rejections be exercised with R2 off).
  const data = createPartAssetUploadUrlSchema.parse(input);
  await requireAdmin();
  ensureR2Enabled();

  // Part must exist before we mint a key under its prefix.
  await db.part.findUniqueOrThrow({
    where: { id: data.partId },
    select: { id: true },
  });

  const cfg = ASSET_KIND_CONFIG[data.kind];
  const r2Key = partAssetKey(
    data.partId,
    data.kind,
    createId(),
    extOf(data.filename),
  );
  const uploadUrl = await presignPut(r2Key, cfg.contentType, data.byteSize);

  // The client MUST echo this exact contentType in the PUT Content-Type header
  // (R2's presigned signature requires the request header match the signed
  // ContentType — and KiCad files report an empty file.type in browsers).
  return { uploadUrl, r2Key, contentType: cfg.contentType };
}

// ─── createPartAssetRenderUploadUrl ─────────────────────
/**
 * Mint a presigned PUT for a part's DERIVED .glb render (produced client-side by
 * `convertToGlb`). Kind is implicitly MODEL_3D (only models have a render). The
 * forced content-type is RENDER_MIME ("model/gltf-binary"); the client MUST echo
 * it in the PUT Content-Type header (R2 signature match). Returns the minted key
 * so the client can pass it to `recordPartAsset` as `renderKey`.
 */
export async function createPartAssetRenderUploadUrl(
  input: unknown,
): Promise<{ uploadUrl: string; renderKey: string; contentType: string }> {
  const data = createPartAssetRenderUploadUrlSchema.parse(input);
  await requireAdmin();
  ensureR2Enabled();
  await db.part.findUniqueOrThrow({ where: { id: data.partId }, select: { id: true } });

  const renderKey = partRenderKey(data.partId, createId());
  const uploadUrl = await presignPut(renderKey, RENDER_MIME, data.byteSize);
  return { uploadUrl, renderKey, contentType: RENDER_MIME };
}

// ─── recordPartAsset ────────────────────────────────────
/**
 * Record the PartAsset row after the client PUT succeeds. HEADs the R2 object to
 * confirm it exists + the actual ContentLength doesn't exceed the declared
 * byteSize OR the kind cap (oversize → DeleteObject + reject). Upserts on the
 * compound-unique `partId_kind` selector: CREATE trusts the schema default
 * (UNVERIFIED) and sets the kind's content-type; a REPLACE (update) repoints
 * r2Key/filename/byteSize/contentType AND re-enters UNVERIFIED + clears the
 * verifier — a replaced file must be re-verified. ref/source/license are left
 * as-is on update (managed by editPartAsset).
 */
export async function recordPartAsset(input: unknown): Promise<PartAsset> {
  const data = recordPartAssetSchema.parse(input);
  const user = await requireAdmin();
  ensureR2Enabled();

  // Part must exist (a clean error beats a Prisma FK violation).
  await db.part.findUniqueOrThrow({
    where: { id: data.partId },
    select: { id: true },
  });

  const cfg = ASSET_KIND_CONFIG[data.kind];
  // HEAD the uploaded object + enforce the declared size AND the kind cap.
  // Oversize deletes the orphan and throws (load-bearing per part-datasheet.ts).
  const actual = await headVerifySize(data.r2Key, data.byteSize, cfg.maxBytes);

  // Optional derived render: HEAD-verify the uploaded .glb (best-effort — a
  // failed verify just drops the render; the source asset still records).
  let render: { renderKey: string; renderBytes: number; renderMime: string; renderBounds: unknown } | null = null;
  if (data.renderKey && data.renderBytes) {
    try {
      const actualRender = await headVerifySize(data.renderKey, data.renderBytes, RENDER_MAX_BYTES);
      render = {
        renderKey: data.renderKey,
        renderBytes: actualRender,
        renderMime: RENDER_MIME,
        renderBounds: data.renderBounds ?? null,
      };
    } catch {
      render = null; // render is non-load-bearing; never block the source record
    }
  }

  // Capture the PRIOR render key so a replace can clean up the stale .glb after.
  const prior = await db.partAsset.findUnique({
    where: { partId_kind: { partId: data.partId, kind: data.kind } },
    select: { renderKey: true },
  });

  // CREATE source SUGGESTION: prefer the source the client extracted/sent;
  // otherwise inherit it from a sibling asset of the same part (e.g. the SYMBOL
  // uploaded first from the same SnapEDA/SamacSys download). Footprints
  // (.kicad_mod) and 3D models (.step — binary) often carry no generator
  // signature of their own, so without this the curator must re-type a source
  // they already entered. Still an UNVERIFIED suggestion — the human reviews +
  // can override. CREATE-only (the update/replace branch never touches source).
  let createSource = data.source ?? null;
  if (!createSource) {
    const sibling = await db.partAsset.findFirst({
      where: { partId: data.partId, source: { not: null } },
      select: { source: true },
      orderBy: { createdAt: "asc" },
    });
    createSource = sibling?.source ?? null;
  }

  // @@unique([partId, kind]) → a replacement upserts in place. A new file
  // ALWAYS re-enters UNVERIFIED (a replaced asset must be re-verified): we keep
  // the metadata (ref/source/license — managed by editPartAsset) but clear the
  // verifier. CREATE trusts the schema default (UNVERIFIED).
  const asset = await db.partAsset.upsert({
    where: { partId_kind: { partId: data.partId, kind: data.kind } },
    create: {
      partId: data.partId,
      kind: data.kind,
      r2Key: data.r2Key,
      filename: data.filename,
      byteSize: actual,
      contentType: cfg.contentType,
      createdById: user.id,
      // CREATE-ONLY: pre-seed the auto-extracted KiCad ref/source (from
      // `@/lib/kicad-meta`) as a STARTING SUGGESTION on the fresh UNVERIFIED row
      // (the schema default keeps trust UNVERIFIED — this never auto-verifies).
      // The UPDATE (replace) branch deliberately OMITS ref/source so a replaced
      // file never clobbers a human's edited metadata (extracted values from a
      // replaced file are intentionally ignored in v1).
      ref: data.ref ?? null,
      source: createSource,
      renderKey: render?.renderKey ?? null,
      renderBytes: render?.renderBytes ?? null,
      renderMime: render?.renderMime ?? null,
      renderBounds: render?.renderBounds ?? Prisma.JsonNull,
    },
    update: {
      r2Key: data.r2Key,
      filename: data.filename,
      byteSize: actual,
      contentType: cfg.contentType,
      trust: "UNVERIFIED",
      verifiedById: null,
      verifiedAt: null,
      lastEditedById: user.id,
      // A replace ALWAYS repoints the render, even to null (conversion failed).
      renderKey: render?.renderKey ?? null,
      renderBytes: render?.renderBytes ?? null,
      renderMime: render?.renderMime ?? null,
      renderBounds: render?.renderBounds ?? Prisma.JsonNull,
    },
  });

  // Best-effort delete the OLD render object when a replace repointed it
  // (orphan is the accepted fallback, same as the source cleanup policy).
  if (prior?.renderKey && prior.renderKey !== render?.renderKey) {
    if (env.R2_ENABLED && env.R2_BUCKET) {
      try { await deleteR2Object(prior.renderKey); } catch { /* swept later */ }
    }
  }

  revalidatePartRoute(data.partId);
  return asset;
}

// ─── getPartAssetDownloadUrl ────────────────────────────
/**
 * Presigned GET for a part's per-kind asset, or `null` when R2 is off / no row
 * exists. Returning `null` (rather than throwing on the disabled / missing path)
 * is deliberate: the part page calls this server-side and renders the download
 * link only when a URL comes back.
 */
export async function getPartAssetDownloadUrl(
  partId: string,
  kind: unknown,
): Promise<string | null> {
  const k = z.enum(PART_ASSET_KINDS).parse(kind);
  await requireUser();
  if (!env.R2_ENABLED || !env.R2_BUCKET) return null;

  const asset = await db.partAsset.findUnique({
    where: { partId_kind: { partId, kind: k } },
    select: { r2Key: true, filename: true },
  });
  // Pass the filename so the GET forces a download (KiCad files aren't viewable
  // inline; symbols/footprints are text and would otherwise render in the tab).
  return asset ? presignGet(asset.r2Key, asset.filename) : null;
}

// ─── getPartAssetRenderUrl ──────────────────────────────
/**
 * Inline presigned GET for a part's MODEL_3D render `.glb`, or null when R2 is
 * off / no render exists. NOT `requireUser`-gated and NOT trust-gated: viewing
 * is how a curator verifies, and the part page is the auth boundary. Uses
 * `presignGetInline` (no attachment disposition) so the browser can fetch it.
 */
export async function getPartAssetRenderUrl(partId: string): Promise<string | null> {
  if (!env.R2_ENABLED || !env.R2_BUCKET) return null;
  const asset = await db.partAsset.findUnique({
    where: { partId_kind: { partId, kind: "MODEL_3D" } },
    select: { renderKey: true },
  });
  return asset?.renderKey ? presignGetInline(asset.renderKey) : null;
}
