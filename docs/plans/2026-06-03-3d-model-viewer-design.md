# In-App 3D Model Viewer — Design

**Date:** 2026-06-03
**Status:** Approved (brainstorm complete). Queued as the next parts-knowledge stage — after Stage C (CAD assets, PRs #9 + #10).
**Builds on:** the `PartAsset { kind: MODEL_3D }` row + the R2 presigned upload pipeline + the bucket CORS (Stage C); the `PartFact`/`PartAsset` trust/provenance **verify gate**; the generic `Artifact` model (Revision-or-Build owned) for the board generalization.

---

## 1. Goal & scope

Render a part's 3D model **in the app** instead of download-only. Today a `MODEL_3D` `PartAsset` (`.step`/`.stp`/`.wrl` on R2) can only be downloaded and opened in external CAD. This feature renders it inline on `/parts/[id]` in an interactive three.js scene — and does so through **one reusable `<ModelViewer>`** designed to render **any 3D artifact in the project**, including (eventually) the full assembled PCB.

The viewer serves **two jobs at once** (validated):
- **Curator verify aid** — a curator eyeballs the model ("right package? right orientation?") *as part of* marking it `VERIFIED`. Viewing happens **before/during** verification.
- **Reference / showcase** — anyone viewing a part (and later a board) sees it in 3D as polished reference.

### Decisions (validated in brainstorm)

| Decision | Choice |
|---|---|
| Render format | **`.glb` is the render lingua franca.** three.js renders a mesh; everything is normalized to `.glb` so the viewer has exactly **one** runtime loader (`GLTFLoader`). |
| Conversion pipeline | **Convert at upload, in the curator's browser.** STEP→mesh tessellation (`occt-import-js` WASM) runs **once** on the uploader's machine; we store **both** the original source file (download / CAD exchange) **and** the derived `.glb` (the render artifact). No new server infra; no per-view conversion; viewers ship no WASM. |
| Render storage | **Derived-render columns on the source row** (`renderKey`/`renderBytes`/`renderMime`/`renderBounds` on `PartAsset`). The `.glb` is a **pure derivative** of the source — not separately verified, regenerated on replace, trust stays on the source model. |
| Viewer | **One reusable `<ModelViewer>`** (three.js + `GLTFLoader` + `OrbitControls`), lazy-mounted on intent, fed an inline presigned `.glb` URL + bounds. Agnostic to part vs board. |
| Board generalization | **Stub in v1.** Add `ArtifactSubkind.MODEL_3D` + the same render columns on `Artifact`; wire a **manual** board-model upload through the identical convert-at-upload path, rendered by the same `<ModelViewer>`. Proves the generalization end-to-end. |
| View vs trust | **Viewing is trust-agnostic** (you view in order to verify). The viewer renders at any trust state; the `VerifyBadge` still reflects the source model's trust. |

### Non-goals (v1)
- **Board *generation*** (BOM → KiCad library export, which would emit the board `.glb`) — the deferred §7 phase. v1 only *renders* a manually-supplied board model.
- **Server-side conversion** — explicitly rejected (Vercel serverless time/memory ceiling; native OCCT/FreeCAD would force a worker/container = new infra).
- **Measurement / sectioning / explode / animation** tools — pan/orbit/zoom only.
- **Auto cross-checks** (model package vs the `PACKAGE` fact, etc.) — deferred enhancement.
- **Mesh compression** (Draco / meshopt) — revisit if the board-scale `.glb` perf ceiling demands it.

### Success criteria
On a pilot part with a real `.step`: a signed-in curator uploads it; the browser derives a `.glb`; the model renders in an orbit-controllable canvas **inline** on `/parts/[id]`, **pre-verify**, over the live R2 + CORS path. Replacing the source regenerates the render; deleting cleans up **both** R2 objects; a conversion **failure** still yields a usable, downloadable asset with a graceful "no in-app preview" fallback. The **same** `<ModelViewer>` renders a manually-uploaded board model from an `Artifact`.

---

## 2. The central trade-study (why convert-at-upload)

three.js renders **meshes**. The dominant source format is **STEP** (`.step`/`.stp`), which is CAD **B-rep** (parametric solids) and must be **tessellated** to a mesh first. `.wrl` (KiCad VRML) already *is* a mesh; `.glb` is the web-native mesh three.js is happiest with. The real decision is **where tessellation runs and whether the resulting mesh is stored.**

| Approach | How | Verdict |
|---|---|---|
| **Convert at upload → store `.glb`** ✅ chosen | Curator's browser tessellates once (`occt-import-js`), exports `.glb`; store source + derived `.glb`; viewers load the small `.glb` | No server infra; heavy work amortized once; fast, light, high-fidelity runtime; original STEP preserved. Cost: conversion code in a code-split **upload** chunk; a 2nd R2 object to track; a weak machine struggles on a huge board. |
| Convert server-side at ingest | `recordPartAsset` runs STEP→glTF on the server | Rejected: must fit Vercel serverless limits; cold starts; board blows the budget; higher-fidelity kernels aren't serverless-runnable → new infra. |
| Client-render every view | Viewer fetches `.step`, tessellates in **every** visitor's browser, **every** view | Rejected: ~7 MB WASM to every viewer; slow first paint; re-done each view; prohibitive for a board; weakest for showcase. |
| Require mesh formats | Viewer renders only `.glb`/`.wrl`; STEP download-only | Rejected: contradicts "mostly STEP"; most parts won't render unless a human pre-converts each; half-broken library. |

**Key insight:** converting *once at upload* is categorically different from converting *on every view*. The chosen approach pays the tessellation cost a single time, on the machine that already has the file, and turns every subsequent view into a cheap `.glb` fetch.

---

## 3. Data model & storage

### 3.1 `PartAsset` — derived-render columns (all nullable)
```
renderKey    String?   // R2 key of the derived .glb: parts/{partId}/MODEL_3D_RENDER-{cuid}.glb
renderBytes  Int?
renderMime   String?   // "model/gltf-binary"
renderBounds Json?     // { center: [x,y,z], radius } — computed at convert time; frames the camera
```
The original `.step`/`.stp`/`.wrl` stays exactly as today (the `r2Key`/`filename`/`byteSize`/`contentType` columns — download + CAD exchange unchanged). The `.glb` is a derivative on the **same** row:
- **not** separately verified (no new trust states; the `VerifyBadge` reflects the source model);
- **regenerated** whenever the source file is replaced;
- present only when conversion succeeded (`renderKey == null` ⇒ no in-app preview, download still works).

### 3.2 `Artifact` — the board stub
- New `ArtifactSubkind.MODEL_3D` (a `FILE` artifact, Revision-or-Build owned).
- The **same** `renderKey`/`renderBytes`/`renderMime`/`renderBounds` columns on `Artifact`.
- v1 wires a **manual** board-model upload (Revision/Build artifact surface) through the identical convert-at-upload path, rendered by the same `<ModelViewer>`. Deliberately thin — it exists to prove generalization, not to be the board feature.

### 3.3 R2 access — the inline fetch path (load-bearing)
`presignGet` today **always** signs `Content-Disposition: attachment` when a filename is passed (so KiCad/text files download instead of rendering). The viewer needs the **opposite**. Add a sibling **`presignGetInline(key)`** (no disposition override) used **only** for the `renderKey`. The attachment path stays for every human download.
- **CORS:** the bucket already allows the app origin for PUT uploads; **verify a `GET` allow-rule exists** for the app origin and add one if not (config tweak, not code) — a browser `fetch` of the `.glb` is cross-origin to R2.
- The part page mints the inline render URL **whenever a render exists**, independent of `canEdit` — read-only visitors get the 3D (reference/showcase), while upload/replace/delete/verify stay `canEdit`-gated. *(If parts pages must be fully auth-gated, keep parity with download — a one-line flip.)*

### 3.4 Migration
Hand-written timestamped SQL (`prisma migrate dev` is interactive-blocked here → `prisma migrate deploy`). Two `ALTER TABLE`s (PartAsset, Artifact) + the new `ArtifactSubkind` enum value. **Never `migrate reset`** (wipes curriculum + curated data).

---

## 4. The convert-at-upload pipeline

Today: `createPartAssetUploadUrl` → client `PUT`s the file → `recordPartAsset` HEAD-verifies + writes the row. We **insert a client-side conversion step between file selection and the record call**, entirely in the curator's browser:

1. Curator picks `model.step`. The uploader **dynamically imports** the converter chunk (`occt-import-js` WASM, ~7 MB) — code-split, loaded **only** when uploading a 3D model (never on the part page, never for viewers).
2. occt tessellates STEP → mesh; three.js `GLTFExporter` serializes a `.glb`; we compute the bounding sphere → `renderBounds`. For a native `.wrl`, the same step runs `VRMLLoader` → `GLTFExporter` instead. **The stored render is always `.glb`** ⇒ one runtime loader forever.
3. Mint a **second** presigned PUT for the `.glb` — a new `createPartAssetRenderUploadUrl` (kind-scoped, forced `model/gltf-binary`) — and PUT the derived mesh.
4. `recordPartAsset` is extended to accept optional `renderKey`/`renderBytes`/`renderBounds`, HEAD-verify the `.glb`, and write all of it in the **same** row as the source.

**Failure is non-fatal (load-bearing).** If conversion fails (malformed STEP, browser OOM on a huge board), we **still upload and record the source** with `renderKey = null`. The asset is fully usable (download works); the viewer shows a graceful "no in-app preview — download to open in CAD" fallback. **Conversion never blocks curation.**

**Replace & delete.** Replacing the source re-runs conversion → new `.glb` (the existing replace path already re-enters `UNVERIFIED`; we repoint `renderKey` and best-effort-delete the old render object). Deleting the asset best-effort-deletes **both** R2 objects (source + render) — same swallow-the-orphan policy as today.

---

## 5. The reusable `<ModelViewer>` component

One client component, agnostic to provenance:
```
<ModelViewer src={inlineGlbUrl} bounds={renderBounds} label={...} />
```
- **Render stack:** three.js + `GLTFLoader` + `OrbitControls` **only**. No occt, no `VRMLLoader` at runtime (everything is already `.glb`). Neutral environment light + grid so a bare PCB part reads clearly; camera auto-framed from `bounds`.
- **Lazy by construction.** `next/dynamic` import with `ssr: false`; mounts **only on intent** — a poster/placeholder ("View 3D model") that mounts the canvas and fetches the `.glb` on click. (Default **click-to-load**; in-view auto-load via `IntersectionObserver` is a showcase upgrade we can flip on.) Keeps three.js (~150 KB gz) and the mesh off the initial part-page payload.
- **States:** loading → rendered scene; on fetch/parse error, the same "download to open in CAD" fallback as a missing render. A render-less asset (`renderKey == null`) shows no viewer affordance, only the existing download row.
- **Mount point (parts):** inside `AssetRow` for the `MODEL_3D` kind, directly under the filename/download line — the curator sees the model right where they verify it.
- **Reuse:** the board stub renders the **same** component from the `Artifact` surface, fed an Artifact's inline render URL + bounds. Nothing in `<ModelViewer>` knows about parts vs boards.

**Bundle discipline:** three.js + the viewer in a route-split chunk loaded on intent; occt in a separate chunk loaded only on the upload path. A visitor who never opens a model sees **unchanged** baseline JS.

---

## 6. Verify-gate & view semantics
- **Trust-agnostic viewing.** The viewer renders at `UNVERIFIED`/`VERIFIED`/`FLAGGED` alike — viewing is *how you verify*. The `VerifyBadge` on the row continues to reflect the source model's trust; the render carries no trust of its own.
- **Curation actions unchanged.** Upload/replace/delete/verify/flag stay `canEdit`-gated with the existing optimistic-concurrency fence; the render columns ride along on the same row writes.

---

## 7. Testing & verification
- **Vitest (real Neon, sequential)** covers the schema/action/migration surface: render-column round-trips through `recordPartAsset` (with and without a render), replace repoints `renderKey`, delete removes both objects, the `presignGetInline` shape, the `MODEL_3D` Artifact subkind. Throwaway rows in `beforeAll`/`afterAll`; never touch curriculum/seed data.
- **The viewer itself** (client-heavy, no DOM harness) is verified by `tsc` + `pnpm run build` + manual on a pilot part, with **optional Playwright smoke** via `superpowers:webapp-testing` (mount the viewer, assert a canvas + no console errors).
- **`"use server"` discipline:** new actions live in the existing `part-assets.ts` (`"use server"`, async-only exports). Pure helpers (`presignGetInline`, any convert glue) live in non-`"use server"` modules (`part-r2.ts` / a new client converter module).

---

## 8. Open risks to confirm during planning
1. **R2 CORS `GET`** rule for the app origin (browser `fetch` of the `.glb`).
2. **`occt-import-js` fidelity/perf** on representative parts (and license/bundle size).
3. **Board-scale `.glb` perf ceiling** — informs whether the stub later needs Draco/meshopt compression.
4. **Conversion robustness** — which STEP variants occt handles cleanly vs. falls back to download-only.
5. **`GLTFExporter` in a Worker** — consider running tessellation + export off the main thread so a large model doesn't freeze the curator's tab (nice-to-have; the failure-fallback makes it non-blocking).

---

## 9. Build sequence (for the plan)
1. **Schema + migration** — render columns on `PartAsset`; `ArtifactSubkind.MODEL_3D` + render columns on `Artifact`; hand-written SQL.
2. **R2 inline path** — `presignGetInline`; confirm/add the CORS `GET` rule.
3. **Convert-at-upload** — client converter module (occt + `GLTFExporter`, code-split); `createPartAssetRenderUploadUrl`; extend `recordPartAsset`; failure fallback; replace/delete cleanup.
4. **`<ModelViewer>`** — three.js + `GLTFLoader` + `OrbitControls`, lazy, fallback; mount in `AssetRow`.
5. **Board stub** — manual `MODEL_3D` Artifact upload + render through the same path/viewer.
6. **Finish** — full Vitest suite + `build` + manual pilot, then PR.
