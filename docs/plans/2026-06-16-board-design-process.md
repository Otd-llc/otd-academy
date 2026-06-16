# Board-design process — integration & improvement run

**Date:** 2026-06-16
**Status:** Scoping / design (validated outline — not yet a bite-sized implementation plan)
**Related:** `docs/plans/2026-06-16-board-to-lesson-pipeline.md` (the A/B/C/D authoring scaffolds this builds on)

## Why

Today the lesson is the unit of work, and the board behind it is implicit — the math,
the IC choices, and the BOM live in someone's head (or a spreadsheet) until they show
up in a guide. That works for L1.01 because one author built it end-to-end. It does not
scale to 22 boards.

Josh's real-world process is: **draft a design doc → run validation passes to lock the
math and ICs → source the BOM so we know we can actually buy the parts → only then write
the guide.** This run makes that process a first-class, lightweight part of the system,
so a board is *de-risked before* anyone spends time authoring a lesson around it — and so
the system can tell us, per board, where it stands.

A second goal rides along: a **two-tier readiness model**. Premium projects are vetted
end-to-end (team-built, real media) before going public; free projects can publish at a
lower bar to earn SEO while we polish them. The system should know the difference and
enforce it.

## The spine

Everything hangs off one lifecycle, with two gates:

```
design doc ─▶ validate (lock math + ICs) ─▶ source & freeze BOM
   ─▶ ⟦ board-readiness ⟧ ─▶ materialize + author guide
   ─▶ team-build (capture media + bring-up) ─▶ ⟦ lesson-readiness: vetted ⟧ ─▶ publish premium
                                                    └▶ ⟦ lesson-readiness: publishable ⟧ ─▶ publish free (SEO)
```

The two gates are the leverage points. Everything else exists to feed them.

## Locked decisions

These came out of the refine + validation passes and are baked into the plan below.

1. **Design doc lives in the repo, not the DB.** Long-form design authoring belongs in
   `docs/boards/<slug>/design.md` — diffable, reviewable in PRs, free, and it matches how
   `docs/plans` already works. The DB holds only the *structured, gateable* bits (the
   validation checklist + the BOM). **Consequence:** no `DESIGN_DOC` artifact subkind —
   smaller surface than the original outline.

2. **Validation = a core mandatory set + flag-driven conditional items.** Mandatory on
   every board: calc trail · each IC datasheet-verified · footprint↔pinout cross-check ·
   fab-DRU DRC · BOM availability. Conditional, triggered by flags we already store:
   **safety review** when `hasMainsNet` / Li-ion / thermal, isolation check,
   `requiresStripboard`. This is exactly how `gate-spec` already branches per-flag — a
   known pattern, and it keeps the base light while adding rigor only where the board
   earns it.

3. **The `board-readiness` gate ships ADVISORY-first.** A hard gate on guide
   materialization would retroactively block boards that never went through the new flow
   (incl. already-published L1.01) and risk failures when a design doc is absent. So it
   ships as a **report** first; it becomes a hard gate only once the workflow is in real
   use and degrades gracefully on missing data.

4. **WS3 includes a BOM CSV import.** "Source into `BomLine`" only sticks if entering a
   BOM isn't one-row-at-a-time pain — BOMs live in spreadsheets for exactly this reason.
   Without a frictionless import, the single-source-of-truth goal won't be adopted. The
   import is in-scope, not optional.

5. **Risk register lives in the design doc (markdown), not a DB model.** A markdown risk
   table in `design.md` + one gateable checklist item ("all top risks de-risked") gives
   ~90% of the value at ~10% of the cost. No structured risk-register model.

6. **Validation is attestation, not verification — framed honestly.** "Calc trail,"
   "fab-DRU DRC," "footprint↔pinout" are humans ticking boxes — a *process* gate, not
   machine proof. The few genuinely-checkable items (BOM availability via the parts MCP,
   DRU presence) are the automated part; the rest is "attested validated." We don't
   oversell it.

7. **The two readiness bars have precise, system-detectable criteria.** The system can
   already detect a team-built board: a `Board` at `BROUGHT_UP` status. So:
   - **Publishable (free / SEO):** all stage cards present · every stage has a quiz · no
     `TODO` stubs · final exam ≥ 10 Q. (Media may still be placeholder.)
   - **Vetted (premium):** publishable **＋** real media in every slot (no empty `src`)
     **＋** ≥ 1 `Board` at `BROUGHT_UP`.

8. **Keep it light — adoption is the real risk.** Every item adds author steps; if it's
   heavyweight it won't be followed. Bias the whole run toward template + checklists +
   advisory gates, and treat gates as worklists that *help* the author, not bureaucracy
   that blocks them. The core+conditional split (decision 2) already pulls this way.

## Phase 0 — Quick wins (no schema; front-loaded)

These reuse primitives that already exist (`assessLessonReadiness`, `collectEmptyMedia`,
the scaffold's `TODO` stubs, `Part.lifecycle`, `Part.datasheetUrl`, `bomFrozenAt`,
`Board` status). Most are standalone PRs that ship before any of the WS1–WS3 schema work
and de-risk the bigger pieces by making "where does this board stand?" visible.

**Lock first (decision 7 dependency):** agree the exact publishable-vs-vetted criteria,
since two of the quick wins depend on it.

1. **Two-tier `lesson-readiness` bar.** Extend the pure `assessLessonReadiness`
   (`src/lib/lesson-readiness.ts`) to return both a `publishable` and a `vetted` verdict
   (real media in every slot + ≥1 `BROUGHT_UP` board for vetted). No schema. Directly
   powers the free-SEO-vs-premium split. *Biggest value/effort in the run.*
   *Note (validation):* `vetted` needs a `broughtUpBoards` count added to the function's
   input — its current signature is `{stages, cards, exam, published}`, so callers (the
   script + the hub) change too. Media-slot emptiness is already derivable from `cards`.
2. **Publish-gate on readiness.** The set-published-revision action
   (`src/lib/actions/projects.ts`) checks the *publishable* bar and refuses if `TODO`
   stubs / missing quizzes remain — the free-SEO content floor is enforced automatically,
   not by discipline. Depends on #1. *Note (validation):* enforce the **publishable** bar
   only (never the vetted bar — that would block free SEO publishing), and keep an admin
   **force** path so we can't lock ourselves out of re-publishing.
3. **Editor flags `TODO` stubs.** Highlight any block whose JSON contains `TODO` in the
   block editor (`BlockListEditor`), so the scaffold's unfilled quiz/screenshot stubs are
   obvious at a glance. Ties scaffold-B + readiness-D + the editor together.
4. **BOM-table health flags.** In the `bomTable` block, show `Part.lifecycle` badges
   (NRND/EOL) and flag parts with **no datasheet**. Data already exists; real sourcing
   signal now and a free down payment on WS3's availability gate. *Note (validation):* a
   datasheet can come from either `Part.datasheetUrl` (external link) **or** the
   `PartDatasheet` uploaded-PDF relation — treat *either* as present, or parts with an
   uploaded PDF false-flag.
5. **Readiness surfaced on the guide hub (admin), with actionable links.** Render
   `assessLessonReadiness` + the `collectEmptyMedia` queue on the hub; each failing check
   deep-links to the card/action that fixes it. Turns the script-only report into an
   in-UI worklist.
6. **Admin pipeline overview.** Per-project badges (readiness bar · capture-queue count ·
   waitlist count) on the operator dashboard, so the whole 22-board rollout is glanceable.
   Derived entirely from values we already compute.
7. **Status badges on the hub/project.** BOM-frozen (`bomFrozenAt`), open-`Errata` count,
   part-lifecycle warnings — small badges from existing data, no new models.
8. **`docs/boards/<slug>/design.md` template.** One file: a design-doc template structured
   to mirror the guide's stage / mode-band shape, with the risk-register table baked in.
   Kills the blank page; it's also the WS2 starter. **Shipped:** copy
   [`docs/boards/_template/design.md`](../boards/_template/design.md) to
   `docs/boards/<project-slug>/design.md`.

> **Not a quick win:** design-to-cost roll-up. `Project.targetCost` exists, but `Part`
> has **no price field**, so a BOM cost roll-up needs a schema/data add first. It belongs
> in WS3, not Phase 0 — flagged here so it isn't mis-sequenced as "easy."

## Workstreams

### WS1 — Foundations
- `DESIGN_VALIDATION` revision-checklist subkind (the gateable validation record).
- Alternate / second-source MPN field on the BOM line.
- *Reuses:* `bomFrozenAt`, `targetCost`, `hasMainsNet`, the parts MCP. **No** `DESIGN_DOC`
  artifact subkind (decision 1).

### WS2 — Design front-end
- The `design.md` template (from Phase 0 #8) + a per-board **risk register** as a markdown
  table inside it (decision 5).
- The `DESIGN_VALIDATION` checklist = **core mandatory** items (calc trail · IC
  datasheet-verified · footprint↔pinout · fab-DRU DRC · BOM availability) **＋ flag-driven
  conditional** items (safety on `hasMainsNet`/Li-ion/thermal, isolation,
  `requiresStripboard`) — same per-flag pattern as `gate-spec` (decision 2).
- One de-risk pass per registered risk before the board can advance.

### WS3 — BOM as single source of truth
- Source the BOM into `BomLine`; **CSV → `BomLine` import** so entry isn't row-by-row
  (decision 4).
- Availability gate via the parts MCP (lifecycle/stock); design-to-cost vs `targetCost`
  (requires adding a `Part` price field here); second-source alternate MPN.
- **BOM freeze** (`bomFrozenAt`) is the handoff that says "guide authoring may begin."

### WS4 — The two gates
- **`board-readiness`** check — design doc present · `DESIGN_VALIDATION` complete · BOM
  sourced / frozen / available — gating guide materialization. **Ships advisory-first**
  (decision 3); hard-gate later.
- **`lesson-readiness`** — the two bars from Phase 0 #1 (publishable / vetted), with the
  publish-gate from Phase 0 #2.

### WS5 — Golden reference + team-build handoff
- The validated revision's KiCad starter + reference gerbers + bring-up measurements
  become the board's **golden set**.
- The team-build is the existing build/board pipeline used by a team: it captures media
  live (filling the empty slots) + brings up boards → flips the lesson to **vetted** and
  feeds errata back.

## Sequence

```
Phase 0 (quick wins)  →  WS1  →  (WS2 ∥ WS3)  →  WS4  →  WS5
```

Phase 0 ships first and largely standalone. WS1 unblocks the structured pieces. WS2 and
WS3 run in parallel (design discipline vs. BOM truth). WS4 wires the gates once their
inputs exist. WS5 is the team-build loop that earns the vetted bar.

## Risks (from the validation pass, with mitigations folded in)

| Risk | Mitigation (now in the plan) |
| --- | --- |
| Hard board-readiness gate retroactively blocks existing/legacy boards | Advisory-first, graceful degradation on missing data (decision 3) |
| BOM-as-SSoT not adopted because entry is painful | CSV → `BomLine` import in WS3 (decision 4) |
| Validation oversold as "proof" | Framed as attestation; only MCP-checkable items automated (decision 6) |
| Two bars ill-defined / "vetted" undetectable | Precise criteria; `BROUGHT_UP` board = the vetted signal (decision 7) |
| Over-building the risk register | Markdown table + one checklist item, no DB model (decision 5) |
| Whole process too heavyweight to follow | Light by construction: template + checklists + advisory gates (decision 8) |

## Open questions (resolve when this becomes an implementation plan)

- **Price field shape** for design-to-cost — a `Part.unitPriceCents` typical price vs. a
  per-`BomLine` quoted price? (Affects WS3 cost roll-up.) **Do not** reuse the name
  `priceCents`: that already exists on `Project` as the *course* price (monetization), so
  a part cost needs a distinct name to avoid confusion.
- **Exact `design.md` section list** — the template's headings (mirrors guide stages, but
  the design-specific sections — topology, calc trail, IC selection rationale, risk
  register — need drafting).
- **When does board-readiness flip from advisory to hard gate?** A board count / a date /
  a manual switch?

## Next step

Turn this into a bite-sized implementation plan (writing-plans skill): start with the
Phase 0 batch (lock bar criteria → two-tier bar → publish-gate → in-UI readiness; the
independent ones — TODO flag, BOM health, dashboard, badges, template — anytime), then
WS1.
