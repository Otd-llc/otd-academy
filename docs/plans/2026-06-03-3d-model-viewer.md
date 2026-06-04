# In-App 3D Model Viewer — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or superpowers:subagent-driven-development) to implement this plan task-by-task.

**Goal:** Render a part's `MODEL_3D` CAD asset inline on `/parts/[id]` in an interactive three.js scene, via a reusable `<ModelViewer>` that also renders a manually-uploaded full-board model from the `Artifact` model.

**Architecture:** `.glb` is the render lingua franca. When a curator uploads a `.step`/`.stp`/`.wrl`, their **browser** tessellates it once (`occt-import-js` WASM) and exports a `.glb`; we store **both** the original source (download / CAD exchange) and the derived `.glb` (the render) — the `.glb` lives in new nullable `renderKey`/`renderBytes`/`renderMime`/`renderBounds` columns on the **same** `PartAsset` row. Every viewer loads only the small `.glb` through one `GLTFLoader` (no WASM shipped to viewers). The board stub mirrors the same columns on `Artifact`. No new server infra; conversion failure is non-fatal (the asset is still recorded download-only).

**Tech Stack:** Next.js 16 (App Router, RSC + client islands) · React 19 · TypeScript · Prisma 7 + Neon Postgres · Cloudflare R2 (S3 SDK, presigned URLs) · Zod 4 · **three.js** (`GLTFLoader` / `OrbitControls` / `GLTFExporter`) · **occt-import-js** (OpenCASCADE→WASM) · Vitest (real Neon, sequential).

**Design doc:** `docs/plans/2026-06-03-3d-model-viewer-design.md` (read it first).

---

## Conventions (apply to EVERY task)

- **Windows/PowerShell:** prefix pnpm with the local-bin PATH:
  `$env:Path = "c:/Users/raven/.local/bin;" + $env:Path` then `pnpm ...`.
- **`"use server"` files export ONLY async functions** — not even `export type {X}`. Pure helpers (schemas, the converter, bounds math, `presignGetInline`) live in NON-`"use server"` modules. (See memory `use-server-export-rule`.)
- **Migrations:** `prisma migrate dev` is interactive-blocked here. Hand-write SQL into a new timestamped folder, then `prisma migrate deploy`. **NEVER `prisma migrate reset`** (wipes curriculum + curated data).
- **Tests:** Vitest, real Neon, **sequential** (full suite ~6 min). Create throwaway rows in `beforeAll`, sweep in `afterAll` asserting zero leftovers. Never touch curriculum/seed data. Mock `next/cache` + `@/auth` as the existing tests do.
- **Commits:** end every commit message with the trailer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- **Branch:** `feature/3d-model-viewer` (already created; the design doc is committed there).
- **Run a single test file:** `pnpm exec vitest run src/lib/__tests__/<file>.test.ts`
- **Typecheck / build gates:** `pnpm exec tsc --noEmit` and `pnpm run build`.

---

## Task 0: Dependencies + occt WASM asset

**Files:**
- Modify: `package.json` (deps)
- Create: `public/occt-import-js.wasm` (copied from the package)
- Create: `scripts/copy-occt-wasm.cjs` (postinstall copy so the wasm survives clean installs)
- Modify: `package.json` `scripts.postinstall`

**Step 1: Install libraries**

Run:
```
$env:Path = "c:/Users/raven/.local/bin;" + $env:Path
pnpm add three occt-import-js
pnpm add -D @types/three
```
Expected: `three`, `occt-import-js` in `dependencies`, `@types/three` in `devDependencies`.

**Step 2: Make the occt `.wasm` available at a stable public URL**

`occt-import-js` loads a sibling `.wasm` at runtime via `locateFile`. In Next we serve it from `/public`. Create `scripts/copy-occt-wasm.cjs`:
```js
// Copy occt-import-js.wasm into /public so the browser can fetch it at
// /occt-import-js.wasm (occtimportjs({ locateFile })). Runs on postinstall so a
// clean `pnpm install` always refreshes it. Idempotent.
const fs = require("node:fs");
const path = require("node:path");

const src = require.resolve("occt-import-js/dist/occt-import-js.wasm");
const destDir = path.join(__dirname, "..", "public");
const dest = path.join(destDir, "occt-import-js.wasm");

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log(`[copy-occt-wasm] ${src} -> ${dest}`);
```

**Step 3: Chain it into postinstall**

Modify `package.json`:
```json
"postinstall": "prisma generate && node scripts/copy-occt-wasm.cjs"
```
Run the copy once now:
```
node scripts/copy-occt-wasm.cjs
```
Expected: `public/occt-import-js.wasm` exists. (If `occt-import-js/dist/occt-import-js.wasm` is not the real path, run `pnpm exec node -e "console.log(require.resolve('occt-import-js'))"` and adjust the `require.resolve` target to the package's actual wasm filename.)

**Step 4: Verify the app still builds**

Run: `pnpm run build`
Expected: PASS (no usage yet; this only confirms the new deps don't break the build).

**Step 5: Commit**
```
git add package.json pnpm-lock.yaml scripts/copy-occt-wasm.cjs public/occt-import-js.wasm
git commit -m "build(viewer): add three + occt-import-js and vendor occt wasm to /public"
```

---

## Task 1: Schema + migration (render columns + board subkind)

**Files:**
- Modify: `prisma/schema.prisma` (`PartAsset`, `Artifact`, `ArtifactSubkind`)
- Create: `prisma/migrations/20260603130000_model_3d_render/migration.sql`
- Test: `src/lib/__tests__/model-render-schema.test.ts` (new)

**Step 1: Edit `prisma/schema.prisma`**

Add to `model PartAsset` (after `contentType`):
```prisma
  renderKey      String?   // R2 key of the derived .glb (parts/{partId}/model_3d_render-{cuid}.glb)
  renderBytes    Int?
  renderMime     String?   // "model/gltf-binary"
  renderBounds   Json?     // { center: [x,y,z], radius } — frames the viewer camera
```

Add to `model Artifact` (after `fileBytes`):
```prisma
  renderKey    String?   // derived .glb for MODEL_3D artifacts (board stub)
  renderBytes  Int?
  renderMime   String?
  renderBounds Json?
```

Add to `enum ArtifactSubkind` (append):
```prisma
  MODEL_3D // 3D model artifact (board/sub-assembly); renderable via <ModelViewer>
```

**Step 2: Hand-write the migration SQL**

Create `prisma/migrations/20260603130000_model_3d_render/migration.sql`:
```sql
-- PartAsset: derived .glb render columns (the source file columns are unchanged).
ALTER TABLE "PartAsset" ADD COLUMN "renderKey"    TEXT;
ALTER TABLE "PartAsset" ADD COLUMN "renderBytes"  INTEGER;
ALTER TABLE "PartAsset" ADD COLUMN "renderMime"   TEXT;
ALTER TABLE "PartAsset" ADD COLUMN "renderBounds" JSONB;

-- Artifact: same derived-render columns (board stub) + the MODEL_3D subkind.
ALTER TABLE "Artifact" ADD COLUMN "renderKey"    TEXT;
ALTER TABLE "Artifact" ADD COLUMN "renderBytes"  INTEGER;
ALTER TABLE "Artifact" ADD COLUMN "renderMime"   TEXT;
ALTER TABLE "Artifact" ADD COLUMN "renderBounds" JSONB;

ALTER TYPE "ArtifactSubkind" ADD VALUE 'MODEL_3D';
```

> NOTE: `ALTER TYPE ... ADD VALUE` cannot run inside a transaction block in older Postgres. Neon/PG15 supports it fine in `migrate deploy`. If deploy errors on the enum line, split it into its own migration folder so it runs alone.

**Step 3: Apply + regenerate**

Run:
```
$env:Path = "c:/Users/raven/.local/bin;" + $env:Path
pnpm exec prisma migrate deploy
pnpm exec prisma generate
```
Expected: migration `20260603130000_model_3d_render` applied; client regenerated with the new fields.

**Step 4: Write the round-trip test (proves migration + Prisma types)**

Create `src/lib/__tests__/model-render-schema.test.ts`:
```ts
// Proves the render columns exist + round-trip on PartAsset, and that the
// MODEL_3D ArtifactSubkind enum value is present. Real Neon; one throwaway Part.
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { ArtifactSubkind } from "@prisma/client";
import { db } from "@/lib/db";

const SEED_EMAIL = "seed@example.com";
const TEST_MFR = "ModelRenderSchema-TestCo";
let seedUserId: string;
let partId: string;

beforeAll(async () => {
  const u = await db.user.findUniqueOrThrow({
    where: { email: SEED_EMAIL },
    select: { id: true },
  });
  seedUserId = u.id;
  const part = await db.part.create({
    data: {
      manufacturer: TEST_MFR,
      mpn: `MRS-${Date.now()}`,
      description: "render schema test part",
      createdById: seedUserId,
    },
    select: { id: true },
  });
  partId = part.id;
});

afterAll(async () => {
  await db.part.deleteMany({ where: { manufacturer: TEST_MFR } }).catch(() => {});
  expect(await db.part.count({ where: { id: partId } })).toBe(0);
});

test("PartAsset render columns round-trip", async () => {
  const a = await db.partAsset.create({
    data: {
      partId,
      kind: "MODEL_3D",
      r2Key: `parts/${partId}/model_3d-test.step`,
      filename: "test.step",
      byteSize: 1000,
      contentType: "application/octet-stream",
      renderKey: `parts/${partId}/model_3d_render-test.glb`,
      renderBytes: 250,
      renderMime: "model/gltf-binary",
      renderBounds: { center: [0, 0, 0], radius: 5 },
      createdById: seedUserId,
    },
  });
  expect(a.renderKey).toContain("model_3d_render");
  expect(a.renderMime).toBe("model/gltf-binary");
  expect((a.renderBounds as { radius: number }).radius).toBe(5);
});

test("MODEL_3D is a valid ArtifactSubkind", () => {
  expect(ArtifactSubkind.MODEL_3D).toBe("MODEL_3D");
});
```

**Step 5: Run the test**

Run: `pnpm exec vitest run src/lib/__tests__/model-render-schema.test.ts`
Expected: PASS (2 tests).

**Step 6: Commit**
```
git add prisma/schema.prisma prisma/migrations/20260603130000_model_3d_render src/lib/__tests__/model-render-schema.test.ts
git commit -m "feat(viewer): add derived-render columns to PartAsset + Artifact, MODEL_3D subkind"
```

---

## Task 2: Inline presigned GET helper

`presignGet(key, filename)` forces `Content-Disposition: attachment`. The viewer needs an **inline** GET (no disposition) so the browser `fetch` of the `.glb` works. `presignGet(key)` *without* a filename is already inline — we add a named, intention-revealing wrapper.

**Files:**
- Modify: `src/lib/part-r2.ts`
- Test: `src/lib/__tests__/part-assets-r2.test.ts` (extend)

**Step 1: Add the helper to `src/lib/part-r2.ts`** (after `presignGet`):
```ts
/** Presigned GET WITHOUT a Content-Disposition override → the browser may fetch
 *  the object inline (CORS GET). Used ONLY for the derived `.glb` render that
 *  <ModelViewer> loads; every human-facing download uses `presignGet(key, name)`
 *  (attachment). Identical to `presignGet(key)` with no filename — named for
 *  intent so a future reader doesn't "tidy" the render path onto the attachment
 *  presign and break in-browser rendering. */
export function presignGetInline(key: string) {
  return presignGet(key);
}
```

**Step 2: Add a test** to `src/lib/__tests__/part-assets-r2.test.ts` (mirror the file's existing presign assertions):
```ts
test("presignGetInline omits response-content-disposition", async () => {
  const url = await presignGetInline("parts/x/model_3d_render-abc.glb");
  expect(url).toContain("X-Amz-Signature");
  expect(url.toLowerCase()).not.toContain("response-content-disposition");
});
```
(Import `presignGetInline` at the top alongside the existing imports. If that test file gates on `R2_ENABLED`, follow its existing skip/guard pattern.)

**Step 3: Run**

Run: `pnpm exec vitest run src/lib/__tests__/part-assets-r2.test.ts`
Expected: PASS (existing + the new test).

**Step 4: Commit**
```
git add src/lib/part-r2.ts src/lib/__tests__/part-assets-r2.test.ts
git commit -m "feat(viewer): add presignGetInline for in-browser .glb fetch"
```

---

## Task 3: Render upload action + `recordPartAsset` render extension

Add a second presigned-PUT action for the `.glb`, and teach `recordPartAsset` to persist the render columns + clean up a stale render on replace.

**Files:**
- Modify: `src/lib/schemas/part-asset.ts` (extend `recordPartAssetSchema`, add a render-upload schema + a pure bounds type)
- Modify: `src/lib/actions/part-assets.ts` (`createPartAssetRenderUploadUrl`; extend `recordPartAsset`; a new `getPartAssetRenderUrl` resolver)
- Modify: `src/lib/r2.ts` (a render-key helper)
- Test: `src/lib/__tests__/part-assets-actions.test.ts` (extend) + `src/lib/__tests__/part-asset-schema.test.ts` (new, pure)

**Step 1: Add the render-key helper to `src/lib/r2.ts`** (after `partAssetKey`):
```ts
// Derived-render key for a part's MODEL_3D .glb (sibling of partAssetKey).
//   parts/{partId}/model_3d_render-{cuid}.glb
export function partRenderKey(partId: string, cuid: string): string {
  return `parts/${partId}/model_3d_render-${cuid}.glb`;
}
```

**Step 2: Extend the schemas in `src/lib/schemas/part-asset.ts`**

Add the render content-type constant + bounds schema near the top:
```ts
export const RENDER_MIME = "model/gltf-binary";
export const RENDER_MAX_BYTES = MAX_UPLOAD_BYTES; // a .glb is always ≤ the source cap

/** Bounding sphere the viewer uses to frame the camera. */
export const renderBoundsSchema = z.object({
  center: z.tuple([z.number(), z.number(), z.number()]),
  radius: z.number().positive(),
});
export type RenderBounds = z.infer<typeof renderBoundsSchema>;
```

Add the render-upload-url schema:
```ts
export const createPartAssetRenderUploadUrlSchema = z.object({
  partId: z.cuid(),
  byteSize: z.int().positive().max(RENDER_MAX_BYTES),
});
```

Extend `recordPartAssetSchema` with the optional render trio (append inside the existing `z.object({...})`):
```ts
  // Optional derived-.glb render (present only when client conversion succeeded).
  renderKey: z.string().trim().min(1).max(1024).optional(),
  renderBytes: z.int().positive().max(RENDER_MAX_BYTES).optional(),
  renderBounds: renderBoundsSchema.optional(),
```

**Step 3: Pure-schema tests** — create `src/lib/__tests__/part-asset-schema.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import {
  recordPartAssetSchema,
  renderBoundsSchema,
  createPartAssetRenderUploadUrlSchema,
} from "@/lib/schemas/part-asset";

describe("render schemas", () => {
  const partId = "c".repeat(24); // a cuid-shaped placeholder; adjust if z.cuid rejects

  test("recordPartAssetSchema accepts the optional render trio", () => {
    const parsed = recordPartAssetSchema.parse({
      partId,
      kind: "MODEL_3D",
      r2Key: "parts/x/model_3d-abc.step",
      filename: "x.step",
      byteSize: 10,
      renderKey: "parts/x/model_3d_render-abc.glb",
      renderBytes: 5,
      renderBounds: { center: [0, 0, 0], radius: 1 },
    });
    expect(parsed.renderKey).toContain("render");
  });

  test("recordPartAssetSchema is valid WITHOUT render fields (conversion failed)", () => {
    const parsed = recordPartAssetSchema.parse({
      partId,
      kind: "MODEL_3D",
      r2Key: "parts/x/model_3d-abc.step",
      filename: "x.step",
      byteSize: 10,
    });
    expect(parsed.renderKey).toBeUndefined();
  });

  test("renderBoundsSchema rejects a non-positive radius", () => {
    expect(() => renderBoundsSchema.parse({ center: [0, 0, 0], radius: 0 })).toThrow();
  });

  test("createPartAssetRenderUploadUrlSchema requires partId + byteSize", () => {
    expect(() => createPartAssetRenderUploadUrlSchema.parse({ partId })).toThrow();
  });
});
```
> If `z.cuid()` rejects the `"cccc…"` placeholder, generate a real one in the test: `import { createId } from "@paralleldrive/cuid2"` and use `createId()`.

Run: `pnpm exec vitest run src/lib/__tests__/part-asset-schema.test.ts` → PASS.

**Step 4: Add `createPartAssetRenderUploadUrl` to `src/lib/actions/part-assets.ts`**

Import the new schema + `partRenderKey` + `RENDER_MIME`, then append:
```ts
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
  await requireUser();
  ensureR2Enabled();
  await db.part.findUniqueOrThrow({ where: { id: data.partId }, select: { id: true } });

  const renderKey = partRenderKey(data.partId, createId());
  const uploadUrl = await presignPut(renderKey, RENDER_MIME, data.byteSize);
  return { uploadUrl, renderKey, contentType: RENDER_MIME };
}
```

**Step 5: Extend `recordPartAsset`** to persist + clean up the render. Inside `recordPartAsset`, after the existing `headVerifySize` for the source and BEFORE the upsert, add:
```ts
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
```

Then add the render columns to BOTH the `create` and `update` branches of the upsert:
```ts
    // in create: { ... }
      renderKey: render?.renderKey ?? null,
      renderBytes: render?.renderBytes ?? null,
      renderMime: render?.renderMime ?? null,
      renderBounds: (render?.renderBounds ?? null) as Prisma.InputJsonValue | typeof Prisma.JsonNull,
    // in update: { ... }  (a replace ALWAYS repoints the render, even to null)
      renderKey: render?.renderKey ?? null,
      renderBytes: render?.renderBytes ?? null,
      renderMime: render?.renderMime ?? null,
      renderBounds: (render?.renderBounds ?? null) as Prisma.InputJsonValue | typeof Prisma.JsonNull,
```
(Import `Prisma` from `@prisma/client` for the JSON null typing; if simpler, store `renderBounds` as `render?.renderBounds ?? Prisma.JsonNull`.)

After the upsert + before `return`, clean up a stale render object:
```ts
  // Best-effort delete the OLD render object when a replace repointed it
  // (orphan is the accepted fallback, same as the source cleanup policy).
  if (prior?.renderKey && prior.renderKey !== render?.renderKey) {
    if (env.R2_ENABLED && env.R2_BUCKET) {
      try { await deleteR2Object(prior.renderKey); } catch { /* swept later */ }
    }
  }
```

**Step 6: Extend `deletePartAsset`** to also drop the render object. In `deletePartAsset`, widen the `select` to include `renderKey`, and after deleting the source object add:
```ts
    if (row.renderKey) {
      try { await deleteR2Object(row.renderKey); } catch { /* orphan swept later */ }
    }
```

**Step 7: Add `getPartAssetRenderUrl` resolver** (the page calls this for the viewer):
```ts
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
```
(Import `presignGetInline` from `@/lib/part-r2`.)

**Step 8: Action-level tests** — extend `src/lib/__tests__/part-assets-actions.test.ts`. Because `recordPartAsset` HEADs R2, mock `@/lib/part-r2` at the top of the file (alongside the existing `next/cache` + `@/auth` mocks) so the HEAD/presign/delete are stubbed:
```ts
vi.mock("@/lib/part-r2", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/part-r2")>();
  return {
    ...actual,
    ensureR2Enabled: vi.fn(),                                   // no-op (R2 "on")
    presignPut: vi.fn(async () => "https://r2.example/put"),
    presignGet: vi.fn(async () => "https://r2.example/get"),
    presignGetInline: vi.fn(async () => "https://r2.example/inline"),
    headVerifySize: vi.fn(async (_k: string, declared: number) => declared), // echo bytes
    deleteR2Object: vi.fn(async () => {}),
  };
});
```
Add a `describe("recordPartAsset render columns", ...)` block:
```ts
import { recordPartAsset, getPartAssetRenderUrl } from "@/lib/actions/part-assets";

test("records the render trio on a fresh MODEL_3D upload", async () => {
  const r = await recordPartAsset({
    partId: throwawayPartId,
    kind: "MODEL_3D",
    r2Key: `parts/${throwawayPartId}/model_3d-a.step`,
    filename: "a.step",
    byteSize: 2000,
    renderKey: `parts/${throwawayPartId}/model_3d_render-a.glb`,
    renderBytes: 500,
    renderBounds: { center: [0, 0, 0], radius: 3 },
  });
  try {
    expect(r.renderKey).toContain("model_3d_render");
    expect(r.renderMime).toBe("model/gltf-binary");
    expect(await getPartAssetRenderUrl(throwawayPartId)).toBe("https://r2.example/inline");
  } finally {
    await deleteAsset(r.id);
  }
});

test("a replace WITHOUT a render clears the render columns + cleans up the old .glb", async () => {
  const first = await recordPartAsset({
    partId: throwawayPartId, kind: "MODEL_3D",
    r2Key: `parts/${throwawayPartId}/model_3d-b.step`, filename: "b.step", byteSize: 2000,
    renderKey: `parts/${throwawayPartId}/model_3d_render-b.glb`, renderBytes: 500,
    renderBounds: { center: [0, 0, 0], radius: 3 },
  });
  const second = await recordPartAsset({ // conversion failed → no render fields
    partId: throwawayPartId, kind: "MODEL_3D",
    r2Key: `parts/${throwawayPartId}/model_3d-b2.step`, filename: "b2.step", byteSize: 2100,
  });
  try {
    expect(second.renderKey).toBeNull();
    expect(second.renderBytes).toBeNull();
  } finally {
    await deleteAsset(second.id);
  }
});
```

**Step 9: Run + commit**

Run: `pnpm exec vitest run src/lib/__tests__/part-asset-schema.test.ts src/lib/__tests__/part-assets-actions.test.ts`
Expected: PASS.
```
git add src/lib/schemas/part-asset.ts src/lib/actions/part-assets.ts src/lib/r2.ts src/lib/__tests__/part-asset-schema.test.ts src/lib/__tests__/part-assets-actions.test.ts
git commit -m "feat(viewer): render-upload action + recordPartAsset render persistence/cleanup"
```

---

## Task 4: Client STEP/WRL → GLB converter

A NON-`"use server"` browser module that tessellates a source file to a `.glb` `Blob` + bounds. Returns `null` on any failure (caller treats the asset as render-less). The heavy `occt-import-js` + `three` exporter imports are **inside the function** so bundlers code-split them onto the upload path only.

**Files:**
- Create: `src/lib/model-convert.ts`
- Create: `src/lib/model-bounds.ts` (pure — unit-tested)
- Test: `src/lib/__tests__/model-bounds.test.ts` (new)

**Step 1: Pure bounds helper** — `src/lib/model-bounds.ts`:
```ts
import type { RenderBounds } from "@/lib/schemas/part-asset";

/** Bounding sphere from a flat XYZ position array (mesh vertices). Returns a
 *  unit fallback for an empty array so the viewer still frames something. */
export function boundsFromPositions(positions: ArrayLike<number>): RenderBounds {
  if (positions.length < 3) return { center: [0, 0, 0], radius: 1 };
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i + 2 < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  const center: [number, number, number] = [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2];
  const dx = maxX - minX, dy = maxY - minY, dz = maxZ - minZ;
  const radius = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz) / 2, 1e-6);
  return { center, radius };
}
```

**Step 2: Test it** — `src/lib/__tests__/model-bounds.test.ts`:
```ts
import { describe, expect, test } from "vitest";
import { boundsFromPositions } from "@/lib/model-bounds";

describe("boundsFromPositions", () => {
  test("unit cube → center origin, radius = half the space diagonal", () => {
    const cube = [-1,-1,-1, 1,-1,-1, 1,1,-1, -1,1,-1, -1,-1,1, 1,-1,1, 1,1,1, -1,1,1];
    const b = boundsFromPositions(cube);
    expect(b.center).toEqual([0, 0, 0]);
    expect(b.radius).toBeCloseTo(Math.sqrt(12) / 2, 5);
  });
  test("empty → unit fallback", () => {
    expect(boundsFromPositions([])).toEqual({ center: [0, 0, 0], radius: 1 });
  });
});
```
Run: `pnpm exec vitest run src/lib/__tests__/model-bounds.test.ts` → PASS.

**Step 3: The converter** — `src/lib/model-convert.ts`:
```ts
// Browser-only: tessellate a source CAD file to a .glb Blob + bounding sphere.
// STEP/STP → occt-import-js (OpenCASCADE WASM); WRL → three VRMLLoader. Always
// exports a binary glTF (.glb) so the viewer has ONE runtime loader. Returns
// null on ANY failure — the caller records the asset download-only (the render
// is non-load-bearing; conversion must never block curation).
//
// Heavy deps (occt, three exporters/loaders) are dynamically imported INSIDE the
// function so they code-split onto the upload path and never reach viewers.
import { boundsFromPositions } from "@/lib/model-bounds";
import type { RenderBounds } from "@/lib/schemas/part-asset";

export type ConvertResult = { glb: Blob; bounds: RenderBounds };

export async function convertToGlb(file: File): Promise<ConvertResult | null> {
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  try {
    const THREE = await import("three");
    const { GLTFExporter } = await import("three/addons/exporters/GLTFExporter.js");

    const scene = new THREE.Scene();
    let allPositions: number[] = [];

    if (ext === ".step" || ext === ".stp") {
      const occtimportjs = (await import("occt-import-js")).default;
      const occt = await occtimportjs({ locateFile: () => "/occt-import-js.wasm" });
      const buf = new Uint8Array(await file.arrayBuffer());
      const res = occt.ReadStepFile(buf, null);
      if (!res?.success || !res.meshes?.length) return null;
      for (const m of res.meshes) {
        const g = new THREE.BufferGeometry();
        const pos = new Float32Array(m.attributes.position.array);
        g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        if (m.attributes.normal) {
          g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(m.attributes.normal.array), 3));
        }
        if (m.index) g.setIndex(new THREE.BufferAttribute(new Uint32Array(m.index.array), 1));
        if (!m.attributes.normal) g.computeVertexNormals();
        const color = m.color ? new THREE.Color(m.color[0], m.color[1], m.color[2]) : new THREE.Color(0.8, 0.8, 0.85);
        scene.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, metalness: 0.2, roughness: 0.6 })));
        allPositions = allPositions.concat(Array.from(pos));
      }
    } else if (ext === ".wrl") {
      const { VRMLLoader } = await import("three/addons/loaders/VRMLLoader.js");
      const text = await file.text();
      const parsed = new VRMLLoader().parse(text, "");
      scene.add(parsed);
      parsed.traverse((o: unknown) => {
        const mesh = o as { geometry?: { getAttribute?: (n: string) => { array: ArrayLike<number> } | undefined } };
        const attr = mesh.geometry?.getAttribute?.("position");
        if (attr) allPositions = allPositions.concat(Array.from(attr.array));
      });
    } else {
      return null; // unsupported source ext
    }

    const bounds = boundsFromPositions(allPositions);
    const glbArrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      new GLTFExporter().parse(
        scene,
        (out) => resolve(out as ArrayBuffer),
        (err) => reject(err),
        { binary: true },
      );
    });
    return { glb: new Blob([glbArrayBuffer], { type: "model/gltf-binary" }), bounds };
  } catch {
    return null; // any failure → render-less asset
  }
}
```
> The `occt-import-js` mesh-result field names (`attributes.position.array`, `index.array`, `color`) match its README; if the installed version differs, adjust field access. Keep the `try/catch → null` contract intact.

**Step 4: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS. (If `three/addons/*` types aren't resolved, add `"moduleResolution": "bundler"` is already implied by Next; otherwise import from `three/examples/jsm/...` and add a `// @ts-expect-error` only as a last resort.)

**Step 5: Commit**
```
git add src/lib/model-convert.ts src/lib/model-bounds.ts src/lib/__tests__/model-bounds.test.ts
git commit -m "feat(viewer): client STEP/WRL → .glb converter (occt + GLTFExporter) with null-on-failure"
```

---

## Task 5: Wire conversion into the upload path

For `MODEL_3D` only: after the source PUT succeeds, attempt `convertToGlb`; on success, PUT the `.glb` and pass `renderKey`/`renderBytes`/`renderBounds` to `recordPartAsset`; on failure, record without them. Other kinds are unchanged.

**Files:**
- Modify: `src/components/parts/AssetUpload.tsx`

**Step 1: In `AssetUpload.tsx`**, inside the `startTransition` block, AFTER the source `put` succeeds and BEFORE `recordPartAsset`, add a MODEL_3D branch:
```ts
        // MODEL_3D: derive a .glb render in-browser (best-effort). Heavy occt/
        // three deps code-split via the dynamic import inside convertToGlb.
        let render: { renderKey?: string; renderBytes?: number; renderBounds?: RenderBounds } = {};
        if (kind === "MODEL_3D") {
          const { convertToGlb } = await import("@/lib/model-convert");
          const converted = await convertToGlb(file);
          if (converted) {
            const r = await createPartAssetRenderUploadUrl({ partId, byteSize: converted.glb.size });
            const putR = await fetch(r.uploadUrl, {
              method: "PUT",
              headers: { "Content-Type": r.contentType },
              body: converted.glb,
            });
            if (putR.ok) {
              render = { renderKey: r.renderKey, renderBytes: converted.glb.size, renderBounds: converted.bounds };
            }
            // a failed render PUT → just record download-only; never throw here
          }
        }

        await recordPartAsset({
          partId, kind, r2Key, filename: file.name, byteSize: file.size,
          ref: meta.ref, source: meta.source,
          ...render,
        });
```
Update the import block to add `createPartAssetRenderUploadUrl` and a type import:
```ts
import { createPartAssetUploadUrl, recordPartAsset, createPartAssetRenderUploadUrl } from "@/lib/actions/part-assets";
import type { RenderBounds } from "@/lib/schemas/part-asset";
```
> Optional UX: while converting, the button already shows "Uploading…"; you may add a transient "Converting 3D…" label. Not required for v1.

**Step 2: Typecheck + build**

Run: `pnpm exec tsc --noEmit && pnpm run build`
Expected: PASS. The build output should show occt/three in a **separate async chunk** (not in the part-page entry).

**Step 3: Commit**
```
git add src/components/parts/AssetUpload.tsx
git commit -m "feat(viewer): convert+upload .glb render on MODEL_3D upload (best-effort)"
```

---

## Task 6: The `<ModelViewer>` component

One reusable client component: lazy three.js scene with orbit controls, loads a `.glb` from an inline URL, frames from bounds, and shows a graceful fallback on error.

**Files:**
- Create: `src/components/ModelViewer.tsx` (the actual three.js canvas; `"use client"`)
- Create: `src/components/ModelViewerLazy.tsx` (intent-gated `next/dynamic` wrapper + poster)
- Test: manual + `pnpm run build` (no DOM harness); optional Playwright smoke in Task 9.

**Step 1: `src/components/ModelViewer.tsx`** (mounts three; never SSR'd):
```tsx
"use client";

// three.js GLB viewer. Loaded ONLY via ModelViewerLazy (next/dynamic, ssr:false)
// so three is never in the server bundle or the initial client entry. Orbit
// controls; camera framed from `bounds`. On load error, calls onError so the
// parent can show the download fallback.
import { useEffect, useRef, useState } from "react";
import type { RenderBounds } from "@/lib/schemas/part-asset";

export default function ModelViewer({ src, bounds }: { src: string; bounds?: RenderBounds | null }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      try {
        const THREE = await import("three");
        const { OrbitControls } = await import("three/addons/controls/OrbitControls.js");
        const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
        const mount = mountRef.current;
        if (!mount || disposed) return;

        const width = mount.clientWidth || 600;
        const height = mount.clientHeight || 420;
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0b0f1a);
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 10000);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(width, height);
        mount.appendChild(renderer.domElement);

        scene.add(new THREE.HemisphereLight(0xffffff, 0x333344, 1.1));
        const dir = new THREE.DirectionalLight(0xffffff, 1.0);
        dir.position.set(1, 1, 1);
        scene.add(dir);
        scene.add(new THREE.GridHelper(10, 10, 0x334, 0x223));

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;

        const radius = bounds?.radius ?? 5;
        const center = bounds?.center ?? [0, 0, 0];
        camera.position.set(center[0] + radius * 2, center[1] + radius * 1.5, center[2] + radius * 2);
        controls.target.set(center[0], center[1], center[2]);
        controls.update();

        new GLTFLoader().load(
          src,
          (gltf) => { if (!disposed) scene.add(gltf.scene); },
          undefined,
          () => { if (!disposed) setError(true); },
        );

        let raf = 0;
        const tick = () => { controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(tick); };
        tick();

        const onResize = () => {
          const w = mount.clientWidth, h = mount.clientHeight || 420;
          camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
        };
        window.addEventListener("resize", onResize);

        cleanup = () => {
          cancelAnimationFrame(raf);
          window.removeEventListener("resize", onResize);
          controls.dispose();
          renderer.dispose();
          renderer.domElement.remove();
        };
      } catch {
        setError(true);
      }
    })();
    return () => { disposed = true; cleanup(); };
  }, [src, bounds]);

  if (error) {
    return (
      <p className="rounded border border-panel-border bg-navy-dark/30 px-4 py-3 font-mono text-xs text-muted">
        3D preview unavailable — download the model to open it in CAD.
      </p>
    );
  }
  return <div ref={mountRef} className="h-[420px] w-full overflow-hidden rounded border border-panel-border bg-deep-space" />;
}
```

**Step 2: `src/components/ModelViewerLazy.tsx`** (poster → mount on click):
```tsx
"use client";

// Intent-gated wrapper: shows a poster button; the heavy three.js viewer mounts
// only on click (next/dynamic, ssr:false), keeping three off the initial page
// payload. Reused by parts AND the board-stub artifact surface.
import dynamic from "next/dynamic";
import { useState } from "react";
import type { RenderBounds } from "@/lib/schemas/part-asset";

const ModelViewer = dynamic(() => import("@/components/ModelViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] w-full items-center justify-center rounded border border-panel-border bg-deep-space font-mono text-xs text-muted">
      Loading 3D viewer…
    </div>
  ),
});

export function ModelViewerLazy({ src, bounds }: { src: string; bounds?: RenderBounds | null }) {
  const [show, setShow] = useState(false);
  if (show) return <ModelViewer src={src} bounds={bounds} />;
  return (
    <button
      type="button"
      onClick={() => setShow(true)}
      className="glass-button inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:text-gold-light"
    >
      View 3D model
    </button>
  );
}
```

**Step 3: Typecheck + build**

Run: `pnpm exec tsc --noEmit && pnpm run build`
Expected: PASS; three.js appears only in an async chunk.

**Step 4: Commit**
```
git add src/components/ModelViewer.tsx src/components/ModelViewerLazy.tsx
git commit -m "feat(viewer): reusable lazy <ModelViewer> (three GLTFLoader + OrbitControls)"
```

---

## Task 7: Mount the viewer on the part page

Resolve the inline render URL server-side and render `<ModelViewerLazy>` inside the MODEL_3D `AssetRow`.

**Files:**
- Modify: `src/app/parts/[id]/page.tsx` (resolve `renderUrl` + pass it through)
- Modify: `src/components/parts/AssetRow.tsx` (accept `renderUrl` + `renderBounds`; mount the viewer)

**Step 1: In `page.tsx`**, after the `assetDownloadUrls` map, resolve the render URL (only for MODEL_3D, only when a render exists):
```ts
import { getPartAssetRenderUrl } from "@/lib/actions/part-assets";
// ...
const model3d = assetByKind.get("MODEL_3D");
const modelRenderUrl =
  r2Enabled && model3d?.renderKey ? await getPartAssetRenderUrl(part.id) : null;
```
Pass two new props where `<AssetRow ... />` is rendered, but only meaningfully for the MODEL_3D kind:
```tsx
                renderUrl={kind === "MODEL_3D" ? modelRenderUrl : null}
                renderBounds={kind === "MODEL_3D" ? (a?.renderBounds as RenderBounds | null) ?? null : null}
```
Add `import type { RenderBounds } from "@/lib/schemas/part-asset";`.

**Step 2: In `AssetRow.tsx`**, extend props:
```ts
import { ModelViewerLazy } from "@/components/ModelViewerLazy";
import type { RenderBounds } from "@/lib/schemas/part-asset";
// add to the prop type + destructure:
  renderUrl?: string | null;
  renderBounds?: RenderBounds | null;
```
Mount the viewer in the existing-asset branch, directly under the filename/download `<div>` (around line 342):
```tsx
      {renderUrl ? (
        <div className="pt-1">
          <ModelViewerLazy src={renderUrl} bounds={renderBounds ?? null} />
        </div>
      ) : null}
```
> View is **trust-agnostic** — the viewer renders regardless of `asset.trust`; do NOT gate it on `canEdit` or trust. A render-less MODEL_3D (or any other kind) simply has `renderUrl == null` and shows nothing here.

**Step 3: Typecheck + build**

Run: `pnpm exec tsc --noEmit && pnpm run build`
Expected: PASS.

**Step 4: Manual verification (pilot part)** — see Task 9's manual checklist.

**Step 5: Commit**
```
git add src/app/parts/[id]/page.tsx src/components/parts/AssetRow.tsx
git commit -m "feat(viewer): render MODEL_3D inline on the part page (trust-agnostic)"
```

---

## Task 8: Board stub (Artifact generalization)

Prove the same `<ModelViewer>` renders a manually-uploaded board model stored on an `Artifact` (subkind `MODEL_3D`). Deliberately thin.

**Files (research first):**
- Read: `src/lib/actions/uploads.ts` (`createUploadUrl` / `recordArtifact` / `getDownloadUrl`) and `src/lib/artifacts.ts` to learn the existing artifact upload + render pattern.
- Read: `src/app/projects/[slug]/[revLabel]/page.tsx` and `.../builds/[buildLabel]/page.tsx` (where artifacts are listed + `ArtifactDownloadLink` is mounted).

**Step 1: Extend the artifact record path with the render trio.** Mirror Task 3 on the artifact side:
- Add to `recordArtifactSchema` (`src/lib/schemas/upload.ts`) the optional `renderKey`/`renderBytes`/`renderBounds` (reuse `renderBoundsSchema` + `RENDER_MAX_BYTES` from `@/lib/schemas/part-asset`, or re-declare locally to avoid a cross-import if cleaner).
- Add `createArtifactRenderUploadUrl({ owner, stage, byteSize })` in `uploads.ts` → presigned PUT under an `artifactKey(owner, stage, cuid, "render.glb")`-style key, content-type `model/gltf-binary`.
- In `recordArtifact`, HEAD-verify + persist the render columns (best-effort, same null-on-failure contract).

**Step 2: Upload wiring.** Find the client component that drives `createUploadUrl` → PUT → `recordArtifact` (the artifact uploader). For `subkind === "MODEL_3D"`, run the SAME `convertToGlb(file)` branch from Task 5 (extract that branch into a tiny shared helper `uploadDerivedGlb(file, getUrl)` in `src/lib/model-convert.ts` if it reduces duplication — DRY), then pass the render fields to `recordArtifact`.

**Step 3: Render wiring.** Where FILE artifacts are listed, add: when `artifact.subkind === "MODEL_3D" && artifact.renderKey`, resolve an inline render URL (a `getArtifactRenderUrl(artifactId)` resolver mirroring `getPartAssetRenderUrl`, using `presignGetInline`) and render `<ModelViewerLazy src={url} bounds={artifact.renderBounds} />` beneath the existing `ArtifactDownloadLink`.

**Step 4: Test** (action-level, mirror Task 3's mock approach for `uploads.ts`'s R2 calls): `recordArtifact` persists the render trio for a MODEL_3D artifact; a render-less record leaves the columns null. Put it in a new `src/lib/__tests__/artifact-render.test.ts` (throwaway Revision/Build + Artifact; sweep in `afterAll`). Follow the existing `uploads-actions.test.ts` setup for owner rows.

**Step 5: Typecheck + build + run the new test**

Run: `pnpm exec tsc --noEmit && pnpm exec vitest run src/lib/__tests__/artifact-render.test.ts && pnpm run build`
Expected: PASS.

**Step 6: Commit**
```
git add -A
git commit -m "feat(viewer): board stub — render MODEL_3D Artifacts via the shared <ModelViewer>"
```

---

## Task 9: Verify, full suite, finish

**Files:** none (verification) + optional `tests/e2e/model-viewer.spec.ts` (Playwright smoke).

**Step 1: Confirm R2 CORS allows `GET` from the app origin.** The viewer does a browser `fetch` of the `.glb` (cross-origin to R2). Check the `foundry-prod` bucket CORS policy includes `GET` (and `HEAD`) for the production origin AND `http://localhost:3000` for dev. If only `PUT`/upload origins are allowed, add a `GET` rule. (This is an R2 dashboard / API config change, not code. Memory: `parts-cad-assets-stage-c` / `foundry-deployment`.)

**Step 2: Manual pilot (the real proof).** Run `pnpm dev`. On a throwaway part:
1. Upload a real `.step` (SnapEDA/SamacSys). Confirm: source downloads AND "View 3D model" appears; clicking it renders an orbitable model.
2. Confirm it renders **before** marking VERIFIED (trust-agnostic).
3. Replace with a different `.step` → the viewer shows the new model; the old `.glb` is gone from R2.
4. Upload a deliberately broken/huge `.step` → the asset still records (download works), no viewer affordance, no crash.
5. Delete the asset → both R2 objects gone.
6. Board stub: upload a board `.step`/`.glb` as a `MODEL_3D` artifact → the same viewer renders it.
Capture notes/screenshots. (Optional: drive steps 1–2 with `superpowers:webapp-testing` Playwright — mount the viewer, assert a `<canvas>` is present and the console has no errors.)

**Step 3: Full suite + build gates**

Run:
```
$env:Path = "c:/Users/raven/.local/bin;" + $env:Path
pnpm exec tsc --noEmit
pnpm exec vitest run
pnpm run build
```
Expected: all PASS (~6 min for vitest). Use `superpowers:verification-before-completion` — paste the real output; do not claim green without it.

**Step 4: Finish the branch.** Use `superpowers:finishing-a-development-branch`:
- Push `feature/3d-model-viewer` (**push every commit before opening the PR** — memory: a stale-branch merge happened before).
- Open the PR with `env -u GH_TOKEN gh pr create ...` (handle `joshtol`; stale `GH_TOKEN` shadows the keyring login).
- PR body: summary + the manual-verification notes/screenshots + the design-doc link + the deferred items (board *generation*, Worker-thread conversion, Draco/meshopt if the board `.glb` is heavy).

---

## Risks / watch-items (carried from the design §8)
1. **R2 CORS `GET`** — Task 9 Step 1; the single most likely "renders locally but blank in prod" cause.
2. **occt mesh-result field names / wasm path** — Task 0 Step 3 + Task 4 Step 3; verify against the installed `occt-import-js` version.
3. **Board-scale `.glb` perf** — the stub may produce a large mesh; if the curator's tab struggles or the viewer is sluggish, that flags a future Worker-thread convert + Draco/meshopt compression (explicit non-goals for v1).
4. **`three/addons` type resolution** — if TS can't resolve `three/addons/*`, fall back to `three/examples/jsm/*` imports.
5. **`ALTER TYPE ... ADD VALUE`** — if `migrate deploy` rejects it mid-transaction, isolate the enum change in its own migration folder.
```
