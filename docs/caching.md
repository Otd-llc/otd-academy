# Caching — Cache Components / PPR

How this app caches, why, and the rules for touching it. **Current as of 2026-07-16**
(PRs #310 → `1407887`, #311 → `b8bf002`, #312 → `68d2249`).

The code is the source of truth. If this doc disagrees with `src/`, the code wins —
but please fix the doc in the same commit.

---

## Why this exists

Dev traffic against the prod Neon branch burned **4.73 GB of the account's 5 GB egress**
and **70% of the 100 CU-h project compute** by mid-July 2026 — while the deployed site
served **4 requests/day**. Two independent fixes landed:

1. **Dev off prod** (#306) — local Postgres for development. See `docs/plans/2026-07-15-dev-off-prod-local-postgres.md`.
2. **This** — make the *public site's* DB reads a function of **time** (~24/day at hourly
   revalidation) instead of **traffic**, before real SEO traffic arrives.

The `/library` SEO surface is 6 clusters / 69 lessons. Uncached, every crawler hit was a
DB read. That is the shape this kills.

**Measured** (production build, Prisma query log, with an uncached control route to prove
the instrument works):

| Surface | Before | After |
| --- | --- | --- |
| `/library` × 20 | — | **0 queries** |
| `/parts` × 10 | 50 | **0** |
| `/pricing` × 10 | 30 | **3** (one cache fill) |
| library OG × 10 | 10 fat-column reads | **1** |
| guide `[stage]` | Part 28 / PartAsset 54 | **1 / 1** per render |

---

## The model

`next.config.ts` sets **`cacheComponents: true`** (Next 16). Consequences, all of them
load-bearing:

- **Dynamic is the default. Caching is opt-in** via the `use cache` directive.
- **Every route-segment `dynamic` / `revalidate` / `runtime` export is rejected outright.**
  The compiler refuses to build. Enabling the flag was all-or-nothing: **57 files** had to
  be stripped in one change. (`runtime` is rejected too — the docs' removal list is
  misleading, and the compiler is the authority. `"nodejs"` is the default anyway, so
  removing it is a no-op.)
- **A prerendered shell cannot read the session, cookies, headers, or the DB.** Anything
  that does must sit behind a `<Suspense>` boundary and stream.

### What actually did the work

The **root layout** was the universal blocker: it awaited `auth()` / `headers()` /
`cookies()` / a DB read before any JSX, so it blocked all 73 routes. Fixing that one file
cleared 29; a single `<Suspense>` around `{children}` took the remaining 44 → 3. **The
feared per-page restructure never happened.**

The Neon-egress win does **not** come from PPR or from the Suspense boundaries. It comes
from `use cache` on the user-independent loaders. PPR is what makes the shell static; the
cached loaders are what decouple DB reads from traffic. Don't confuse the two.

### Chrome is structural (#311)

Chrome membership is decided by **route group**, not sniffed at request time:

```
src/app/
  layout.tsx          static shell + <IdentityMemo/> island + {children}
  (chrome)/layout.tsx static header frame + 2 islands + <Suspense>{children}</Suspense> + static footer
  (bare)/layout.tsx   <Suspense>{children}</Suspense>   -- /sign-in, /embed/*
  api/ · robots.ts · sitemap.ts · opengraph-image.tsx   -- unmoved
```

Before this, the header sat behind `<Suspense fallback={null}>` in the root layout because
a prerendered shell **cannot** know whether chrome applies to the route. It streamed in
*after* `<main>` and shoved the content down — a real CLS on every chrome route (measured
on `/briefs`: `<body>`@3181 → `<main>`@3840 → header@8403). Route-group membership is known
at build time, so the header is now in the first flush, **37 KB ahead of the content**.

That refactor also deleted `src/lib/chrome.ts` and the `x-pathname` middleware sniff.

**Keep `(chrome)/layout.tsx` synchronous.** Awaiting anything there blocks prerendering for
all ~50 routes underneath it — the root-layout bug, one level down. Request-time data goes
in an island.

---

## The two files

| File | Owns |
| --- | --- |
| **`src/lib/cache-profile.ts`** | The `ONE_HOUR` window + every tag constant. |
| **`src/lib/cache-invalidate.ts`** | The invalidators. One home, so a writer cannot forget which surfaces its write feeds. |

### The window

```ts
export const ONE_HOUR = { stale: 3600, revalidate: 3600, expire: 86_400 } as const;
```

Owner-specified (2026-07-15), written **inline rather than as `cacheLife("hours")`**: the
built-in profiles' real numbers are documented only for `"default"` (5m stale / 15m
revalidate), so `"hours"` could silently resolve to a window nobody chose.

`expire: 86400` is a hard ceiling — an un-invalidated entry never outlives a day.

### The tags

| Constant | Value | Set by | Cleared by |
| --- | --- | --- | --- |
| `TAG_MINI_LESSONS` | `mini-lessons` | the Library read path, sitemap | `src/lib/actions/mini-lesson.ts` |
| `miniLessonTag(slug)` | `mini-lesson-<slug>` | `cachedMiniLesson` | `src/lib/actions/mini-lesson.ts` |
| `TAG_PROJECTS` | `projects` | project graph, courses, pricing, sitemap | `invalidateProjectGraph()` |
| `TAG_PARTS` | `parts` | parts list, category tree | `invalidateParts()` |

Lessons are tagged **both** broadly and narrowly, so a single-lesson edit doesn't blow the
whole index and an index-wide reseed still catches the row.

---

## The read side — every cached function

Twelve. If you add one, add it here.

| Function | File | Args | Tags | Key bounded by |
| --- | --- | --- | --- | --- |
| `sitemap()` | `src/app/sitemap.ts` | — | `mini-lessons`, `projects` | n/a |
| `cachedPublishedRows()` | `src/lib/library/load.ts` | — | `mini-lessons` | n/a |
| `cachedMiniLesson(slug)` | `src/lib/library/load.ts` | `slug` | `mini-lessons`, `mini-lesson-<slug>` | **`cachedPublishedRows()`** via `loadPublicMiniLesson` |
| `loadProjectMiniLessons(projectId)` | `src/lib/library/load.ts` | `projectId` | `mini-lessons` | internal id (not a route param) |
| `loadPublicLibraryForBook(cluster?)` | `src/lib/library/load.ts` | `cluster?` | `mini-lessons` | caller's registry check |
| `cachedProjectGraph()` | `src/lib/skill-tree.ts` | — | `projects` | n/a |
| `cachedCourseEdges()` | `src/app/(chrome)/courses/[slug]/page.tsx` | — | `projects` | n/a |
| `cachedCourse(slug)` | `src/app/(chrome)/courses/[slug]/page.tsx` | `slug` | `projects` | **`knownProjectSlugs()`** |
| `loadAllAccessBundle()` | `src/app/(chrome)/pricing/page.tsx` | — | `projects` | n/a |
| `premiumPriceRange()` | `src/app/(chrome)/pricing/page.tsx` | — | `projects` | n/a |
| `cachedDefaultPartsPage()` | `src/app/(chrome)/parts/page.tsx` | — | `parts` | n/a |
| `cachedCategoryTree()` | `src/components/parts/CategoryTreePicker.tsx` | — | `parts` | n/a |

**Three take a route param** — `cachedMiniLesson`, `loadPublicLibraryForBook`, `cachedCourse`.
All three are bounded. Keep it that way (see Law 1).

## The write side

`updateTag`, never `revalidateTag` (Law 3). Invalidators are sync functions in a **plain**
module — not `"use server"`, which may only export async functions (see the repo rule in
`src/lib/actions/*`). Server actions import and call them.

| Invalidator | Called from |
| --- | --- |
| `invalidateProjectGraph()` | `actions/projects.ts` (×5), `project-dependencies.ts` (×3), `project-price.ts`, `project-visibility.ts` |
| `invalidateParts()` | `actions/parts.ts` (×3) |
| `updateTag(TAG_MINI_LESSONS)` + `updateTag(miniLessonTag(slug))` | `actions/mini-lesson.ts` (incl. the prior slug on a rename) |

`revalidatePath` does **not** substitute. `revalidatePath("/")` mints the implicit tag
`_N_T_/`, which is not in `/courses`' or `/sitemap.xml`'s implicit tag set — so without the
explicit tag, publishing a course left `/courses` showing "coming soon" and the sitemap
missing URLs for an hour.

---

## The laws

Each was a **real bug** found on this branch. Do not re-derive them.

### 1. Bound every cached function that takes a route param

`use cache` keys on **arguments**, and a `[slug]` / `[id]` route param matches **any
string**. An unbounded cached loader mints one cache entry **and one DB query per distinct
garbage URL** a crawler tries — and those negative entries evict real rows from the LRU.
That is precisely the traffic-scales-with-reads behaviour this work exists to kill.

Bound against an **already-cached row set**, which costs no query of its own:

```ts
export async function loadPublicMiniLesson(slug: string) {
  const known = await cachedPublishedRows();          // the same hourly read the index does
  if (!known.some((r) => r.slug === slug)) return null;
  return cachedMiniLesson(slug);                      // reached only for slugs that exist
}
```

The membership check is **not** redundant with the query's `where`. The `where` bounds the
*result*; this bounds the *cache key space*.

### 2. Never leave a `cacheTag` without an invalidator

It fails **silently** — the content just goes stale for an hour, with nothing to grep for
and no error anywhere. `projects` was set by two readers and fired by nothing; publishing a
course was invisible for an hour.

Use the constants, not inline strings: the reader that SETS a tag and the writer that
CLEARS it live in different files, and a typo on either side is silent.

### 3. `updateTag`, not `revalidateTag`

`revalidateTag`'s second parameter is typed `string | CacheLifeConfig`, but `CacheLifeConfig`
is `{ expire?: number }` — it reads **only** `expire` and discards `stale` / `revalidate`, and
a non-zero `expire` makes the invalidation **stale-while-revalidate rather than a purge**.
Passing `ONE_HOUR` there silently asks for a **24-hour** window. TypeScript cannot catch it
(a variable reference fires no excess-property check).

`updateTag` takes no profile and expires immediately. The write side does not need to "name
the same profile the read side was cached under" — the two are unrelated.

### 4. A cached function may not read the session

`use cache` + `auth()` is a build error. It is also a correctness trap: caching a gated read
would serve one visitor's entitlement to another.

Corollary: **the prerendered shell cannot read the session or the DB.** `<html data-theme>`
ships as a constant, which silently killed the signed-in account-theme fallback. `User.theme`
is now stamped onto the device as a cookie by the `signIn` event in `src/auth.ts`; the
inline `THEME_BOOTSTRAP` script in `src/app/layout.tsx` is the only theme resolver.

### 5. Only plain, serializable values cross the cache boundary

Plain scalars, arrays, and `Date` serialize. **`Map` / `Set` / Prisma `Decimal` are not
assumptions worth making.** `listPublishedByCluster()` puts `use cache` on the *row query*
and builds its `Map` **outside** the boundary, from cached plain rows.

### 6. vitest cannot catch cache bugs

Without the Next compiler the `use cache` directive is an **inert string** — cached loaders
simply run uncached. The tests exercise a path that **does not exist in production** and can
never catch a serialization violation. **Only a real `next build` covers that.**

`next/cache` is stubbed wholesale in ~43 test files, so a stub must carry every export its
module graph touches; each new cache export breaks another one until they're all updated.

---

## What is deliberately NOT cached

Not oversights:

- **Field Guide PDFs** (`/library/field-guide/pdf`, `/library/field-guide/[cluster]/pdf`) —
  `isFieldGuideAuthorized()` calls `auth()`. Account-gated, so inherently dynamic (Law 4).
  The **per-lesson** PDF reads no session, and its caching lives in `loadPublicMiniLesson`.
- **`buildSkillTree(userId)`** — keys on its argument, so caching it would mint an entry per
  learner. Only the user-independent `cachedProjectGraph()` half is cached; `loadViewer` stays
  request-time. The expensive part is the DB read anyway — `computeSkillTree` is pure CPU.
- **`currentAccount()`** — session-scoped. It uses React's per-**request** `cache()` memo, not
  the `use cache` disk cache, so the header's islands share one `auth()` + one avatar read.
  **Never** promote it to `use cache`.
- **5 of the 6 DB-backed OG routes** — one thin indexed lookup each. Caching them adds
  unbounded-key surface to save a single query. (The **library** OG route *is* cached — it was
  re-reading the fat `contentBlocks` column purely to re-derive `diagramSrc`, which the stored
  column already holds.)

## Known gaps

- **Guide `[stage]` is still ~13 queries/render.** No longer the N+1 — it is `generateMetadata`
  re-querying what the page body already reads (Project ×2, GuideCard ×3, Revision ×2).
  Cacheable, but the page has PUBLIC/PREMIUM/FREE gating + a paywall, so it needs care.
  Multiplies ~20× when the board burst lands.
- **Seeded Library content takes up to an hour to appear on PROD.** `scripts/*seed*.ts` runs
  outside a request context, where `updateTag`/`revalidateTag` is unavailable — so it cannot
  invalidate. Admin edits through `src/lib/actions/mini-lesson.ts` *are* live on the next
  request. Force it sooner by touching the lesson once through `/admin/library`, or by
  redeploying (the build id is part of every cache key). Optional fix, considered and
  deliberately deferred: a `CRON_SECRET`-guarded `POST /api/revalidate` the seed scripts call.
- **Two inline tag strings** drift from Law 2's "use the constants": `src/app/sitemap.ts`
  (`cacheTag("mini-lessons", "projects")`) and `src/lib/skill-tree.ts` (`cacheTag("projects")`).
  They match by value, so nothing is broken today.

---

## Adding a cached read — the checklist

1. Is it **user-independent**? If it reads the session, stop (Law 4).
2. Does it take a **route param**? Bound it against an already-cached row set (Law 1).
3. `cacheLife(ONE_HOUR)` from `@/lib/cache-profile` — not a named profile.
4. `cacheTag(...)` with a **constant**, and make sure an invalidator fires it (Law 2).
5. Does the return value **serialize**? No `Map`/`Set`/`Decimal` across the boundary (Law 5).
6. Add it to the inventory table above.
7. **Verify against a production build** — vitest cannot see any of this (Law 6).

## Verifying

**vitest proves nothing here.** Use a production build:

```powershell
pnpm exec next build
pnpm exec next start -p 3100     # 3100, so :3000 dev stays up
```

Then hit a route N times and count `prisma:query` lines in the log.

Non-negotiable: **a query count of 0 means nothing unless you prove the instrument works.**
Always include an **uncached control route** in the same run and confirm *it* still logs
queries. Otherwise you are measuring a broken logger.

`AUTH_TRUST_HOST=1` is wanted for faithful local prod measurement of signed-out behaviour.
Auth.js rejects an untrusted host in production mode; the route gate is fail-**closed** since
#312, so this is now a convenience, not a safety requirement.

### Dev is not the instrument

- **Dev bypasses server caches when the request carries `cache-control: no-cache`** — which is
  exactly what Chrome sends **by default whenever DevTools is open**, and what a hard reload
  (Ctrl+Shift+R) sends. Measured on this app, `/library` ×5: **5 queries normally, 173 with the
  header** — same code, ~35× the reads. Next logs
  `Route ... is rendering with server caches disabled` when it happens. Uncheck DevTools →
  Network → **Disable cache**. See <https://nextjs.org/docs/messages/cache-bypass-in-dev>.
- Even warm, dev fills caches lazily per navigation and won't match production.
- If dev reports an error for code that `tsc` / `next build` say is clean, it is a **stale
  compile**: restart, and delete `.next\dev` if it persists. A stale trace can also come from a
  browser tab's cached HMR client — hard-reload before trusting its line numbers. (Hard-reload
  for stale compiles; **normal** reload when judging caching.)

---

## See also

- `docs/plans/2026-07-15-cache-components-ppr.md` — the migration plan + outcome. Its numbered
  Tasks are the **original** plan; several premises turned out wrong. Kept for reasoning, not
  as instructions.
- `docs/plans/2026-07-15-dev-off-prod-local-postgres.md` — the other half of the egress fix.
- `docs/plans/2026-07-15-library-derived-columns.md` — why `readingMinutes` / `diagramSrc` are
  stored columns (the fat-column read this removed).
