# Handoff — Project Foundry, brainstorm the **3D-model viewer** feature

You're resuming work on **Project Foundry** (`c:\zzz\project-foundry`) to **brainstorm a new feature: an in-app 3D viewer** for CAD models. Start with `superpowers:brainstorming` (Socratic design refinement) — do NOT jump to code. The output of the brainstorm is a design doc; then `superpowers:writing-plans` → `superpowers:subagent-driven-development` → `superpowers:finishing-a-development-branch`, exactly as the parts-knowledge stages were built.

## The app (one paragraph)
Next.js 16 (App Router, RSC + client islands) / React 19 / TypeScript / Prisma 7 + Neon Postgres / Tailwind v4 (CSS-first, NO config, NO shadcn) / Radix / Zod 4 / Auth.js v5 — an internal hardware-design-lifecycle tracker. Production: foundry.onethousanddrones.com (Vercel + Neon + Cloudflare R2, all **live**). Branch off `main`.

## Where we are (relevant to 3D)
The **parts-knowledge system** is fully shipped on `main`:
- **Stage A** — per-part curated facts (`PartFact`) behind a human **verify gate** (`UNVERIFIED → VERIFIED → FLAGGED`, provenance precondition, optimistic concurrency, auto-demote).
- **Stage B** — a read-only MCP server (`lookup_part`/`lookup_bom`) over a least-privilege Neon role.
- **Stage C** — per-part **KiCad CAD assets**: `PartAsset { kind: SYMBOL | FOOTPRINT | MODEL_3D }`, uploaded to R2, verify-gated, downloadable; plus KiCad-metadata auto-extract and asset delete. (PRs #9 + #10.)

**The 3D model already lives in the data model** as the `MODEL_3D` PartAsset kind (`.step`/`.stp`/`.wrl`, stored on R2, with a presigned GET). Today it's upload/verify/**download** only — there is no in-app rendering. **This brainstorm is about rendering it** (and generalizing).

## The feature to brainstorm
A **three.js 3D viewer**, starting with a part's `MODEL_3D` asset on `/parts/[id]`, but explicitly designed to generalize to **any 3D artifact in the project** — sub-assemblies, and eventually **the full assembled PCB** (KiCad can export the board as 3D). The user's framing: *"Assets are displayed, including a three.js scene for the 3D model. We'll eventually be displaying anything 3D we create — the full 3D board when done will be displayed somewhere in the project."*

### The central decision (the thing the brainstorm must resolve): **render format + pipeline**
three.js renders **meshes**, but most source files are not meshes:
- **STEP (`.step`/`.stp`)** — the common SnapEDA/SamacSys 3D format — is **CAD B-rep** (parametric solids). Must be **tessellated to a mesh** first (needs an OpenCASCADE kernel).
- **WRL (`.wrl`)** — KiCad's own per-part 3D models are often VRML, which **is a mesh** → three.js `VRMLLoader` loads it **directly** (the genuine near-term easy win).
- **glTF/GLB** — the **web-native** 3D format three.js is happiest with, and what **KiCad 7+ can export the whole board as**.

Three approaches to weigh (the core trade-study):
| Approach | How | Trade-off |
|---|---|---|
| Client-side STEP | `occt-import-js` (OpenCASCADE → WASM) tessellates in-browser | No server pipeline; ~5–8 MB WASM + slow on complex parts/boards |
| Server-side convert at ingest | STEP → glTF (occt / FreeCAD headless) when an asset is recorded; store the glTF | Fast web-native runtime; adds a conversion dependency to the upload path |
| Standardize on mesh formats | Render only glTF/WRL; STEP stays the download/CAD-exchange artifact | Simplest viewer; you (or KiCad) produce the mesh |

Likely north star: **glTF as the render lingua franca**, with one reusable `<ModelViewer>` (three.js + GLTFLoader/VRMLLoader) used everywhere a 3D artifact appears (part model, sub-assembly, full board). The full-board case ties into the **deferred BOM → KiCad-library export phase** (where a board glTF would be generated).

### Open questions for the brainstorm (not exhaustive)
- Client-WASM vs server-convert vs require-glTF — and the perf ceiling for a full PCB.
- Does the viewer need its own artifact/asset notion, or reuse `PartAsset`/`Artifact`? Where do non-part 3D artifacts (the board) live?
- Loading/UX: lazy-load the (heavy) viewer; orbit controls; fallback when no renderable mesh; R2 CORS for in-browser fetch (note: the asset GET currently forces `Content-Disposition: attachment` for downloads — a viewer needs a *non-attachment* fetch path).
- Verify-gate interaction: does "view" require VERIFIED, or is viewing trust-agnostic?
- Bundle/cost: three.js + occt WASM are large — code-split aggressively.

## Files / concepts to read first
- `docs/plans/2026-06-03-parts-cad-assets-design.md` + `…stage-c-implementation.md` (the asset model + the §7 deferred board-export this connects to).
- `src/lib/schemas/part-asset.ts` (`ASSET_KIND_CONFIG` — MODEL_3D exts/cap), `src/lib/actions/part-assets.ts` (`getPartAssetDownloadUrl` — the presigned GET; note the attachment disposition), `src/lib/part-r2.ts`, `src/lib/r2.ts`.
- `src/components/parts/AssetRow.tsx` (where a per-part viewer would mount) + `src/app/parts/[id]/page.tsx`.
- `prisma/schema.prisma` (`PartAsset`, `Artifact`).

## Workflow + conventions (carry these)
- **Flow:** brainstorm → design doc → `writing-plans` → `subagent-driven-development` (fresh subagent per task + a code-review subagent between tasks; fix Critical/Important before the next task) → `finishing-a-development-branch` (full suite → push → PR → merge).
- **Windows/PowerShell:** prefix pnpm with `$env:Path = "c:/Users/raven/.local/bin;" + $env:Path`. `pnpm exec tsx scripts/*` is allowlisted.
- **gh:** `env -u GH_TOKEN gh …` (stale GH_TOKEN shadows the keyring login; handle is `joshtol`). **Push every commit before merging a PR** (a recent slip merged a stale branch — recovered via a follow-up PR).
- **Migrations:** `prisma migrate dev` is interactive-blocked here — hand-write the SQL into a new timestamped folder → `prisma migrate deploy`. **NEVER `migrate reset`** (wipes curriculum + curated data).
- **`"use server"` files export ONLY async functions** (not even `export type {X}` re-exports — runtime crash, uncaught by tsc/build). Pure helpers live in non-`"use server"` modules.
- **Scripting:** server actions can't be scripted (requireUser/revalidatePath) — use direct-Prisma seed-style scripts (dotenv + `.env.local`).
- **Tests:** Vitest, real Neon, sequential (~6 min full suite). Throwaway rows in beforeAll/afterAll; never touch curriculum/seed data. No DOM harness — UI verified by `tsc` + `pnpm run build` + manual. A 3D viewer is client-heavy; consider `superpowers:webapp-testing` (Playwright) for smoke if useful.
- **R2 is LIVE** (`R2_ENABLED=true`, bucket `foundry-prod`, CORS applied) — no infra gate for storage; a browser-fetch viewer may need a CORS/disposition tweak.
- **Commits:** trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Branch off `main`; commit/push only when asked.
- **Verify philosophy:** "authoritative-done" — trust from an explicit human gate, never inference.

## Memory
Auto-memory at `C:\Users\raven\.claude\projects\c--zzz-project-foundry\memory\` (MEMORY.md index). Especially: `parts-cad-assets-stage-c` (this feature's foundation + the format fork), `parts-mcp-stage-b`, `foundry-deployment`, `use-server-export-rule`, `foundry-headless-scripting`, `github-identity`, `claude-settings-allowlist`.

## First action
Invoke `superpowers:brainstorming` and refine the 3D-viewer idea — lead with the render-format/pipeline trade-study (it gates everything else), then the viewer component, where non-part 3D artifacts live, and the tie-in to the board-export phase. Confirm the design with the user before writing a plan.
