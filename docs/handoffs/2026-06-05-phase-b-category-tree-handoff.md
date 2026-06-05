# Handoff — Parts Phase B (Category Tree)

**Date:** 2026-06-05
**Branch:** `feature/parts-category-tree` (off `main`, pushed)
**Plan:** [docs/plans/2026-06-05-parts-phase-b-category-tree.md](../plans/2026-06-05-parts-phase-b-category-tree.md)
**Parent design:** [docs/plans/2026-06-04-parts-subsystem-at-scale-design.md](../plans/2026-06-04-parts-subsystem-at-scale-design.md) (Phase B section)

## Your job

Review the Phase B plan **with fresh eyes**, then execute it. The plan is detailed and
task-by-task; treat it as a strong proposal, not gospel — if a step is wrong or a better
approach exists, adjust the plan first, then build. Use **superpowers:executing-plans**
(or subagent-driven-development) to implement.

## Where things stand (so you don't redo work)

- **Phase A** (searchable/paginated/mobile parts list) — DONE, merged to `main` (PR #15).
- **USB4110-GF-A facts** — DONE. PINOUT (16 pins) + MECHANICAL + PARAMETRICS were seeded
  VERIFIED directly into the Neon DB (via `scripts/seed-usb4110-facts.ts`, untracked). They
  already surface through `mcp__foundry-parts__lookup_part`. Do not redo.
- **Phase B** — planned only (this handoff). Nothing built yet.
- **Phase C** (KiCad symbol/footprint pickers + server-side library) — designed, comes AFTER B.

## The core strategy (why this migration is low-risk)

An audit of every `PartCategory` usage found two bridges that keep churn tiny:
1. **Leaf slug = the old enum token.** The 6 migrated leaves get `Category.slug =
   "MLCC_CAPACITOR"` etc., so the one category-keyed code path (`CATEGORY_REQUIRED` in
   `src/lib/schemas/part-fact.ts`) and every test/seed string literal keep working.
2. **Keep the enum column.** `Part.category` (the enum) is RETAINED; everywhere category is
   read becomes `categoryRef?.slug ?? category`. Old data (enum only) still resolves;
   `categoryId` wins once set. Dropping the enum is a separate later phase — NOT this one.

## Decisions defaulted in the plan — re-examine these with fresh eyes

- **Form control:** a searchable combobox showing the path (`Passives › Capacitors › MLCC`),
  not a bespoke tree widget.
- **Admin category CRUD:** deferred (seed the tree; no add/rename/move UI this phase).
- **Enum drop:** deferred to a later audited migration.
- **Tree shape:** Passives→{Resistors→SMD, Capacitors→MLCC}, ICs→{Power→LDO, Interface→USB-UART},
  Modules→RF, Connectors→USB. (If a different taxonomy is better, change `CATEGORY_TREE` in Task 2.)

If you disagree with any of these, that's exactly the kind of thing the fresh-eyes pass is for.

## Hard environment rules (learned the hard way — do not violate)

- **NEVER run `prisma migrate dev` against the shared Neon DB.** It can offer a destructive
  reset that would wipe the curriculum DAG, WROOM parts, and seed fixtures. Instead:
  hand-author the migration SQL under `prisma/migrations/<timestamp>_<name>/migration.sql`,
  run `pnpm exec prisma migrate status` (confirm 1 pending, no drift), then
  `pnpm exec prisma migrate deploy` (forward-only, reset-proof), then `pnpm exec prisma generate`.
  Match Prisma's index/FK naming (`Category_*_idx`, `Part_categoryId_fkey`, etc.).
- **Use the PowerShell tool for `pnpm`/`git`** — the Bash tool has no `pnpm` on PATH.
- **`tsc` baseline:** `pnpm exec tsc --noEmit` reports 4 PRE-EXISTING errors in the untracked
  `scripts/vendor-kicad-symbols.ts`. Those are not yours; "clean" means no NEW errors elsewhere.
- **Schema-change gate:** after any schema/enum change, run the FULL `tsc` AND the FULL
  `pnpm exec vitest run` (currently 91 files / 752 tests). The shared seed fixture
  `esp32-sensor-breakout` backs ~23 tests; if implicated, `pnpm db:seed` to restore.
- **Commits:** stage explicit paths (never `git add -A`); end messages with the
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` trailer.
- **gh CLI:** a stale `GH_TOKEN` shadows the keyring login (401 Bad credentials). Prefix gh
  commands with `$env:GH_TOKEN=$null;` (PowerShell). For PR bodies, write to a temp file and
  use `gh pr create --body-file` (inline here-strings mangle quoted phrases). GitHub handle
  is `joshtol`; base branch is `main`.
- **Tests:** node-env Vitest, `globals: false` (import from `"vitest"`); DB tests share one
  Neon DB, create `Date.now()`-suffixed throwaway rows, sweep in `afterAll`. Copy the shape
  from `src/lib/__tests__/parts-query.test.ts`.

## Finish

When done: full gate green → finishing-a-development-branch → push + `gh pr create` (base `main`).
The PR body should note the enum column is retained (no drop) and that category reads bridge
`categoryRef?.slug ?? category`.
