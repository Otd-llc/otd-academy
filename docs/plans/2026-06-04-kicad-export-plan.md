# BOM → KiCad Export — Implementation Plan

> **For Claude:** Execute via **superpowers:subagent-driven-development** — one fresh subagent per task, code review between tasks. Design: [2026-06-04-kicad-export-design.md](2026-06-04-kicad-export-design.md).

**Goal:** Generate a KiCad 10 project tree (libraries + scaffold + auto-wired power/ground rails) from a revision's BOM + verified assets + nets, downloadable as a `.zip` `BOM_EXPORT` artifact.

**Architecture:** Server-side string-templating of KiCad S-expr/JSON (no KiCad binary). New `Net`/`NetNode` revision data drives rail wiring. Output zipped (JSZip) → R2 → `Artifact`.

**Tech stack:** Next.js 16 server actions, Prisma 7 + Neon, Zod 4, vitest 4 (tests run against **real Neon**, mirror `part-assets-actions.test.ts`), `@aws-sdk/client-s3` for R2 (mirror `r2.ts`/`part-r2.ts`).

**Conventions (every task):** server actions live in `src/lib/actions/`, Zod schemas in `src/lib/schemas/`, tests in `src/lib/__tests__/`. Action files are `"use server"` → **export only async functions** (re-exported types crash at runtime — see the use-server rule). Mutations take `requireUser`, use optimistic concurrency on `updatedAt`, and `revalidatePath`. Verify gate = `FactTrust` UNVERIFIED→VERIFIED→FLAGGED, mirror `part-facts.ts`. Run `pnpm exec tsx`-style only for scripts; tests via `pnpm exec vitest run <file>`. After any schema change run full `tsc` **and** the full vitest suite (enum-mirror maps break silently — see the schema-change rule).

---

## Task 1: `Net` / `NetNode` schema + migration

**Files:**
- Modify: `prisma/schema.prisma` (add `Net`, `NetNode` models, `NetClass` enum, `Revision.nets Net[]`, `User` back-relation)
- Create: migration via `prisma migrate dev --name add-nets`
- Test: `src/lib/__tests__/nets-schema.test.ts`

**Steps:**
1. Add the models exactly as in design §2 (`Net`: `@@unique([revisionId,name])`; `NetNode`: `@@unique([netId,refDes,pin])`; `NetClass { GROUND POWER SIGNAL }`; `trust FactTrust @default(UNVERIFIED)` + verify audit fields; cascade `onDelete: Cascade` from Revision/Net).
2. Write the failing test: create a throwaway project→revision, create a `Net`, assert a duplicate `(revisionId,name)` throws; add two `NetNode`s, assert duplicate `(netId,refDes,pin)` throws; assert deleting the revision cascades nets+nodes. (Mirror the throwaway-entity + cleanup pattern in `part-assets-actions.test.ts`.)
3. `pnpm exec prisma migrate dev --name add-nets`; `pnpm exec prisma generate`.
4. Run the test → PASS. Run full `tsc --noEmit`.
5. Commit: `feat(nets): add Net/NetNode schema + migration`.

---

## Task 2: Net Zod schema + actions (CRUD, verify, deriveRails)

**Files:**
- Create: `src/lib/schemas/net.ts`, `src/lib/actions/nets.ts`, `src/lib/actions/nets-form.ts`
- Test: `src/lib/__tests__/nets-actions.test.ts`

**Steps:**
1. `net.ts`: Zod for net name (non-empty, KiCad-net-safe), `netClass`, node `{refDes, pin}`.
2. Actions (mirror `part-facts.ts` for requireUser + optimistic concurrency + verify gate): `createNet`, `deleteNet`, `addNetNode`, `removeNetNode`, `setNetTrust` (verify/unverify/flag).
3. **`deriveRails(revisionId)`** — the meaty one. Contract: load the revision's BOM lines → each part's `PINOUT` `PartFact`; expand each `BomLine.refDes` (comma-split) into individual designators; for every pin with `type==="gnd"` create/attach a `NetNode(refDes,pin)` to a `GND` net (create GND net if absent); for every `type==="power"` pin, attach to a **proposed** net named from the pin name (e.g. `3V3`,`VDD`→`+3V3`; `VBUS`,`5V`,`VIN`→`+5V`) — all created `UNVERIFIED`. Idempotent (re-run reconciles, doesn't duplicate). Returns a summary `{nets, nodesCreated, proposed}`.
4. TDD: write failing tests first — create a revision whose BOM has a part with a PINOUT fact (gnd + power + io pins); assert `deriveRails` creates `GND` with the gnd nodes, proposes power net(s), leaves io pins alone, is idempotent on re-run, and that nets are UNVERIFIED. Test verify/CRUD actions. (Real Neon; throwaway + cleanup.)
5. Run tests → PASS; `tsc`.
6. Commit: `feat(nets): net actions + deriveRails from PINOUT facts`.

---

## Task 3: Net editor UI on the revision page

**Files:**
- Create: `src/components/nets/NetEditor.tsx` (client), `src/components/nets/DeriveRailsButton.tsx`
- Modify: `src/app/projects/[slug]/[revLabel]/page.tsx` (mount the editor in a pane), `src/lib/actions/nets-form.ts` (form wrappers)
- Test: `src/components/__tests__/net-editor.test.ts` (logic-level, mirror existing component tests)

**Steps:**
1. Server-load the revision's nets+nodes; render a table (net name · class · trust badge · nodes `refDes.pin`) with add/remove-node, delete-net, and verify/unverify buttons (reuse `VerifyBadge`).
2. "Derive rails" button calls `deriveRails`; show the summary.
3. Follow the existing pane pattern (e.g. `RevisionChecklistsPane`) for layout + `SaveButton`/`IconButton`.
4. Test the form-action wiring + any client reducer logic. UI smoke only where full render isn't unit-testable.
5. `tsc`; run tests → PASS.
6. Commit: `feat(nets): revision net editor UI + derive-rails`.

---

## Task 4: KiCad S-expr primitives + library assembly

**Files:**
- Create: `src/lib/kicad/sexpr.ts` (tiny S-expr builder/serializer), `src/lib/kicad/symbol-lib.ts`, `src/lib/kicad/footprint-lib.ts`, `src/lib/kicad/lib-tables.ts`
- Test: `src/lib/__tests__/kicad-lib.test.ts` + fixtures under `src/lib/__tests__/fixtures/kicad/`

**Steps:**
1. `sexpr.ts`: minimal typed S-expr node + serializer (KiCad formatting: parens, quoted strings, indentation). Unit-test round-trips.
2. `symbol-lib.ts`: parse an uploaded `.kicad_sym`, **set the symbol's `Footprint` property** to `<nick>:<fpName>`, merge N symbols into one `kicad_symbol_lib`. Validate format against U1's real SnapEDA `.kicad_sym` (we have it) — use it as a golden fixture.
3. `footprint-lib.ts`: rewrite each `.kicad_mod`'s `(model …)` path → `${KIPRJMOD}/3dmodels/<file>`.
4. `lib-tables.ts`: emit `sym-lib-table` / `fp-lib-table` pointing at `${KIPRJMOD}/libs/…`.
5. TDD throughout: golden-file tests for each generator (assert exact emitted text for a fixture input).
6. `tsc`; tests → PASS.
7. Commit: `feat(kicad): s-expr primitives + symbol/footprint lib assembly`.

---

## Task 5: Project config (`.kicad_pro`) + placement + minimal `.kicad_pcb`

**Files:**
- Create: `src/lib/kicad/project.ts`, `src/lib/kicad/placement.ts`, `src/lib/kicad/pcb.ts`
- Test: `src/lib/__tests__/kicad-project.test.ts`

**Steps:**
1. `project.ts`: `.kicad_pro` JSON from a default board config (2-layer, 1oz, learner-friendly clearances, a wider **Power** net class, 3D search path). Typed config object with overridable fields.
2. `placement.ts`: deterministic grid layout → `(x,y,rotation)` per ref-des (non-overlapping, stable ordering by ref-des).
3. `pcb.ts`: minimal `.kicad_pcb` (board setup/layers/rules only, no footprints — they arrive via Update-PCB-from-Schematic).
4. TDD: golden tests for `.kicad_pro` JSON shape + placement determinism (same input → same coords).
5. `tsc`; tests → PASS.
6. Commit: `feat(kicad): project config + placement + base pcb`.

---

## Task 6: Stub generation + coverage report

**Files:**
- Create: `src/lib/kicad/stubs.ts`, `src/lib/kicad/report.ts`
- Test: `src/lib/__tests__/kicad-stubs.test.ts`

**Steps:**
1. `stubs.ts`: when a part lacks a SYMBOL, synthesize a stub symbol — a box with one pin per PINOUT-fact pin (number/name/type), or a generic box if no pinout. Missing FOOTPRINT → generic footprint from the `footprint`/package string. Missing 3D → omit.
2. `report.ts`: build `EXPORT_REPORT.md` — per part, symbol/footprint/3D = verified | unverified | stubbed | missing, plus a summary count.
3. TDD: stub symbol from a fixture PINOUT fact (assert pins emitted); report formatting for a mixed-coverage BOM.
4. `tsc`; tests → PASS.
5. Commit: `feat(kicad): asset stubs + coverage report`.

---

## Task 7: Schematic generation + power-rail geometric wiring (CRUX)

**Files:**
- Create: `src/lib/kicad/schematic.ts`, `src/lib/kicad/pin-geometry.ts`
- Test: `src/lib/__tests__/kicad-schematic.test.ts`, `src/lib/__tests__/kicad-pin-geometry.test.ts`

**Steps:**
1. `pin-geometry.ts`: given a symbol's pin `(at x y angle)(length L)` and an instance `(at X Y rot)`, compute the absolute connection-point coordinate + orientation. **Unit-test at 0/90/180/270° + mirrored** with hand-computed expecteds — this is the riskiest math.
2. `schematic.ts`: place each symbol instance (from Task 5 placement); for each **verified** `Net` of class GROUND/POWER, for each `NetNode`, drop a power-port symbol (`power:GND`/`power:+3V3`/…) or `(global_label)` at the computed pin coordinate, with a short connecting `(wire)` if the port anchor ≠ pin point. Signal pins left open. Emit valid `.kicad_sch`.
3. TDD: feed a 2-part fixture with a GND net spanning both → assert a GND port emitted at each gnd pin's computed coordinate; assert signal pins untouched; assert unverified nets are skipped.
4. `tsc`; tests → PASS.
5. Commit: `feat(kicad): schematic generation + power-rail wiring`.

---

## Task 8: Export orchestration — zip, R2, artifact, download

**Files:**
- Add dep: `jszip`
- Create: `src/lib/kicad/export.ts` (assemble the tree), `src/lib/actions/kicad-export.ts` (server action), `src/components/KicadExportButton.tsx`
- Modify: `src/app/projects/[slug]/[revLabel]/page.tsx` (button, BOM_SOURCING stage)
- Test: `src/lib/__tests__/kicad-export.test.ts`

**Steps:**
1. `export.ts`: orchestrate — load BOM lines + part assets (from R2, mirror `part-r2.ts`) + nets + board config → run Tasks 4–7 generators → assemble the §1 tree → JSZip → `Buffer`.
2. `kicad-export.ts`: `requireUser`; call `export.ts`; `PutObject` the zip to R2 (key `exports/{revisionId}/kicad-{cuid}.zip`, mirror `r2.ts`); create an `Artifact` (`kind:FILE`, `subkind:BOM_EXPORT`, stage `BOM_SOURCING`, fileKey/mime/bytes) (mirror `artifacts.ts`); `revalidatePath`.
3. `KicadExportButton.tsx`: triggers the action, links the resulting artifact (reuse `ArtifactDownloadLink`).
4. TDD: orchestration test with R2 mocked (mirror the `vi.mock("@/lib/part-r2")` pattern) → assert zip contains the expected entries (`*.kicad_pro`, `libs/*.kicad_sym`, `sym-lib-table`, `EXPORT_REPORT.md`) for a fixture revision; assert the Artifact row is created.
5. `tsc`; **full vitest suite**; `pnpm run build`.
6. Commit: `feat(kicad): export action + zip/R2/artifact + download button`.

---

## Final
- Full `tsc --noEmit` + full vitest suite + `pnpm run build` green.
- Final code review across the whole branch.
- Manual acceptance: generate an export for `foundry-l1-01-wroom-breakout@v1`, open the zip in KiCad 10, confirm libraries load + power rails appear + report lists the 16 stubbed parts.
- Finish via **superpowers:finishing-a-development-branch** (PR to `main`).
