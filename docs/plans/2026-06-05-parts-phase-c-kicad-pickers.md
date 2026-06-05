# Parts Phase C — KiCad Pickers + Server-Side Library Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task.

**Goal:** Let a curator pick concrete KiCad symbol/footprint lib-ids in the part form (auto-suggested from the category), backed by a searchable full-library index, an R2 symbol-lib store, and a layered export resolver — so a UI-created part is export-ready with no script step.

**Architecture:** Three Postgres tables (`KicadLibSymbol`/`KicadLibFootprint` index + `KicadSymbolDefCache`) seeded from the local KiCad 10 install, with pg_trgm-ranked search actions. The export's `resolveVendoredSymbol` becomes async + layered (committed JSON → DefCache → R2 fetch + flatten on miss). Two client-island comboboxes (modeled on Phase B's `CategoryCombobox`) drive `Part.kicadSymbol`/`kicadFootprint`, pre-filled from `Category.defaultKicadSymbol`/`defaultKicadFootprintLib`.

**Tech Stack:** Next.js 16 (RSC + client islands), Prisma 7 + Neon (pg_trgm), Zod 4, R2 (`@aws-sdk/client-s3`), Vitest 4 (node env). Reuses `src/lib/kicad/` (sexpr, symbol-lib, the existing export + committed snapshot).

**Design:** [parts-phase-c-kicad-pickers-design](2026-06-05-parts-phase-c-kicad-pickers-design.md).

---

## Conventions for the executor

- **Migrations: NEVER `prisma migrate dev`** against the shared Neon DB. Hand-author SQL under `prisma/migrations/<ts>_<name>/migration.sql`, confirm `pnpm exec prisma migrate status` (1 pending, no drift), then `pnpm exec prisma migrate deploy`, then `pnpm exec prisma generate`.
- Use the **PowerShell** tool for `pnpm`/`git` (Bash lacks `pnpm` on PATH).
- One test file: `pnpm exec vitest run <path>`. Don't redirect vitest stderr (`2>&1`) — PS 5.1 wraps it as noise; pipe to `2>$null` then `Select-String` for summaries.
- Type-check: `pnpm exec tsc --noEmit` — **4 pre-existing errors in `scripts/vendor-kicad-symbols.ts` are the baseline** (Task 2 removes them). "Clean" = no NEW errors.
- Commits: stage explicit paths, never `git add -A`; Co-author trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. For messages with non-ASCII/quotes, write to a file and `git commit -F`.
- Node-env Vitest, `globals: false` — import test fns from `"vitest"`. DB tests use `Date.now()`-suffixed unique keys + sweep in `afterAll` (copy `src/lib/__tests__/parts-query.test.ts`).
- KiCad source dir: `C:\Program Files\KiCad\10.0\share\kicad\{symbols,footprints}` (222 `.kicad_sym`, 155 `.pretty`).

---

## Task 1: Schema + pg_trgm migration + lib-id validation

**Files:** `prisma/schema.prisma`; `prisma/migrations/<ts>_kicad_library/migration.sql`; `src/lib/schemas/part.ts`; Test: `src/lib/__tests__/part-schema.test.ts` (create if absent).

**Step 1 — Schema.** Add near the `Part` models:

```prisma
model KicadLibSymbol {
  libId       String  @id      // "Device:R"
  lib         String
  name        String
  keywords    String?
  description String?
  datasheet   String?
  fpFilters   String?
  // pg_trgm GIN search index added in the raw migration (not expressible here).
  @@index([lib])
}

model KicadLibFootprint {
  libId       String @id       // "Resistor_SMD:R_0805_2012Metric"
  lib         String
  name        String
  description String?
  tags        String?
  padCount    Int?
  // pg_trgm GIN search index added in the raw migration.
  @@index([lib])
}

model KicadSymbolDefCache {
  libId   String   @id
  text    String
  version String
  builtAt DateTime @default(now())
}
```

**Step 2 — Hand-author the migration** (`CreateTable` ×3 mirroring Prisma DDL, then the extension + GIN indexes):

```sql
-- CreateExtension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateTable KicadLibSymbol / KicadLibFootprint / KicadSymbolDefCache
--   (mirror an existing migration's column DDL; TEXT cols, "padCount" INTEGER,
--    "builtAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP, PK constraints).

-- CreateIndex (btree, Prisma-named)
CREATE INDEX "KicadLibSymbol_lib_idx"    ON "KicadLibSymbol"("lib");
CREATE INDEX "KicadLibFootprint_lib_idx" ON "KicadLibFootprint"("lib");

-- CreateIndex (pg_trgm GIN, raw — search ranking)
CREATE INDEX "KicadLibSymbol_search_trgm" ON "KicadLibSymbol"
  USING GIN ((coalesce("name",'') || ' ' || coalesce("keywords",'') || ' ' || coalesce("description",'')) gin_trgm_ops);
CREATE INDEX "KicadLibFootprint_search_trgm" ON "KicadLibFootprint"
  USING GIN ((coalesce("name",'') || ' ' || coalesce("description",'') || ' ' || coalesce("tags",'')) gin_trgm_ops);
```

**Step 3 — Apply safely:** `migrate status` (expect 1 pending) → `migrate deploy` → `generate`.

**Step 4 — lib-id validation (TDD).** Add to `src/lib/schemas/part.ts` a reusable `kicadLibId` Zod string and extend `createPartSchema`:

```ts
export const kicadLibId = z
  .string()
  .trim()
  .regex(/^[\w.-]+:[\w./-]+$/, "must be a KiCad lib-id (Lib:Name)")
  .max(200);
// in createPartSchema:
  kicadSymbol: kicadLibId.optional().nullable(),
  kicadFootprint: kicadLibId.optional().nullable(),
```

Write tests: a valid `"Device:R"` / `"Resistor_SMD:R_0805_2012Metric"` passes; `"Device"` (no colon) and `"a:b:c"`-style garbage fail.

**Step 5 — Commit** schema + migration dir + part.ts + test.
`feat(kicad): library index tables (pg_trgm) + Part kicad lib-id validation`

---

## Task 2: Extract `flatten.ts` from the vendor script (TDD)

**Files:** Create `src/lib/kicad/flatten.ts`; Test `src/lib/kicad/__tests__/flatten.test.ts`; Modify `scripts/vendor-kicad-symbols.ts` to import it.

The `resolve()` function (extends-chain flattening) currently lives inline in `scripts/vendor-kicad-symbols.ts` (and trips 4 tsc errors via dynamic imports). Move it to a typed pure module.

**Step 1 — Write failing tests** for `flattenSymbol(libNode, name)`:
- a self-contained symbol returns a clone unchanged;
- a derived symbol `(symbol "X" (extends "Base") (property "Value" "X"))` returns a self-contained def named `X` with Base's body + the override;
- an extends cycle throws.

Build the `libNode` fixtures with `parseSexpr` over small inline `.kicad_sym` strings.

**Step 2 — Implement** `src/lib/kicad/flatten.ts` exporting `flattenSymbol(libNode: SList, name: string): SList` and a `symbolByName(libNode, name)` helper — the body lifted verbatim from the script's `resolve()`/`symByName`/`propName`, typed against `sexpr.ts` (`SList`, `findChild`, `findChildren`, `head`, `isStr`, `isList`) and `symbol-lib.ts`'s `renameSymbol`.

**Step 3 — Run** `pnpm exec vitest run src/lib/kicad/__tests__/flatten.test.ts` → PASS.

**Step 4 — Refactor the script** to `import { flattenSymbol, symbolByName } from "@/lib/kicad/flatten"` and delete the inline copies. Confirm `pnpm exec tsc --noEmit` now shows **0 errors** (baseline cleared).

**Step 5 — Commit.** `refactor(kicad): extract symbol-flatten logic into src/lib/kicad/flatten.ts`

---

## Task 3: Ingest seed — index the full library (script)

**Files:** Create `scripts/ingest-kicad-libs.ts` (idempotent, direct-Prisma seed style; copy the dotenv + deferred-`db`-import shape from `scripts/seed-category-tree.ts`).

**Symbols:** for each `*.kicad_sym` in the symbols dir, `parseSexpr`, then for each `(symbol …)` child (top-level only — skip unit sub-symbols whose name contains `_<n>_<m>`), read properties via a `getProp(sym, key)` helper (`findChildren(sym,"property")` → match `items[1]` name → `items[2]` value). Upsert `KicadLibSymbol { libId: `${lib}:${name}`, lib, name, keywords: getProp("ki_keywords"), description: getProp("ki_description"), datasheet: getProp("Datasheet"), fpFilters: getProp("ki_fp_filters") }`.

**Footprints:** for each `*.pretty` dir, for each `*.kicad_mod`, `parseSexpr`; the node head is `footprint`; `name = items[1]`. Upsert `KicadLibFootprint { libId: `${lib}:${name}`, lib (the .pretty dir name minus suffix), name, description: atomValue(findChild(fp,"descr")?.items[1]), tags: …"tags"…, padCount: findChildren(fp,"pad").length }`.

Batch upserts (chunk with `createMany` + `skipDuplicates`, or `$transaction` in groups of ~500) — there are ~20k + ~15k rows. Print counts. Re-runnable.

**Run it** and record the counts. Leave the script tracked (commit the script only, not DB state).
**Commit.** `feat(kicad): ingest full KiCad 10 standard library into the index`

---

## Task 4: R2 symbol-lib upload seed (script)

**Files:** Create `scripts/upload-kicad-symbol-libs.ts`.

Upload the 222 `*.kicad_sym` **symbol** sources to R2 (footprints are never uploaded). Use the `r2` `S3Client` + `env` from `src/lib/r2.ts` / `@/env` (read the bucket name there; mirror the `PutObjectCommand` usage in `src/lib/actions/part-assets.ts`). Key scheme: `kicad/symbols/<KICAD_VERSION>/<Lib>.kicad_sym` (define `KICAD_VERSION = "20260508"` shared with the cache `version`). Skip-if-exists (HEAD) so re-runs are cheap. Requires `R2_ENABLED`; abort with a clear message otherwise. Print uploaded/skipped counts.

**Commit.** `feat(kicad): upload standard symbol-lib sources to R2`

---

## Task 5: Layered async resolver (TDD)

**Files:** Modify `src/lib/kicad/vendor-symbols.ts`; Modify `src/lib/kicad/export.ts:246-253`; Test `src/lib/__tests__/kicad-resolver.test.ts`.

**Step 1 — Failing tests** (DB; inject `db`): a `libId` present in the committed JSON resolves WITHOUT hitting the cache; a `libId` absent from JSON but present in `KicadSymbolDefCache` returns the cached text; a miss path is asserted structurally (the R2 fetch is the seam — gate it behind a thin `fetchLibSource(libId)` so the test stubs it, returns a flattened def, and asserts a cache row was written).

**Step 2 — Implement** `resolveVendoredSymbol(libId): Promise<string | undefined>`:
1. `DEFS[libId]` (committed JSON) → return.
2. `db.kicadSymbolDefCache.findUnique({ where: { libId } })` → return `.text`.
3. `const src = await fetchLibSource(libId)`; if none → `undefined`. Parse, `flattenSymbol(libNode, name)`, `serializeSexpr`, `db.kicadSymbolDefCache.upsert(... { text, version: KICAD_VERSION })`, return text.

`fetchLibSource(libId)` does the R2 `GetObjectCommand` for `kicad/symbols/<version>/<Lib>.kicad_sym` and returns the body text (or undefined on 404). Keep `vendoredSymbolIds()` for the committed set.

**Step 3 — Update `export.ts`.** The assembly loop (line ~246) calls `resolveVendoredSymbol` twice synchronously; change to `const vendored = await resolveVendoredSymbol(part.kicadSymbol)` once, then branch on `vendored !== undefined`. The enclosing loop is already `async` (it `await`s asset fetches) — confirm and `await`.

**Step 4 — Run** the resolver test + the existing kicad export tests (`pnpm exec vitest run -t kicad`) → PASS.
**Commit.** `feat(kicad): layered async symbol resolver (JSON -> cache -> R2 flatten)`

---

## Task 6: Search actions (TDD)

**Files:** Create `src/lib/actions/kicad-search.ts` (`"use server"`); Test `src/lib/__tests__/kicad-search.test.ts`.

`searchKicadSymbols(input)` / `searchKicadFootprints(input)` — Zod-parse `{ q: string (≤128), lib?: string, take?: ≤50 default 25 }`, then `db.$queryRaw` with pg_trgm:

```ts
// symbols (footprints mirror with the footprint search expression)
const rows = await db.$queryRaw<SymbolHit[]>`
  SELECT "libId", "lib", "name", "description",
         similarity(coalesce("name",'')||' '||coalesce("keywords",'')||' '||coalesce("description",''), ${q}) AS sim
  FROM "KicadLibSymbol"
  WHERE (${lib}::text IS NULL OR "lib" = ${lib})
    AND (coalesce("name",'')||' '||coalesce("keywords",'')||' '||coalesce("description",'')) % ${q}
  ORDER BY sim DESC, "name" ASC
  LIMIT ${take};`;
```

**TDD:** seed a handful of throwaway `KicadLibSymbol` rows (distinct `lib` prefix, `Date.now()`-suffixed) incl. near-miss names; assert the closest match ranks first, the `lib` filter narrows, and `take` caps. Sweep in `afterAll`. (Set `pg_trgm.similarity_threshold` is the default 0.3; if the test's tokens fall below it, lower via `set_limit` in the same tx or assert on the ordered subset.)

**Commit.** `feat(kicad): pg_trgm-ranked symbol/footprint search actions`

---

## Task 7: Form pickers + category auto-suggest (build + verify)

**Files:** Create `src/components/parts/KicadSymbolPicker.tsx`, `src/components/parts/KicadFootprintPicker.tsx`; Modify `src/components/CreatePartDialog.tsx` (the shared `PartFields`); Modify `src/lib/actions/parts.ts` (`createPart`); Test: extend `src/lib/__tests__/parts-actions.test.ts`.

- Both pickers are client islands modeled on `src/components/parts/CategoryCombobox.tsx` (same loaded/empty state, `onMouseDown` preventDefault, filter-after-select fixes). `KicadSymbolPicker` calls `searchKicadSymbols` (debounced on input, not load-all — the index is large), posts `kicadSymbol` via a hidden input, renders `name · lib · description`. `KicadFootprintPicker` calls `searchKicadFootprints`, posts `kicadFootprint`, and accepts a `lib?`/`fpFilters?` prop to pre-narrow.
- **Auto-suggest:** in `PartFields`, lift the chosen category into state; when it changes, fetch its `Category.defaultKicadSymbol`/`defaultKicadFootprintLib` (extend `listCategoriesForPicker` to include them, or a small `getCategoryDefaults(id)` action) → seed the symbol picker's value and pass the footprint lib to the footprint picker.
- `createPart`: validate `kicadSymbol`/`kicadFootprint` exist in the index (`db.kicadLibSymbol.findUnique`), set them. Unknown → throw a clean error.
- **Verify:** `tsc` clean; extend `parts-actions.test.ts` (createPart links a real indexed symbol/footprint; rejects an unknown lib-id). Dev-server pass — picking a category prefills the symbol, the footprint picker narrows, create succeeds (note: `/parts/new` is auth-gated).

**Commit.** `feat(kicad): symbol/footprint pickers + category auto-suggest on the part form`

---

## Task 8: Category KiCad defaults seed (script)

**Files:** Create `scripts/seed-category-kicad-defaults.ts`.

Set `defaultKicadSymbol`/`defaultKicadFootprintLib` on the 6 pilot leaves (idempotent `update` by slug): `MLCC_CAPACITOR → "Device:C"` / `"Capacitor_SMD"`; `PASSIVE_RESISTOR → "Device:R"` / `"Resistor_SMD"`; `LDO_REGULATOR → "Regulator_Linear:AP2112K-3.3"` (or leave symbol null) / `"Package_TO_SOT_SMD"`; `USB_CONNECTOR → null` / `"Connector_USB"`; `RF_MODULE`/`USB_UART_IC` → leave null where no single default fits. Run it; print what was set.

**Commit.** `feat(kicad): seed category KiCad symbol/footprint defaults`

---

## Task 9: Full schema-change gate

- `pnpm exec tsc --noEmit` — **0 errors** (Task 2 cleared the vendor-script baseline).
- `pnpm exec vitest run` — FULL suite green. If a fixture needs the new `Part.kicadSymbol`/`kicadFootprint` or a `KicadLib*` shape, fix it (mirror Phase B's `makePart` fix).
- Commit any remaining test/fixture adjustments.

---

## Done criteria

- The full KiCad 10 library is indexed + searchable (pg_trgm ranked); symbol sources are in R2.
- The export resolver is layered/async (JSON → cache → R2 flatten); existing exports still pass.
- The part form has working symbol + footprint pickers with category auto-suggest; a UI-created part sets `kicadSymbol`/`kicadFootprint` and is export-ready.
- Full `tsc` (0 errors) + full vitest green.

## Out of scope (later)

- Admin UI to edit category KiCad defaults (seed-only).
- Footprint file bundling (footprints stay referenced).
- Auto re-sync on KiCad version bump (re-run ingest + R2 upload).
