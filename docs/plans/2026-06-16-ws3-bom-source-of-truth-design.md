# WS3 — BOM as single source of truth (design)

**Date:** 2026-06-16
**Status:** Design validated (ready for a bite-sized implementation plan)
**Parent:** `docs/plans/2026-06-16-board-design-process.md` (the board-design process run)
**Sibling:** `docs/plans/2026-06-16-ws2-design-front-end-design.md` (runs in parallel)

## Why

WS3 makes the revision's `BomLine` set the **single source of truth** for what the board
is built from — so the system can answer "can we actually buy this, and does it hit the
cost target?" before anyone authors a guide. It adds the three things a BOM needs to be
trustworthy and frictionless: a per-line **price** (design-to-cost), a **CSV import** so
entry isn't row-by-row, and a **lifecycle/cost advisory** surfaced at BOM freeze. WS1
already shipped the second-source (`altMpn`/`altManufacturer`) fields this builds on.

## Dependency + branching

WS3 is **independent of WS1's checklist work** — it touches `BomLine` (which WS1 also
touched: `altMpn`/`altManufacturer`) and the BOM editor. To avoid a merge tangle with the
open WS1 PR, **branch WS3 off `feat/ws1-foundations`** as well (the alt fields it renders
alongside the new price field already live there). Retarget to `main` after WS1 merges.
WS2 and WS3 are otherwise parallel and ship as independent PRs.

## Scoping decisions (locked with Josh, 2026-06-16)

| Decision | Choice |
| --- | --- |
| Price field shape | **`BomLine.unitPriceCents` (Int, nullable)** — the price quoted for *this* board's line at sourcing time. Distributor CSV exports carry per-line price; roll-up = Σ(qty × unitPriceCents). **Never** reuse `priceCents` (that's `Project`'s course price). |
| CSV unmatched rows | **Strict match + report** — resolve each row to an existing `Part` by `(manufacturer, mpn)`; unmatched rows are reported, never auto-created (keeps the curated parts library clean). |
| CSV duplicate rows | **Upsert** — a row whose part already has a `BomLine` on the revision updates it in place (qty/price/alt/notes); report "N created, M updated". Re-importing a corrected sheet is idempotent. |
| Availability gate | **Lifecycle-only, advisory** — flag non-`ACTIVE` `Part.lifecycle` (NRND/EOL) + unpriced lines + over-target. No live distributor-stock API (that's a future workstream). |
| BOM visibility | **Admin-only** — price/cost/advisory live in the admin BOM editor + the freeze flow. No public `bomTable` changes; second-source learner-rendering stays a later follow-up. |
| Freeze advisory | **Soft-confirm** — the advance-to-LAYOUT control (which freezes the BOM) shows the warnings + an explicit "I've reviewed" ack gating the button; never hard-blocks. |

## Section A — per-line price (`unitPriceCents`)

### Schema + migration

Add one nullable column to `model BomLine` (alongside the WS1 alt fields):

```prisma
  altMpn          String?
  altManufacturer String?
  unitPriceCents  Int?    // WS3: quoted unit price (cents) for design-to-cost; NOT priceCents
```

Hand-authored migration:

```sql
ALTER TABLE "BomLine" ADD COLUMN IF NOT EXISTS "unitPriceCents" INTEGER;
```

### Validation + action + UI

- `src/lib/schemas/bom-line.ts`: add `unitPriceCents: z.number().int().nonnegative().max(100_000_000).optional().nullable()` to both `createBomLineSchema` and `editBomLineSchema`.
- `src/lib/actions/bom-lines.ts`: thread `unitPriceCents` through `createBomLine`'s create
  `data` (`unitPriceCents: data.unitPriceCents ?? null`); `editBomLine` forwards any defined
  key **that survives `editBomLineSchema.parse`** — so it works only *after* the field is
  added to the schema (step above). In `createBomLineFormAction`, the form sends **dollars** — convert with
  `Math.round(parseFloat(...) * 100)` (mirroring `SetPriceForm` in `_edit-fields.tsx`) into
  `unitPriceCents` before validation, or read a dedicated cents hidden field. The action
  stays `"use server"` exporting only async functions.
- `src/app/projects/[slug]/[revLabel]/_bom-editor.tsx`: a "Unit price (USD)" dollar input
  in the add-line form (OTD palette, `step="0.01"`), and a muted per-line price (e.g.
  `$1.23`) in the row display, using `formatUsd` from `src/lib/format-money.ts`
  (`formatUsd(priceCents: number)`). The editor's `BomLineRow` type and the page's
  `revision.bomLines.map(...)` (`page.tsx`) currently **drop** `unitPriceCents` and
  `part.lifecycle` — both must be added to the row type + the map (the query already
  `include: { part: true }`, so the data is fetched; only the projection drops it).

## Section B — CSV import

### Pure parser (`src/lib/bom-csv.ts`, no DB)

A testable pure module that parses CSV text into typed rows. **Canonical column contract**
(header row required, mapped by header name, extra columns ignored):

```
refDes, manufacturer, mpn, quantity, unitPrice, altMpn, altManufacturer, notes
```

- `refDes` is a comma-or-space-joined list. The DB CHECK `bomline_refdes_count`
  (`array_length(string_to_array("refDes", ','), 1) = "quantity"`, baseline migration)
  **will abort the whole tx** if a row's refDes count ≠ quantity, so the parser must catch
  it first: split on commas/spaces, **trim each segment, drop blanks, collapse to a clean
  comma-joined string** (the Zod `refDesField` also forbids leading/trailing whitespace),
  then validate the segment count `=== quantity` and surface a per-row error if not.
  Watch the trailing-comma trap (`"R1,"` → length 2).
- `unitPrice` is **dollars** (e.g. `1.23`) → parsed to integer cents; blank → null.
- `quantity` is a positive integer.
- Returns `{ rows: ParsedBomRow[], errors: RowError[] }` — parse/shape errors are
  collected per row (1-indexed), never thrown, so the importer can report them all.

### Importer (`importBomCsv` server action in `bom-lines.ts`)

`importBomCsv({ revisionId, csv })` — run inside `withTxRetry` at **Serializable**
isolation, matching every existing `BomLine` write (single-line adds at Serializable can
race an import on the `[revisionId, partId]` key; upsert + retry handles it):
1. Guard freeze with **both** `assertBomNotFrozen(tx, revisionId)` (checks `bomFrozenAt` —
   the BOM-freeze guard) **and** `assertNotFrozen(tx, revisionId)` (checks revision
   `frozenAt`), exactly as `createBomLine` does (`bom-lines.ts` calls both). *Note: the
   "frozen BOM" guard is `assertBomNotFrozen`, not `assertNotFrozen` — they're distinct.*
2. Parse via `bom-csv.ts`. Collect parse errors (incl. the refDes-count guard below).
3. For each valid row, resolve `Part` by the `(manufacturer, mpn)` unique key — **strict**.
   Unmatched → add to the `unmatched` report list, skip.
4. Matched rows **upsert** on the `[revisionId, partId]` unique key (`tx.bomLine.upsert`):
   create with qty/price/alt/notes, or update those fields in place. Count created vs updated.
5. The whole import is one tx so a mid-file failure rolls back cleanly.
6. Return `{ created, updated, unmatched: [...], rowErrors: [...] }` for the UI report.

> **Strict match is the curated-library guard.** A real part is created deliberately
> (the existing CreatePart flow), never as an import side effect.

### Import UI

In `_bom-editor.tsx` (a `"use client"` component): a collapsible "Import CSV" panel (file
input **or** paste textarea). The existing single-line add uses `useActionState` +
`<form action={createBomLineFormAction}>` (a **form action**, not `useTransition`) — match
that pattern: a sibling `<form action={importBomCsvFormAction}>` with its own
`useActionState` returning the report. Render the report: "N created · M updated · K
skipped (no matching part)" with the unmatched MPNs and any per-row errors listed. Disabled
when the revision is frozen (the page already passes a frozen flag to the editor).

## Section C — cost roll-up

Pure helper `bomCost(lines, targetCost)` (in `bom-csv.ts` or a small `bom-cost.ts`):

- `totalCents = Σ(quantity × (unitPriceCents ?? 0))`.
- `unpricedCount = lines.filter(l => l.unitPriceCents == null).length`.
- `targetCents = targetCost == null ? null : Math.round(Number(targetCost) * 100)`
  (`Project.targetCost` is `Decimal(10,2)` **dollars** — convert, don't assume cents).
- `overTarget = targetCents != null && totalCents > targetCents`.

Rendered in the BOM editor as a badge: "BOM total $X.XX / target $Y.YY" (gold under
target, red over), with an "(N lines unpriced)" caveat so the total is never silently
understated. `formatUsd` formats both.

## Section D — lifecycle/cost advisory + soft-confirm freeze

### Pure assessor

`assessBomSourcing(lines, targetCost)` → `{ warnings: BomWarning[] }`, where a warning is
one of: a **non-`ACTIVE`** part (`Part.lifecycle !== "ACTIVE"` — the enum is
`ACTIVE | NRND | EOL | OBSOLETE`, so test inequality, **not** an `NRND`/`EOL` allowlist that
silently misses `OBSOLETE`), `unpriced` line, `over-target`. Pure, testable, no DB (callers
pass `lines` with `part.lifecycle` + `unitPriceCents`).

### Always-visible advisory panel

In the revision detail / BOM editor at `BOM_SOURCING`: a panel listing the warnings, or a
green "no sourcing warnings" when clean. Purely informational — visible regardless of
freeze state. *Chip note:* the existing `LifecycleBadge` (Phase 0 #4) is a **private**
function inside the public guide component `src/components/guide/GuideBlocks.tsx` — don't
export it (that touches a public component this workstream leaves alone); duplicate a small
admin lifecycle chip (~15 lines, same `EOL`/`OBSOLETE` = danger, `NRND` = caution
semantics) in the BOM editor instead.

### Soft-confirm on the freeze (advance-to-LAYOUT)

`bomFrozenAt` is set as a **side effect** of `advanceStage` entering `LAYOUT`
(`src/lib/actions/stages.ts` — atomic raw UPDATE; there is no standalone freeze action).
A hard exit-gate would *block* the advance, contradicting "soft-confirm, still proceed".
So the ack is **client-side** on the advance control:

- The advance control is **`StageActions`** (`src/components/StageActions.tsx`, a
  `"use client"` component rendered on the revision page — *not* `StageTracker`, which is
  the read-only band). It currently receives only `{ revisionId, currentStage, isFrozen }`,
  so the BOM warnings must be **threaded in as a new prop** from the server page.
- **Only** when `currentStage === "BOM_SOURCING"` (the advance that freezes) and warnings
  exist: show the warning summary + an "I've reviewed the BOM sourcing advisory" checkbox
  whose client state disables the `AdvanceSubmit` button until ticked. Other stages are
  unaffected.
- `advanceStage` itself is **unchanged** — the soft-confirm is a client-side UI affordance,
  not a server gate (advisory-first; WS4 may harden it into a real gate later).

> Honest framing: this is a "did you look?" speed-bump, not enforcement. It matches the
> parent plan's light/advisory-first stance (decisions 3 & 8).

## Explicitly NOT in WS3

- **No public `bomTable` change** — price/cost/second-source stay admin-only this round.
- **No live stock / lead-time API** — availability is lifecycle-only (a future workstream).
- **No `Part`-level price** — price is per-`BomLine` only (sourcing truth, not a global
  part attribute that goes stale).
- **No change to `advanceStage`** — the freeze trigger and its gates are untouched.

## Constraints honored

- **Prod DB.** `.env.local` `DATABASE_URL` is prod. Migration: hand-author SQL +
  `pnpm prisma migrate deploy`. Run vitest **one suite at a time** (never concurrently —
  corrupts the `esp32-sensor-breakout` fixture; `pnpm db:seed` restores).
- **New DB-backed tests use throwaway revisions** on `esp32-sensor-breakout` or a throwaway
  project — never assert on a real curriculum row's mutable state (see the
  guide-completion prod-coupled-test lesson). CSV-import tests create fresh revisions and
  clean up in `afterAll`.
- **Schema-change checks.** After the `BomLine` column add: `pnpm prisma generate`, full
  `pnpm tsc --noEmit`, full `pnpm vitest run`. Watch fixtures that build whole `BomLine`
  objects.
- **`"use server"` files export only async functions** (`bom-lines.ts`).
- **No merge without Josh's go-ahead.** Open the PR (stacked on `feat/ws1-foundations`),
  verify CI `build | pass` explicitly, hand back.

## Verification

- `pnpm prisma generate` succeeds; `pnpm tsc --noEmit` clean.
- `bom-csv.ts` unit tests: header mapping, dollars→cents, refDes-count-vs-quantity
  validation, per-row error collection, blank-price → null.
- `importBomCsv` integration (throwaway revision): matched rows create; re-import updates
  (idempotent); unmatched MPNs reported, not created; frozen revision rejected.
- Cost roll-up + advisory: a line with an EOL part + an unpriced line surface as warnings;
  over-target shows the red badge; `Decimal` targetCost converts correctly.
- Freeze flow: with warnings present, the advance-to-LAYOUT button is disabled until the
  ack checkbox is ticked; `advanceStage` behavior otherwise unchanged.
- Full `pnpm vitest run` green (run once, not concurrently).
