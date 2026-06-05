# Parts Subsystem at Scale — Design

**Status:** Design (validated 2026-06-04). Implementation plan to follow via `writing-plans`.

**Goal:** Take the parts catalog from a Phase-1 single-table list to a subsystem that
stays usable at a massive component count: searchable, organized by a real category
tree, mobile-responsive, and with KiCad symbol/footprint assignment moved into the
part-create flow (so export "just works" for any new part without per-part manual
vendoring).

**Architecture in one sentence:** Every surface here reduces to the *same* primitive —
a server-side, indexed, `contains`-searchable table queried from a Server Component or
a `"use server"` action — so parts search, category navigation, and the KiCad
symbol/footprint pickers all share one pattern (the existing `listPartsBySearch` action
is the seed of it).

**Tech stack:** Next.js 16 (App Router, RSC + small client islands), Prisma 7 + Neon
Postgres, Tailwind v4, Radix primitives, Cloudflare R2. No new runtime deps required for
Phases A–B; Phase C adds an R2-hosted KiCad library source + generated index tables.

---

## Decisions (locked)

| Fork | Choice | Why |
| --- | --- | --- |
| Category model | **Hierarchical category tree** (a `Category` table, parent/child + materialized `path`) | Scales to hundreds of nodes, supports subtree filters + per-node counts; the 6 enum values migrate in as seed rows. |
| Mobile layout | **Cards below `md`, table at `md`+** | Best touch UX; mirrors the existing `BoardsTable` responsive approach. |
| KiCad picker source | **Full KiCad standard library, server-side** | Picker can offer *any* standard symbol/footprint; export resolves/flattens the picked symbol def on demand. Always complete. |
| Search engine (defaulted) | **Server `?q=` + Prisma `contains` + pagination**, `pg_trgm` GIN as the documented scale-up | Reuses the existing action; RSC-friendly; no new infra now. |

---

## Current state (baseline)

- **List** — `src/app/parts/page.tsx` is a Server Component doing `db.part.findMany()`
  with only a `?mains=1` certified-module chip. Renders a bare `<table class="w-full">`
  (no `overflow-x-auto`), Category column `hidden md:table-cell`. No search box, no
  pagination.
- **Search backend already exists** — `listPartsBySearch()` in `src/lib/actions/parts.ts`
  (`contains` OR over mpn/manufacturer/description, `take ≤ 50`) — wired to BOM dropdowns,
  *not* the list page.
- **Create/edit** — `src/components/CreatePartDialog.tsx` (`PartFields`) + action
  `createPartFormAction`. `category` is a `<select>` over the 6-value enum; `footprint`
  is free text; **`kicadSymbol`/`kicadFootprint` are on the model but not in the form**.
- **Taxonomy** — `enum PartCategory { RF_MODULE, LDO_REGULATOR, USB_UART_IC,
  MLCC_CAPACITOR, USB_CONNECTOR, PASSIVE_RESISTOR }` — project-specific, won't scale.
- **Reuse** — `BoardsTable.tsx` (responsive table + `overflow-x-auto` + status pills),
  `FilterChip` (URL-state chips), `PageHeader`, `PartGlanceTrigger`, native `<dialog>`
  modal pattern, Radix `Tooltip`. No DataTable/combobox/pagination components yet.

---

## Phase A — Parts list at scale (search · filter · sort · paginate · mobile)

Independent of the taxonomy work; delivers the most immediate value. Keeps the current
enum for the category chip until Phase B.

### A1. Server-side query from searchParams

`parts/page.tsx` reads typed searchParams and composes one Prisma query:

```
?q=          free text   → OR contains(mpn, manufacturer, description), insensitive
?cat=        category    → Phase A: enum value; Phase B: category path subtree
?lifecycle=  enum        → ACTIVE | NRND | EOL | OBSOLETE
?mains=1     bool        → isCertifiedModule (existing)
?sort=       enum        → mpn | manufacturer | recent  (default manufacturer,mpn)
?page=       int ≥ 1     → skip = (page-1)*PAGE_SIZE, take = PAGE_SIZE (50)
```

- Run `db.part.findMany({ where, orderBy, skip, take, select })` and
  `db.part.count({ where })` in one `Promise.all` for the pager.
- Validate every param against an allowlist (mirror `src/app/page.tsx` filter handling) —
  unknown values are dropped, not thrown.

### A2. Indexes / search scale path

- Existing `@@index([mpn]) @@index([category]) @@index([lifecycle])` stay.
- Add `@@index([manufacturer])` (default sort + filter).
- **Scale-up (documented, not built now):** `contains` compiles to `ILIKE '%q%'` → a
  sequential scan. When that gets slow, enable the Postgres `pg_trgm` extension and add a
  GIN index on the searched columns (`gin (mpn gin_trgm_ops)`, etc.), or move to a
  generated `tsvector` + GIN full-text column. Either is a migration-only change behind
  the same action signature.

### A3. UI — search + filters

- **`PartsSearch`** (new client island): a debounced text input that pushes `?q=` via
  `router.replace` (keeps other params). ~30 lines; the only new client state.
- **Filters**: reuse `FilterChip` for `mains` + `lifecycle`; category as a chip row now,
  a tree picker in Phase B. Filters live in a `flex flex-wrap` bar that stacks on mobile.
- **Pager**: a small `Pagination` component (Prev / "page X of N" / Next) emitting
  `?page=` links. Server-rendered, no client JS.

### A4. Mobile — cards below `md`, table at `md`+

Extract presentation into **`PartsList`**:

- `<div class="hidden md:block">` → the existing table, wrapped in `overflow-x-auto`
  (belt-and-suspenders) — mirror `BoardsTable`.
- `<ul class="md:hidden">` → one **`PartCard`** per row: MPN (link) + manufacturer +
  description (clamped) + category chip + lifecycle + CERTIFIED badge + `PartGlanceTrigger`.
- Search bar + filters full-width and tap-friendly on mobile.

**Phase A ships alone** and resolves both "needs a search system" and "isn't mobile
responsive" for the current catalog size.

---

## Phase B — Category taxonomy (hierarchical tree)

### B1. Data model

```prisma
model Category {
  id        String     @id @default(cuid())
  slug      String     @unique          // "smd-resistors"
  name      String                       // "SMD Resistors"
  parentId  String?
  parent    Category?  @relation("CategoryTree", fields: [parentId], references: [id], onDelete: Restrict)
  children  Category[] @relation("CategoryTree")
  path      String     @unique           // materialized slugs: "passives/resistors/smd-resistors"
  depth     Int        @default(0)
  order     Int        @default(0)       // sibling display order
  // Phase-C auto-suggest defaults (nullable; only leaf-ish nodes set these)
  defaultKicadSymbol       String?        // e.g. "Device:R"
  defaultKicadFootprintLib String?        // e.g. "Resistor_SMD" (narrows the footprint picker)
  parts     Part[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([parentId])
  @@index([path])
}
```

`Part` gains:

```prisma
categoryId  String?
categoryRef Category? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
@@index([categoryId])
```

- **Materialized `path`**: computed on write as `parent.path + "/" + slug` (root = slug).
  Subtree filter = `where: { categoryRef: { path: { startsWith: node.path + "/" } } }`,
  including the node itself via `OR categoryId = node.id`. Chosen over a recursive CTE /
  closure table because the tree is small (hundreds of nodes) and reads dominate.
- **Re-parenting** a node rewrites its descendants' `path` (rare admin op) — acceptable;
  note it in the move handler.

### B2. Migration (enum → tree, non-destructive)

1. Add `Category` + `Part.categoryId` (keep `Part.category` enum column for now).
2. Seed the initial tree and map the 6 enum values to leaf nodes:
   - `Passives → Resistors → SMD Resistors` ← `PASSIVE_RESISTOR`
   - `Passives → Capacitors → MLCC` ← `MLCC_CAPACITOR`
   - `ICs → Power → LDO Regulators` ← `LDO_REGULATOR`
   - `ICs → Interface → USB-UART` ← `USB_UART_IC`
   - `Modules → RF Modules` ← `RF_MODULE`
   - `Connectors → USB Connectors` ← `USB_CONNECTOR`
3. Backfill `Part.categoryId` from the old enum via the mapping.
4. A *later* migration drops `Part.category` + the `PartCategory` enum once nothing reads
   them (export, fact code, tests audited first — see the schema-change discipline note).

### B3. UI

- **List**: replace the category chip with a **`CategoryTreePicker`** (collapsible tree or
  cascading combobox) that sets `?cat=<path>`; show a per-node part count
  (`groupBy categoryId` or count per path prefix). Breadcrumb of the active node.
- **Create/edit form**: swap the enum `<select>` for the same tree picker (sets
  `categoryId`). Selecting a category with `defaultKicadSymbol`/`defaultKicadFootprintLib`
  pre-fills the Phase-C symbol/footprint pickers (overridable).
- **Admin**: a minimal category CRUD (add child / rename / reorder / move). Small;
  gated to authors.

---

## Phase C — KiCad library index + create-form symbol/footprint pickers

Moves symbol/footprint assignment into part-create and makes export self-service for any
part. Builds directly on the existing vendor/flatten machinery
(`scripts/vendor-kicad-symbols.ts`, `src/lib/kicad/vendor-symbols.ts`).

### C1. Server-side library — three pieces

1. **Source of truth (R2).** A pinned KiCad standard-library release (symbol `.kicad_sym`
   + footprint `.pretty` metadata) uploaded once under `kicad-libs/<release>/…` by a seed
   script. Keeps the repo lean and the function bundle small (vs. committing tens of MB).
2. **Search index (Postgres).** Generated from that release so the picker searches with the
   same `contains` pattern as parts:

   ```prisma
   model KicadLibSymbol {
     libId       String  @id   // "Device:R"
     lib         String        // "Device"
     name        String        // "R"
     keywords    String?
     description String?
     datasheet   String?       // seeds Part.datasheetUrl on pick when present
     fpFilters   String?       // symbol's footprint filters → narrows the footprint picker
     @@index([lib])
   }
   model KicadLibFootprint {
     libId       String @id    // "Resistor_SMD:R_0805_2012Metric"
     lib         String
     name        String
     description String?
     tags        String?
     padCount    Int?
     @@index([lib])
   }
   ```

   Search actions `searchKicadSymbols(q, lib?)` / `searchKicadFootprints(q, lib?)` mirror
   `listPartsBySearch` (insensitive `contains` over name/keywords/description, `take ≤ 50`).
   `pg_trgm` GIN is the same documented scale path.
3. **Def cache (Postgres).** Export needs the *flattened* symbol S-expr only for the
   handful of symbols a BOM references:

   ```prisma
   model KicadSymbolDefCache {
     libId   String   @id   // flattened, self-contained "(symbol ...)" text
     text    String
     version String         // source release tag (cache-bust on KiCad bump)
     builtAt DateTime @default(now())
   }
   ```

### C2. Export resolution (replaces the static snapshot)

`resolveVendoredSymbol(libId)` becomes a layered resolver:

1. Committed `vendor/standard-symbols.json` (today's snapshot) — fast path / offline seed.
2. `KicadSymbolDefCache` row for `libId`.
3. **Miss** → fetch the lib's source from R2, parse, **flatten extends** (the existing
   `resolve()` logic moves from the script into `src/lib/kicad/`), write the cache, return.

Footprints stay *referenced* (resolved from the learner's local `fp-lib-table` at PCB
time) — the index exists only to power the picker; no footprint files are bundled.

### C3. Create/edit form

- **Category** (Phase B picker) drives auto-suggest: on select, prefill `kicadSymbol` from
  `Category.defaultKicadSymbol` and constrain the footprint picker to
  `defaultKicadFootprintLib`.
- **`KicadSymbolPicker`** (client island, combobox over `searchKicadSymbols`) → sets
  `Part.kicadSymbol` to a concrete lib-id; shows name · lib · description. If the symbol
  carries a datasheet and the part has none, offer to fill `datasheetUrl`.
- **`KicadFootprintPicker`** (same, over `searchKicadFootprints`) → `Part.kicadFootprint`,
  pre-filtered by the symbol's `fpFilters` + the chosen category's footprint lib.
- `createPartSchema` gains `categoryId`, `kicadSymbol`, `kicadFootprint` (optional, but
  validated as well-formed `Lib:Name` lib-ids).

**Net effect:** a part created through the UI is export-ready — no `populate-*` /
`vendor-*` script step. The WROOM `populate-wroom-kicad-refs` + `vendor-kicad-symbols`
flow becomes the one-time seed of the index + cache.

---

## Reuse vs. build

| Reuse | Build |
| --- | --- |
| `listPartsBySearch` pattern (→ all search actions) | `PartsSearch`, `Pagination`, `PartsList` + `PartCard` |
| `BoardsTable` responsive/overflow pattern | `CategoryTreePicker` + minimal category admin |
| `FilterChip`, `PageHeader`, `PartGlanceTrigger`, Radix `Tooltip` | `KicadSymbolPicker` / `KicadFootprintPicker` comboboxes |
| `vendor-kicad-symbols` flatten logic (move into `src/lib/kicad/`) | R2 library seed + `KicadLibSymbol/Footprint/DefCache` + layered resolver |

---

## Risks / notes

- **Schema-change discipline** (per prior burns): the enum→`categoryId` migration and the
  eventual enum drop must be followed by a **full `tsc` + the full vitest suite** — enum
  mirrors, fixtures, and the `esp32-sensor-breakout` seed fixture break in ways a task's
  own checks miss. Keep the enum column through a transition release; drop it in a separate
  migration after auditing every reader.
- **`contains` is a seq scan** — fine to thousands; `pg_trgm` GIN is the pre-planned fix,
  same action signature.
- **KiCad release pinning** — the R2 source + index + `version` stamp must move together;
  bumping KiCad busts `KicadSymbolDefCache`. Footprint *references* already assume the
  learner's local libs, so name drift between releases is the watch item.
- **Function bundle size** — source libs live in R2, never bundled; only the small index
  rows + the committed snapshot ship with the app.

---

## Out of scope (YAGNI)

- Parametric search (resistance/voltage range filters) — depends on `PartFact` parametrics;
  separate design.
- Bulk import / CSV part ingestion.
- Symbol/footprint *editing* in-app (we reference standard libs; custom parts still go
  through the existing upload+verify asset flow).
- 3D model picking (models remain the upload flow).

---

## Rollout

`A → B → C`, each independently shippable:

- **A** fixes search + mobile for today's catalog with no new infra.
- **B** adds the scalable taxonomy + tree navigation.
- **C** automates KiCad assignment + makes export self-service.
