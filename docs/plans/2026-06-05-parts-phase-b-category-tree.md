# Parts Phase B — Category Tree Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (or executing-plans) to implement this plan task-by-task.

**Goal:** Replace the flat 6-value `PartCategory` enum with a hierarchical `Category`
tree, so the catalog can organize a large component count — with tree navigation +
subtree filtering on the list and a category picker on the create form. Non-destructive:
the enum column stays through a transition; the read path bridges old→new.

**Parent design:** [parts-subsystem-at-scale](2026-06-04-parts-subsystem-at-scale-design.md) (Phase B).

**Architecture:** A `Category` table (parent/child + materialized `path`) with `Part.categoryId`
FK. Two bridges keep churn low: (1) the 6 migrated leaves use **slug = the old enum token**
so the string-keyed `CATEGORY_REQUIRED` map and all test/seed literals survive; (2) the
enum column is **retained**, and everywhere category is read it becomes
`categoryRef?.slug ?? category` — old data (enum only) still resolves, `categoryId` wins
once set. Dropping the enum is a separate future phase.

**Tech stack:** Next.js 16 (RSC + client islands), Prisma 7 + Neon, Zod 4, Tailwind v4,
Vitest 4 (node env). No new deps.

---

## Decisions (defaulted — flag in review if you disagree)

| Decision | Choice | Rationale |
| --- | --- | --- |
| Leaf slug values | **= old enum tokens** (`MLCC_CAPACITOR`, …) | `CATEGORY_REQUIRED` + tests/seeds keep working verbatim. |
| Transition strategy | **Keep enum column**; read path = `categoryRef?.slug ?? category` | Zero churn to seeds/tests that set the enum; reversible. |
| Required-parametrics rules | **Stay code-side**, re-keyed to plain string slugs | Developer-curated; no need to move into the DB yet. |
| Form category control | **Searchable combobox showing the path** (`Passives › Capacitors › MLCC`) | Reuses the search muscle; no bespoke tree widget; scales. |
| List category filter | **`?cat=<path>` subtree filter** + a collapsible tree/breadcrumb | This is the Phase-A-deferred category filter, now backed by the tree. |
| Admin category CRUD | **Deferred** (seed the tree; add/rename/move UI later) | YAGNI for a seeded small tree; not needed for Phase B value. |
| Enum drop | **Deferred to a later phase** | Audit every reader first (schema-change discipline). |

---

## Blast radius (from the audit) — what changes

**Must change:** `prisma/schema.prisma` (add `Category`, `Part.categoryId`); `part-fact.ts`
(`CATEGORY_REQUIRED` → string keys, `parametricsFor`/`factDataSchema` take `string|null`);
`FactGroupCard.tsx` + `parts/[id]/page.tsx` (pass `categoryRef?.slug ?? category`);
`parts.ts` (`createPart` sets `categoryId`); `CreatePartDialog.tsx` (picker); `part.ts`
schema (`categoryId`); `parts-list.ts` + `parts/page.tsx` + `part.ts` (the `cat` filter).

**Stays as-is (the bridge protects them):** every seed/test that sets `category:
"MLCC_CAPACITOR"` (enum column retained); the parts-knowledge query (already returns a
string — we just change the source); the MCP server (no enum usage).

---

## Conventions for the executor

- One test file: `pnpm exec vitest run <path>`; by name add `-t "<substring>"`; whole suite: `pnpm exec vitest run`.
- Type-check: `pnpm exec tsc --noEmit` (ignore the 4 pre-existing errors in the untracked `scripts/vendor-kicad-symbols.ts`).
- **Migrations: NEVER `prisma migrate dev` against the shared Neon DB** (it can offer a destructive reset). Hand-author the migration SQL under `prisma/migrations/<ts>_<name>/migration.sql`, then `pnpm exec prisma migrate deploy` (reset-proof, forward-only), then `pnpm exec prisma generate`. Confirm with `pnpm exec prisma migrate status` first.
- Use the **PowerShell** tool for `pnpm`/`git` (Bash lacks `pnpm` on PATH).
- Commits: stage explicit paths, never `git add -A`. Co-author trailer per repo convention.
- Node-env Vitest, `globals: false` — import test fns from `"vitest"`. DB tests use a `Date.now()`-suffixed unique key + sweep in `afterAll` (copy `parts-query.test.ts`).

---

## Task 1: `Category` model + `Part.categoryId` (schema + migration)

**Files:** `prisma/schema.prisma`; `prisma/migrations/<ts>_category_tree/migration.sql`.

**Step 1 — Add to schema** (place `Category` near `Part`):

```prisma
model Category {
  id        String     @id @default(cuid())
  slug      String     @unique          // migrated leaves: the old enum token; new nodes: kebab
  name      String                       // human label, e.g. "MLCC Capacitors"
  parentId  String?
  parent    Category?  @relation("CategoryTree", fields: [parentId], references: [id], onDelete: Restrict)
  children  Category[] @relation("CategoryTree")
  path      String     @unique           // materialized slugs: "passives/capacitors/MLCC_CAPACITOR"
  depth     Int        @default(0)
  order     Int        @default(0)
  defaultKicadSymbol       String?        // Phase C
  defaultKicadFootprintLib String?        // Phase C
  parts     Part[]
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
  @@index([parentId])
  @@index([path])
}
```

Add to `model Part` (keep `category PartCategory?` as-is):

```prisma
  categoryId  String?
  categoryRef Category? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  // ...with the other @@index lines:
  @@index([categoryId])
```

**Step 2 — Hand-author the migration SQL** (`CreateTable Category` + the two `Part`
columns/index + FKs). Mirror Prisma's output format; index names `Category_*_idx`,
`Part_categoryId_idx`; FK `Part_categoryId_fkey` (`ON DELETE SET NULL`), `Category_parentId_fkey`
(`ON DELETE RESTRICT`). Verify against an existing migration's DDL style.

**Step 3 — Apply safely:** `prisma migrate status` (expect 1 pending) → `prisma migrate deploy` → `prisma generate`.

**Step 4 — Commit** `prisma/schema.prisma` + the migration dir.
`feat(parts): Category tree model + Part.categoryId`

---

## Task 2: category path/tree pure helpers (TDD)

**Files:** Create `src/lib/categories.ts`; Test `src/lib/__tests__/categories.test.ts`.

Pure functions the seed + filters reuse:
- `categoryPath(parentPath: string | null, slug: string): string` → `parent ? `${parent}/${slug}` : slug`.
- `subtreeWhere(node: { id: string; path: string }): Prisma.PartWhereInput` → `{ OR: [{ categoryId: node.id }, { categoryRef: { path: { startsWith: node.path + "/" } } }] }`.
- `CATEGORY_TREE`: the seed definition (roots → children → leaves), each `{ slug, name, children? }`, with the 6 leaves carrying the enum-token slug. This is the single source for the seed (Task 3) and tests.

**TDD:** test `categoryPath` (root vs nested), and that `CATEGORY_TREE` contains exactly the
6 enum-token leaf slugs (`RF_MODULE, LDO_REGULATOR, USB_UART_IC, MLCC_CAPACITOR, USB_CONNECTOR, PASSIVE_RESISTOR`) and that every leaf slug is unique. (`subtreeWhere` shape is asserted structurally.)

Tree (from the design):
```
Passives → Resistors → SMD Resistors (PASSIVE_RESISTOR)
Passives → Capacitors → MLCC (MLCC_CAPACITOR)
ICs → Power → LDO Regulators (LDO_REGULATOR)
ICs → Interface → USB-UART (USB_UART_IC)
Modules → RF Modules (RF_MODULE)
Connectors → USB Connectors (USB_CONNECTOR)
```
(Non-leaf nodes get kebab slugs: `passives`, `resistors`, `capacitors`, `ics`, `power`, `interface`, `modules`, `connectors`.)

**Commit:** `feat(parts): category tree definition + path/subtree helpers`

---

## Task 3: seed the tree + backfill `Part.categoryId` (script)

**Files:** Create `scripts/seed-category-tree.ts` (idempotent; direct-Prisma seed style).

- Walk `CATEGORY_TREE` depth-first; upsert each node by `slug` with computed `path`, `depth`,
  `order`, `parentId`. (Upsert so re-runs are safe.)
- Backfill: for every leaf whose slug is an old enum token, set `categoryId` on all parts
  whose `category` enum equals that token: `db.part.updateMany({ where: { category: <token>, categoryId: null }, data: { categoryId: leaf.id } })`.
- Print: nodes upserted, parts backfilled per leaf, and any parts left with `category != null && categoryId == null` (should be none for the 6 tokens).

Run it; confirm the WROOM parts (and any others) get `categoryId`. **Do not commit DB state**;
the script is the record (leave untracked per repo convention, or commit the script only).

---

## Task 4: re-key category logic to slug strings (TDD)

**Files:** `src/lib/schemas/part-fact.ts`; `src/components/parts/FactGroupCard.tsx`;
`src/app/parts/[id]/page.tsx`; Test: extend `src/lib/__tests__/part-fact-schema.test.ts`.

- `part-fact.ts`: change `CATEGORY_REQUIRED` to a plain `Record<string, readonly string[]>`
  with string keys `"MLCC_CAPACITOR"`, `"LDO_REGULATOR"`; drop the `PartCategory` import;
  change `parametricsFor(category: string | null)` and `factDataSchema(group, category: string | null)`.
  (The existing tests already pass string literals → they keep passing; add one asserting an
  unknown slug imposes no required keys.)
- `FactGroupCard.tsx`: prop type `category: string | null`.
- `parts/[id]/page.tsx`: load `categoryRef: { select: { slug: true } }`; pass
  `part.categoryRef?.slug ?? part.category` into the card (the bridge).

**Verify:** `pnpm exec vitest run src/lib/__tests__/part-fact-schema.test.ts` green; `tsc` clean.
**Commit:** `refactor(parts): category-keyed fact logic uses slug strings (enum→tree bridge)`

---

## Task 5: list query — `cat` subtree filter (TDD)

**Files:** `src/lib/schemas/part.ts` (add `cat` to `partsListParamsSchema`);
`src/lib/parts-list.ts` (`listParts` applies `subtreeWhere` + returns `categoryRef {slug,name,path}`);
Test: extend `src/lib/__tests__/parts-list.test.ts`.

- `partsListParamsSchema` gains `cat: z.string().trim().max(256).optional().catch(undefined)` (a category `path`).
- `listParts`: when `cat` is set, resolve the node by `path` and AND-in `subtreeWhere(node)`;
  include `categoryRef: { select: { slug: true, name: true, path: true } }` in the select so
  the list/card can show the human name. Returned row's display category =
  `categoryRef?.name ?? category ?? "—"`.
- **TDD:** seed throwaway categories + parts under a parent and a child; assert `cat=<parent path>`
  returns parts in both the parent and its descendants; `cat=<child path>` returns only the child's.

**Commit:** `feat(parts): list filter by category subtree (path prefix)`

---

## Task 6: list UI — category tree picker + filter (build + verify)

**Files:** Create `src/components/parts/CategoryTreePicker.tsx` (server component: renders the
tree as nested links setting `?cat=<path>`, active node highlighted, per-node part counts via a
`groupBy`/count pass) + a breadcrumb of the active node; render it in `src/app/parts/page.tsx`;
extend the page's `current` + `partsHref` usage to carry `cat`.

- Counts: one `db.category.findMany` (ordered by `path`) + a `db.part.groupBy({ by: ['categoryId'] })`
  rolled up to ancestor paths (compute subtree counts in memory — the tree is small).
- Mobile: the picker collapses into a `<details>`/disclosure above the list.
- Display the resolved category `name` in the existing desktop table cell + `PartCard`.

**Verify:** `tsc` clean; dev-server pass — clicking a node filters to its subtree, breadcrumb +
counts update, clearing returns to all. **Commit:** `feat(parts): category tree navigation on the list`

---

## Task 7: create/edit form — category picker (build + verify)

**Files:** `src/lib/schemas/part.ts` (`createPartSchema.categoryId`); `src/lib/actions/parts.ts`
(`createPart` validates `categoryId` exists, sets it; keep writing the legacy enum too if the
chosen category's slug is an enum token, so old readers stay consistent during transition);
`src/components/CreatePartDialog.tsx` (replace the enum `<select>` with a `CategoryCombobox`
client island over a server-fetched category list, showing each option's `path` as
`Passives › Capacitors › MLCC`); create `src/components/parts/CategoryCombobox.tsx`.

- `createPartSchema`: add `categoryId: z.string().optional().nullable()`; keep `category` optional
  for back-compat but the form posts `categoryId`.
- `createPart`: look up the category by id; set `categoryId`; if its slug is one of the 6 enum
  tokens, also set `category` (legacy) so nothing regresses; else leave `category` null.
- **Verify:** `tsc` clean; the existing `parts-actions.test.ts` updated to pass a real `categoryId`
  (seed a category in the test) and assert the part links to it; dev-server create flow works.

**Commit:** `feat(parts): category picker in the create/edit form`

---

## Task 8: full schema-change gate

- `pnpm exec tsc --noEmit` — only the 4 pre-existing `vendor-kicad-symbols.ts` errors.
- `pnpm exec vitest run` — FULL suite green (the enum column + bridge mean seeds/tests that set
  `category` keep working; if `esp32-sensor-breakout` or any fixture is implicated, `pnpm db:seed`
  to restore and re-run).
- If green, the phase is done. **Commit** any remaining test/fixture adjustments.

---

## Done criteria

- A `Category` tree exists; every previously-categorized part has a `categoryId`.
- The list filters by category subtree (`?cat=`), with tree navigation + counts + breadcrumb,
  and shows human category names; mobile-friendly.
- The create form assigns a category via a path-showing combobox.
- Per-category required-parametrics still enforced (now slug-keyed).
- The `PartCategory` enum column is retained and still valid; **no enum drop** this phase.
- Full `tsc` + full vitest green.

## Out of scope (later)

- Admin category CRUD (add/rename/reorder/move) — seed-only for now.
- Dropping `Part.category` + the `PartCategory` enum (separate audited migration).
- Phase C (KiCad pickers) — depends on `Category.defaultKicadSymbol`, seeded empty here.

## Execution

Subagent-driven, one task per subagent + review between. Tasks 1, 3, 6, 7 are migration/UI
(build + verify); 2, 4, 5 are TDD. Migrations via hand-authored SQL + `migrate deploy` only.
