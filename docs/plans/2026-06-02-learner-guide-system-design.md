# Learner Guide System, Tooltips, and Bench-Style Headers — Design

**Date:** 2026-06-02
**Status:** Approved + adversarially validated against the codebase 2026-06-02 (six-agent verification; §3 completion model, §6/§7 notes, and §10 dependencies corrected from the original draft).
**Motivator:** The TB-1-POWER "Bench Console" docs (`C:/zzz/otd/hardware/schematic/test-boards/TB-1-POWER/docs/bench`) — a 4-card interactive hardware bench guide. We want equivalent learner-facing guides for every Foundry curriculum project, a reusable tooltip/glossary primitive, and the bench-doc header aesthetic.

---

## 1. Goals & scope

Build a **learner guide capability** in the Foundry and author guides for **all 22 curriculum projects**, plus a **reusable tooltip/glossary primitive** and a **reusable bench-styled page header**.

Each guide walks the learner through the **full design→bringup pipeline** — one card per `Stage` from `REQUIREMENTS` through `BRINGUP`. Bench-style hand-assembly (the TB-1-POWER depth) is the `ASSEMBLY`/`BRINGUP` cards; earlier cards teach the design stages.

**Card span = 8 stages.** The `Stage` enum has **9** members (`REQUIREMENTS, SCHEMATIC, BOM_SOURCING, LAYOUT, DRC_GERBER, ORDERING, ASSEMBLY, BRINGUP, REVISION` — `prisma/schema.prisma:131-141`). `REVISION` is the post-bring-up respin stage, not part of *creating* the board, so it is **excluded** from the card set. Hence **8 cards/guide → 176 cards** for 22 guides (not 198). `GuideCard.@@unique([guideId, stage])` still permits a `REVISION` card if we later want one.

**Cards do not map uniformly onto checklist gates.** Only 3 of the 8 stages are completed by a *revision-scoped* checklist; the rest use build/board-scoped checklists, artifacts, commits, or board statuses. The completion model is per-stage — see §3.

### Non-goals (this effort)
- A WYSIWYG guide authoring UI beyond per-card content-block editing.
- Porting TB-1-POWER itself into the Foundry DB (it is not one of the 22; it is the reference exemplar for *level of detail*).
- Replacing the existing Checklist / Measurement / gate systems — guides reuse them.

### Success criteria
- A Prisma migration adds `Guide` + `GuideCard`; a composer generates guides from curriculum metadata; a backfill materializes all 22.
- A learner can open `/projects/[slug]/[revLabel]/guide`, see per-stage cards with progress, and complete a stage's actions inline (which drive the existing gate).
- A `Tooltip` (hover hint) and `GlossaryTerm` (click-to-read) primitive exist, are accessible (correct ARIA), and are reused across the app.
- A `PageHeader` reproduces the bench header (mono breadcrumb → two-tone title → italic lead → gold rule) from existing tokens.

---

## 2. Key decisions (validated)

| Decision | Choice | Rationale |
|---|---|---|
| Scope | System **+ all 22 curriculum guides** | User intent: every project guides the learner through creating it. |
| Guide span | Full **design→bringup pipeline**, one card per `Stage` | Maps to the existing stage state machine and gates; "creating the project" = the whole pipeline. |
| Data model | **Separated teaching layer** (`Guide`/`GuideCard`) + reuse `Checklist`/`Measurement`/gates | Avoids duplicating battle-tested gate machinery; keeps teaching vs. completion concerns separate. |
| Content source | **Materialize into editable per-revision rows** | Mirrors `materializeCanonicalChecklist`; supports per-board annotation/corrections (the bench docs do this). |
| Tooltip tech | **Radix UI** (`@radix-ui/react-tooltip` + `react-popover`) | Industry-standard, accessible-by-default, RSC-compatible as client leaves, styleable with existing Tailwind tokens. |
| Completion UX | **Uniform per-card "stage gate" affordance** over heterogeneous sources | Every card shows the same "✓ done / N remaining" footer regardless of checklist/artifact/commit/board-status backing. |
| Following scope | Design cards (REQUIREMENTS→ORDERING) **revision-level**; ASSEMBLY/BRINGUP **per-board** | Matches Foundry scoping + the bench docs' per-board (B01…Bn) logs. |
| ASSEMBLY depth | **One** rich ASSEMBLY card; bench technique lives in its teaching blocks | Per the full-pipeline choice (not a bench sub-guide); gate = new `POST_ASSEMBLY_CONTINUITY` template. |
| Sequencing | **Merge seed PR #1 → `main` first**, rebase, extract shared `gotcha-blocks.ts` | Composer reuses the seed's gotcha catalog; avoids divergence (§10). |

### Context that made these cheap/correct
- **Styling already aligns.** `src/app/globals.css` already defines the *same* tokens as the bench docs: `--color-command-gold #c8963e`, `--color-signal-blue #4a8fff`, `--color-deep-space #08090d`, and the Bebas Neue / Space Mono / Lora trio. There is even a `.note-italic` recipe commented "for inline help text and tooltips." Header adoption is mostly assembling a component from existing tokens.
- **The guide gap is known.** `ArtifactSubkind` reserves `ASSEMBLY_PROCEDURE` / `BENCH_PROCEDURE` ("Revision-scoped template") but they are **dead** — listed in no stage's allowed subkinds and creatable by no code path. The Phase-1 design doc (`docs/plans/2026-05-27-design-foundry-phase1-design.md:962-963`) explicitly defers "procedure correction model" and "structured Build-level risk callouts," naming the TB-1-POWER bench docs as the motivator.
- **No tooltip component exists.** Every "tooltip" today is a raw HTML `title=` attribute; no UI primitive lib is installed. (See `src/components/StageTracker.tsx:116`, `MarkBringupCompleteButton.tsx:30,62`, `SaveButton.tsx:23`, etc.)

---

## 3. Data model (teaching layer)

Two new Prisma models, **revision-scoped** (author once per design revision, mirroring the Checklist template pattern):

```prisma
model Guide {
  id            String      @id @default(cuid())
  revisionId    String      @unique
  revision      Revision    @relation(fields: [revisionId], references: [id], onDelete: Cascade)
  title         String
  trackSnapshot CurriculumTrack?   // denormalized for render/labeling
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  createdById   String
  createdBy     User        @relation(fields: [createdById], references: [id], onDelete: Restrict)
  cards         GuideCard[]
}

model GuideCard {
  id               String            @id @default(cuid())
  guideId          String
  guide            Guide             @relation(fields: [guideId], references: [id], onDelete: Cascade)
  stage            Stage             // which pipeline stage this card teaches
  ordinal          Int
  eyebrow          String            // e.g. "PHASE 04"
  title            String            // e.g. "LAYOUT"
  lead             String?           // italic-serif dek
  contentBlocks    Json              // Zod-validated discriminated-union array
  isGate           Boolean           @default(false)
  completionRef    Json?             // typed ref to the card's completion source (see §3)
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt

  @@unique([guideId, ordinal])
  @@unique([guideId, stage])
}
```

`Revision` gains `guide Guide?` and `User` gains `guidesCreated Guide[]` back-relations.

### Content block vocabulary (Zod discriminated union, stored in `contentBlocks`)

Derived directly from the bench-doc element catalog:

- `{ type: "prose", md }` — markdown paragraph (sanitized on render, per existing `sanitize-html` use).
- `{ type: "callout", severity: "critical" | "warn" | "info", label, body }` — the 3-severity callout.
- `{ type: "steps", ordered: boolean, items: string[] }` — numbered technique primers.
- `{ type: "table", columns: string[], rows: Cell[][] }` — `Cell` supports `ref` / `mpn` / `badge{tone}` decorations.
- `{ type: "termRef", term }` — inline jargon → renders `GlossaryTerm`.
- `{ type: "sourceRef", label, href }` — deep link to source-of-truth docs.

`contentBlocks` are **pure teaching content**. The card's **actionable completion widget** (the checklist editor, measurement-capture form, or read-only artifact/commit/board-status state) is *not* a content block — it is rendered separately by the card's `completionRef` adapter (§3, "Completion & gates") at a fixed position (card footer), keeping teaching and completion concerns cleanly split.

### Completion & gates: **reuse existing systems, but the source differs per stage**

The guide still owns no completion state — it reuses the existing substrate. **But that substrate is not uniformly a revision-scoped checklist**, so `completionRef` is a typed discriminated reference (stored as JSON), and each card renders the *existing* component appropriate to its completion source:

```ts
type CompletionRef =
  | { kind: "revisionChecklist"; subkind: ChecklistSubkind }   // render ChecklistEditor (revision-owned)
  | { kind: "buildChecklist";    subkind: ChecklistSubkind }   // resolve activeBuild → ChecklistEditor (build-owned)
  | { kind: "boardMeasurements"; steps: string[] }             // resolve board → AddMeasurementForm
  | { kind: "artifact";          subkinds: ArtifactSubkind[] } // artifact presence (existing pickers/lists)
  | { kind: "commit";            field: "schematicCommit" | "layoutCommit" }
  | { kind: "boardStatus";       statuses: BoardStatus[] }     // board roster status
  | { kind: "none" };                                          // pure teaching card
```

Verified mapping of the 8 cards to their real completion source (`src/lib/stages.ts`):

| Card (Stage) | Completion source | Scope | `completionRef` |
|---|---|---|---|
| REQUIREMENTS | `REQUIREMENTS_REVIEW` checklist | **revision** | `revisionChecklist` |
| SCHEMATIC | `SCHEMATIC_FILE` artifact + `schematicCommit` | revision | `artifact` + `commit` |
| BOM_SOURCING | `STRIPBOARD_VALIDATION` checklist *iff* `requiresStripboard`, else BOM artifacts | **revision** | `revisionChecklist` / `artifact` |
| LAYOUT | `LAYOUT_REVIEW` checklist | **revision** | `revisionChecklist` |
| DRC_GERBER | `DRC_REPORT` / `GERBER_ZIP` artifacts | revision/build | `artifact` |
| ORDERING | `PCB_ORDER` / `PARTS_ORDER` artifacts | **build** | `artifact` |
| ASSEMBLY | `POST_ASSEMBLY_CONTINUITY` checklist (+ measurements) | **build/board** | `buildChecklist` + `boardMeasurements` |
| BRINGUP | `BRINGUP_LOG`/`BRINGUP_COMPLETE` artifacts + board statuses | **build/board** | `artifact` + `boardStatus` |

So the original "render the checklist inline / zero new gate logic" framing is true **only for REQUIREMENTS, LAYOUT, and conditional BOM_SOURCING** (the three revision-scoped checklist gates, matched by `.subkind` — confirmed at `stages.ts:146,221,273`). For the other five cards the guide renders the existing artifact/measurement/board components, and the gate is the existing artifact/commit/status check. The guide adds **no new gate predicate**, but it does add **render adapters** that map each `completionRef` to the right existing component + read its live state for the progress roll-up.

**Build/Board resolution (new logic the original draft omitted).** Guides are revision-scoped, but `POST_ASSEMBLY_CONTINUITY` is build-scoped and `Measurement` is board-scoped (per board, `boardId` required — `schemas/measurement.ts:30`). A guide card needing build/board scope must resolve the revision's **active unfrozen Build** (the existing `build_one_unfrozen_per_revision` invariant gives at most one) and, for measurement capture, a **selected Board** (the guide hub carries an active-build context; the ASSEMBLY/BRINGUP cards expose a board picker). The hub/card render must gracefully handle *no active build* and *no boards registered* — the same states the ASSEMBLY/BRINGUP gates already enumerate.

**Downstream checklists are not pre-seeded.** The 22 curriculum revisions currently have only their `REQUIREMENTS_REVIEW` checklist materialized (they sit at `REQUIREMENTS`). `LAYOUT_REVIEW` / `STRIPBOARD_VALIDATION` are materialized lazily (today via the revision UI). A `revisionChecklist` card must therefore **lazily materialize** its canonical checklist when the learner reaches it (reuse `materializeCanonicalChecklist`) rather than assume it exists. `POST_ASSEMBLY_CONTINUITY` has **no canonical template and no build-scoped materialize action** today — authoring both is net-new work for the ASSEMBLY card.

### Resolved completion-UX decisions (2026-06-02 discussion)

- **(A) Uniform "stage gate" affordance.** Despite the heterogeneous sources above, every card renders the *same* footer widget — a "✓ done / N remaining" gate state — so the learner experience is consistent ("complete this card → advance"). The widget is a thin presenter over the `completionRef` adapter: `revisionChecklist`/`buildChecklist` show the live `ChecklistEditor`; `boardMeasurements` shows the capture form + remaining steps; `artifact`/`commit`/`boardStatus` show a read-only "present/absent" state with a deep link to where the learner satisfies it. Computing "done" reuses the **existing stage gate predicate** for that stage wherever one exists, so the card's notion of done never diverges from the real gate.
- **(B) Following scope: revision-level vs per-board.** Design-stage cards (REQUIREMENTS → ORDERING) are followed **once per revision**. ASSEMBLY and BRINGUP cards are **per-board**: the hub renders a board matrix (B01…Bn for the active build), and those cards' completion (POST_ASSEMBLY_CONTINUITY check, measurements, board status) is tracked **per board**. The hub's roll-up is therefore two-tier: revision-level progress for design cards + a per-board grid for the build cards. Handles no-active-build / no-boards by showing the build cards as "blocked until a build/boards exist."
- **(C) ASSEMBLY card is one card.** Per the full-pipeline choice (not the bench sub-guide variant), ASSEMBLY is a single card. Its completion source is a **new `POST_ASSEMBLY_CONTINUITY` canonical template** (the Step-0 screening / continuity content). The deep bench technique from the TB-1-POWER reference (sequence discipline, drag-tin primer, pin-1 / polarity, time budgets) lives in the card's **teaching `contentBlocks`** (callouts + numbered `steps` + tables), so the depth is preserved without fragmenting the gate.

---

## 4. Content templating (authoring 22 guides without hand-typing 176 cards)

`src/lib/guide-templates/`:

- **`stage-skeletons.ts`** — per-`Stage` shared card: eyebrow/title, generic *process* prose, its `completionRef` (§3 table), `isGate`.
- **`track-overlays.ts`** — per-`CurriculumTrack` (SENSE/ACT/POWER/COMMS) content flavor.
- **`gotcha-blocks.ts`** — the §6 cross-cutting gotchas (WS2812 level-shift, servo brownout, ADC1-only, isolation post-regulator, WROOM antenna keep-out, auto-shutoff) as reusable `callout` blocks, each with a predicate `(project, stage) => boolean` for attachment.
- **`compose.ts`** — `composeGuide(project): ComposedGuide` merges skeleton + track overlay + project overlay (`disciplineTaught`, applicable gotchas, locked decisions) into the full card set. `Project.track` is nullable (`schema:82`); the composer must define a **neutral fallback overlay** for a null track (all 22 curriculum projects have a track today, but the bench tools' future siblings or ad-hoc projects may not).

> **Reuse the seed's gotcha catalog, don't fork it.** The per-board gotcha predicates and item strings (antenna keep-out on all WROOM boards, isolation post-reg on `foundry-l2-05`/`foundry-l3-01`, the WS2812/servo/ADC1/auto-shutoff set) already live in `scripts/populate-curriculum-dag.ts` (on the unmerged `seed/curriculum-dag-population` branch). `gotcha-blocks.ts` must be the **single source** for these — extract them so the composer and the REQUIREMENTS_REVIEW seed agree. See §10 (sequencing dependency).

`materializeGuide(revisionId)` server action mirrors `materializeCanonicalChecklist` (`src/lib/actions/checklists.ts:601`): compose → write `Guide` + `GuideCard` rows in a Serializable tx, freeze-guarded via `assertNotFrozen`. **Dedupe:** unlike the checklist path (which dedupes on `(revisionId, subkind)` via `findFirst`), `Guide.revisionId` carries a real `@unique`, so the action must **both** pre-check (friendly "guide already exists" error) **and** catch a Prisma `P2002` from a concurrent double-materialize. A **backfill script** materializes guides for the 22 curriculum revisions. After materialization, cards are hand-editable so a board's guide can diverge from the generic template as real notes accrue.

---

## 5. Learner-facing render + routes

- **Hub** — `/projects/[slug]/[revLabel]/guide`: bench header + a **two-tier** layout (per decision B): (1) a card grid for the design stages (REQUIREMENTS→ORDERING), each colored gold (complete) / blue (partial) / muted (untouched) like the bench `decorateIndexCards` aggregate; (2) a **per-board matrix** (B01…Bn of the active build) for the ASSEMBLY/BRINGUP cards. When there is no active build or no boards, the build-stage row renders "blocked until a build/boards exist."
- **Card** — `/projects/[slug]/[revLabel]/guide/[stage]`: bench-styled header, teaching content blocks, the uniform **stage-gate footer** (decision A) whose innards come from the card's `completionRef` adapter, and a sticky bottom progress bar with ← prev / CONSOLE / next → nav. ASSEMBLY/BRINGUP cards additionally carry a **board selector** (decision B) so capture/status is recorded against a specific board.

Both are RSC pages reading guide rows + live checklist/measurement/artifact/board state. Because completion rides the existing systems, **progress is server-persisted automatically** — per revision for design cards, per board for build cards (unlike the static docs' anonymous localStorage).

---

## 6. Tooltip / glossary primitive (Radix)

- Add `@radix-ui/react-tooltip` + `@radix-ui/react-popover`, styled with existing Tailwind token utilities (`.glass-card`, `.note-italic`, `font-mono` term header). Static class strings need no `cn()`; Radix `data-state=open|closed|delayed-open` styling uses Tailwind `data-*` variants (no clsx/tailwind-merge required).
- **`src/components/Tooltip.tsx`** — `role=tooltip` hint shown on hover **and** focus, Esc-dismiss, non-interactive content (WAI-ARIA tooltip pattern). For brief labels/gate-implication hints.
- **`src/components/GlossaryTerm.tsx`** — Popover (`aria-expanded`/`aria-controls`, focus management, click-outside + Esc) for click-to-read jargon (WL-CSP, drag-tin, SAC305, ADC1/ADC2, RLD, tombstoning…). Rendered by the `termRef` content block.
- **`src/lib/glossary.ts`** — `term → definition` map, seeded from the canonical stage/gate terms already in `src/lib/stages.ts` plus domain jargon.
- **Retrofit** the existing raw `title=` sites (`StageTracker.tsx:116` truncation, `MarkBringupCompleteButton.tsx:30/62` blocking-serials, `SaveButton.tsx:23`, the `hasMainsNet`/`isCertifiedModule` toggles flagged in the curriculum plans) onto `Tooltip` for consistency.

ARIA rule: hover-hint = tooltip semantics; click-to-reveal glossary = disclosure/popover semantics. Never use tooltip semantics for click-to-reveal content (touch + screen-reader correctness).

**Validated integration notes (corrected from the original draft):**
- **Radix already resolves on this stack.** `@radix-ui/react-toggle@1.1.10` + the shared `@radix-ui/react-primitive@2.1.3` / `react-slot` / `compose-refs` foundation are *already* in `pnpm-lock.yaml` transitively (via `@prisma/studio-core`), cleanly against React 19.2.4 / Next 16.2.6 — strong evidence the two named packages will resolve. **But** `react-tooltip`/`react-popover` themselves are not yet in the lockfile: planning must run `pnpm add` and confirm a clean install with a **single** `@radix-ui/react-primitive` version (avoid dupe/skew with the transitive 2.1.3). The earlier "no UI primitive lib is installed" phrasing was imprecise — none are *direct* deps and no tooltip primitive is authored, but a Radix primitive is present transitively.
- **Not zero-cost.** These pull the full Radix primitive tree (`react-presence`, `react-dismissable-layer`, `react-portal`, `react-focus-scope`, popper/floating) — the app's first runtime UI-library dependency. Acceptable, but acknowledge it.
- **z-index layering.** Radix portals to `document.body`; the app establishes stacking with a `sticky top-0 z-20` header and `z-10` dropdowns. Tooltip/popover content needs a z-index above `z-20`. (There is **no** "3px fixed top bar" in the Foundry — that was the bench docs; the earlier conflict note was a false premise.)
- **In-dialog triggers.** Native `<dialog>` modals (`CreatePartDialog`, `NewChecklistDialog`, `BulkMeasurementsDialog`) occupy the browser top layer. A body-portal'd Radix popover triggered *inside* an open dialog would render behind the modal backdrop — exactly where jargon like `isCertifiedModule`/SAC305 appears. For in-dialog triggers, set Radix's `container` prop to the dialog element (or render inline).

---

## 7. Styling / header component

A reusable **`src/components/PageHeader.tsx`** implementing the bench recipe from tokens **already in `globals.css`**:
- `.nav-back` "← CONSOLE" back link (gold arrow, gray label → gold on hover).
- `.meta-strip` mono uppercase breadcrumb, gold inline labels, `/` separators (e.g. `Card 04 / 08 / Phase LAYOUT / Project … / Build …`).
- `bench-hero` — Bebas Neue `clamp(54px,9vw,108px)` two-tone title: `.ord` gold eyebrow over a white title whose trailing word is gold via `.accent`.
- Lora-italic `.subhead` lead, closed by a 1px `--color-gold-dim`-style bottom rule.

Port the ~8 missing `@layer components` recipes into `globals.css` (`meta-strip`, `bench-hero`/`.ord`/`.accent`, `subhead`, `nav-back`, `callout` severities, `badge`, `table.tech`) — all consuming existing color/font tokens; **no palette additions**. (Validation confirmed *none* of these recipes exist today, so this is net-new authoring, not duplication — the `globals.css` `@layer components` block currently has only `glass-card`, `glass-button*`, `section-band`, `gold-glow`, `note-italic`.)

**Applied to:** guide hub + cards (primary). Optionally project/revision detail headers "where appropriate" — to be confirmed at implementation; default is guide pages first, then extend if it reads well.

**Validated header notes (corrected from the original draft):**
- **PageHeader replaces, doesn't augment.** The project and revision detail pages already ship **bespoke inline header strips** — `src/app/projects/[slug]/page.tsx:79-151` (`glass-card border-l-4 border-l-command-gold` + `font-mono` breadcrumb + `font-display` title + badge chips) and `[revLabel]/page.tsx:141-162` (analogous, `font-display` gold label at `clamp(2rem,5vw,3rem)`). The bench `bench-hero` runs at `clamp(54px,9vw,108px)` — a different, much larger scale. Applying `PageHeader` to those pages means **replacing** the existing strips, not coexisting; "where appropriate" must be an explicit decision, not left ambiguous, or the app ends up with two header aesthetics.
- **Back-link affordance changes blue→gold.** Today's back-link is signal-blue underlined text (`← All projects`, `← {project.name}`); the `nav-back` recipe specifies a gold arrow + gray→gold label. Adopting it is a deliberate visual-consistency change.
- **Dual font pipeline to reconcile.** `layout.tsx:7-15,42` loads Geist + Geist_Mono via `next/font` onto `<html>`, while the bench trio (Bebas/Space Mono/Lora) is loaded only via a Google-Fonts **`@import`** in `globals.css:1`. `bench-hero`/`meta-strip` consume `var(--font-display/-mono/-serif)` (the bench trio) so they *render*, but the 108px hero on a render-blocking `@import` (no `next/font` preload/optimization) is worth confirming or migrating the bench fonts to `next/font`.

---

## 8. Migration, actions, tests, backfill

- **Migration:** `Guide`, `GuideCard` (+ back-relations on `Revision`, `User`).
- **Actions:** `materializeGuide` (pre-check + P2002 catch), `editGuideCard` (content blocks Zod-validated), `reorderGuideCards` (reuse the two-pass negative-scratch ordinal swap from `reorderChecklistItems`), all freeze-guarded.
- **Completion adapters (new, per §3):** a render layer that maps each card's `completionRef` to the existing component + live state — `revisionChecklist`→`ChecklistEditor`, `buildChecklist`→resolve activeBuild then `ChecklistEditor`, `boardMeasurements`→board picker + `AddMeasurementForm`, `artifact`/`commit`/`boardStatus`→read-only state read. Includes the **build/board resolution** helper (revision → active unfrozen build → selected board) and graceful no-build / no-boards states.
- **New canonical content:** a `POST_ASSEMBLY_CONTINUITY` canonical template + a build-scoped materialize path (none exists today); lazy materialization of `LAYOUT_REVIEW`/`STRIPBOARD_VALIDATION` when a learner reaches those cards.
- **Schemas:** Zod discriminated union for content blocks; the `CompletionRef` union; `materializeGuide`/`editGuideCard` input schemas.
- **Tests:** composer output (per track + gotcha attachment predicates + null-track fallback), `materializeGuide` dedupe (pre-check **and** P2002) + freeze rejection, content-block + `CompletionRef` validation, completion-adapter state reads per `kind`, build/board resolution incl. no-build/no-boards, render smoke for hub + a card.
- **Backfill:** script to materialize guides for the 22 curriculum revisions (slugs `foundry-*`). Depends on those revisions existing in the target DB (see §10).

---

## 9. Open items deferred to planning
- Exact stage-skeleton prose per stage (content authoring) — bulk of the work; templated.
- Whether `PageHeader` also replaces the existing bespoke project/revision header strips (§7) — explicit decision, not ambiguous.
- Whether to migrate the bench font trio from CSS `@import` to `next/font` (§7).
- Whether to formally retire the dead `ASSEMBLY_PROCEDURE`/`BENCH_PROCEDURE` artifact subkinds. **Note:** the guide stores procedures as `GuideCard.contentBlocks` JSON, so it does **not** consume or repurpose those subkinds — they simply remain dead unless retired. Retiring is a Prisma enum-drop migration + updating `ARTIFACT_SUBKIND_OWNER` and `artifacts.test.ts:19-20,58-59` (which pin both) in lockstep, and reconciling four other plan docs that still list them.
- Glossary term inventory (seed list).
- Whether `REVISION` ever gets a card (excluded for now, §1).

## 10. Dependencies & sequencing (surfaced by validation)

1. **Seed branch must land first.** `feature/learner-guide-system` was branched from `main` and currently has **no commits of its own** (`HEAD == main`). The 22 `foundry-*` projects, their v1 revisions, and the **gotcha catalog + per-board predicates the composer reuses** live only in `scripts/populate-curriculum-dag.ts` on the sibling, unmerged `seed/curriculum-dag-population` branch (PR #1). Sequence: **merge the seed PR to `main`, then rebase this feature branch onto it**, so (a) the composer can extract `gotcha-blocks.ts` from one source of truth and (b) the project metadata is in the tree. Alternatively, vendor the script as a spec — but merge-first is cleaner.
2. **DB must actually contain the curriculum data.** Existence of the 22 projects/revisions is a *runtime* precondition, not a repo fact: `prisma/seed.ts` only creates `esp32-sensor-breakout`. The populate script was **run against the live DB on 2026-06-02 and verified** (22 projects, 33 edges, 22 revisions + REQUIREMENTS_REVIEW checklists), so dev/prod already have them — but any *fresh* environment must run the script before `materializeGuide` can attach guides.
3. **Downstream-stage checklists aren't seeded.** Only `REQUIREMENTS_REVIEW` is materialized on the 22 revisions (all at `REQUIREMENTS`). The `revisionChecklist` cards for LAYOUT (and conditional BOM_SOURCING) must lazily materialize their canonical checklist on demand; the ASSEMBLY card needs a brand-new `POST_ASSEMBLY_CONTINUITY` template + build-scoped materialize (see §3, §8).
4. **Radix install verification** before committing to the approach: `pnpm add @radix-ui/react-tooltip @radix-ui/react-popover` and confirm a clean install with a single `@radix-ui/react-primitive` version (§6).
