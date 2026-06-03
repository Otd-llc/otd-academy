# Parts CAD Assets (KiCad) — Stage C Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (fresh subagent per task + a code-review subagent between tasks) to implement this plan task-by-task. Fix Critical/Important review findings before the next task.

**Goal:** Turn each part into a **design-ready KiCad bundle** — upload + verify + download a per-part **symbol (`.kicad_sym`) / footprint (`.kicad_mod`) / 3D model (`.step`)** (the datasheet already landed in Stage A), each behind the same human verify gate, over the same R2 pipeline.

**Architecture:** A new **`PartAsset { kind: SYMBOL | FOOTPRINT | MODEL_3D }`** model (one row per `(part, kind)`), with its own trust/verify columns reusing the `FactTrust` enum. Uploads reuse the Stage A presigned-PUT pipeline ([part-datasheet.ts](../../src/lib/actions/part-datasheet.ts) + [r2.ts](../../src/lib/r2.ts) + the live CORS), parameterized **per kind** (extension allowlist + forced content-type + size cap). DB-only gate actions (verify / flag / clear / unverify / edit-metadata) mirror the just-merged [part-facts.ts](../../src/lib/actions/part-facts.ts) gate (`requireUser`, optimistic-lock on `updatedAt`, field-granular auto-demote). The detail page gains an **Assets** section (3 rows) beside the existing Datasheet, reusing `VerifyBadge` + the gate-control pattern. The **BOM → KiCad-library export is the explicit next phase** (design §7) and is OUT of scope here.

**Tech Stack:** Prisma 7 + Neon · `@aws-sdk/client-s3` + `s3-request-presigner` (R2) · Zod 4 · Next.js 16 (RSC + client islands) · Vitest (node, real Neon, sequential). Design source of truth: [docs/plans/2026-06-03-parts-cad-assets-design.md](2026-06-03-parts-cad-assets-design.md). Stage A datasheet pattern this generalizes: [part-datasheet.ts](../../src/lib/actions/part-datasheet.ts) + [part-datasheet-actions.test.ts](../../src/lib/__tests__/part-datasheet-actions.test.ts).

**Live infra (verified 2026-06-03 — NO infra-authorization gate):** R2 is **already enabled** — `R2_ENABLED=true`, bucket `foundry-prod`, credentials in `.env.local`, and bucket CORS is applied (`scripts/set-r2-cors.ts`). The browser→R2 PUT the datasheet uses works today; the larger `.step` PUT rides the same CORS and fits under the pipeline's 100 MB ceiling (`MAX_UPLOAD_BYTES`). No Neon role, no CORS change, no Vercel change needed.

**Conventions (carry these):**
- **Windows/PowerShell**: prefix pnpm with `$env:Path = "c:/Users/raven/.local/bin;" + $env:Path`. `pnpm exec tsx scripts/*` is allowlisted.
- **Branch**: `git switch -c feature/parts-cad-assets` off `main` before any commit. Commit/push only when the human asks.
- **Commit trailer**: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Migrations**: `prisma migrate dev` is non-interactive-blocked here. **NEVER `migrate reset`** (wipes curriculum + the now-curated AP2112 pinout). Hand-write the migration SQL into a new timestamped folder, then `prisma migrate deploy` (Task 1 gives the exact SQL).
- **`"use server"` files export ONLY async functions** — no `export type { X }` re-exports (crashes at runtime, uncaught by tsc/build). Put pure helpers (`shouldDemoteAsset`, config) in non-`"use server"` modules.
- **Tests**: Vitest, real Neon, sequential. Mock `@/auth` + `next/cache` like [part-facts-actions.test.ts](../../src/lib/__tests__/part-facts-actions.test.ts); mock `@/env` (R2 off) for the upload-gate test like [part-datasheet-actions.test.ts](../../src/lib/__tests__/part-datasheet-actions.test.ts). Throwaway rows in `beforeAll`/`afterAll` asserting zero leftovers; never touch curriculum/seed data.

**Design decisions baked in (flag on review if you disagree):**
1. **Validate by file EXTENSION, not browser `file.type`** — `.kicad_sym`/`.kicad_mod`/`.step` usually report an *empty* `file.type` in browsers. The server **forces** a per-kind content-type, signs it into the presigned PUT, and the client echoes that exact value (R2's signature requires the PUT `Content-Type` header match the signed one).
2. **Per-kind size caps** (all ≤ `MAX_UPLOAD_BYTES` = 100 MB): `SYMBOL`/`FOOTPRINT` = 5 MB (text, tiny); `MODEL_3D` = 100 MB (the existing ceiling). Tunable.
3. **`license` = free text** (v1; design open item).
4. **Include `unverifyPartAsset`** for parity with the fact gate's just-merged undo (the design predates it).
5. **Do NOT auto-sync `Part.footprint` ↔ `PartAsset.ref`** in v1 — `ref` is the asset's own field (design open item).
6. **Shared R2 helpers**: the new asset upload actions reuse `r2.ts` primitives via a small shared `part-r2.ts`; **`part-datasheet.ts` is left untouched** (retrofitting it onto the shared helper is a deferred cleanup — avoid churning the just-verified Stage A path).

---

## Step 0 — Branch (pre-flight)

```powershell
git switch main; git switch -c feature/parts-cad-assets
```
Confirm a clean tree first (only the gitignored `.claude/settings.local.json` + pre-existing untracked files are expected).

---

## Task 1 — Migration: `PartAssetKind` enum + `PartAsset` model

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<ts>_parts_cad_assets/migration.sql`
- Test: `src/lib/__tests__/part-asset-model.test.ts`

**Step 1 — schema.** Add to `prisma/schema.prisma` (near the Stage A parts-knowledge block):
```prisma
enum PartAssetKind {
  SYMBOL
  FOOTPRINT
  MODEL_3D
}

model PartAsset {
  id             String        @id @default(cuid())
  partId         String
  part           Part          @relation(fields: [partId], references: [id], onDelete: Cascade)
  kind           PartAssetKind
  r2Key          String        // parts/{partId}/{kind}-{cuid}.{ext}
  filename       String
  byteSize       Int
  contentType    String
  ref            String?       // symbol/footprint name (sym-lib-table descr data)
  source         String?       // SnapEDA | SamacSys | Ultra Librarian | manufacturer | hand-made
  license        String?
  trust          FactTrust     @default(UNVERIFIED)
  verifiedById   String?
  verifiedAt     DateTime?
  lastEditedById String?
  createdById    String
  createdBy      User          @relation(fields: [createdById], references: [id], onDelete: Restrict)
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  @@unique([partId, kind])
  @@index([trust])
}
```
Add `assets PartAsset[]` to `model Part`, and `partAssets PartAsset[]` to `model User` (the back-relation for `createdBy`).

**Step 2 — migration SQL.** Create `prisma/migrations/<ts>_parts_cad_assets/migration.sql` (use a real timestamp, e.g. `20260603T...`; match the existing folder naming `YYYYMMDDHHMMSS_name`). You may generate a draft with `pnpm exec prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script` and hand-verify it equals:
```sql
-- CreateEnum
CREATE TYPE "PartAssetKind" AS ENUM ('SYMBOL', 'FOOTPRINT', 'MODEL_3D');

-- CreateTable
CREATE TABLE "PartAsset" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "kind" "PartAssetKind" NOT NULL,
    "r2Key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "ref" TEXT,
    "source" TEXT,
    "license" TEXT,
    "trust" "FactTrust" NOT NULL DEFAULT 'UNVERIFIED',
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "lastEditedById" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PartAsset_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "PartAsset_partId_kind_key" ON "PartAsset"("partId", "kind");
CREATE INDEX "PartAsset_trust_idx" ON "PartAsset"("trust");

-- FKs
ALTER TABLE "PartAsset" ADD CONSTRAINT "PartAsset_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartAsset" ADD CONSTRAINT "PartAsset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```
Then apply + regenerate the client:
```powershell
$env:Path = "c:/Users/raven/.local/bin;" + $env:Path
pnpm exec prisma migrate deploy
pnpm exec prisma generate
```

**Step 3 — failing test** `src/lib/__tests__/part-asset-model.test.ts`: create a throwaway Part + a `PartAsset` (kind `SYMBOL`, `contentType "text/plain"`), read it back, assert defaults (`trust: "UNVERIFIED"`); assert `@@unique([partId, kind])` rejects a second `SYMBOL` on the same part (and ALLOWS a `FOOTPRINT`). Mirror the isolation/teardown of `part-datasheet-actions.test.ts` (throwaway part ids, `afterAll` cascade-delete + zero-leftover sweep).

**Step 4 — run + commit:**
```powershell
pnpm exec vitest run src/lib/__tests__/part-asset-model.test.ts
pnpm exec tsc --noEmit
git add prisma/schema.prisma prisma/migrations src/lib/__tests__/part-asset-model.test.ts
git commit -m "feat(parts): migration — PartAssetKind enum + PartAsset model"
```

---

## Task 2 — Per-kind config + schemas (`part-asset.ts`)

**Files:**
- Create: `src/lib/schemas/part-asset.ts`
- Test: `src/lib/__tests__/part-asset-schema.test.ts`

**Step 1 — failing tests** covering: each kind's config (exts/contentType/cap); the upload schema's `superRefine` REJECTS a wrong extension for the kind (e.g. `.png` for `SYMBOL`, `.kicad_sym` for `MODEL_3D`) and a too-large `byteSize` (> the kind cap), ACCEPTS a correct one (case-insensitive ext); `shouldDemoteAsset` returns true when `ref` OR `source` changes and false for a `license`-only change (mirrors the fact `shouldDemote` cases).

**Step 2 — implement** `src/lib/schemas/part-asset.ts`. This is a PURE module (no `"use server"`):
```ts
import { z } from "zod";
import { MAX_UPLOAD_BYTES } from "@/lib/schemas/upload";

export const PART_ASSET_KINDS = ["SYMBOL", "FOOTPRINT", "MODEL_3D"] as const;
export type PartAssetKindT = (typeof PART_ASSET_KINDS)[number];

/** Per-kind upload policy: allowed extensions, the SERVER-FORCED content-type
 *  (signed into the PUT + echoed by the client), and the size cap. KiCad files
 *  report an empty browser `file.type`, so we validate by EXTENSION and force
 *  the content-type ourselves. */
export const ASSET_KIND_CONFIG: Record<
  PartAssetKindT,
  { exts: readonly string[]; contentType: string; maxBytes: number; label: string }
> = {
  SYMBOL:    { exts: [".kicad_sym"], contentType: "text/plain",               maxBytes: 5 * 1024 * 1024, label: "Symbol" },
  FOOTPRINT: { exts: [".kicad_mod"], contentType: "text/plain",               maxBytes: 5 * 1024 * 1024, label: "Footprint" },
  MODEL_3D:  { exts: [".step", ".stp", ".wrl"], contentType: "application/octet-stream", maxBytes: MAX_UPLOAD_BYTES, label: "3D Model" },
};

/** Lowercased extension incl. the dot, e.g. "ESP32.STEP" → ".step". "" if none. */
export function extOf(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i < 0 ? "" : filename.slice(i).toLowerCase();
}

export function isExtAllowed(kind: PartAssetKindT, filename: string): boolean {
  return ASSET_KIND_CONFIG[kind].exts.includes(extOf(filename));
}

export const createPartAssetUploadUrlSchema = z
  .object({
    partId: z.cuid(),
    kind: z.enum(PART_ASSET_KINDS),
    filename: z.string().trim().min(1).max(255),
    byteSize: z.int().positive().max(MAX_UPLOAD_BYTES),
  })
  .superRefine((v, ctx) => {
    const cfg = ASSET_KIND_CONFIG[v.kind];
    if (!isExtAllowed(v.kind, v.filename)) {
      ctx.addIssue({ code: "custom", path: ["filename"],
        message: `${v.kind} must be one of: ${cfg.exts.join(", ")}` });
    }
    if (v.byteSize > cfg.maxBytes) {
      ctx.addIssue({ code: "custom", path: ["byteSize"],
        message: `${v.kind} exceeds the ${Math.round(cfg.maxBytes / 1024 / 1024)} MB cap.` });
    }
  });

export const recordPartAssetSchema = z.object({
  partId: z.cuid(),
  kind: z.enum(PART_ASSET_KINDS),
  r2Key: z.string().trim().min(1).max(1024),
  filename: z.string().trim().min(1).max(255),
  byteSize: z.int().positive().max(MAX_UPLOAD_BYTES),
});

/** Metadata edit (no file). `.strict()` so a typo'd key is rejected, not dropped. */
export const editPartAssetSchema = z
  .object({
    id: z.cuid(),
    updatedAt: z.coerce.date(),
    ref: z.string().trim().max(200).optional(),
    source: z.string().trim().max(200).optional(),
    license: z.string().trim().max(200).optional(),
  })
  .strict();

/** Pure auto-demote decision: a `ref` OR `source` change demotes a VERIFIED
 *  asset; a `license`-only change does NOT (cosmetic). Mirrors fact shouldDemote. */
export function shouldDemoteAsset(
  stored: { ref: string | null; source: string | null },
  next: { ref?: string | null; source?: string | null },
): boolean {
  const norm = (s: string | null | undefined) => (s == null || s === "" ? null : s);
  return norm(stored.ref) !== norm(next.ref) || norm(stored.source) !== norm(next.source);
}
```

**Step 3 — run + commit:**
```powershell
pnpm exec vitest run src/lib/__tests__/part-asset-schema.test.ts
pnpm exec tsc --noEmit
git add src/lib/schemas/part-asset.ts src/lib/__tests__/part-asset-schema.test.ts
git commit -m "feat(parts): PartAsset schemas — per-kind ext/cap + demote decision"
```

---

## Task 3 — R2 key helper + shared upload helpers (`part-r2.ts`)

**Files:**
- Modify: `src/lib/r2.ts` (add `partAssetKey`)
- Create: `src/lib/part-r2.ts` (shared presign/HEAD-verify/download, reused by the asset actions)
- Test: `src/lib/__tests__/part-r2.test.ts` (key shape only — the live R2 ops are covered by the gate test in Task 5 + manual)

**Step 1 — `r2.ts` key.** Append:
```ts
import type { PartAssetKindT } from "@/lib/schemas/part-asset";
// Part-scoped CAD asset key (design §2). parts/{partId}/{kind}-{cuid}.{ext}
export function partAssetKey(
  partId: string, kind: PartAssetKindT, cuid: string, ext: string,
): string {
  const e = ext.startsWith(".") ? ext.slice(1) : ext;
  return `parts/${partId}/${kind.toLowerCase()}-${cuid}.${e}`;
}
```
> Note: `r2.ts` currently has no `@/lib/schemas/*` import; importing the TYPE only (`import type`) keeps it dependency-light and erases at compile.

**Step 2 — `part-r2.ts`** (NOT `"use server"` — plain helpers; the `"use server"` actions in Task 5 call these):
```ts
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/env";
import { r2 } from "@/lib/r2";

const PUT_TTL_SECONDS = 900;
const GET_TTL_SECONDS = 300;

export function ensureR2Enabled(): void {
  if (!env.R2_ENABLED) {
    throw new Error("R2 file storage is not enabled on this deployment. Set R2_ENABLED=true and configure R2_* credentials.");
  }
  if (!env.R2_BUCKET) throw new Error("R2_BUCKET is not configured.");
}

export function presignPut(key: string, contentType: string, byteSize: number) {
  return getSignedUrl(r2, new PutObjectCommand({
    Bucket: env.R2_BUCKET!, Key: key, ContentLength: byteSize, ContentType: contentType,
  }), { expiresIn: PUT_TTL_SECONDS });
}

/** HEAD the uploaded object; on oversize (vs declared OR the cap) delete the
 *  orphan and throw. Returns the actual ContentLength to record. */
export async function headVerifySize(key: string, declaredBytes: number, maxBytes: number): Promise<number> {
  const head = await r2.send(new HeadObjectCommand({ Bucket: env.R2_BUCKET!, Key: key }));
  const actual = head.ContentLength ?? 0;
  if (actual > declaredBytes || actual > maxBytes) {
    await r2.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET!, Key: key }));
    throw new Error(`Uploaded file exceeds declared size (${actual} > ${declaredBytes}).`);
  }
  return actual;
}

export function presignGet(key: string) {
  return getSignedUrl(r2, new GetObjectCommand({ Bucket: env.R2_BUCKET!, Key: key }), { expiresIn: GET_TTL_SECONDS });
}
```

**Step 3 — test** `part-r2.test.ts`: assert `partAssetKey("p1","MODEL_3D","abc",".STEP") === "parts/p1/model_3d-abc.step"` and the symbol/footprint shapes. Run + commit:
```powershell
pnpm exec vitest run src/lib/__tests__/part-r2.test.ts
pnpm exec tsc --noEmit
git add src/lib/r2.ts src/lib/part-r2.ts src/lib/__tests__/part-r2.test.ts
git commit -m "feat(parts): partAssetKey + shared R2 presign/head/download helpers"
```

---

## Task 4 — DB-only gate actions (verify / flag / clear / unverify / edit) + form wrappers

The trust-gate half — no R2. A near-clone of [part-facts.ts](../../src/lib/actions/part-facts.ts) over `PartAsset`. Fully testable against real Neon.

**Files:**
- Create: `src/lib/actions/part-assets.ts` (the gate actions; the R2 upload actions arrive in Task 5 in the SAME file)
- Create: `src/lib/actions/part-assets-form.ts` (client wrappers, mirrors [part-facts-form.ts](../../src/lib/actions/part-facts-form.ts))
- Test: `src/lib/__tests__/part-assets-actions.test.ts`

**Step 1 — failing tests** (real Neon; mock `@/auth` + `next/cache` like `part-facts-actions.test.ts`; throwaway Part + PartAsset rows, zero-leftover teardown):
- `verifyPartAsset`: precondition **`source` non-empty** ⇒ VERIFIED (+ `verifiedById`/`verifiedAt`); empty `source` ⇒ rejected; self-verify allowed; a FLAGGED row can't be verified.
- `editPartAsset`: a `ref` OR `source` change auto-demotes VERIFIED→UNVERIFIED + clears verifier; a `license`-only change stays VERIFIED; `.strict()` rejects a typo'd key.
- Optimistic concurrency: stale `updatedAt` on edit/verify/unverify ⇒ rejected ("reload"), no write.
- `flagPartAsset` ⇒ FLAGGED; `clearPartAssetFlag` ⇒ UNVERIFIED only; `unverifyPartAsset` ⇒ VERIFIED→UNVERIFIED (clears verifier), rejects non-VERIFIED, does NOT un-flag FLAGGED (pin `trust:"VERIFIED"` in WHERE).

**Step 2 — implement** `src/lib/actions/part-assets.ts` (gate half). Mirror `part-facts.ts` exactly: `idWithLockSchema` ({id, updatedAt}, `.strict()`); `CONFLICT_MESSAGE`; `revalidatePath(\`/parts/${partId}\`)`; conditional `updateMany({ where: { id, updatedAt, trust: <pin> }, data })` with `count===0 ⇒ throw CONFLICT_MESSAGE`. Sketch of the distinctive bits:
```ts
"use server";
import { type PartAsset } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { editPartAssetSchema, shouldDemoteAsset } from "@/lib/schemas/part-asset";
// ... idWithLockSchema + CONFLICT_MESSAGE local (or shared) ...

export async function verifyPartAsset(input: unknown): Promise<PartAsset> {
  const { id, updatedAt } = idWithLockSchema.parse(input);
  const user = await requireUser();
  const row = await db.partAsset.findUniqueOrThrow({ where: { id }, select: { partId: true, trust: true, source: true } });
  if (row.trust === "FLAGGED") throw new Error("A flagged asset must be cleared and re-reviewed before it can be verified.");
  if (!row.source || row.source.trim().length === 0) throw new Error("Cannot verify: an asset needs a stated source (its provenance basis).");
  const { count } = await db.partAsset.updateMany({
    where: { id, updatedAt, trust: { not: "FLAGGED" } },
    data: { trust: "VERIFIED", verifiedById: user.id, verifiedAt: new Date() },
  });
  if (count === 0) throw new Error(CONFLICT_MESSAGE);
  revalidatePath(`/parts/${row.partId}`);
  return db.partAsset.findUniqueOrThrow({ where: { id } });
}

export async function editPartAsset(input: unknown): Promise<PartAsset> {
  const env_ = editPartAssetSchema.parse(input);
  const user = await requireUser();
  const existing = await db.partAsset.findUniqueOrThrow({ where: { id: env_.id }, select: { partId: true, trust: true, ref: true, source: true } });
  const demote = existing.trust === "VERIFIED" && shouldDemoteAsset(existing, { ref: env_.ref, source: env_.source });
  const { count } = await db.partAsset.updateMany({
    where: { id: env_.id, updatedAt: env_.updatedAt },
    data: {
      ref: env_.ref ?? null, source: env_.source ?? null, license: env_.license ?? null,
      lastEditedById: user.id,
      ...(demote ? { trust: "UNVERIFIED", verifiedById: null, verifiedAt: null } : {}),
    },
  });
  if (count === 0) throw new Error(CONFLICT_MESSAGE);
  revalidatePath(`/parts/${existing.partId}`);
  return db.partAsset.findUniqueOrThrow({ where: { id: env_.id } });
}
// unverifyPartAsset / flagPartAsset / clearPartAssetFlag: copy part-facts.ts's
// unverifyFact / flagFact / clearFlag verbatim, swapping db.partFact → db.partAsset.
```
> ⚠️ `editPartAsset` writes `ref/source/license` as `?? null`, so an edit that omits a field CLEARS it. The inline editor (Task 6) must always send all three current values. (Same contract as the fact editor's strict envelope.)

`part-assets-form.ts`: `editPartAssetForm`, `verifyPartAssetForm`, `unverifyPartAssetForm`, `flagPartAssetForm`, `clearPartAssetFlagForm` — each `dispatch(() => action(input))`, identical shell to `part-facts-form.ts`.

**Step 3 — run + commit:**
```powershell
pnpm exec vitest run src/lib/__tests__/part-assets-actions.test.ts
pnpm exec tsc --noEmit
git add src/lib/actions/part-assets.ts src/lib/actions/part-assets-form.ts src/lib/__tests__/part-assets-actions.test.ts
git commit -m "feat(parts): PartAsset gate actions (verify/flag/clear/unverify/edit) + wrappers"
```

---

## Task 5 — R2 upload actions (create-url / record / download) + R2-gate test

**Files:**
- Modify: `src/lib/actions/part-assets.ts` (add the 3 R2 actions)
- Test: `src/lib/__tests__/part-assets-r2.test.ts`

**Step 1 — failing tests** (mock `@/env` to force `R2_ENABLED: false`, spreading the real env so Neon stays live — copy the mock from `part-datasheet-actions.test.ts`):
- `createPartAssetUploadUrl` throws the R2-disabled error when off; and (R2 off, but Zod runs first) REJECTS a wrong extension (`.png` for `SYMBOL`) and an oversize `byteSize` via the schema `superRefine`.
- `recordPartAsset` throws R2-disabled AND writes no `PartAsset` row.
- `getPartAssetDownloadUrl(partId, kind)` returns `null` when R2 off (even with a row present) and when no row exists.

**Step 2 — implement** the 3 actions in `part-assets.ts`, reusing `part-r2.ts` + `ASSET_KIND_CONFIG`:
```ts
import { createId } from "@paralleldrive/cuid2";
import { partAssetKey } from "@/lib/r2";
import { ensureR2Enabled, presignPut, headVerifySize, presignGet } from "@/lib/part-r2";
import { ASSET_KIND_CONFIG, createPartAssetUploadUrlSchema, recordPartAssetSchema, extOf } from "@/lib/schemas/part-asset";

export async function createPartAssetUploadUrl(input: unknown): Promise<{ uploadUrl: string; r2Key: string; contentType: string }> {
  const data = createPartAssetUploadUrlSchema.parse(input); // ext + cap enforced here
  await requireUser();
  ensureR2Enabled();
  await db.part.findUniqueOrThrow({ where: { id: data.partId }, select: { id: true } });
  const cfg = ASSET_KIND_CONFIG[data.kind];
  const r2Key = partAssetKey(data.partId, data.kind, createId(), extOf(data.filename));
  const uploadUrl = await presignPut(r2Key, cfg.contentType, data.byteSize);
  return { uploadUrl, r2Key, contentType: cfg.contentType }; // client MUST send this exact contentType
}

export async function recordPartAsset(input: unknown): Promise<PartAsset> {
  const data = recordPartAssetSchema.parse(input);
  const user = await requireUser();
  ensureR2Enabled();
  await db.part.findUniqueOrThrow({ where: { id: data.partId }, select: { id: true } });
  const actual = await headVerifySize(data.r2Key, data.byteSize, ASSET_KIND_CONFIG[data.kind].maxBytes);
  const cfg = ASSET_KIND_CONFIG[data.kind];
  // @@unique([partId, kind]): replace upserts in place. A new file ALWAYS
  // re-enters UNVERIFIED (a replaced asset must be re-verified) — keep the
  // metadata (ref/source/license) but clear the verifier.
  const asset = await db.partAsset.upsert({
    where: { partId_kind: { partId: data.partId, kind: data.kind } },
    create: { partId: data.partId, kind: data.kind, r2Key: data.r2Key, filename: data.filename, byteSize: actual, contentType: cfg.contentType, createdById: user.id },
    update: { r2Key: data.r2Key, filename: data.filename, byteSize: actual, contentType: cfg.contentType, trust: "UNVERIFIED", verifiedById: null, verifiedAt: null, lastEditedById: user.id },
  });
  revalidatePath(`/parts/${data.partId}`);
  return asset;
}

export async function getPartAssetDownloadUrl(partId: string, kind: unknown): Promise<string | null> {
  const k = z.enum(PART_ASSET_KINDS).parse(kind);
  await requireUser();
  if (!env.R2_ENABLED || !env.R2_BUCKET) return null;
  const asset = await db.partAsset.findUnique({ where: { partId_kind: { partId, kind: k } }, select: { r2Key: true } });
  return asset ? presignGet(asset.r2Key) : null;
}
```
> The upsert `where` uses the compound-unique selector `partId_kind` Prisma generates from `@@unique([partId, kind])`.

**Step 3 — run + commit:**
```powershell
pnpm exec vitest run src/lib/__tests__/part-assets-r2.test.ts
pnpm exec tsc --noEmit
git add src/lib/actions/part-assets.ts src/lib/__tests__/part-assets-r2.test.ts
git commit -m "feat(parts): PartAsset R2 upload/record/download actions"
```

---

## Task 6 — UI: Assets section (upload + row + gate controls)

**Files:**
- Create: `src/components/parts/AssetUpload.tsx` (generalize `DatasheetUpload`)
- Create: `src/components/parts/AssetRow.tsx`
- Modify: `src/app/parts/[id]/page.tsx` (add the Assets section)
- (No DOM harness — verify via `pnpm run build` + manual.)

**Step 1 — `AssetUpload.tsx`** — a client island parameterized by `kind`, generalizing `DatasheetUpload`: the `<input accept>` is the kind's exts; validate the picked file's extension client-side (`isExtAllowed`); run `createPartAssetUploadUrl({ partId, kind, filename, byteSize })` → `fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: file })` **using the `contentType` returned by the action** (NOT `file.type`) → `recordPartAsset({ partId, kind, r2Key, filename, byteSize })` → `router.refresh()`. Label "Upload"/"Replace {label}".

**Step 2 — `AssetRow.tsx`** — one kind's row: the trust `VerifyBadge`, the filename + a download link (presigned GET passed from the server), the gate IconButtons (Verify when UNVERIFIED · Undo-verify when VERIFIED · Flag/Clear-flag — copy the conditional block from [FactGroupCard.tsx](../../src/components/parts/FactGroupCard.tsx) lines ~330-394, swapping the `*PartAsset*Form` wrappers), the inline **ref / source / license** editor (dispatch `editPartAssetForm` with all three values + the loaded `updatedAt`; surface the optimistic-lock/precondition `message`), and an `AssetUpload` for replace. A missing asset renders just `AssetUpload`.

**Step 3 — detail page.** In `src/app/parts/[id]/page.tsx`: `include: { ..., assets: true }`; build `assetByKind` like `factByGroup`; for each kind in `PART_ASSET_KINDS`, server-resolve a presigned download URL (`r2Enabled && canEdit && asset ? await getPartAssetDownloadUrl(part.id, kind) : null`, mirroring `cachedDatasheetUrl`); render an **"Assets"** `<section>` (heading + 3 `AssetRow`s) after the datasheet section. The `AssetUpload` controls render only when `r2Enabled && canEdit` (same gate as `DatasheetUpload`).

**Step 4 — verify + commit:**
```powershell
pnpm exec tsc --noEmit
pnpm run build
git add src/components/parts/AssetUpload.tsx src/components/parts/AssetRow.tsx "src/app/parts/[id]/page.tsx"
git commit -m "feat(parts): part-detail Assets section (upload/verify/download per kind)"
```

---

## Task 7 — Live demo + finish the branch

**Step 1 — full suite + build, all green:**
```powershell
$env:Path = "c:/Users/raven/.local/bin;" + $env:Path
pnpm exec tsc --noEmit
pnpm exec vitest run
pnpm run build
```

**Step 2 — live demo (the design's success criteria).** On the running app (deployed or `next dev`), signed in, open a pilot part (e.g. the AP2112 `/parts/cmpxnfjkl0001a8uvokhe4vlh`). For each kind, upload a real KiCad file (a `.kicad_sym`, a `.kicad_mod`, a `.step` — e.g. from `C:\zzz\otd\hardware\schematic\test-boards\TB-1-POWER\libs`), set its **source** (and license/ref), click **Verify** (it gates on source present), confirm the badge flips, the **download** link returns the file, and **Undo verify** / **Replace** behave (replace re-enters UNVERIFIED). This rides the live R2 + CORS — no infra setup.

**Step 3 — finish.** > **REQUIRED SUB-SKILL:** Use superpowers:finishing-a-development-branch — verify the suite, push `feature/parts-cad-assets`, open the PR (`env -u GH_TOKEN gh ...`, handle `joshtol`), and merge per the established flow.

---

## Done-when (Stage C)
`tsc` clean · `pnpm run build` passes · `pnpm exec vitest run` green (model, schema/ext/cap + demote, the DB-only gate actions incl. unverify + optimistic-lock, the R2-gate behavior) · on the running app a signed-in user can upload + set-source + **Verify** + download a part's symbol/footprint/3D-model, with replace re-entering UNVERIFIED and Undo-verify working — over the live R2 path.

## Out of scope (carried to the next phase — design §7)
The **BOM → KiCad-library export** (the `.pretty` + per-part `.kicad_sym` + generated `fp-lib-table`/`sym-lib-table` bundle — the headline payoff, its own phase); auto cross-checks (symbol pins vs the `PINOUT` fact-group; footprint pad count); SnapEDA/UL API import; unifying `PartDatasheet` into `PartAsset` (+ retrofitting `part-datasheet.ts` onto the shared `part-r2.ts` helpers); `lookup_part` reporting asset availability/verified-state for MCP grounding.
