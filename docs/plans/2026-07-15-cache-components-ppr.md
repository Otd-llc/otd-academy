# Cache Components / PPR Migration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
>
> **Load the `vercel:next-cache-components` skill before Task 3.** It carries the current
> `use cache` / `cacheLife` / `cacheTag` contract. Do not write caching code from memory.

**Goal:** Make public-page database reads a function of *time* (24/day at hourly revalidation) instead of *traffic*, by enabling Next 16 Cache Components and caching the user-independent data reads — before real SEO traffic arrives.

**Architecture:** Turn on `cacheComponents: true` (global PPR). Every route-segment `dynamic`/`revalidate` export is removed — Next rejects them outright under this flag. The user-independent loaders get `'use cache'` + an explicit 1-hour `cacheLife` + `cacheTag(...)`; per-user fragments (session, XP overlay, resume rail) move behind `<Suspense>` so they stay dynamic and stream. Write paths fire `revalidateTag` so a content edit appears immediately and the hour is only the fallback.

**The cache profile is `cacheLife({ revalidate: 3600 })`, written inline — NOT `cacheLife('hours')`.** The owner specified a 1-hour window (2026-07-15). The named profiles' exact numbers are documented only for `'default'` (5m stale / 15m revalidate); what `'hours'` resolves to is unverified, and silently getting a different window than the one that was chosen is the kind of thing nobody notices. Use the inline form so the intent is on the page:

```ts
cacheLife({ stale: 3600, revalidate: 3600, expire: 86_400 });
```

If a named profile is preferred later, verify its real numbers against the Next docs first and record them here.

**Tech Stack:** Next 16.2.6 (Turbopack), React 19.2.4, Prisma 7.8.

---

## Measured facts this plan is built on (2026-07-15)

- **Enabling the flag is all-or-nothing.** Spiked `cacheComponents: true` against the current tree: `next build` fails with **45 errors**, every one being *"Route segment config `dynamic` is not compatible with `nextConfig.cacheComponents`. Please remove it."* There is no incremental path — you cannot cache one route and leave `force-dynamic` elsewhere.
- **34 files** export a route-segment `dynamic`/`revalidate` and must all be converted: **22 pages** (20 `force-dynamic` + 2 `force-static`), **11 route handlers**, and `sitemap.ts`.
- **The CI build has no database.** `.github/workflows/ci.yml:26` sets `DATABASE_URL: postgresql://stub:stub@stub/stub` for `pnpm next build`. The real `ci-test` Neon branch (`secrets.NEON_TEST_DATABASE_URL`) is used **only** by the vitest job.
- **`force-dynamic` exists here *because* of that.** From the source: *"Keep `force-dynamic` so the CI build (stub DATABASE_URL) doesn't prerender the DB query"* (`src/app/courses/page.tsx`, `src/app/library/page.tsx`). Removing it makes those pages prerender-eligible, so **the CI build will try to run DB queries against a fake URL and fail.** Task 1 exists solely to unblock this.
- **16 files call `await auth()`**; only 1 uses `cookies()`/`headers()` directly. `auth()` is the dominant runtime-API surface, so it drives where Suspense boundaries go.
- **`unstable_cache` still exists** in 16.2.6 (exported from `next/cache`) but is legacy; the owner chose the full migration over it on 2026-07-15.

**Why bother, given the derived-columns work already cut `/library` 18.7×:** that made each render ~35 kB. At 10k renders/day that is still **~10.5 GB/month** — over the 5 GB account allowance. Caching decouples DB reads from traffic entirely. At `cacheLife('hours')` the floor is ~24 reads/day no matter how much traffic lands.

---

## KNOWN UNKNOWN — read this before estimating

The 45 route-config errors are only the **first** error class. Next refuses to build while any `dynamic` export remains, so **the second class (missing Suspense boundaries around runtime APIs) cannot be observed until all 34 are removed.** That list is genuinely unknown right now.

Task 2 is therefore a **discovery task**: strip the exports, build, and *record the real error list* before writing any component code. Do not estimate the Suspense work before Task 2 output exists.

**The single question Task 2 must answer — it is a 3× scope swing:**

> **Does a fully-dynamic page need a Suspense restructure just to build under `cacheComponents`, or may it simply have no static shell?**

**17 of the 20 `force-dynamic` pages read the session** (verified 2026-07-15) — not the 5 public ones this plan is *for*:

```
PUBLIC (the point of this work) -- 5:
  library/page.tsx   library/[slug]/page.tsx   courses/page.tsx
  courses/[slug]/page.tsx   pricing/page.tsx

PER-USER, no caching value -- 2:
  logbook/page.tsx   welcome/page.tsx

ADMIN, no caching value, gated + near-zero traffic -- 10:
  admin/billing  admin/feedback  admin/goals  admin/library  admin/library/[id]
  admin/logbook  admin/sourcing  admin/students  admin/students/[id]  admin/waitlist
```

- **If fully-dynamic pages are allowed:** the work is the 5 public pages. Tractable.
- **If every page needs a prerenderable shell:** it is 17 restructures, 10 of them on admin surfaces that gain **nothing** from caching. That is a different project, and worth reconsidering against the `unstable_cache` option that was declined on 2026-07-15 (which touches ~4 files and needs no config change).

**Report this number at the Task 2 checkpoint before writing any component code.** If it is 17, **stop and re-scope with the owner** rather than pushing through — doing 10 admin restructures to save Neon egress on 5 public pages is a bad trade, and the fallback still exists.

---

## THE SILENT FAILURE MODE — the thing most likely to cause real damage

Removing `force-dynamic` from a **GET route handler** makes it prerender-*eligible*. If Next freezes one at build time, it does not error — it serves a stale, build-time response forever. **8 of the 11 route handlers export GET:**

| Route | Method | If frozen |
| --- | --- | --- |
| `api/cron/lifecycle` | GET | **nightly lifecycle emails silently stop** |
| `api/cron/refresh-availability` | GET | **DigiKey availability watchdog silently stops** |
| `email/unsubscribe/[token]` | GET,POST | **unsubscribe link dead** — a compliance problem |
| `admin/waitlist/export` | GET | serves a frozen build-time CSV |
| `api/capture/status`, `api/capture/session` | GET | admin capture polling frozen |
| `sitemap-images.xml` | GET | stale image sitemap |
| `library/[slug]/pdf` | GET | **stale PDFs after a content edit** (see Task 3b) |
| `api/stripe/webhook` | POST | not at risk (POST is never prerendered) |

**This is probably fine — and "probably" is exactly the problem.** Two reasons to expect it is:
1. The Cache Components migration table says `dynamic = 'force-dynamic'` → *"Remove (default behavior)"* — i.e. dynamic **is** the default under this flag, and caching is opt-in via `use cache`.
2. Most of these touch the `Request` object (the crons read `req.headers.get("authorization")` for their `CRON_SECRET` check), which independently opts a handler out of static rendering.

But it is **unverified**, and the failure is silent — a frozen cron produces no error, just an absence of emails nobody notices for a week. The crons are also **middleware-exempt** (`src/proxy.ts` matcher excludes `api/cron`), so they self-guard with `CRON_SECRET` and have no second line of defence.

**Task 2 MUST verify each GET handler still executes per request.** Do not infer it from a green build. The escape hatch, if any is wrongly frozen:

```ts
import { connection } from "next/server";

export async function GET(req: Request) {
  await connection(); // defer to request time; never prerender
  // ...
}
```

`connection` is confirmed exported from `next/server` in 16.2.6.

---

## Preconditions

- Branch off `main`. Do not merge without the maintainer's explicit go-ahead (CLAUDE.md).
- `fix/dev-off-prod-local-postgres` must be merged first: this plan's local verification assumes `DATABASE_URL` is the local Postgres, and Task 1 changes CI in ways that assume the adapter switch exists.
- `pnpm` runs via PowerShell, not the Bash tool.
- **Local `pnpm exec tsc --noEmit` is red for unrelated reasons** — two gitignored scratch files (`scripts/_inspect-u1-cad.ts`, `scripts/_probe-render-pdf.tsx`) have pre-existing type errors. They are untracked so CI is clean. Filter them; do not "fix" them here.

---

### Task 1: Give the CI build a real database

**The blocker.** Everything else fails until this lands. Do it first, on its own, and confirm CI is green before touching a single route.

**Files:**
- Modify: `.github/workflows/ci.yml`

**Step 1: Point the build step at the ci-test branch**

The `pnpm next build` step's `env:` block is **10 lines** (`ci.yml:25-35`): the two DB URLs plus eight auth/R2 stubs that `src/env.ts` validates at import. **Change ONLY the two DB lines. Leave every other line exactly as-is** — dropping the auth stubs fails env validation and the build dies for an unrelated reason that looks like a caching bug.

```yaml
      - run: pnpm next build
        env:
          # CHANGED: a REAL database. With cacheComponents the build prerenders
          # pages and evaluates `use cache` functions, so it executes Prisma
          # queries. The stub only ever worked because every DB-backed page was
          # force-dynamic -- which cacheComponents forbids.
          DATABASE_URL: ${{ secrets.NEON_TEST_DATABASE_URL }}
          DIRECT_URL: ${{ secrets.NEON_TEST_DATABASE_URL }}
          # UNCHANGED below -- env.ts validates these at import.
          AUTH_SECRET: "stub-secret-32-chars-long-padding-x"
          AUTH_GOOGLE_ID: stub
          AUTH_GOOGLE_SECRET: stub
          AUTH_GITHUB_ID: stub
          AUTH_GITHUB_SECRET: stub
          AUTH_RESEND_KEY: stub
          ALLOWED_EMAILS: "stub@stub"
          R2_ENABLED: "false"
```

> **This task may turn out to be unnecessary** — it is required only if the build actually prerenders DB-backed data, which is the same unknown Task 2 resolves. Do it anyway: a real DB in CI is strictly better than a fake one, it is a two-line change, and discovering the need mid-migration is worse than paying for it up front.

**Change the `pnpm next build` step's env ONLY.** The diagram-export freshness gate is a *later step in the same `build` job* with its own `env:` block (`ci.yml:56`) that also pins the stub. It boots `pnpm next start` against the build artifact and only requests `/diagram-render/[key]`, which the source states is *"pure components"* with no DB. Leave that stub in place — and confirm the gate still passes, since it now runs against a build produced with a real DB.

**Step 2: Consider the cold-branch race**

The vitest job already wraps its migrate in a retry because *"[the branch] has to wake it, which can outrun a single migrate's connect timeout"* (`ci.yml:72`). The build now has the same exposure. If the build flakes on a cold branch, add the same retry shape rather than raising timeouts blindly.

**Step 3: Verify on a throwaway PR**

Push the branch and confirm the `build` job is green **before** Task 2. Note that `build` can merge RED in this repo — check `build | pass` explicitly, do not trust the overall check mark.

**Step 4: Note the Vercel side**

Vercel's build already has the real prod `DATABASE_URL`, so it will prerender against **prod** at deploy time. That is a handful of read queries per deploy — negligible, and it usefully warms the cache. No action needed; recorded so it is not a surprise.

**Step 5: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: build against a real DB so pages can prerender"
```

---

### Task 2: DISCOVERY — strip the route configs and record what breaks

**This task produces information, not a finished migration.** Its deliverable is the error list Task 3+ are scoped from.

**Files:**
- Modify: `next.config.ts`
- Modify: all 34 files exporting `dynamic` / `revalidate` (list below)

**Step 1: Enable the flag**

```ts
// next.config.ts
const nextConfig: NextConfig = {
  cacheComponents: true,
  // ...
}
```

**Step 2: Remove every route-segment config**

All 34. Next rejects the build while any remain:

```
src/app/(internal)/diagram-render/[key]/page.tsx   src/app/admin/billing/page.tsx
src/app/admin/feedback/page.tsx                     src/app/admin/goals/page.tsx
src/app/admin/library/page.tsx                      src/app/admin/library/[id]/page.tsx
src/app/admin/logbook/page.tsx                      src/app/admin/sourcing/page.tsx
src/app/admin/students/page.tsx                     src/app/admin/students/[id]/page.tsx
src/app/admin/waitlist/export/route.ts              src/app/admin/waitlist/page.tsx
src/app/api/capture/session/route.ts                src/app/api/capture/status/route.ts
src/app/api/cron/lifecycle/route.ts                 src/app/api/cron/refresh-availability/route.ts
src/app/api/stripe/webhook/route.ts                 src/app/briefs/page.tsx
src/app/briefs/[key]/page.tsx                       src/app/checkout/success/page.tsx
src/app/courses/page.tsx                            src/app/courses/[slug]/page.tsx
src/app/email/unsubscribe/[token]/route.ts          src/app/library/field-guide/pdf/route.tsx
src/app/library/field-guide/[cluster]/pdf/route.tsx src/app/library/page.tsx
src/app/library/[slug]/page.tsx                     src/app/library/[slug]/pdf/route.tsx
src/app/logbook/page.tsx                            src/app/pricing/page.tsx
src/app/sandbox/share-cards/page.tsx                src/app/sitemap-images.xml/route.ts
src/app/sitemap.ts                                  src/app/welcome/page.tsx
```

**Do not delete the reasoning.** Several carry a comment explaining *why* the route is dynamic (`checkout/success`: *"Depends on the request query + a runtime Stripe call — never prerender"*). That intent still matters — it now becomes a Suspense boundary or a `use cache: private`, not a deleted line. Convert the comment; do not drop it.

Per the migration table: `force-static` → `'use cache'` + `cacheLife('max')` (the 2 `briefs` routes).

**Step 3: Build and RECORD the errors**

```powershell
pnpm exec next build 2>&1 | Tee-Object -FilePath ../cachecomponents-errors.txt
```

Group the failures by class and write them into this plan under a new "Task 2 output" heading before continuing. Expect at minimum: routes reading `auth()`/`cookies()` at the top level without a Suspense boundary.

**Step 4: Checkpoint with the owner**

Report the error list and the revised estimate. If the surface is materially bigger than "wrap the per-user fragments", stop and re-scope. This is the point to bail cheaply.

**Step 5: Commit the discovery state**

Commit even if the build is red — this is a recorded checkpoint, and the branch is not merging yet regardless.

```bash
git commit -m "wip(cache): enable cacheComponents, strip route configs (build red -- discovery)"
```

---

### Task 3: Cache the user-independent library reads

Scope from Task 2's output. Load the `vercel:next-cache-components` skill first.

**Files:**
- Modify: `src/lib/library/load.ts`
- Modify: `src/lib/skill-tree.ts`
- Test: `src/lib/__tests__/library-cache-tags.test.ts`

**Step 1: Tag the loaders**

> **Do not put `use cache` directly on `listPublishedByCluster`.** It returns
> `bucketByCluster(rows)` — a **`Map<string, T[]>`** (`src/lib/library/cluster-order.ts:39`).
> Whether Next serializes a `Map` across the cache boundary is an assumption this plan
> refuses to make. Cache the **plain row array**, and bucket outside the boundary:
>
> ```ts
> async function cachedPublishedRows() {
>   "use cache";
>   cacheLife("hours");
>   cacheTag("mini-lessons");
>   return db.miniLesson.findMany({ /* ...existing select, unchanged... */ });
> }
>
> export async function listPublishedByCluster() {
>   return bucketByCluster(await cachedPublishedRows()); // Map built OUTSIDE the cache
> }
> ```
>
> Rows contain `Date` values (`createdAt`/`updatedAt`) and a Prisma `Json` field; both are
> plain-serializable. Keep it that way — if a future select adds a Prisma `Decimal`, it will
> not cross the boundary.

```ts
// src/lib/library/load.ts
import { cacheLife, cacheTag } from "next/cache";
```

Same shape for `loadPublicMiniLesson(slug)` — tag both broadly and narrowly so a single-lesson edit does not blow the whole index:

```ts
cacheTag("mini-lessons", `mini-lesson-${slug}`);
```

`buildSkillTree(userId)` is **only cacheable for `userId === null`** (the anonymous shape). Split it: a cached `buildPublicSkillTree()` and the existing per-user path. Do not cache the signed-in variant — `use cache` keys on arguments, so caching per-user data would silently mint a cache entry per learner.

> **The trap:** anything reading `auth()`/`cookies()` inside a `use cache` function is a build error. `listPublishedByCluster` and `loadPublicMiniLesson` are already user-independent (verified: neither touches the session). `loadLessonMeta` is user-independent *data* but is only ever called for signed-in users — cache it anyway, it keys on nothing.

**Step 2: Verify caching actually happens — against a PRODUCTION build, not `next dev`**

Not a unit test — a behavioural one. **Do not verify this with `pnpm dev`.** Dev-mode caching semantics differ from production (dev deliberately re-executes for HMR), so a dev run can show either false caching or false misses. Build and start:

```powershell
pnpm exec next build
pnpm exec next start
# then drive 20 renders of /library
```

Counting the queries: on **local** Postgres `pg_stat_statements` is present but **not loaded** (it needs `shared_preload_libraries` + a service restart, which needs elevation). Two options that do work:
- **Prisma query log** — `src/lib/db.ts` sets `log: ["query", ...]`, so count `MiniLesson` lines in the server output across 20 renders. Expect **1**, not 20.
- **Local `pg_stat_statements`**, if you are willing to enable it: add `shared_preload_libraries = 'pg_stat_statements'` to `postgresql.conf` and restart the service (elevated).

Expect one query per revalidate window, not one per render. **If the count scales with renders, a loader escaped the cache** — most likely by being called outside the cached function.

**Step 3: Commit**

---

### Task 3b: The two cacheable reads the first draft of this plan missed

Both are pure, user-independent, and hit by exactly the traffic this migration exists to serve. Neither appeared in the original task list — they were in the strip list with no instruction, which would have left them uncached (a silent miss) or frozen (a silent bug).

**`src/app/sitemap.ts`** — `force-dynamic`, four DB reads (`Project` ×2, `Part`, `MiniLesson`), zero runtime APIs. Every crawler hits it. Cache it:

```ts
export default async function sitemap() {
  "use cache";
  cacheLife("hours");
  cacheTag("mini-lessons", "projects");
  // ...existing queries, unchanged...
}
```

Tag it `mini-lessons` so a lesson edit refreshes the sitemap too — a new lesson that is not in the sitemap for an hour is a real SEO cost.

**`src/app/library/[slug]/pdf/route.tsx`** — a GET handler that reads **no session at all** (verified) and renders `contentBlocks` through react-pdf. Two problems, one opportunity:
- Prerender-eligible ⇒ could serve **stale PDFs** after a content edit.
- react-pdf rendering is expensive per request.

Cache it with the same tag as the content it renders, so an edit invalidates the PDF:

```ts
cacheLife("hours");
cacheTag("mini-lessons", `mini-lesson-${slug}`);
```

**Do NOT do this to the field-guide PDFs.** `src/app/library/field-guide/pdf/route.tsx` and `.../[cluster]/pdf/route.tsx` are account-gated via `isFieldGuideAuthorized`, which calls `await auth()` (`src/lib/library/field-guide-gate.ts:16`). A `use cache` function may not read the session — it is a build error, and caching a gated response would be worse than a build error. They are inherently dynamic. Leave them alone beyond removing the route config.

> The gate is **in-route**, not in middleware — `src/proxy.ts`'s matcher excludes anything containing a dot (`.*\..*`) and several `api/*` prefixes. Do not assume middleware is a backstop for these routes.

**Step: Commit**

---

### Task 4: Suspense boundaries for the per-user fragments

Scope from Task 2's output. **This is the bulk of the migration — budget accordingly.**

**Every one of the five public pages calls `await auth()` at the top level** (verified 2026-07-15):

| Page | Reads `auth()` | Also reads |
| --- | --- | --- |
| `library/page.tsx` | yes | `listPublishedByCluster`, `loadLessonMeta`, resume, XP |
| `library/[slug]/page.tsx` | yes | `loadPublicMiniLesson` |
| `courses/page.tsx` | yes | `buildSkillTree` |
| `courses/[slug]/page.tsx` | yes | project + lessons |
| `pricing/page.tsx` | yes | `db.project` ×2, `db.bundle` |

A top-level `await auth()` makes the **entire page** dynamic, so **none of them prerender until restructured**. This is not "wrap one overlay on `/library`" — it is the same restructure five times: hoist the cached public data into a `use cache` function, push `auth()` down into a child, wrap that child in `<Suspense>`.

`/library` is the richest example: a cached public index **plus** a signed-in Logbook overlay (per-lesson XP), a resume rail, and a follower card. The public part caches; the per-user part streams.

```tsx
export default async function LibraryPage() {
  return (
    <>
      <LibraryIndex />                {/* cached: 'use cache' */}
      <Suspense fallback={<LogbookRailSkeleton />}>
        <LogbookOverlay />            {/* dynamic: reads auth() */}
      </Suspense>
    </>
  );
}
```

**The fallback is a design deliverable, not a `<p>Loading…</p>`.** These render on the real page for real users. Use the `otd-frontend-design` skill; match the console aesthetic; verify in **both** themes.

**Verify:** signed-out `/library` is identical to today; signed-in still shows XP overlay, resume rail, and follower card. Diff the HTML against a pre-migration capture if unsure.

---

### Task 5: Tag invalidation on the write paths

Hourly revalidation is the fallback. Edits should appear immediately.

**Files:**
- Modify: `src/lib/actions/mini-lesson.ts`
- Modify: `scripts/*seed*.ts` (or document the manual step)

**Step 1: Admin edits**

```ts
import { revalidateTag } from "next/cache";
// after a successful write:
revalidateTag("mini-lessons");
revalidateTag(`mini-lesson-${slug}`);
```

Use `revalidateTag` (background) not `updateTag` unless the same request must see fresh data.

**Step 2: The seed-script gap — be honest about it**

Seed scripts write to the DB **outside a request context**, so they cannot call `revalidateTag`. A seeded content change will therefore take up to an hour to appear in prod. Options, in order of preference:
1. Accept it and **document it** in CLAUDE.md next to the seed workflow.
2. Add an admin-only `POST /api/revalidate` (guarded by `CRON_SECRET`) that the seed scripts hit after writing.

Do **not** silently leave this undocumented — "I seeded prod and nothing changed" is a confusing hour to lose.

**Step 3: Commit**

---

### Task 6: Prove it

**Step 1: Full gates**

```powershell
pnpm exec tsc --noEmit   # filter the 2 known gitignored scratch errors
pnpm test                # expect green (1645 at time of writing)
pnpm exec next build     # must be GREEN -- this is the whole point
```

**Step 2: Prove DB reads decoupled from traffic**

The headline claim. Reset prod's `pg_stat_statements` (installed 2026-07-15), drive N renders, count queries:

```
mcp__Neon__run_sql: SELECT pg_stat_statements_reset();
# ...drive 60 renders against a preview deploy...
SELECT sum(calls) FROM pg_stat_statements WHERE query ILIKE '%"MiniLesson"%';
```

Expect a small constant, **not** 60×. Anything scaling with render count means a loader escaped the cache.

> **Check the preview's database first.** This measurement reads **prod's** `pg_stat_statements`, so it only means anything if the preview deployment's `DATABASE_URL` is prod. Confirm in the Vercel project's Preview environment before drawing conclusions — if Preview points somewhere else, a reading of "0 queries" proves nothing at all. (`vercel env ls`, or the Vercel dashboard.)
>
> Resetting `pg_stat_statements` on prod is a **counter reset, not data loss** — but it does discard whatever attribution has accumulated since the last reset. It was last reset 2026-07-15 19:21Z.

**Step 3: Prove the pages still render correctly**

`/library`, `/library/[slug]`, `/courses`, `/pricing` — signed-out **and** signed-in, both themes. Check the 69 lesson links, read-times, hero diagrams, and the XP overlay.

**Step 4: Watch the first deploy**

PPR changes how every page is served. Check Vercel runtime logs for new errors after deploy; the site currently serves ~4 requests/day, so a regression will be quiet rather than loud.

---

## Rollback

Revert the branch. `cacheComponents` is a build-time flag — no data, schema, or infrastructure changes. Task 1 (the CI env) is independently useful and can stay.

## Definition of done

- [ ] CI `build | pass` explicitly green (it can merge red — check it, don't trust the tick)
- [ ] `pnpm exec next build` green locally
- [ ] `pnpm test` green; `tsc` clean modulo the 2 known scratch files
- [ ] Prod DB reads flat across a render burst (the actual proof)
- [ ] `/library`, `/library/[slug]`, `/courses`, `/pricing` correct signed-out + signed-in, both themes
- [ ] Suspense fallbacks are designed, not placeholders
- [ ] Seed-script revalidation gap either solved or documented in CLAUDE.md
- [ ] Maintainer's explicit go-ahead before merge
