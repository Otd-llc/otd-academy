# Parts Phase C — KiCad Symbol/Footprint Pickers + Server-Side Library (Design)

**Date:** 2026-06-05
**Status:** Design validated (brainstorm complete); implementation plan to follow.
**Parent design:** [parts-subsystem-at-scale](2026-06-04-parts-subsystem-at-scale-design.md) (Phase C section).
**Follows:** Phase B (category tree) — shipped PR #16. The category picker's
`Category.defaultKicadSymbol` / `defaultKicadFootprintLib` columns were seeded
empty in Phase B specifically to drive Phase C's auto-suggest.

## Goal

Make a part created/edited through the UI **export-ready with no script step**:
the curator picks a concrete KiCad **symbol** lib-id (`Device:R`) and **footprint**
lib-id (`Resistor_SMD:R_0805_2012Metric`) from searchable pickers, auto-suggested
from the part's category. The export already embeds vendored symbol defs (PR
#13/#14); Phase C replaces the static, script-maintained snapshot with a
server-side library: a searchable index, an R2 source store, and a layered
resolver. Target format is **KiCad 10** (`20260508`), matching the shipped export.

## Decisions (validated in brainstorm)

| Decision | Choice | Rationale |
| --- | --- | --- |
| Scope | **Full Phase C** — C1 index + C2 R2/cache resolver + C3 form pickers | The complete designed feature, not a slice. |
| Library data | **Full KiCad 10 standard library** (222 symbol libs, 155 footprint dirs) | Picker can reach any standard symbol; ingest is re-runnable to re-sync. |
| Source | Local install `C:\Program Files\KiCad\10.0\share\kicad\{symbols,footprints}` (confirmed present) | No external fetch; matches the export's pinned version. |
| Search relevance | **pg_trgm GIN + `similarity()` ranking** | Full-library scale (~20k symbols) makes raw `contains` noisy; trigram ranking surfaces the best hits. |
| Export resolver | **Layered + lazy** (committed JSON → DefCache → R2 fetch + flatten on miss) | Flatten only the handful of symbols a BOM references; don't pre-flatten 20k. |
| Footprints in R2 | **No** — footprints stay *referenced* | Resolved from the learner's local `fp-lib-table` at PCB time; the index only powers the picker. |

## §1 — Schema + migration (C1)

Three models (near the `Part` models in `prisma/schema.prisma`):

```prisma
model KicadLibSymbol {
  libId       String  @id        // "Device:R"
  lib         String             // "Device"
  name        String             // "R"
  keywords    String?            // ki_keywords
  description String?            // ki_description
  datasheet   String?            // Datasheet property → seeds Part.datasheetUrl on pick
  fpFilters   String?            // ki_fp_filters → narrows the footprint picker
  @@index([lib])
}

model KicadLibFootprint {
  libId       String @id         // "Resistor_SMD:R_0805_2012Metric"
  lib         String
  name        String
  description String?            // (descr ...)
  tags        String?            // (tags ...)
  padCount    Int?
  @@index([lib])
}

model KicadSymbolDefCache {
  libId   String   @id           // flattened, self-contained "(symbol ...)" text
  text    String
  version String                 // KiCad release tag; cache-bust on bump
  builtAt DateTime @default(now())
}
```

`createPartSchema` gains `kicadSymbol?` and `kicadFootprint?`, validated as
well-formed `Lib:Name` lib-ids (`/^[\w.-]+:[\w./-]+$/`).

**Migration (hand-authored; NEVER `prisma migrate dev` against shared Neon):**
`CREATE EXTENSION IF NOT EXISTS pg_trgm`; the three tables; and **GIN trigram
indexes** on a searchable text expression for symbols and footprints, e.g.
`CREATE INDEX KicadLibSymbol_search_trgm ON "KicadLibSymbol" USING GIN
((coalesce(name,'') || ' ' || coalesce(keywords,'') || ' ' || coalesce(description,'')) gin_trgm_ops);`
Apply via `prisma migrate deploy` (Neon supports pg_trgm). Then `prisma generate`.

## §2 — Ingest seed (re-runnable, direct-Prisma)

`scripts/ingest-kicad-libs.ts` reads the local install:
- **Symbols:** parse each `.kicad_sym`; upsert one `KicadLibSymbol` per `(symbol …)`
  with `name`, `ki_keywords`, `ki_description`, `Datasheet`, `ki_fp_filters`.
- **Footprints:** parse each `.kicad_mod` in every `.pretty`; upsert
  `KicadLibFootprint` with `(descr)`, `(tags)`, and pad count.
- Idempotent upserts (re-run to re-sync a KiCad bump). Prints counts.

The flatten/`resolve()` logic currently in `scripts/vendor-kicad-symbols.ts`
**moves into `src/lib/kicad/flatten.ts`** (typed properly — this clears the 4
pre-existing `tsc` errors in that script) and is reused by the ingest, the
resolver, and the existing vendor script.

## §3 — R2 library + layered resolver (C2)

A seed (`scripts/upload-kicad-symbol-libs.ts`) uploads the 222 `.kicad_sym`
**symbol** sources to R2 under `kicad/symbols/<version>/<Lib>.kicad_sym`.
Footprints are never uploaded.

`resolveVendoredSymbol(libId)` in `src/lib/kicad/vendor-symbols.ts` becomes
**async + layered**:
1. Committed `vendor/standard-symbols.json` (offline/fast path; already-referenced defs).
2. `KicadSymbolDefCache` row for `libId`.
3. **Miss** → fetch `<Lib>.kicad_sym` from R2, `flatten()` the symbol, write the
   cache row (with `version`), return.

The export's symbol-lib generator switches to the async resolver. The committed
JSON stays as the seed; no behavior change for already-referenced parts.

## §4 — Search actions

`searchKicadSymbols(q, lib?)` / `searchKicadFootprints(q, lib?)` — Prisma
`$queryRaw` using pg_trgm `similarity()` over the searchable expression, `ORDER BY
similarity DESC`, `take ≤ 50`, optional `lib` filter. Same input/output shape as
`listPartsBySearch`. Return `{ libId, lib, name, description, … }` for the picker.

## §5 — Form pickers + category auto-suggest (C3)

Two client islands modeled on the Phase B `CategoryCombobox`:
- **`KicadSymbolPicker`** (over `searchKicadSymbols`) → posts `kicadSymbol`; shows
  name · lib · description. If the symbol has a datasheet and the part has none,
  offer to fill `datasheetUrl`.
- **`KicadFootprintPicker`** (over `searchKicadFootprints`) → posts `kicadFootprint`;
  pre-filtered by the chosen symbol's `fpFilters` + the category's default lib.

On category select, prefill `kicadSymbol` from `Category.defaultKicadSymbol` and
constrain the footprint picker to `defaultKicadFootprintLib`. `createPart`
validates both lib-ids exist in the index, sets them.

**Category defaults seed** (`scripts/seed-category-kicad-defaults.ts`): set
sensible defaults on the 6 pilot leaves, e.g. `MLCC_CAPACITOR → Device:C` /
`Capacitor_SMD`; `PASSIVE_RESISTOR → Device:R` / `Resistor_SMD`;
`LDO_REGULATOR → Regulator_Linear` lib; `USB_CONNECTOR → Connector` /
`Connector_USB`.

## §6 — Testing + build sequence

**Tests:** pure tests for `flatten()` (extends-chain resolution, cycle guard) and
the lib-id validators; DB tests for the search actions (trigram ranking, `lib`
filter) and the layered resolver (cache hit/miss → cache write) with throwaway
rows swept in `afterAll`; the full schema-change gate (full `tsc` + full
`vitest`) after the migration.

**Build order:** schema + migration (pg_trgm) → extract `flatten.ts` → ingest seed
→ R2 upload + layered resolver → search actions → pickers + category auto-suggest
→ category-default seed → full gate.

## Reuse vs. build

| Reuse | Build |
| --- | --- |
| `sexpr.ts`, `symbol-lib.ts`, the `resolve()`/flatten logic (move into `src/lib/kicad/flatten.ts`) | `KicadLibSymbol` / `KicadLibFootprint` / `KicadSymbolDefCache` + pg_trgm migration |
| `listPartsBySearch` pattern (→ search actions) | `searchKicadSymbols` / `searchKicadFootprints` ($queryRaw + trigram) |
| Phase B `CategoryCombobox` island pattern | `KicadSymbolPicker` / `KicadFootprintPicker` |
| Existing R2 helpers (part-assets uploads/presign) | R2 symbol-lib seed + layered `resolveVendoredSymbol` |
| Committed `vendor/standard-symbols.json` (stays as fast path) | Ingest + R2-upload seeds |

## Out of scope (later)

- Admin UI to edit `Category.defaultKicadSymbol`/`defaultKicadFootprintLib`
  (seed-only this phase, mirroring Phase B's seed-only category tree).
- Footprint *file* bundling (footprints stay referenced by design).
- Auto-re-sync on KiCad version bump (re-run the ingest + R2 upload manually).

## Hard environment rules (carry over from Phase B)

- **NEVER `prisma migrate dev`** against the shared Neon DB. Hand-author the
  migration SQL (including `CREATE EXTENSION pg_trgm` + GIN indexes), confirm
  `prisma migrate status` (1 pending, no drift), then `prisma migrate deploy`,
  then `prisma generate`. Match Prisma's index/FK naming.
- After the schema change, run the FULL `tsc` AND FULL `vitest`.
- Use the **PowerShell** tool for `pnpm`/`git` (Bash lacks `pnpm` on PATH).
- Commits: stage explicit paths, never `git add -A`; Co-author trailer. For
  commit messages / PR bodies with non-ASCII or quotes, write to a file and use
  `git commit -F` / `gh pr create --body-file` (PowerShell mangles inline).
- `gh`: prefix with `$env:GH_TOKEN=$null;` (stale token shadows keyring). Base
  branch `main`; handle `joshtol`.
- **CI is currently red** on a pre-existing infra bug (workflow pins Node 20 but
  pnpm 11.5.1 needs Node ≥22.13). A one-line fix (`.github/workflows/ci.yml`
  `node-version: 22`) would make CI meaningful for this phase — recommended as a
  quick separate PR.
