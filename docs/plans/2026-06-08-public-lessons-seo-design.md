# Public Lessons + SEO — Design (Phase 1 of the GTM roadmap)

_2026-06-08. Validated design for making flagship lessons publicly crawlable with
a full public-facing experience and rich SEO. Phase 1 of the internal GTM roadmap.
Scope decisions (locked in conversation): full public chrome + `/courses` in this
slice; rich JSON-LD incl. HowTo; only WROOM goes PUBLIC to start._

## Goal

Turn the auth-gated lessons into a public funnel top: anonymous visitors (and
search engines) can read flagship lessons; signed-in behavior is unchanged; the
content earns organic traffic and demonstrates quality ("expert aura"). No
payments — this is the free funnel.

## Decisions baked in

- **Public surface = the per-track flagship project**, encoded by
  `Project.accessTier = PUBLIC` (Phase 0). This slice flags **WROOM only**;
  more projects get flagged `PUBLIC` later as they become shop-window ready.
- **Tiers:** `accessTier ∈ { PUBLIC, FREE, PREMIUM }`. PUBLIC = no-account
  readable; FREE = needs a (free) account; PREMIUM = paid (gating deferred to
  Phase 2/3). Default `FREE`.
- **Rich structured data** including HowTo. **Dynamic OG images.** **Public
  chrome** + a public `/courses` index ship in this phase.

## Architecture

### 1. `accessTier` (schema)
`enum AccessTier { PUBLIC FREE PREMIUM }`; `Project.accessTier AccessTier
@default(FREE)`. Hand-authored migration applied to the prod Neon branch.
Backfill WROOM L1.01 → `PUBLIC`. Per the schema-change discipline: full `tsc` +
full vitest after.

### 2. Access gate — page-level, not middleware
The edge middleware can't run a Prisma lookup to know which slug is `PUBLIC`, so
the gate is split:
- `isPublicPath` (pure, in `admin-routes.ts`) is extended to treat **guide
  routes** (`/projects/[slug]/[rev]/guide…`) and `/courses` as public-*eligible*
  — i.e. the middleware stops blanket-redirecting anonymous on those paths.
- The **guide page** resolves `project.accessTier` and, when there is **no
  session and `accessTier !== PUBLIC`**, `redirect("/sign-in")`. So a non-public
  project's lessons still require sign-in for anonymous; PUBLIC ones render
  read-only. Signed-in behavior is unchanged (existing `guideCardView` split).
- The decision is a pure, unit-tested helper (`resolvePublicLessonAccess`).

### 3. Public chrome — `x-pathname` header (no route-group refactor)
Today chrome renders only when signed in (so `/sign-in` stays a clean boot
screen). The root layout can't see the pathname directly, so:
- Middleware sets an `x-pathname` request header.
- The root layout reads it and renders chrome when `signedIn ||
  isPublicPath(pathname)`, suppressed on `/sign-in`.
- Chrome adapts: signed-in → `UserMenu` + role-gated nav; anonymous → brand +
  public nav (Courses, Parts) + a **"Sign up free"** CTA.

### 4. Metadata + OG
- `metadataBase` in the root layout (absolute OG URLs).
- `generateMetadata` on: guide card, guide hub, project page, `/courses`,
  `/parts` (list + detail). Per-lesson title/description/OpenGraph/Twitter from
  the card's title/lead.
- **Canonical → the published revision's** stage URL (kills the `/v1/`
  duplicate-content trap); a pure `canonicalLessonPath(project, stage)` helper.
- **Dynamic OG image** via Next `ImageResponse` (`opengraph-image` route) —
  brand + project/stage on the deep-space background; no static assets.

### 5. JSON-LD — pure builders in `lib/seo/`, unit-tested
- **Course** on the project/hub: name, description, provider (One Thousand
  Drones), `educationalLevel` (level), `hasCourseInstance`.
- **BreadcrumbList** on lessons: Home › Courses › Project › Stage.
- **HowTo** per stage: `guideCardToHowTo(card, project)` maps the card's `steps`
  blocks → `HowToStep`; `tool`/`supply` pulled from the project BOM where it
  fits. Injected via a small `<JsonLd>` component (`application/ld+json`).

### 6. `/courses`, sitemap, robots, CTA
- Public **`/courses`** index: cards for `PUBLIC` projects → their guide;
  `ItemList` + `Course` JSON-LD; `generateMetadata`. (Lists WROOM now; grows as
  projects are flagged.)
- **`app/sitemap.ts`** (dynamic): PUBLIC project guide URLs (all published
  stages) + `/courses` + parts list/detail.
- **`app/robots.ts`**: allow public; disallow `/projects` (admin) / `/learn` /
  `/api`; reference the sitemap.
- **Sign-up CTA** island on anonymous PUBLIC lessons.

### 7. CWV
3D is already lazy (`ModelViewerLazy` = `next/dynamic`, `ssr:false`,
click-to-load) — verify only.

## Testing
- Pure/unit: `isPublicPath` additions, `resolvePublicLessonAccess`,
  `canonicalLessonPath`, the `lib/seo` builders (course / breadcrumb / howTo),
  `guideCardToHowTo`.
- Schema change → **full tsc + full vitest**.
- Manual SEO check (view-source): canonical, OG/Twitter tags, JSON-LD blocks;
  anonymous can read WROOM lessons + sees public chrome + `/courses`; a
  non-public project still redirects anonymous to `/sign-in`; signed-in
  unaffected; robots/sitemap resolve.

## Delivery — two PRs
- **PR A — access + chrome:** `accessTier` schema/migration/backfill; the
  page-level access gate (`isPublicPath` + guide-page check); `x-pathname` +
  adaptive public chrome; `/courses` index; sign-up CTA.
- **PR B — SEO surface:** `metadataBase` + `generateMetadata` + canonical;
  dynamic OG; JSON-LD (Course/Breadcrumb/HowTo); `sitemap.ts` + `robots.ts`.

Out of scope (later phases): entitlements/paywall/payments (P2–P3); flagging the
other three tracks' first projects PUBLIC; HowTo enrichment beyond the first cut.
