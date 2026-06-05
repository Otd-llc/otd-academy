# Parts List at Scale — Phase A Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or
> subagent-driven-development) to implement this plan task-by-task.

**Goal:** Make the parts list usable at a large catalog size *today* — a `?q=` search
box, lifecycle/mains filters, sort, server-side pagination, and a mobile layout (cards
below `md`, table at `md`+) — with no new infrastructure.

**Parent design:** [parts-subsystem-at-scale](2026-06-04-parts-subsystem-at-scale-design.md)
(Phase A section). This plan implements Phase A only.

**Architecture:** The page stays a Server Component. A pure, injected-client query
function `listParts(db, params)` (mirrors the `parts-knowledge/query.ts` test style) does
filtering + sort + pagination and is unit-tested directly against Neon. A pure
`partsHref()` helper builds every filter/sort/search/page link (and resets page on filter
change) and is unit-tested. The only client island is a debounced search input. Rendering
splits into a desktop `<table>` (`hidden md:block`, `overflow-x-auto` — mirrors
`BoardsTable`) and a mobile `PartCard` list (`md:hidden`).

**Tech stack:** Next.js 16 (App Router, RSC + one client island), Prisma 7 + Neon,
Tailwind v4, Zod 4, Vitest 4 (node env, no jsdom). No new deps.

---

## Scope

**In:** search (`q`), lifecycle filter, mains filter (keep existing), sort, pagination,
mobile cards/table split, a `manufacturer` index.

**Out (later phases):** category *filtering* (Phase B replaces the enum with a tree —
building enum-chip filters now would be throwaway, so Phase A keeps the category *column*
read-only and adds no category filter control), the KiCad symbol/footprint pickers
(Phase C), `pg_trgm`/full-text (documented scale-up).

**Refinement vs. the design doc:** the design listed a category chip row in Phase A; we
defer the category *filter control* to Phase B per DRY (the tree supersedes it). Per-row
category display stays.

---

## Conventions for the executor

- **Run one test file:** `pnpm exec vitest run src/lib/__tests__/<file>.test.ts`
- **Run one test by name:** add `-t "<substring>"`.
- **Run the whole suite:** `pnpm exec vitest run`
- **Type-check:** `pnpm exec tsc --noEmit`
- **Migrate:** `pnpm exec prisma migrate dev --name <name>`
- Tests are **node-env, `globals: false`** → import `{ describe, test, expect, beforeAll,
  afterAll } from "vitest"`. DB tests share one Neon DB; `fileParallelism` is off. Use a
  `Date.now()`-suffixed unique manufacturer to isolate rows, and sweep + assert zero
  leftovers in `afterAll` (copy the shape from `src/lib/__tests__/parts-query.test.ts`).
- **Commits:** stage explicit paths (`git add <path> <path>`), never `git add -A`.

---

## Task 1: `partsListParamsSchema` — normalize URL params (pure, TDD)

**Files:**
- Modify: `src/lib/schemas/part.ts`
- Test: `src/lib/__tests__/parts-list-params.test.ts`

**Step 1 — Write the failing test:**

```ts
// src/lib/__tests__/parts-list-params.test.ts
import { describe, test, expect } from "vitest";
import { partsListParamsSchema } from "@/lib/schemas/part";

describe("partsListParamsSchema", () => {
  test("defaults: empty input → sort=manufacturer, page=1, mains=false", () => {
    const p = partsListParamsSchema.parse({});
    expect(p).toEqual({ q: undefined, lifecycle: undefined, mains: false, sort: "manufacturer", page: 1 });
  });

  test("parses q, lifecycle, sort, page and mains='1'", () => {
    const p = partsListParamsSchema.parse({ q: "  10k  ", lifecycle: "EOL", sort: "recent", page: "3", mains: "1" });
    expect(p).toEqual({ q: "10k", lifecycle: "EOL", mains: true, sort: "recent", page: 3 });
  });

  test("invalid values fall back instead of throwing", () => {
    const p = partsListParamsSchema.parse({ lifecycle: "NOPE", sort: "sideways", page: "-4", mains: "0" });
    expect(p.lifecycle).toBeUndefined();
    expect(p.sort).toBe("manufacturer");
    expect(p.page).toBe(1);
    expect(p.mains).toBe(false); // only "1" enables mains
  });
});
```

**Step 2 — Run, expect FAIL** (`partsListParamsSchema` not exported):
`pnpm exec vitest run src/lib/__tests__/parts-list-params.test.ts`

**Step 3 — Implement** (append to `src/lib/schemas/part.ts`):

```ts
export const PART_SORTS = ["manufacturer", "mpn", "recent"] as const;
export type PartSort = (typeof PART_SORTS)[number];

// Total parser for the parts-list URL params: every field `.catch`es to a safe
// default so a hand-edited/garbage querystring narrows nothing rather than 500ing.
// `mains` is true ONLY for the literal "1" (mirrors the existing list-page check).
export const partsListParamsSchema = z.object({
  q: z.string().trim().max(128).optional().catch(undefined),
  lifecycle: z.enum(PartLifecycle).optional().catch(undefined),
  mains: z.preprocess((v) => v === "1", z.boolean()).catch(false),
  sort: z.enum(PART_SORTS).catch("manufacturer"),
  page: z.coerce.number().int().min(1).catch(1),
});
export type PartsListParams = z.infer<typeof partsListParamsSchema>;
```

**Step 4 — Run, expect PASS.**

**Step 5 — Commit:**
```bash
git add src/lib/schemas/part.ts src/lib/__tests__/parts-list-params.test.ts
git commit -m "feat(parts): partsListParamsSchema for list search/filter/sort/page"
```

---

## Task 2: `partsHref` — build filter/sort/search/page links (pure, TDD)

A single helper for every link on the page. Changing any filter/search/sort resets to
page 1; pagination links keep the page. Empty/undefined values are dropped.

**Files:**
- Create: `src/lib/parts-list-url.ts`
- Test: `src/lib/__tests__/parts-list-url.test.ts`

**Step 1 — Write the failing test:**

```ts
// src/lib/__tests__/parts-list-url.test.ts
import { describe, test, expect } from "vitest";
import { partsHref } from "@/lib/parts-list-url";

describe("partsHref", () => {
  test("no params → /parts", () => {
    expect(partsHref({}, {})).toBe("/parts");
  });

  test("setting a filter drops the page param (reset to page 1)", () => {
    expect(partsHref({ q: "x", page: "5" }, { lifecycle: "EOL" })).toBe("/parts?q=x&lifecycle=EOL");
  });

  test("a page patch preserves existing filters", () => {
    const href = partsHref({ q: "10k", lifecycle: "ACTIVE" }, { page: "2" });
    expect(href).toBe("/parts?q=10k&lifecycle=ACTIVE&page=2");
  });

  test("empty-string or undefined patch value removes that key", () => {
    expect(partsHref({ q: "x", lifecycle: "EOL" }, { q: "" })).toBe("/parts?lifecycle=EOL");
    expect(partsHref({ mains: "1" }, { mains: undefined })).toBe("/parts");
  });
});
```

**Step 2 — Run, expect FAIL.**

**Step 3 — Implement:**

```ts
// src/lib/parts-list-url.ts
// Build a /parts URL by merging `patch` onto the current params. Any filter/search/
// sort change (a patch that doesn't itself set `page`) resets pagination to page 1 by
// dropping the page param. Empty/undefined values are omitted entirely.
type Params = Record<string, string | undefined>;

export function partsHref(current: Params, patch: Params): string {
  const next: Params = { ...current, ...patch };
  if (!("page" in patch)) delete next.page; // filter/search/sort change → page 1
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(next)) {
    if (v != null && v !== "") sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `/parts?${qs}` : "/parts";
}
```

**Step 4 — Run, expect PASS.**

**Step 5 — Commit:**
```bash
git add src/lib/parts-list-url.ts src/lib/__tests__/parts-list-url.test.ts
git commit -m "feat(parts): partsHref link builder (page resets on filter change)"
```

---

## Task 3: `listParts` — filter + sort + paginate query (DB, TDD)

The core. Injected client (testable), returns the page slice + totals. Leaves
`listPartsBySearch` (BOM dropdowns) untouched — different select + no pagination.

**Files:**
- Create: `src/lib/parts-list.ts`
- Test: `src/lib/__tests__/parts-list.test.ts`

**Step 1 — Write the failing test** (isolate via a unique manufacturer; pass `pageSize`
to exercise pagination without 50+ rows):

```ts
// src/lib/__tests__/parts-list.test.ts
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { db } from "@/lib/db";
import { listParts } from "@/lib/parts-list";

const SEED_EMAIL = "seed@example.com";
const MFR = `PartsList-TestCo-${Date.now()}`;
let userId: string;

beforeAll(async () => {
  userId = (await db.user.findUniqueOrThrow({ where: { email: SEED_EMAIL }, select: { id: true } })).id;
  // 3 rows under one manufacturer, distinct mpn/description/lifecycle/certified.
  await db.part.createMany({
    data: [
      { manufacturer: MFR, mpn: "AA-100", description: "ten kilohm widget", lifecycle: "ACTIVE", isCertifiedModule: true,  createdById: userId },
      { manufacturer: MFR, mpn: "BB-200", description: "voltage regulator",  lifecycle: "EOL",    isCertifiedModule: false, createdById: userId },
      { manufacturer: MFR, mpn: "CC-300", description: "ten kilohm sensor",  lifecycle: "ACTIVE", isCertifiedModule: false, createdById: userId },
    ],
  });
});

afterAll(async () => {
  await db.part.deleteMany({ where: { manufacturer: MFR } }).catch(() => {});
  expect(await db.part.count({ where: { manufacturer: MFR } })).toBe(0);
});

// Helper: scope every query to this test's rows via q=MFR (contains match).
const base = { q: MFR, lifecycle: undefined, mains: false, sort: "manufacturer" as const, page: 1 };

describe("listParts", () => {
  test("q matches across mpn/manufacturer/description; returns full select + totals", async () => {
    const r = await listParts(db, base);
    expect(r.total).toBe(3);
    expect(r.totalPages).toBe(1);
    expect(r.parts.map((p) => p.mpn).sort()).toEqual(["AA-100", "BB-200", "CC-300"]);
    expect(r.parts[0]).toHaveProperty("category");
    expect(r.parts[0]).toHaveProperty("isCertifiedModule");
  });

  test("q narrows by description token", async () => {
    const r = await listParts(db, { ...base, q: "ten kilohm" });
    // scoped enough for the test set; assert our two matches are present
    const mine = r.parts.filter((p) => p.manufacturer === MFR).map((p) => p.mpn).sort();
    expect(mine).toEqual(["AA-100", "CC-300"]);
  });

  test("lifecycle filter", async () => {
    const r = await listParts(db, { ...base, lifecycle: "EOL" });
    expect(r.parts.map((p) => p.mpn)).toEqual(["BB-200"]);
  });

  test("mains filter → certified only", async () => {
    const r = await listParts(db, { ...base, mains: true });
    expect(r.parts.map((p) => p.mpn)).toEqual(["AA-100"]);
  });

  test("sort=mpn orders ascending by mpn", async () => {
    const r = await listParts(db, { ...base, sort: "mpn" });
    expect(r.parts.map((p) => p.mpn)).toEqual(["AA-100", "BB-200", "CC-300"]);
  });

  test("pagination: pageSize=2 → 2 pages, page 2 has the remainder", async () => {
    const p1 = await listParts(db, { ...base, sort: "mpn", page: 1 }, 2);
    expect(p1.total).toBe(3);
    expect(p1.totalPages).toBe(2);
    expect(p1.parts.map((p) => p.mpn)).toEqual(["AA-100", "BB-200"]);
    const p2 = await listParts(db, { ...base, sort: "mpn", page: 2 }, 2);
    expect(p2.parts.map((p) => p.mpn)).toEqual(["CC-300"]);
  });

  test("page past the end clamps to the last page", async () => {
    const r = await listParts(db, { ...base, sort: "mpn", page: 99 }, 2);
    expect(r.page).toBe(2);
    expect(r.parts.map((p) => p.mpn)).toEqual(["CC-300"]);
  });
});
```

**Step 2 — Run, expect FAIL.**

**Step 3 — Implement:**

```ts
// src/lib/parts-list.ts
// Parts-library list query: filter (q / lifecycle / mains) + sort + pagination,
// returning the page slice plus totals for the pager. Injected client for testability
// (mirrors parts-knowledge/query.ts). NOTE: `q` uses Prisma `contains` (ILIKE '%q%') —
// a sequential scan; fine to thousands. The pre-planned scale-up is a pg_trgm GIN index
// (see the Phase-A design), a migration-only change behind this same signature.
import type { Prisma } from "@prisma/client";
import type { db as Db } from "@/lib/db";
import type { PartsListParams } from "@/lib/schemas/part";

export const PARTS_PAGE_SIZE = 50;

const LIST_SELECT = {
  id: true,
  mpn: true,
  manufacturer: true,
  description: true,
  category: true,
  lifecycle: true,
  isCertifiedModule: true,
} satisfies Prisma.PartSelect;

export type PartsListRow = Prisma.PartGetPayload<{ select: typeof LIST_SELECT }>;

export type PartsListResult = {
  parts: PartsListRow[];
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
};

export async function listParts(
  client: typeof Db,
  params: PartsListParams,
  pageSize: number = PARTS_PAGE_SIZE,
): Promise<PartsListResult> {
  const where: Prisma.PartWhereInput = {
    ...(params.q
      ? {
          OR: [
            { mpn: { contains: params.q, mode: "insensitive" } },
            { manufacturer: { contains: params.q, mode: "insensitive" } },
            { description: { contains: params.q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(params.lifecycle ? { lifecycle: params.lifecycle } : {}),
    ...(params.mains ? { isCertifiedModule: true } : {}),
  };

  const orderBy: Prisma.PartOrderByWithRelationInput[] =
    params.sort === "mpn"
      ? [{ mpn: "asc" }]
      : params.sort === "recent"
        ? [{ updatedAt: "desc" }]
        : [{ manufacturer: "asc" }, { mpn: "asc" }];

  const total = await client.part.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(params.page, 1), totalPages);

  const parts = await client.part.findMany({
    where,
    orderBy,
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: LIST_SELECT,
  });

  return { parts, total, page, totalPages, pageSize };
}
```

**Step 4 — Run, expect PASS.**

**Step 5 — Commit:**
```bash
git add src/lib/parts-list.ts src/lib/__tests__/parts-list.test.ts
git commit -m "feat(parts): listParts query (filter + sort + pagination + totals)"
```

---

## Task 4: Wire the page to `listParts` + lifecycle/mains chips + sort

Swap the page's inline `findMany` for `listParts`; keep the existing table markup (it now
reads `result.parts`). Add a lifecycle chip row + a sort control; keep the MAINS chip.
Pagination + responsive split land in Tasks 6–7.

**Files:**
- Modify: `src/app/parts/page.tsx`

**Step 1 — Widen `searchParams`, parse, query.** Replace the `searchParams` type +
the `db.part.findMany` block:

```tsx
export default async function PartsListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = partsListParamsSchema.parse(raw);
  const { parts, total, page, totalPages } = await listParts(db, params);
  // `current` for partsHref: only the string-valued params we honor.
  const current = {
    q: params.q,
    lifecycle: params.lifecycle,
    mains: params.mains ? "1" : undefined,
    sort: params.sort === "manufacturer" ? undefined : params.sort,
    page: page > 1 ? String(page) : undefined,
  };
```

Add imports:
```tsx
import { partsListParamsSchema, PART_SORTS } from "@/lib/schemas/part";
import { listParts } from "@/lib/parts-list";
import { partsHref } from "@/lib/parts-list-url";
import { PartLifecycle } from "@prisma/client";
```

**Step 2 — Replace the single MAINS chip row** with mains + lifecycle chips, each built
via `partsHref` (toggling off when active):

```tsx
<div className="mt-6 flex flex-wrap items-center gap-2">
  <FilterChip label="ALL PARTS" active={!params.mains && !params.lifecycle}
              href={partsHref(current, { mains: undefined, lifecycle: undefined })} />
  <FilterChip label="MAINS PARTS" active={params.mains}
              href={partsHref(current, { mains: params.mains ? undefined : "1" })} />
  <span className="mx-1 hidden text-muted sm:inline">·</span>
  {Object.values(PartLifecycle).map((lc) => (
    <FilterChip key={lc} label={lc} active={params.lifecycle === lc}
                href={partsHref(current, { lifecycle: params.lifecycle === lc ? undefined : lc })} />
  ))}
</div>
```

**Step 3 — Add a sort control** (chips, mirrors the filter pattern) above the table:

```tsx
<div className="mt-4 flex flex-wrap items-center gap-2 font-mono text-xs uppercase text-muted">
  <span>Sort</span>
  {PART_SORTS.map((s) => (
    <FilterChip key={s} label={s} active={params.sort === s}
                href={partsHref(current, { sort: s === "manufacturer" ? undefined : s })} />
  ))}
  <span className="ml-auto normal-case">{total} part{total === 1 ? "" : "s"}</span>
</div>
```

**Step 4 — Point the table at `parts`** (rename the `.map` source from `parts` — already
named `parts`, so the existing `parts.map((p) => …)` block is unchanged) and update the
empty-state copy to reflect filters:

```tsx
{total === 0 ? (
  <p className="mt-10 font-mono text-sm uppercase tracking-wider text-muted">
    {params.q || params.lifecycle || params.mains ? "NO PARTS MATCH THESE FILTERS." : "NO PARTS — CREATE ONE TO BEGIN."}
  </p>
) : ( /* …existing table… */ )}
```

**Step 5 — Verify:**
- `pnpm exec tsc --noEmit` → clean.
- `pnpm exec vitest run src/lib/__tests__/parts-list.test.ts src/lib/__tests__/parts-list-url.test.ts src/lib/__tests__/parts-list-params.test.ts` → green.
- `pnpm dev`, open `/parts`: toggling lifecycle/mains/sort chips changes the URL and the
  list; reload preserves state.

**Step 6 — Commit:**
```bash
git add src/app/parts/page.tsx
git commit -m "feat(parts): query-driven list page (lifecycle + mains + sort chips)"
```

---

## Task 5: `PartsSearch` client island (debounced)

**Files:**
- Create: `src/components/parts/PartsSearch.tsx`
- Modify: `src/app/parts/page.tsx` (render it above the chips, pass current `q`)

**Step 1 — Implement the island:**

```tsx
// src/components/parts/PartsSearch.tsx
"use client";
// Debounced search box for the parts list. Pushes `?q=` (resetting pagination) via
// router.replace so the Server Component re-queries; other params are preserved by
// partsHref. Empty input clears the q param.
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { partsHref } from "@/lib/parts-list-url";

export function PartsSearch({
  initialQ,
  current,
}: {
  initialQ: string;
  current: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialQ);
  const [, startTransition] = useTransition();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; } // don't fire on mount
    const id = setTimeout(() => {
      startTransition(() => router.replace(partsHref(current, { q: value.trim() || undefined })));
    }, 250);
    return () => clearTimeout(id);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <input
      type="search"
      defaultValue={initialQ}
      onChange={(e) => setValue(e.target.value)}
      placeholder="Search MPN, manufacturer, description…"
      aria-label="Search parts"
      className="mt-6 w-full rounded border border-panel-border bg-deep-space px-3 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
    />
  );
}
```

**Step 2 — Render it** in `page.tsx` right after the header `</div>`:

```tsx
<PartsSearch initialQ={params.q ?? ""} current={current} />
```
Add `import { PartsSearch } from "@/components/parts/PartsSearch";`.

**Step 3 — Verify:** `pnpm exec tsc --noEmit`; in `pnpm dev`, typing filters after ~250ms,
the URL gains `?q=`, Back/refresh restore the query, clearing the box removes `q`.

**Step 4 — Commit:**
```bash
git add src/components/parts/PartsSearch.tsx src/app/parts/page.tsx
git commit -m "feat(parts): debounced search island on the list page"
```

---

## Task 6: `PartsPagination` (server)

**Files:**
- Create: `src/components/parts/PartsPagination.tsx`
- Test: `src/components/__tests__/PartsPagination.test.tsx` (element-tree walk, per the
  StageTracker convention)
- Modify: `src/app/parts/page.tsx` (render below the list when `totalPages > 1`)

**Step 1 — Write the failing test** (assert Prev disabled on page 1, hrefs preserve `q`):

```tsx
// src/components/__tests__/PartsPagination.test.tsx
import { describe, test, expect } from "vitest";
import { isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";
import { PartsPagination } from "@/components/parts/PartsPagination";

function hrefs(tree: ReactElement): string[] {
  const out: string[] = [];
  const walk = (n: ReactNode) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!isValidElement(n)) return;
    const el = n as ReactElement<{ href?: string; children?: ReactNode }>;
    if (typeof el.props.href === "string") out.push(el.props.href);
    if (el.props.children !== undefined) walk(el.props.children);
  };
  walk(tree);
  return out;
}

describe("PartsPagination", () => {
  test("page 1: no prev link, next link keeps q and sets page=2", () => {
    const tree = PartsPagination({ page: 1, totalPages: 3, current: { q: "10k" } }) as ReactElement;
    const hs = hrefs(tree);
    expect(hs.some((h) => h.includes("page=2") && h.includes("q=10k"))).toBe(true);
    expect(hs.some((h) => h.includes("page=0"))).toBe(false);
  });

  test("middle page: prev and next both present", () => {
    const tree = PartsPagination({ page: 2, totalPages: 3, current: {} }) as ReactElement;
    const hs = hrefs(tree);
    expect(hs.some((h) => h.includes("page=1"))).toBe(true); // page=1 link drops to /parts? — see impl note
    expect(hs.some((h) => h.includes("page=3"))).toBe(true);
  });
});
```

> Impl note: `partsHref` drops `page=1` (it's the default → `/parts`). The prev-link
> assertion on page 2 therefore checks for the page-1 *destination*; adjust the assertion
> to `hs.some((h) => h === "/parts" || h.includes("page=1"))` to match `partsHref`'s
> page-1 collapse. (Write the test to match the helper you built in Task 2.)

**Step 2 — Run, expect FAIL.**

**Step 3 — Implement:**

```tsx
// src/components/parts/PartsPagination.tsx
// Server-rendered pager. Prev/Next are partsHref links; the current page sets the page
// param (page 1 collapses to /parts via partsHref). Disabled ends render as plain spans.
import Link from "next/link";
import { partsHref } from "@/lib/parts-list-url";

export function PartsPagination({
  page,
  totalPages,
  current,
}: {
  page: number;
  totalPages: number;
  current: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;
  const cls = "rounded border border-panel-border bg-navy-dark px-3 py-1 font-mono text-xs uppercase tracking-wider";
  const prev = page > 1 ? partsHref(current, { page: String(page - 1) }) : null;
  const next = page < totalPages ? partsHref(current, { page: String(page + 1) }) : null;
  return (
    <nav className="mt-8 flex items-center justify-between gap-4" aria-label="Parts pages">
      {prev ? <Link href={prev} className={`${cls} text-command-gold`}>← Prev</Link>
            : <span className={`${cls} text-muted opacity-50`}>← Prev</span>}
      <span className="font-mono text-xs uppercase tracking-wider text-muted">Page {page} of {totalPages}</span>
      {next ? <Link href={next} className={`${cls} text-command-gold`}>Next →</Link>
            : <span className={`${cls} text-muted opacity-50`}>Next →</span>}
    </nav>
  );
}
```

**Step 4 — Render in `page.tsx`** after the table/list block:
```tsx
<PartsPagination page={page} totalPages={totalPages} current={current} />
```
Add the import.

**Step 5 — Run the test (PASS), `tsc`, and a dev-server check** with `pageSize` temporarily
small or a seeded large set.

**Step 6 — Commit:**
```bash
git add src/components/parts/PartsPagination.tsx src/components/__tests__/PartsPagination.test.tsx src/app/parts/page.tsx
git commit -m "feat(parts): server-rendered pagination"
```

---

## Task 7: Responsive split — desktop table + mobile `PartCard`

**Files:**
- Create: `src/components/parts/PartCard.tsx`
- Test: `src/components/__tests__/PartCard.test.tsx`
- Modify: `src/app/parts/page.tsx`

**Step 1 — Write the failing PartCard test** (element-tree walk for MPN/manufacturer +
the detail link):

```tsx
// src/components/__tests__/PartCard.test.tsx
import { describe, test, expect } from "vitest";
import { isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";
import { PartCard } from "@/components/parts/PartCard";

function textOf(n: ReactNode): string {
  if (n == null || n === false) return "";
  if (typeof n === "string" || typeof n === "number") return String(n);
  if (Array.isArray(n)) return n.map(textOf).join("");
  if (isValidElement(n)) return textOf((n.props as { children?: ReactNode }).children);
  return "";
}
function hrefs(n: ReactNode, out: string[] = []): string[] {
  if (Array.isArray(n)) { n.forEach((x) => hrefs(x, out)); return out; }
  if (!isValidElement(n)) return out;
  const el = n as ReactElement<{ href?: string; children?: ReactNode }>;
  if (typeof el.props.href === "string") out.push(el.props.href);
  if (el.props.children !== undefined) hrefs(el.props.children, out);
  return out;
}

const part = { id: "p1", mpn: "RT9080-33GJ5", manufacturer: "Richtek", description: "LDO", category: "LDO_REGULATOR" as const, lifecycle: "ACTIVE" as const, isCertifiedModule: false };

describe("PartCard", () => {
  test("shows mpn + manufacturer and links to the detail page", () => {
    const tree = PartCard({ part }) as ReactElement;
    const text = textOf(tree);
    expect(text).toContain("RT9080-33GJ5");
    expect(text).toContain("Richtek");
    expect(hrefs(tree)).toContain("/parts/p1");
  });
});
```

**Step 2 — Run, expect FAIL.**

**Step 3 — Implement `PartCard`** (a `<li>` card; reuse the certified badge + glance
trigger from the table):

```tsx
// src/components/parts/PartCard.tsx
// Mobile (< md) card for one part row. Desktop uses the table in page.tsx.
import Link from "next/link";
import type { PartsListRow } from "@/lib/parts-list";
import { PartGlanceTrigger } from "@/components/parts/PartGlanceTrigger";

export function PartCard({ part: p }: { part: PartsListRow }) {
  return (
    <li className="glass-card flex flex-col gap-2 p-4 font-mono text-sm">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/parts/${p.id}`} className="text-command-gold underline-offset-2 hover:underline">
          {p.mpn}
        </Link>
        <PartGlanceTrigger partId={p.id} mpn={p.mpn} />
      </div>
      <p className="text-link-muted">{p.manufacturer}</p>
      <p className="text-link-muted">{p.description}</p>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>{p.category ?? "—"}</span>
        <span>·</span>
        <span>{p.lifecycle}</span>
        {p.isCertifiedModule && (
          <span className="rounded border border-panel-border bg-navy-dark px-2 py-0.5 uppercase tracking-wider text-alert-red">
            CERTIFIED MODULE
          </span>
        )}
      </div>
    </li>
  );
}
```

**Step 4 — In `page.tsx`, wrap the table for desktop and add the mobile card list.**
Replace the `total === 0 ? … : (<table>…)` body with:

```tsx
) : (
  <>
    {/* Desktop: table at md+ (overflow guard mirrors BoardsTable). */}
    <div className="mt-10 hidden overflow-x-auto md:block">
      <table className="w-full border-collapse font-mono text-sm">
        {/* …unchanged thead + tbody… */}
      </table>
    </div>
    {/* Mobile: stacked cards below md. */}
    <ul className="mt-8 flex flex-col gap-3 md:hidden">
      {parts.map((p) => <PartCard key={p.id} part={p} />)}
    </ul>
  </>
)}
```
Add `import { PartCard } from "@/components/parts/PartCard";`.

**Step 5 — Verify:** `tsc`; run the PartCard test (PASS); `pnpm dev` and check at a phone
width (cards) and desktop width (table, horizontal scroll only if narrow).

**Step 6 — Commit:**
```bash
git add src/components/parts/PartCard.tsx src/components/__tests__/PartCard.test.tsx src/app/parts/page.tsx
git commit -m "feat(parts): responsive list — cards on mobile, table on desktop"
```

---

## Task 8: `manufacturer` index + full-suite gate

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_parts_list_manufacturer_index/migration.sql` (generated)

**Step 1 — Add the index** to `model Part` (next to the existing `@@index`es):
```prisma
@@index([manufacturer])
```

**Step 2 — Generate + apply the migration:**
```bash
pnpm exec prisma migrate dev --name parts_list_manufacturer_index
```
Expect: a new migration adding `CREATE INDEX "Part_manufacturer_idx" ON "Part"("manufacturer");`, client regenerated.

**Step 3 — Schema-change discipline gate** (per the project's hard-won rule — enum/column
changes break enum-mirrors/fixtures in ways a task's own checks miss):
```bash
pnpm exec tsc --noEmit          # whole project
pnpm exec vitest run            # FULL suite, not just parts tests
```
Both must be clean/green. If the shared `esp32-sensor-breakout` seed fixture is implicated,
`pnpm db:seed` to restore before re-running.

**Step 4 — Commit:**
```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "perf(parts): index Part.manufacturer for list sort/filter"
```

---

## Done criteria

- `/parts` supports `?q=`, `?lifecycle=`, `?mains=1`, `?sort=`, `?page=`, all composable
  and URL-driven; bad params degrade gracefully (no 500).
- Mobile renders cards; desktop renders the table.
- New unit tests green: `parts-list-params`, `parts-list-url`, `parts-list`,
  `PartsPagination`, `PartCard`. Full `tsc` + full vitest suite green.
- `listPartsBySearch` (BOM dropdowns) untouched.

## Execution handoff

After the plan is approved, execute via **subagent-driven-development** (fresh subagent per
task + code review between tasks) in a worktree off `main`. Commit the two design/plan docs
first so they travel with the branch. Tasks 1–3 are pure/DB TDD (highest confidence);
4–7 are UI wiring verified by `tsc` + the unit tests + a dev-server pass; 8 is the
schema-change gate.
