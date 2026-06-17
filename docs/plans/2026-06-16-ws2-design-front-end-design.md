# WS2 — Design front-end (design)

**Date:** 2026-06-16
**Status:** Design validated (ready for a bite-sized implementation plan)
**Parent:** `docs/plans/2026-06-16-board-design-process.md` (the board-design process run)
**Sibling:** `docs/plans/2026-06-16-ws3-bom-source-of-truth-design.md` (runs in parallel)

## Why

WS2 is the "design front-end" workstream: it makes the *design-discipline* half of the
process (draft → validate the math + ICs → register + de-risk the known risks) a
first-class, lightweight part of the system. It is deliberately **small** — Phase 0 and
WS1 already shipped most of the surface:

- Phase 0 (#8) shipped `docs/boards/_template/design.md` — the design-doc template, with
  the risk-register table (§6) and the DESIGN_VALIDATION checklist (§7) already in it.
- WS1 (PR #142) shipped `ChecklistSubkind.DESIGN_VALIDATION`, the 5 core attestation
  items, the declarative `conditionalItems` mechanism, and the `hasMainsNet` conditional
  block (2 mains-safety items injected at materialize time).

So WS2 is **not** new machinery. It is: two more conditional flag blocks (Li-ion,
thermal), one more core attestation item (risks de-risked), and the first fully-worked
example design doc. The injection wiring, the template, and the base checklist all exist.

## Dependency + branching

WS2 **depends on WS1** (it extends `conditionalItems`, the `DESIGN_VALIDATION` template,
and the materialize-time flag read — all introduced in PR #142, currently open/unmerged).
**Branch WS2 off `feat/ws1-foundations`** (stacked) until WS1 merges, then retarget the PR
to `main`. WS3 is independent of WS1 and branches off `main`.

## Scoping decisions (locked with Josh, 2026-06-16)

| Decision | Choice |
| --- | --- |
| Li-ion / thermal conditionals | **Add now** — two new `Project` booleans (`hasLiIon`, `hasThermalConcern`) + their DESIGN_VALIDATION conditional blocks + inline admin toggles. (WS1 deferred these as YAGNI; WS2 brings them in.) |
| The "de-risk every risk" notion | **One new core attestation item** ("all top risks de-risked"), gating on the markdown register in design.md §6. No DB risk model (parent decision 5). |
| Worked example | **WROOM L1.01** (`l1-01-wroom-breakout`) — fill the template for the one published board, as the canonical reference. Pure markdown. |

## Section A — two new project flags + conditional blocks

### Schema + migration

Add two booleans to `model Project`, mirroring `hasMainsNet` / `requiresStripboard`
(non-null, default false):

```prisma
  requiresStripboard Boolean @default(false)
  hasMainsNet        Boolean @default(false)
  hasLiIon           Boolean @default(false) // WS2: triggers Li-ion safety conditional
  hasThermalConcern  Boolean @default(false) // WS2: triggers thermal conditional
```

Hand-authored migration (re-run-safe, mirrors prior `Project` boolean adds):

```sql
ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "hasLiIon" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "hasThermalConcern" BOOLEAN NOT NULL DEFAULT false;
```

### Validation + action + UI (mirror `hasMainsNet` exactly)

- `src/lib/schemas/project.ts`: add `hasLiIon: z.boolean().optional()` and
  `hasThermalConcern: z.boolean().optional()` to `createProjectSchema` (`editProjectSchema`
  is `createProjectSchema.partial()` so it inherits them).
- `src/lib/actions/projects.ts`: add `editProjectHasLiIonAction` +
  `editProjectHasThermalConcernAction`, copied from `editProjectHasMainsNetAction`. The
  file stays `"use server"` exporting only async functions.
  **Required helper edit (tsc landmine):** `editProjectHasMainsNetAction` delegates to a
  private `editProjectBooleanField(fieldName, …)` whose `fieldName` parameter is a *closed*
  union `"criticalPath" | "requiresStripboard" | "hasMainsNet"`. Widen it to add
  `"hasLiIon" | "hasThermalConcern"` or the copied actions won't compile.
  **Create-time parity (optional but do it):** `createProject` spreads each boolean
  conditionally (`...(data.x !== undefined ? { x: data.x } : {})`); add the two new flags
  there too so they're settable at create time, and add their checkboxes to the
  create-project form `src/app/projects/new/_form.tsx` (which already renders the
  `requiresStripboard` / `hasMainsNet` checkboxes) for UI parity with the edit page.
- `src/app/projects/[slug]/_edit-fields.tsx`: add `EditHasLiIonForm` +
  `EditHasThermalConcernForm`, copied from `EditHasMainsNetForm` (autosave checkbox,
  Tooltip explaining the conditional each triggers).
- `src/app/projects/[slug]/page.tsx`: render the two new toggles next to the existing
  `hasMainsNet` / `requiresStripboard` toggles, passing `project.hasLiIon` /
  `project.hasThermalConcern`.

### Conditional blocks in the canonical template

Extend the `conditionalItems` flag union in `CanonicalTemplate`
(`src/lib/canonical-checklist-templates.ts`):

```ts
  conditionalItems?: {
    flag: "hasMainsNet" | "requiresStripboard" | "hasLiIon" | "hasThermalConcern";
    items: CanonicalItem[];
  }[];
```

Add two blocks to `CANONICAL_TEMPLATES.DESIGN_VALIDATION.conditionalItems` (after the
existing `hasMainsNet` block):

```ts
  {
    flag: "hasLiIon",
    items: [
      { label:
          "Li-ion protection verified — OVP/OCP/short protection, charge & discharge current limits, and cell balancing if multi-cell." },
      { label:
          "Pack thermal/mechanical containment reviewed — cell placement, venting, and worst-case fault behavior per the design doc." },
    ],
  },
  {
    flag: "hasThermalConcern",
    items: [
      { label:
          "Thermal budget verified — worst-case dissipation, copper-pour/heatsink, and junction temperature within the part's abs-max." },
      { label:
          "Derating applied — thermally-stressed parts run within a margin of their rated limits per the design doc." },
    ],
  },
```

### Injection wiring (one-line change)

The injection logic in `materializeCanonicalChecklist`'s revision branch
(`src/lib/actions/checklists.ts`) is already generic — it iterates
`template.conditionalItems` and reads `flags[c.flag]`. The **only** change: the project
`select` that loads the flags must include the two new columns:

```ts
        const rev = await tx.revision.findUniqueOrThrow({
          where: { id: revisionId },
          select: {
            project: {
              select: {
                hasMainsNet: true,
                requiresStripboard: true,
                hasLiIon: true,          // WS2
                hasThermalConcern: true, // WS2
              },
            },
          },
        });
```

Without this, `flags.hasLiIon` is `undefined` (falsy) and the block never injects.

## Section B — the "risks de-risked" core item

Add a **6th core mandatory item** to `CANONICAL_TEMPLATES.DESIGN_VALIDATION.items`:

```ts
  { label:
      "All top risks de-risked — every risk in the design doc's risk register (§6) has a completed de-risk pass." },
```

This is the gateable hook for the parent plan's "one de-risk pass per registered risk"
(decision 5). The register itself stays a markdown table in design.md (no DB model); this
item is the human attestation that it's been worked. It is **core** (every board), not
conditional.

> **Test impact:** the WS1 test asserts `t.items.length).toBe(5)` and lists the 5 labels.
> WS2 updates it to 6 and appends the risks-de-risked matcher. The two conditional-block
> assertions (Li-ion, thermal) are added alongside the existing `hasMainsNet` one.
> **Disambiguation:** the `STRIPBOARD_VALIDATION` template test in the same file *also*
> asserts `toBe(5)` — leave it alone; only the `DESIGN_VALIDATION` count flips to 6. Also
> check `src/lib/__tests__/checklists-actions.test.ts` — its WS1 injection tests count
> items on a `hasMainsNet` project (5 core → now 6 core, so a `hasMainsNet` project yields
> 8, not 7); update those expectations.

## Section C — worked example design doc (reconcile, don't write fresh)

**A rich WROOM design doc already exists** at `docs/boards/wroom-breakout/design.md` — a
real "Pass 2" doc (the ESP32-S3-WROOM-1 module, the WROOM-32E→S3 switch forced by a
bridge-sourcing dead end, the real risk R1, calc trail, etc.). But it's in the **old**
`REQUIREMENTS_DOC` format (Requirements → PDR → CDR), at the **wrong dir** (`wroom-breakout/`,
not the current slug), and it self-references the **stale** `foundry-l1-01-wroom-breakout`
slug + "v1 at REQUIREMENTS".

So the worked example is a **port/reconcile**, not a blank-template fill:

1. Create `docs/boards/l1-01-wroom-breakout/design.md` (the correct current slug) from the
   `_template/design.md` structure (§1 ORIENT … §8 BOM sourcing).
2. Port the real content from `wroom-breakout/design.md` into the template's sections —
   especially the risk register (§6: the bridge-sourcing dead-end is a textbook risk entry)
   and the IC-selection / calc-trail tables (§3–4).
3. Fix the slug reference to `l1-01-wroom-breakout`.
4. Replace the old `docs/boards/wroom-breakout/design.md` with a one-line pointer (or
   `git mv` + restructure) so the two don't diverge — the new file is the single source.

WROOM has **no** mains/Li-ion/thermal flags, so its §7 lists the 6 core items only — which
doubles as a check that the core set reads sensibly on a real board. Pure markdown; no code
risk; becomes the canonical reference every future board copies.

## Explicitly NOT in WS2

- **No DB risk-register model** (parent decision 5 — markdown table + one checklist item).
- **No stage gate / exitGate** for DESIGN_VALIDATION (still WS4, advisory-first). WS2 only
  adds checklist *content* and flags; nothing blocks stage advancement.
- **No retroactive flag changes** to existing projects — the new columns default false, so
  every existing board (incl. WROOM) is unaffected until an admin ticks a flag.

## Constraints honored

- **Prod DB.** `.env.local` `DATABASE_URL` is prod. Migration: hand-author SQL +
  `pnpm prisma migrate deploy`. Run vitest **one suite at a time** (never concurrently —
  corrupts the `esp32-sensor-breakout` fixture; `pnpm db:seed` restores).
- **Schema-change checks.** After the `Project` column add: `pnpm prisma generate`, full
  `pnpm tsc --noEmit`, full `pnpm vitest run`. Enum/flag-mirror surfaces to watch: the
  `conditionalItems` flag union, the `checklists.ts` project `select`, the project schema,
  and any test fixture that builds a whole `Project` object.
- **`"use server"` files export only async functions** (`projects.ts`).
- **No merge without Josh's go-ahead.** Open the PR (stacked on `feat/ws1-foundations`),
  verify CI `build | pass` explicitly, hand back.

## Verification

- `pnpm prisma generate` succeeds; `pnpm tsc --noEmit` clean.
- Materialize a `DESIGN_VALIDATION` checklist on a revision whose project has
  `hasLiIon = true` → the 6 core items + 2 Li-ion items appear (in order); `hasThermalConcern = true`
  adds the 2 thermal items; `hasMainsNet = true` still adds its 2; all four flags on a
  single project → 6 core + 6 conditional, in declaration order.
- A project with no flags → 6 core items only.
- `docs/boards/l1-01-wroom-breakout/design.md` exists, fully filled, renders cleanly.
- Full `pnpm vitest run` green (run once, not concurrently).
