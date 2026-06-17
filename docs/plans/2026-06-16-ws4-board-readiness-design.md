# WS4 — board-readiness gate (design)

**Date:** 2026-06-16
**Status:** Design validated (ready for a bite-sized implementation plan)
**Parent:** `docs/plans/2026-06-16-board-design-process.md` (the board-design process run)

## Why

WS4 is the "gates" workstream. The parent plan's WS4 has two halves:
- **lesson-readiness** (the publishable / vetted bars + publish-gate) — **already shipped
  in Phase 0 (#139)** as `assessLessonReadiness` + `ReadinessPanel` + the `setPublishedRevision`
  publish-gate. Nothing to do here.
- **board-readiness** — the *new* half: a check that a board is de-risked (design validated,
  BOM sourced + frozen + buyable) **before** anyone authors a guide around it. This is what
  consumes WS1's `DESIGN_VALIDATION` and WS3's BOM sourcing data.

So WS4's net-new is **board-readiness only**, and it ships **advisory-first** (parent
decision 3): it surfaces a readout + a soft-confirm speed-bump on guide materialization, but
never hard-blocks. It mirrors the existing `assessLessonReadiness` pattern almost exactly and
adds **no new schema**.

## Scoping decisions (locked with Josh, 2026-06-16)

| Decision | Choice |
| --- | --- |
| How "design doc present" is detected | **Folded into "DESIGN_VALIDATION complete."** No repo-file read, no new field. A complete `DESIGN_VALIDATION` checklist (whose items reference the design.md §s) is the design-discipline proxy. A revision with no `DESIGN_VALIDATION` checklist reads as not-ready — correct, that checklist IS the signal. |
| Advisory strength | **Soft-confirm ack on Generate Guide** — when not board-ready, the Generate-Guide button requires an "I've reviewed board-readiness" tick to enable (still proceeds). Mirrors WS3's freeze ack. `materializeGuide` is unchanged. |
| Surface split | **Panel on the revision detail page; ack on the guide hub.** The full `BoardReadinessPanel` (readout) lives on `[revLabel]/page.tsx` next to DESIGN_VALIDATION + the BOM. The soft-confirm ack lives on `GenerateGuideButton` (guide hub + stage page), with a compact "not board-ready: N issue(s)" nudge. |
| Hard-gate flip | **Deferred entirely.** Advisory-only, no enforcement mechanism. `ready` + reasons are computed and surfaced; nothing blocks. The advisory→hard-gate trigger is decided later when the workflow is in real use (YAGNI). |
| Schema | **None.** Reads existing data (checklist items, `bomFrozenAt`, `bomLines.part.lifecycle`, `unitPriceCents`, `targetCost`). |

## Section A — the pure assessor (`src/lib/board-readiness.ts`)

Mirror `src/lib/lesson-readiness.ts` exactly — a pure, testable function the pages feed DB
rows into. No DB/React/network import.

```ts
export type BoardReadinessTier = "required" | "info";

export interface BoardCheck {
  label: string;
  ok: boolean;
  tier: BoardReadinessTier;
  detail?: string;
}

export interface BoardReadinessInput {
  /** A DESIGN_VALIDATION checklist exists on the revision. */
  hasDesignValidation: boolean;
  /** Every item on it is checked OR notApplicable. */
  designValidationComplete: boolean;
  /** WS3 BOM-freeze handoff timestamp, or null. */
  bomFrozenAt: Date | null;
  /** Number of BomLines on the revision. */
  bomLineCount: number;
  /** Non-ACTIVE lifecycle parts (EOL/NRND/OBSOLETE) on the BOM. */
  lifecycleWarningCount: number;
  /** Lines with no unit price (info-tier). */
  unpricedCount: number;
  /** Cost roll-up over targetCost (info-tier). */
  overTarget: boolean;
  /** Convention path for the info pointer line. */
  designDocPath: string;
}

export interface BoardReadiness {
  checks: BoardCheck[];
  /** All `required`-tier checks pass. */
  ready: boolean;
}

export function assessBoardReadiness(input: BoardReadinessInput): BoardReadiness;
```

**Required checks (all must pass for `ready`):**
1. **Design validated** — `hasDesignValidation && designValidationComplete`. Detail when
   failing: "no DESIGN_VALIDATION checklist" / "N item(s) unchecked".
2. **BOM frozen** — `bomFrozenAt != null`. Detail: "BOM not frozen — advance past
   BOM_SOURCING to freeze."
3. **BOM has parts** — `bomLineCount > 0`.
4. **No end-of-life parts** — `lifecycleWarningCount === 0`. Detail: "N part(s) NRND/EOL/obsolete".

**Info checks (reported, gate nothing):**
- **Cost** — `unpricedCount` / `overTarget` summarized (cost is design-to-cost, not a
  buyability blocker).
- **Design doc** — a pointer line "design doc: `docs/boards/<slug>/design.md`" (tier `info`).

`ready = checks.filter(c => c.tier === "required").every(c => c.ok)`.

> "Complete" = every `ChecklistItem` is `checked || notApplicable` (the model's checked-xor-n/a
> fields; the schema enforces the xor). An empty checklist (0 items) is `complete` vacuously
> but `hasDesignValidation` still requires the checklist to EXIST — and a materialized
> `DESIGN_VALIDATION` always seeds ≥ 6 items, so this isn't a real hole.

## Section B — the panel (`src/components/BoardReadinessPanel.tsx`)

Mirror `src/components/guide/ReadinessPanel.tsx`: a presentational component taking
`{ readiness: BoardReadiness }`, rendering a single "Board ready" bar (green when `ready`)
+ the per-check list (✓ / ✗ for `required`, · for `info`, with `detail`). Same OTD palette
and idiom (the `Bar` + checks-list structure). Header: "Board readiness — de-risked before
authoring".

Rendered on the **revision detail page** `src/app/projects/[slug]/[revLabel]/page.tsx`,
near the DESIGN_VALIDATION/BOM area. The page computes `assessBoardReadiness` from data it
already loads (WS3 added `targetCost` + `bomLines.part`; the checklists are loaded for the
`RevisionChecklistsPane`). If the `DESIGN_VALIDATION` checklist items aren't already selected
with their `checked`/`notApplicable`, extend that select.

## Section C — the soft-confirm ack on Generate Guide

`GenerateGuideButton` (`src/components/guide/GenerateGuideButton.tsx`, `"use client"`) is
rendered on the guide hub (`[revLabel]/guide/page.tsx`) and the per-stage guide page
(`[revLabel]/guide/[stage]/page.tsx`). Bake the ack INTO the component so both call sites
behave identically:

- Add optional props `boardReady?: boolean` and `boardIssueCount?: number`.
- When `boardReady === false`: render, above the submit pill, a compact muted/red nudge
  ("⚠ Board not ready — {n} issue(s); see board readiness on the revision page.") + an
  "I've reviewed board readiness" checkbox (`useState`, default false) that **disables the
  submit pill until ticked**. When `boardReady` is `true` or `undefined`, the button behaves
  exactly as today (no checkbox).
- `materializeGuide` / `materializeGuideFormAction` are **unchanged** — the ack is client-side
  only (advisory-first).

Both pages compute board-readiness and pass `boardReady={readiness.ready}` +
`boardIssueCount={failing required checks}` to `GenerateGuideButton`. **Unlike the revision
detail page** (which already `include`s checklists + bomLines + targetCost and computes
`cost`/`bomWarnings`), the two guide pages currently load **none** of the assessor inputs, and
their `GenerateGuideButton` renders only inside the `!revision.guide` branch — so each must run
a **scoped extra query** in that branch loading `bomFrozenAt`, `bomLines { quantity,
unitPriceCents, part { lifecycle } }`, `checklists { subkind, items { checked, notApplicable } }`,
and `project { slug, targetCost }`. A shared `boardReadinessFromRows(rows)` helper (a separate
module from the pure `board-readiness.ts`, so the lib stays Prisma-free like
`lesson-readiness.ts`) does the row→input mapping for both pages. The revision page calls the
pure `assessBoardReadiness` directly with its already-computed `cost`/`bomWarnings`.

## Explicitly NOT in WS4

- **No new schema / migration.**
- **No `materializeGuide` change** — it does not hard-block; the ack is pure client UX.
- **No hard-gate flip** — deferred (decision above).
- **No lesson-readiness work** — shipped in Phase 0 #139.
- **No repo-filesystem read** for the design doc — folded into DESIGN_VALIDATION.

## Constraints honored

- **Prod DB.** `.env.local` `DATABASE_URL` is prod. Run vitest **one suite at a time** (never
  concurrently — corrupts the `esp32-sensor-breakout` fixture; `pnpm db:seed` restores). The
  assessor is pure so its unit tests need no DB; any page/integration test uses throwaway
  revisions (never a real curriculum row's mutable state).
- **`"use server"` files export only async functions** — N/A here (no new server action;
  `GenerateGuideButton` is a client component).
- **No merge without Josh's go-ahead.** Open the PR, verify CI `build | pass` explicitly,
  hand back.
- **Branching:** WS4 reads WS1's `DESIGN_VALIDATION` + WS3's BOM data, so it logically sits
  on top of WS3. Branch off `feat/ws3-bom-source-of-truth` (so the assessor can consume
  `bomLines.part.lifecycle` + `unitPriceCents` already threaded there). Retarget to `main`
  after the stack (#142 → #143/#144 → WS4) merges. Note: WS4 does not strictly need WS2.

## Verification

- `pnpm prisma generate` (no schema change, but regen is harmless); `pnpm tsc --noEmit` clean.
- `board-readiness.ts` unit tests: ready when all four required pass; not-ready on each
  missing piece (no DESIGN_VALIDATION, incomplete items, BOM unfrozen, empty BOM, an EOL part);
  info checks never affect `ready`.
- The revision detail page shows the `BoardReadinessPanel` with the right verdict.
- On the guide hub, a not-ready revision's Generate-Guide button is disabled until the ack
  checkbox is ticked; a ready revision's button behaves as before.
- Full `pnpm vitest run` green (run once, not concurrently).
