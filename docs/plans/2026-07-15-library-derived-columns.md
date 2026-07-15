# Library Derived Columns — Neon Egress Fix — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stop `/library` from pulling all 69 lessons' full `contentBlocks` (~630 kB/render) just to derive three scalars, by storing those scalars as columns on `MiniLesson`.

**Architecture:** Add three derived columns (`readingMinutes`, `questionCount`, `diagramSrc`) to `MiniLesson`. Keep them fresh with a Prisma client extension in `src/lib/db.ts` — the single choke point every writer already funnels through (`await import("@/lib/db")`, 164 call sites across `scripts/`, plus the admin actions). The two hot loaders then stop selecting `contentBlocks` entirely. A vitest drift guardrail recomputes from `contentBlocks` and fails if any stored column disagrees.

**Tech Stack:** Prisma 7.8 (`prisma-client-js`, `PrismaNeon` adapter), Next.js App Router, vitest, Neon Postgres 17.

---

## Why this, and why it's shaped this way

Measured 2026-07-15:

- Neon `production` branch: **4.73 GB egress** + **209 compute-hours** this billing period (5 GB free-tier cap; sum across all branches = 5.18 GB).
- Vercel production: **4 requests / 24h**. The load is **not** visitor traffic — it's local `next dev` against PROD (`.env.local` `DATABASE_URL` is PROD, per CLAUDE.md).
- `/library` is `force-dynamic`, so every HMR re-render re-queries. It pulls all 69 lessons' `contentBlocks` **twice** — [`listPublishedByCluster`](../../src/lib/library/load.ts) and [`loadLessonMeta`](../../src/lib/logbook/load.ts) — then discards the content.
- `contentBlocks` for the 69 published PUBLIC lessons = 189 kB stored / **306 kB as JSON on the wire**. ×2 = **611 kB per render**. 4.73 GB ÷ 611 kB ≈ 7,700 renders ≈ 515/day. Corroborated independently: `MiniLesson` is the only full-table-scanned table with a TOAST payload (~3.9 GB scan volume).

**Measured after implementation** (`scripts/_measure-library-egress.ts`, 2026-07-15):

| per `/library` render (signed-in: both loaders) | wire cost |
| --- | --- |
| before — `contentBlocks` ×2 | **662.4 kB** |
| after — scalars ×2 | **35.3 kB** |
| reduction | **18.7×** (627 kB saved/render) |

> **Correction.** The pre-implementation estimate in an earlier draft said 33.9×. That
> was apples-to-oranges: it compared **two** `contentBlocks` reads against **one** read of
> scalars, when both loaders remain (each now cheap). The real figure is **18.7×**, and it
> holds on both paths — `loadLessonMeta` only runs for signed-in users
> (`src/app/library/page.tsx`, inside `if (session?.user?.email)`), so anonymous/SEO
> renders go 331 kB → 18 kB and signed-in go 662 kB → 35 kB. Both ≈ 18×.

At the ~515 renders/day that burned 4.73 GB in 15 days, that is **~331 MB/day**, i.e.
**~9.9 GB/month** — more than the entire 5 GB account allowance. The saving applies to dev
today and to real traffic later.

**Non-goals (explicitly out of scope):**
- ISR / `unstable_cache` on public routes. Worth doing before launch; does **not** address the current overage (there is no traffic). Separate plan.
- Moving dev off Neon. Note a Neon *branch* saves nothing — free-tier compute and egress are **account-wide**. Only local Postgres removes dev from the meter. Separate decision.
- `src/lib/db.ts:15` sets `log: ["query", "error", "warn"]` — logs every query in dev. Noise, not egress. Leave it.

---

## Validation already done (2026-07-15)

The three assumptions this plan rests on were checked empirically before it was written. Re-verify only if the codebase moves under you.

1. **The derive functions survive real data.** Ran all three over every published lesson: **0 anomalies / 69**. All 69 have a hero diagram; all 69 carry ≥1 quiz question. `readingMinutes` and `firstDiagramSrc` are pure + defensive over `unknown` by construction.
2. **`$extends` genuinely intercepts.** Prototyped (`scripts/_validate-extends-proto.ts`, zero DB writes — the extension captured args and threw before `query()`): `create` **PASS**, `update` **PASS**, `upsert.create` **PASS**, and a `title`-only update correctly left the derived keys absent — **PASS**. The `as unknown as PrismaClient` cast is type-safe: a query extension doesn't alter model types, so call sites are unaffected.
3. **`db.ts` really is the universal write choke point.** `new PrismaClient` appears nowhere else that can write — the only other construction is `mcp/parts-server/client.ts`, bound to the `foundry_ro` **read-only** role. `prisma/seed.ts` imports `{ db } from "@/lib/db"`. And there are currently **zero** `miniLesson.updateMany` / raw-SQL writes, so nothing bypasses the extension today. Task 6's drift guard is insurance against a *future* bypass, not a present one.

---

## Preconditions

- Branch off `main` (CLAUDE.md: don't merge without maintainer go-ahead).
- `.env.test.local` present, or **tests hit PROD**. Verify before running vitest.
- Migrations are hand-authored + applied with `pnpm db:migrate` (`prisma migrate deploy`, never `migrate dev`). `pnpm` runs via PowerShell, not the Bash tool.
- After any schema change: **full tsc + full vitest** (enum/column mirror maps break silently).

---

### Task 1: The derive helper

One place that turns `contentBlocks` into the three scalars, so the extension, the backfill, and the drift test can never disagree.

**Files:**
- Create: `src/lib/library/derived.ts`
- Test: `src/lib/__tests__/library-derived.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { deriveLessonMeta } from "@/lib/library/derived";

describe("deriveLessonMeta", () => {
  it("derives all three scalars from contentBlocks", () => {
    const blocks = [
      { type: "prose", body: "word ".repeat(400).trim() },
      { type: "image", src: "/guide-diagrams/foo.svg" },
      { type: "quiz", questions: [{ key: "q1" }, { key: "q2" }] },
    ];
    expect(deriveLessonMeta(blocks)).toEqual({
      readingMinutes: expect.any(Number),
      questionCount: 2,
      diagramSrc: "/guide-diagrams/foo.svg",
    });
  });

  it("is defensive over non-array Json (Prisma Json is unknown at runtime)", () => {
    expect(deriveLessonMeta(null)).toEqual({
      readingMinutes: 1, // readingMinutes floors at 1
      questionCount: 0,
      diagramSrc: null,
    });
  });
});
```

**Step 2: Run it, verify it fails**

```
pnpm vitest run src/lib/__tests__/library-derived.test.ts
```
Expected: FAIL — cannot resolve `@/lib/library/derived`.

**Step 3: Implement**

```ts
// src/lib/library/derived.ts
//
// The single source of truth for MiniLesson's DERIVED columns. Three pure
// functions of contentBlocks, computed in one place so the write-path extension
// (src/lib/db.ts), the backfill, and the drift guardrail can never disagree.
//
// WHY these are columns and not derived at read time: /library renders every
// published lesson, and deriving these live meant SELECTing all 69 rows'
// contentBlocks (~314 kB on the wire) to keep ~14 kB of scalars. See
// docs/plans/2026-07-15-library-derived-columns.md.
import { readingMinutes } from "@/lib/library/reading-time";
import { firstDiagramSrc } from "@/lib/library/hero-diagram";
import { quizQuestions } from "@/lib/logbook/lesson-content";

export type LessonDerived = {
  readingMinutes: number;
  questionCount: number;
  diagramSrc: string | null;
};

export function deriveLessonMeta(contentBlocks: unknown): LessonDerived {
  return {
    readingMinutes: readingMinutes(contentBlocks),
    questionCount: quizQuestions(contentBlocks).length,
    diagramSrc: firstDiagramSrc(contentBlocks),
  };
}
```

**Step 4: Run it, verify it passes**

```
pnpm vitest run src/lib/__tests__/library-derived.test.ts
```
Expected: PASS (2 tests).

**Step 5: Commit**

```bash
git add src/lib/library/derived.ts src/lib/__tests__/library-derived.test.ts
git commit -m "feat(library): single derive helper for MiniLesson scalars"
```

---

### Task 2: Schema + hand-authored migration

**Files:**
- Modify: `prisma/schema.prisma` (the `MiniLesson` model)
- Create: `prisma/migrations/<timestamp>_minilesson_derived_columns/migration.sql`

**Step 1: Add the columns to the model**

```prisma
  cluster        String?
  clusterOrdinal Int                 @default(0)
  // ── Derived from contentBlocks; kept fresh by the db.ts client extension.
  // Never hand-set these. See src/lib/library/derived.ts.
  readingMinutes Int                 @default(1)
  questionCount  Int                 @default(0)
  diagramSrc     String?
  createdAt      DateTime            @default(now())
```

**Step 2: Hand-author the migration**

```sql
-- prisma/migrations/<timestamp>_minilesson_derived_columns/migration.sql
-- Derived-from-contentBlocks columns for MiniLesson. Values are backfilled by
-- scripts/backfill-lesson-derived.ts immediately after this migration lands;
-- the defaults are placeholders and MUST NOT be trusted until that runs.
ALTER TABLE "MiniLesson" ADD COLUMN "readingMinutes" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "MiniLesson" ADD COLUMN "questionCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MiniLesson" ADD COLUMN "diagramSrc" TEXT;
```

Additive + defaulted, so it's safe against the running deploy: existing code ignores the columns.

**Step 3: Apply to PROD and regenerate**

```
pnpm db:migrate
```
Expected: `prisma migrate deploy` applies one migration, then refreshes the test pool so it can't drift. Restart `next dev` afterward (`prisma generate` changed the client).

**Step 4: Verify the columns exist**

Confirm shape, not values — the values are placeholders until Task 4 backfills:

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'MiniLesson'
  AND column_name IN ('readingMinutes','questionCount','diagramSrc');
```
Expected: 3 rows.

**Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(library): add MiniLesson derived columns"
```

---

### Task 3: Keep them fresh — the Prisma client extension

The staleness guard. Every writer — 9+ seed scripts and the admin actions — reaches the DB through `await import("@/lib/db")`, so intercepting there catches all of them, including seeds not yet written.

**Files:**
- Modify: `src/lib/db.ts`
- Test: `src/lib/__tests__/minilesson-derived-extension.test.ts` (DB-backed; leases a pool branch)

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { deriveLessonMeta } from "@/lib/library/derived";

const blocks = [
  { type: "prose", body: "word ".repeat(600).trim() },
  { type: "image", src: "/guide-diagrams/derived-test.svg" },
];

async function anyUserId() {
  const u = await db.user.findFirst({ select: { id: true } });
  if (!u) throw new Error("seed fixture missing a User");
  return u.id;
}

describe("MiniLesson derived-column extension", () => {
  it("populates derived columns on create", async () => {
    const row = await db.miniLesson.create({
      data: {
        slug: `derived-create-${Date.now()}`,
        title: "t",
        contentBlocks: blocks,
        createdById: await anyUserId(),
      },
      select: { id: true, readingMinutes: true, questionCount: true, diagramSrc: true },
    });
    const want = deriveLessonMeta(blocks);
    expect(row).toMatchObject(want);
    await db.miniLesson.delete({ where: { id: row.id } });
  });

  it("recomputes derived columns when contentBlocks changes on update", async () => {
    const created = await db.miniLesson.create({
      data: {
        slug: `derived-update-${Date.now()}`,
        title: "t",
        contentBlocks: [],
        createdById: await anyUserId(),
      },
      select: { id: true },
    });
    const row = await db.miniLesson.update({
      where: { id: created.id },
      data: { contentBlocks: blocks },
      select: { readingMinutes: true, questionCount: true, diagramSrc: true },
    });
    expect(row).toMatchObject(deriveLessonMeta(blocks));
    await db.miniLesson.delete({ where: { id: created.id } });
  });

  it("leaves derived columns alone on an update that does not touch contentBlocks", async () => {
    const created = await db.miniLesson.create({
      data: {
        slug: `derived-untouched-${Date.now()}`,
        title: "t",
        contentBlocks: blocks,
        createdById: await anyUserId(),
      },
      select: { id: true, readingMinutes: true },
    });
    const row = await db.miniLesson.update({
      where: { id: created.id },
      data: { title: "renamed" },
      select: { readingMinutes: true },
    });
    expect(row.readingMinutes).toBe(created.readingMinutes);
    await db.miniLesson.delete({ where: { id: created.id } });
  });
});
```

Uses throwaway rows, never real curriculum rows — per the guide-completion prod-coupled-test lesson.

**Step 2: Run it, verify it fails**

```
pnpm vitest run src/lib/__tests__/minilesson-derived-extension.test.ts
```
Expected: FAIL — derived columns come back as the `DEFAULT` placeholders (1 / 0 / null), not the derived values.

**Step 3: Implement the extension**

```ts
// src/lib/db.ts
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { deriveLessonMeta } from "@/lib/library/derived";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Inject MiniLesson's derived columns into any write payload that carries
// contentBlocks. Returns `data` untouched when contentBlocks is absent (a
// title-only edit must not disturb them).
function withDerived<T>(data: T): T {
  if (!data || typeof data !== "object") return data;
  const d = data as Record<string, unknown>;
  if (!("contentBlocks" in d)) return data;
  return { ...d, ...deriveLessonMeta(d.contentBlocks) } as T;
}

function makeClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const adapter = new PrismaNeon({ connectionString: url });
  const base = new PrismaClient({ adapter, log: ["query", "error", "warn"] });

  // MiniLesson's readingMinutes/questionCount/diagramSrc are DERIVED from
  // contentBlocks. Recompute them here, at the one choke point every writer
  // already funnels through (the admin actions and ~164 `await import("@/lib/db")`
  // call sites in scripts/), so a new seed script cannot forget and rot them.
  // NOTE: this intercepts create/update/upsert only. `updateMany` and raw SQL
  // bypass it — the drift guardrail test is what catches that.
  return base.$extends({
    query: {
      miniLesson: {
        create({ args, query }) {
          args.data = withDerived(args.data);
          return query(args);
        },
        update({ args, query }) {
          args.data = withDerived(args.data);
          return query(args);
        },
        upsert({ args, query }) {
          args.create = withDerived(args.create);
          args.update = withDerived(args.update);
          return query(args);
        },
      },
    },
  }) as unknown as PrismaClient;
}

export const db = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

**Step 4: Run it, verify it passes**

```
pnpm vitest run src/lib/__tests__/minilesson-derived-extension.test.ts
```
Expected: PASS (3 tests).

> **On the `as unknown as PrismaClient` cast:** validated as safe — a *query* extension doesn't change model types, so every call site keeps its existing types and the new columns come from the schema, not the extension. If tsc nonetheless objects, do **not** widen to `any`; export the extended type instead (`export type Db = ReturnType<typeof makeClient>`) and fix call sites — that's signal, not noise.

**Step 5: Commit**

```bash
git add src/lib/db.ts src/lib/__tests__/minilesson-derived-extension.test.ts
git commit -m "feat(library): recompute MiniLesson derived columns on write"
```

---

### Task 4: Backfill the 69 live rows

**Files:**
- Create: `scripts/backfill-lesson-derived.ts`

**Step 1: Write the script**

```ts
// One-off: backfill MiniLesson's derived columns for every existing row.
// Idempotent — re-running recomputes the same values. Safe to re-run after any
// bulk content edit that bypassed the db.ts extension (updateMany / raw SQL).
//
// Run:  pnpm exec tsx scripts/backfill-lesson-derived.ts
// PROD: .env.local DATABASE_URL is PROD. This WRITES. Read CLAUDE.md first.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

async function main() {
  const { db } = await import("@/lib/db");
  const { deriveLessonMeta } = await import("@/lib/library/derived");

  const rows = await db.miniLesson.findMany({
    select: { id: true, slug: true, contentBlocks: true },
  });
  console.log(`backfilling ${rows.length} lessons…`);

  let changed = 0;
  for (const row of rows) {
    const derived = deriveLessonMeta(row.contentBlocks);
    // Write the derived fields explicitly. Passing contentBlocks back through
    // would work (the extension would recompute), but rewriting a TOASTed JSON
    // column for no reason is exactly the waste this plan exists to remove.
    await db.miniLesson.update({ where: { id: row.id }, data: derived });
    changed++;
    console.log(
      `  ${row.slug}: ${derived.readingMinutes} min · ${derived.questionCount} Q · ${derived.diagramSrc ?? "—"}`,
    );
  }
  console.log(`done: ${changed} rows`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

**Step 2: Dry-run against the numbers the site renders today**

Before writing to PROD, confirm the derived values match what `/library` currently computes live. Task 7 does this formally; at minimum eyeball a few read-times against the live page.

**Step 3: Run the backfill**

```
pnpm exec tsx scripts/backfill-lesson-derived.ts
```
Expected: one line per lesson, `done: <N> rows` where N ≥ 69.

**Step 4: Verify no row kept a placeholder**

```sql
SELECT count(*) AS unbackfilled
FROM "MiniLesson"
WHERE published = true AND "accessTier" = 'PUBLIC'
  AND "readingMinutes" = 1 AND "questionCount" = 0 AND "diagramSrc" IS NULL;
```
Expected: `0` — or, if non-zero, each one is genuinely a 1-minute, quiz-less, diagram-less lesson. Confirm by hand; do not assume.

**Step 5: Commit**

```bash
git add scripts/backfill-lesson-derived.ts
git commit -m "chore(library): backfill MiniLesson derived columns"
```

---

### Task 5: Stop selecting contentBlocks in the two hot loaders

The actual payoff.

**Files:**
- Modify: `src/lib/library/load.ts:82-112` (`listPublishedByCluster`)
- Modify: `src/lib/logbook/load.ts:21-32` (`loadLessonMeta`)

**Step 1: `listPublishedByCluster` — select the columns, drop the JSON**

```ts
export async function listPublishedByCluster() {
  const rows = await db.miniLesson.findMany({
    where: { published: true, accessTier: "PUBLIC" },
    orderBy: { updatedAt: "desc" },
    // readingMinutes/diagramSrc are stored columns derived from contentBlocks on
    // write (src/lib/db.ts extension). Selecting contentBlocks here to derive
    // them live cost ~314 kB of wire per render for ~14 kB of scalars.
    select: {
      slug: true,
      title: true,
      summary: true,
      createdAt: true,
      updatedAt: true,
      cluster: true,
      clusterOrdinal: true,
      readingMinutes: true,
      diagramSrc: true,
    },
  });
  return bucketByCluster(rows);
}
```

The `rows.map(...)` that stripped `contentBlocks` goes away — the shape it produced (`readingMinutes`, `diagramSrc`) now comes straight from the DB, and `bucketByCluster` is generic over the row shape.

**Step 2: `loadLessonMeta` — same**

```ts
export async function loadLessonMeta(): Promise<LessonMeta[]> {
  return db.miniLesson.findMany({
    where: { published: true, accessTier: "PUBLIC" },
    select: { slug: true, cluster: true, questionCount: true, readingMinutes: true },
  });
}
```

Returns the `LessonMeta` shape directly — the `.map()` is now redundant. Keep the exported `LessonMeta` type as-is so callers don't churn.

**Step 3: Drop the now-unused imports**

`readingMinutes` / `firstDiagramSrc` in `src/lib/library/load.ts`, `readingMinutes` / `quizQuestions` in `src/lib/logbook/load.ts` — **only** if no other function in the file still uses them. Check before deleting; `loadPublicLibraryForBook` and the quiz paths legitimately still read `contentBlocks`.

**Step 4: Full typecheck + full suite**

```
pnpm exec tsc --noEmit
pnpm test
```
Expected: tsc clean; vitest green (~1610 tests, ~80s). A schema change demands the **full** suite, not a scoped run.

**Step 5: Commit**

```bash
git add src/lib/library/load.ts src/lib/logbook/load.ts
git commit -m "perf(library): read derived columns instead of contentBlocks"
```

---

### Task 6: Drift guardrail

The extension covers `create`/`update`/`upsert`. `updateMany` and raw SQL bypass it. This test is what turns that from a silent rot into a failed build — same shape as the existing `cluster-order` and `diagrams:check` gates.

**Files:**
- Create: `src/lib/__tests__/library-derived-drift.test.ts`

**Step 1: Write the test**

```ts
import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { deriveLessonMeta } from "@/lib/library/derived";

// Every published lesson's stored derived columns MUST equal a fresh derive from
// its contentBlocks. Fails when a write path bypassed the db.ts extension
// (updateMany / raw SQL / a direct psql edit). Fix = re-run
// `pnpm exec tsx scripts/backfill-lesson-derived.ts`.
describe("MiniLesson derived columns do not drift", () => {
  it("stored columns match a fresh derive for every published lesson", async () => {
    const rows = await db.miniLesson.findMany({
      where: { published: true, accessTier: "PUBLIC" },
      select: {
        slug: true,
        contentBlocks: true,
        readingMinutes: true,
        questionCount: true,
        diagramSrc: true,
      },
    });
    expect(rows.length).toBeGreaterThan(0);

    const drifted = rows
      .map((r) => ({ slug: r.slug, want: deriveLessonMeta(r.contentBlocks), got: {
        readingMinutes: r.readingMinutes,
        questionCount: r.questionCount,
        diagramSrc: r.diagramSrc,
      }}))
      .filter((r) => JSON.stringify(r.want) !== JSON.stringify(r.got));

    expect(drifted).toEqual([]);
  });
});
```

**Step 2: Run it**

```
pnpm vitest run src/lib/__tests__/library-derived-drift.test.ts
```
Expected: PASS. If it fails, the backfill (Task 4) didn't cover something — fix the data, not the test.

**Step 3: Commit**

```bash
git add src/lib/__tests__/library-derived-drift.test.ts
git commit -m "test(library): guard MiniLesson derived columns against drift"
```

---

### Task 7: Prove the saving, and prove nothing changed on screen

Verification, not vibes. Two claims to discharge: bytes went down, and the rendered page is identical.

**Files:**
- Create: `scripts/_measure-library-egress.ts` (scratch; `_`-prefixed like the other scratch scripts)

**Step 1: Measure the wire cost of the new query shape**

```ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

async function main() {
  const { db } = await import("@/lib/db");
  const [row] = await db.$queryRawUnsafe<{ before: bigint; after: bigint }[]>(`
    SELECT
      sum(length("contentBlocks"::text))::bigint AS before,
      sum(
        length(slug) + length(title) + coalesce(length(summary),0)
        + coalesce(length("diagramSrc"),0) + coalesce(length(cluster),0) + 16
      )::bigint AS after
    FROM "MiniLesson" WHERE published = true AND "accessTier" = 'PUBLIC';
  `);
  const kb = (n: bigint) => (Number(n) / 1024).toFixed(1);
  console.log(`per /library render:`);
  console.log(`  before: ${kb(row.before * 2n)} kB  (contentBlocks x2)`);
  console.log(`  after:  ${kb(row.after)} kB  (scalars x1)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
```

Run it. Measured 2026-07-15: before **662.4 kB**, after **35.3 kB** — **18.7×**, 627 kB saved per render. Anything under ~15× is a red flag: re-check that *both* loaders actually stopped selecting `contentBlocks`.

**Step 2: Confirm the page is byte-identical to a reader**

Start dev (`Start-Process … -WindowStyle Hidden`; the harness-backgrounded server dies), load `http://localhost:3000/library` — **localhost, not 127.0.0.1**, or `/_next` chunks 404 and nothing hydrates. Check against the pre-change page:

- read-times on the cluster rows match
- the featured + also-featured hero diagrams still render
- the signed-in Logbook XP overlay still shows per-lesson earned/max

**Step 3: Confirm the DB actually stopped shipping the JSON**

`pg_stat_statements` was installed on PROD 2026-07-15 and collects from that point:

```sql
SELECT calls, rows, left(query, 90) AS q
FROM pg_stat_statements
WHERE query ILIKE '%MiniLesson%'
ORDER BY calls DESC LIMIT 10;
```
Expect the hot `/library` query to no longer reference `contentBlocks`.

**Step 4: Commit**

```bash
git add scripts/_measure-library-egress.ts
git commit -m "chore(library): script to measure the /library query wire cost"
```

---

## Rollback

- Code: revert the branch. The columns are additive and defaulted — old code ignores them, so a revert needs no down-migration.
- Data: nothing destroyed. `contentBlocks` is untouched throughout; the derived columns are pure duplicates and can be recomputed at any time with `scripts/backfill-lesson-derived.ts`.
- `pg_stat_statements`: `DROP EXTENSION pg_stat_statements;` on PROD if unwanted.

## Definition of done

- [ ] `pnpm exec tsc --noEmit` clean
- [ ] `pnpm test` fully green (~1610)
- [ ] Backfill run against PROD; the "unbackfilled" query returns 0 (or each hit hand-confirmed)
- [ ] Measured before/after shows ≈ 628 kB → ≈ 15 kB
- [ ] `/library` renders identically signed-out **and** signed-in, in both themes
- [ ] Maintainer's explicit go-ahead before merge (CLAUDE.md)
