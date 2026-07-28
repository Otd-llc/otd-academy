# Board → Lesson Pipeline — scoping

_2026-06-16. Level 1 completion (L1.02–L1.05 to L1.01's bar) is the decided gating
priority for monetization, but it's **blocked upstream on hardware design** — those
four boards must be designed/built before accurate lessons can be authored. This doc
scopes how to make the **board → published lesson** path cheaper, so every future
board flows into a lesson with less manual work. Grounded in a read-only audit of the
existing tooling, not memory._

---

## 1. The bar (definition of done) — what L1.01 actually is

L1.01 (`l1-01-wroom-breakout`, PUBLIC, published) is the quality bar. From the DB:

- **8 stage cards** (one per stage REQUIREMENTS → BRINGUP), **4 gates**, **~382 content
  blocks (~165k chars)**.
- Block mix: **155 callout · 59 prose · 56 image · 25 deepDive · 24 steps · 23 table ·
  16 video · 8 quiz · 5 partModel · 4 sourceRef · 3 vendorCta · 3 action · 1 kit**.
- An **18-question final exam** (75% pass → MASTERED).

By contrast L1.02–L1.05 are **identical skeletons**: 8 stage cards + 4 gates, but only
**~14 blocks (~2k chars)** of stub prose/callouts each, **zero images, zero quizzes, no
exam**. The structure exists; the depth (≈96% of the work) does not.

**A "done" lesson** ≈ L1.01's profile: rich content across all 8 stages, per-stage
quizzes, images/diagrams, a final exam, all gates wired, then `publishedRevisionId` set.

---

## 2. The pipeline — what a new board gets for free vs. what's manual

| Step | Automated (free once data exists) | Manual (per lesson) |
|---|---|---|
| **0. Design the board** | — | ⚙️ **KiCad design — the upstream bottleneck (hardware, Josh)** |
| **1. Project + revision + BOM + parts** | schema + admin UI | enter `BomLine`s; create `Part`s; upload/verify CAD assets (SYMBOL/FOOTPRINT/MODEL_3D) or accept UNVERIFIED stubs |
| **2. KiCad export ZIP** | ✅ `buildKicadExportZip(revisionId)` — schematic (unwired placed parts, *by design*), PCB base, libs, `bom.csv`, coverage report | uploading real symbols/footprints/3D to avoid stubs |
| **3. Guide skeleton** | ✅ `composeGuide` → 8 stage cards (eyebrow/title/lead/baseBlocks/gate/completionRef) + per-track SCHEMATIC overlay + slug-matched gotcha callouts; `materialize-curriculum-guides.ts` | — |
| **4. Deep stage content** | — | 🔴 **the dominant cost** — all custom prose/callouts/steps/tables/deepDives/kits beyond the skeleton (L1.01 took ~18 hand-authoring scripts). No templates past the skeleton. |
| **5. Media** | ✅ in-app admin capture (getDisplayMedia → webp/clip → R2 → block) + 14 reusable React diagram components + glossary `[[term]]` (100+ terms) | 🔴 every image/diagram/video captured or drawn per lesson (56 in L1.01); per-lesson static SVGs |
| **6. Quizzes** | ✅ `quiz` block type + client scoring | 🔴 author per-stage quizzes (8 in L1.01) |
| **7. Exam** | ✅ `Exam` model + server grading + UI; idempotent seed script | 🟡 author ~15–20 questions |
| **8. Gates** | ✅ generic gate-spec (SCHEMATIC=ERC, LAYOUT=DRC, rest=quiz) + per-flag (`requiresStripboard`, `hasMainsNet`) | 🟡 a few per-lesson checklists hand-created |
| **9. Publish** | ✅ set `publishedRevisionId` | — |

**Takeaway:** the *framework* is mature. The cost is concentrated in **(4) deep content +
(5) media + (6/7) assessments** — all irreducibly content, and all blocked until the board
exists (step 0).

---

## 3. Friction, ranked (the real costs)

1. **Deep per-stage content has no scaffold past the 8-card skeleton.** Each lesson is a
   near-blank page authored block-by-block via direct-Prisma operation scripts. This is
   ~96% of the per-lesson effort and the L1.01 evidence (18 passes) shows it.
2. **Media is fully manual.** The capture mechanism is good, but every one of ~56 images +
   16 clips is captured/placed by hand; per-lesson diagrams are bespoke SVGs.
3. **BOM-sourcing stage is data-blind.** The BOM data (`BomLine`: refDes, MPN, qty,
   datasheet) exists, but the BOM_SOURCING card is hand-written prose — **no data-driven
   sourcing table generated from the BOM**. The audit flagged this explicitly.
4. **Part-asset curation / stub proliferation.** A new board's BOM has many parts with no
   uploaded CAD → UNVERIFIED stubs; symbols/footprints/3D + part facts are curated
   per-part with no bulk import.
5. **Gotchas + some gates are hardcoded** (`gotcha-blocks.ts`, per-flag checklists) — new
   discipline callouts need a code change.
6. **Quizzes + exam** are hand-authored (medium, irreducible — they need the engineering).

---

## 4. Highest-leverage tooling investments (board-independent — pay off on every lesson)

These cut the per-lesson burden *now*, before the boards exist, and compound across all 4
remaining L1 lessons (and L2/L3 later):

- **A. Data-driven BOM/sourcing block (highest value).** A new `bomTable`/sourcing block
  rendered from `BomLine` data (refDes, MPN, qty, datasheet link, vendor CTA) — turns the
  thinnest, most-blank stage into auto-content from data you already enter. Directly closes
  friction #3. _Est: medium (one block type + renderer + a generator from BOM rows)._
- **B. Per-stage content scaffolds (the L1.01 shape as a template).** Extend the skeleton
  beyond 1 stub block: pre-seed each stage with the *structure* L1.01 converged on — a
  mode-band ORIENT/DO/CHECK ribbon, section headers, an empty quiz stub, a deepDive stub,
  and image placeholders with `captureHint`s. Authoring becomes fill-in-the-blank, not
  blank-page. Directly attacks friction #1 (the dominant cost). _Est: medium; extends
  `stage-skeletons.ts` + `compose.ts`._
- **C. Batch capture queue.** Placeholders + `captureHint`s already exist; surface a
  per-lesson "all empty media" capture list so an admin shoots them in one session instead
  of hunting card-by-card. Attacks friction #2. _Est: small–medium (UI over existing data)._
- **D. Definition-of-Done check.** A script/report that scores a lesson against the L1.01
  profile (≥N blocks/stage, ≥1 image/stage, 8 quizzes, an exam, all gates) so "ready to
  publish" is measurable, not vibes. _Est: small._
- **E. Part-asset bulk import** (SnapEDA/SamacSys) to cut stub proliferation — _bigger,
  defer_ until a board's BOM makes it worth it.

**Honest framing:** tooling *scaffolds* content; it can't *write* it. The engineering
knowledge for each board (the why behind each schematic/layout choice) is irreducible
author work, and it can't start until the board is designed. So the throughput ceiling is
still **board design (step 0)** — the tooling above makes each lesson cheaper, not free.

---

## 5. Recommended sequence

1. **Unblock prioritization:** decide *which* L1 board to design first — ideally
   demand-driven (a **waitlist admin view** over the per-course signups we now capture
   would answer this directly).
2. **Build the scaffolds (A + B + D)** while the first board is being designed — they're
   board-independent and make lesson #1 (and every lesson after) materially cheaper.
3. **Pilot one lesson end-to-end** with the new scaffolds (the first designed board) to
   validate the pipeline and calibrate the real per-lesson effort before scaling to the
   other three.
4. Add **C** (batch capture) and **E** (bulk CAD import) if the pilot shows they're worth it.

---

## Appendix — key files (from the audit)

**Guide authoring:** `src/lib/schemas/guide.ts` (16 block types) · `src/lib/guide-templates/{compose,stage-skeletons,track-overlays,gotcha-blocks}.ts` · `src/lib/glossary.ts` · `src/lib/inline-terms.ts` · `src/components/guide/{GuideBlocks,diagram-registry}.tsx` · `scripts/materialize-curriculum-guides.ts` · `scripts/_l101-*.ts` (the 18 L1.01 authoring passes).

**KiCad/BOM/parts:** `src/lib/kicad/export.ts` + `src/lib/kicad/{symbol-lib,footprint-lib,stubs,schematic,placement}.ts` · `src/lib/actions/kicad-export.ts` · `src/lib/actions/part-assets.ts` · `src/lib/model-convert.ts` · `src/components/ModelViewer.tsx` · `mcp/parts-server/` · schema: `Part`/`PartAsset`/`BomLine`.

**Media / gates / exam:** `src/components/guide/MediaCapture.tsx` + `src/app/api/{capture,shot}` + `src/lib/{capture-token,guide-block-write}.ts` · `src/lib/{gate-spec,learner-gates,load-gate-context,stages}.ts` · `src/lib/actions/exam.ts` + `src/components/learn/ExamForm.tsx` + `scripts/seed-l101-exam.ts`.
