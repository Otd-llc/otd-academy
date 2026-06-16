# WS1 — Foundations (design)

**Date:** 2026-06-16
**Status:** Design validated (ready for a bite-sized implementation plan)
**Parent:** `docs/plans/2026-06-16-board-design-process.md` (the board-design process run)

## Why

WS1 is the "Foundations" workstream of the board-design process run. It ships the two
schema-level primitives the later workstreams depend on, and nothing more:

1. A `DESIGN_VALIDATION` `ChecklistSubkind` — the gateable validation record that WS2
   fills with content and WS4's `board-readiness` gate later consumes.
2. A second-source / alternate-MPN field on `BomLine` — the BOM's first step toward being
   a single source of truth (WS3).

Keeping WS1 a clean foundation matters: it must not retroactively block any existing or
legacy revision (incl. the already-published L1.01), so it ships **no new hard gate**.

## Scoping decisions (locked with Josh, 2026-06-16)

| Decision | Choice |
| --- | --- |
| How far DESIGN_VALIDATION goes in WS1 | **Record + UI only, no stage gate.** Board-readiness consumes it in WS4 (advisory-first, parent decision 3). |
| Flag-driven conditional items | **Inject at materialize time** from project flags. One checklist; conditionals pre-filtered. |
| Alt-MPN field shape | **`altMpn` + `altManufacturer`** (two optional strings). No price field in WS1 — cost roll-up is WS3. |
| Stage the checklist pins to | **`BOM_SOURCING`** (the spine is validate → source BOM; sits with the existing STRIPBOARD_VALIDATION affordance). |

## Section A — `DESIGN_VALIDATION` checklist

### Enum + canonical template

- Add `DESIGN_VALIDATION` to the `ChecklistSubkind` enum via a hand-authored
  `ALTER TYPE "ChecklistSubkind" ADD VALUE 'DESIGN_VALIDATION';` migration (mirrors
  `20260602030000_stripboard_validation_subkind`).
- Add a `DESIGN_VALIDATION` entry to `CANONICAL_TEMPLATES`
  (`src/lib/canonical-checklist-templates.ts`) and to `canonicalTemplateKeySchema`
  (`src/lib/schemas/canonical-checklist.ts`), pinned to stage `BOM_SOURCING`.
- **Core mandatory items** (parent decision 2):
  - Calc trail recorded — every derived value traces to a source.
  - Each IC datasheet-verified against the chosen part.
  - Footprint ↔ pinout cross-checked for each part.
  - Fab-DRU DRC accounted for (the fab's design rules will be applied at layout).
  - BOM availability confirmed (parts are buyable — stock / lifecycle).

  These are **attestations, not machine proofs** (parent decision 6); copy reflects that.

### Flag-driven conditional items (inject at materialize time)

Extend `CanonicalTemplate` with an optional declarative field:

```ts
conditionalItems?: {
  flag: "hasMainsNet" | "requiresStripboard";
  items: CanonicalItem[];
}[];
```

In `materializeCanonicalChecklist`'s **revision-scoped branch** only, after resolving the
revision, load the parent project's flags (`hasMainsNet`, `requiresStripboard`) and append
the `items` of every `conditionalItems` block whose `flag` is `true`. Core items keep their
ordinals first; conditional items follow in declaration order. The build-scoped branch is
unchanged (no project-flag conditionals there).

**WS1 ships exactly one conditional:** `hasMainsNet` →
- "Mains-safety review completed (clearance/creepage, fusing, earthing per the design doc)."
- "Isolation barrier verified on the design (isolation gap + the certified module's rating)."

Deliberately **not** added in WS1:
- A `requiresStripboard` conditional — that flag already owns the whole
  `STRIPBOARD_VALIDATION` checklist at BOM_SOURCING; duplicating it here would be noise.
- Li-ion / thermal conditionals — no such project flag exists yet. WS2 can add flags +
  items when the boards that need them arrive. (YAGNI.)

The mechanism is general; WS2 extends the conditional set, not the wiring.

### UI

A "Generate DESIGN_VALIDATION checklist" affordance on the revision detail page next to the
existing materialize buttons (reuse `MaterializeReviewButton` / `GenerateChecklistButton`),
so the materialized checklist appears in the BOM_SOURCING-stage checklist pane and is
editable like any other.

### Explicitly NOT in WS1

- **No `exitGate` branch** for `DESIGN_VALIDATION`. Nothing blocks stage advancement; WS4's
  advisory `board-readiness` check reads the subkind later.
- No `DESIGN_DOC` artifact subkind (parent decision 1 — the design doc lives in the repo).

## Section B — second-source / alternate-MPN on `BomLine`

### Schema

Add two optional, nullable columns (no default, no new constraint):

```prisma
model BomLine {
  // ...existing fields...
  altMpn          String?
  altManufacturer String?
}
```

Hand-authored migration:
`ALTER TABLE "BomLine" ADD COLUMN "altMpn" TEXT, ADD COLUMN "altManufacturer" TEXT;`

No price field in WS1. Design-to-cost and any `unitPriceCents` / per-line quoted price are
WS3, and must never reuse the name `priceCents` (that's `Project`'s course price).

### Validation + action layers

- `createBomLineSchema` / `editBomLineSchema` (`src/lib/schemas/bom-line.ts`): add
  `altMpn` and `altManufacturer` as `z.string().trim().max(200).optional().nullable()`,
  mirroring the existing `notes` field. **No** refinement coupling them — a second-source
  may legitimately be MPN-only or manufacturer-only; it is an informational sourcing hint,
  not a foreign key to `Part`.
- `createBomLine` / `editBomLine` (`src/lib/actions/bom-lines.ts`): thread the two fields
  through the create payload and the `createBomLineFormAction` `pickString` reads. Both
  files stay `"use server"` exporting only async functions.

### UI

`src/app/projects/[slug]/[revLabel]/_bom-editor.tsx`:
- Two optional inputs ("Alt. MPN", "Alt. mfr.") in the add-line form, OTD palette, matching
  the existing notes input.
- The line-row list shows a muted second-source line when either field is present
  (e.g. `alt: <altManufacturer> <altMpn>`).

The public `bomTable` guide block is **not** touched in WS1 — surfacing second-source to
learners belongs with WS3's BOM-rendering work.

## Constraints honored

- **Prod DB.** `.env.local` `DATABASE_URL` is prod. Migrations: hand-author SQL +
  `prisma migrate deploy`. Run the vitest suite **one at a time** (never concurrently — it
  corrupts the shared `esp32-sensor-breakout` fixture; `pnpm db:seed` restores).
- **Schema-change checks.** After the enum add + the `BomLine` columns: run full `tsc` AND
  the full vitest suite. Enum-mirror surfaces to watch: the `CANONICAL_TEMPLATES` record,
  `canonicalTemplateKeySchema`, and any exhaustive `switch` on `ChecklistSubkind` (tsc
  flags these).
- **No merge without Josh's go-ahead.** Open the PR, verify CI `build | pass` explicitly,
  hand back.

## Verification

- `pnpm prisma generate` succeeds; `pnpm tsc` clean.
- Materialize a `DESIGN_VALIDATION` checklist on a revision whose project has
  `hasMainsNet = true` → the two safety items appear after the core items; on a project
  with `hasMainsNet = false` → only the core items appear.
- Add a BOM line with `altMpn` + `altManufacturer` → the row shows the second-source line;
  edit clears/changes it.
- Full vitest suite green (run once, not concurrently).
