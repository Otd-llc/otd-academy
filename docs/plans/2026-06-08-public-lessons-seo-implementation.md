# Public Lessons + SEO Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the per-track flagship lessons (WROOM first) publicly crawlable with a full public-facing chrome and rich SEO (canonical, metadata/OG, Course/Breadcrumb/HowTo JSON-LD, sitemap/robots) — the free funnel top. No payments.

**Architecture:** A per-project `accessTier` flag (`PUBLIC|FREE|PREMIUM`) gates access. Edge middleware can't DB-lookup, so it lets guide/courses paths through and the **page** enforces `accessTier` (anonymous + non-PUBLIC → `/sign-in`). Public chrome is enabled by a middleware-set `x-pathname` header the root layout reads. SEO is standard Next App Router: `generateMetadata`, dynamic `opengraph-image`, `<script type="application/ld+json">`, `sitemap.ts`, `robots.ts`. Pure helpers are unit-tested; RSC wiring is tsc + manual.

**Tech Stack:** Next.js 16 App Router (RSC), Auth.js v5, Prisma 7 + Neon, Vitest 4, Tailwind v4.

**Design doc:** `docs/plans/2026-06-08-public-lessons-seo-design.md`.

**Conventions:** hand-authored migrations applied via `pnpm prisma migrate deploy` to the Neon **production** branch (default branch; NEVER `migrate dev` on shared Neon — see memory). After the schema task run **full `pnpm tsc` + full `pnpm vitest run`**. One commit per task; two PRs (A then B).

---

# PR A — Access + Public Chrome

## Task A1: `accessTier` schema + migration + backfill

**Files:**
- Modify: `prisma/schema.prisma` (Project model + a new enum)
- Create: `prisma/migrations/20260608000000_project_access_tier/migration.sql`

**Step 1 — schema.** In `prisma/schema.prisma` add the enum (near the other curriculum enums ~line 660) and the field on `Project` (~line 94, by `level`):

```prisma
enum AccessTier {
  PUBLIC  // no account needed — crawlable, the SEO surface
  FREE    // needs a (free) account
  PREMIUM // paid (gating deferred to a later phase)
}
```
```prisma
  // On Project, alongside `level`:
  accessTier  AccessTier  @default(FREE)
```

**Step 2 — migration SQL** (`migration.sql`):

```sql
CREATE TYPE "AccessTier" AS ENUM ('PUBLIC', 'FREE', 'PREMIUM');
ALTER TABLE "Project" ADD COLUMN "accessTier" "AccessTier" NOT NULL DEFAULT 'FREE';
-- Flagship: WROOM L1.01 is the first PUBLIC project (SEO surface).
UPDATE "Project" SET "accessTier" = 'PUBLIC' WHERE "slug" = 'foundry-l1-01-wroom-breakout';
```

**Step 3 — apply + generate.**
Run: `pnpm prisma migrate deploy` (targets the Neon prod branch via DIRECT_URL)
Then: `pnpm prisma generate`
Verify backfill: query `SELECT slug, "accessTier" FROM "Project" WHERE "accessTier"='PUBLIC';` → exactly the WROOM row.

**Step 4 — schema-change discipline.**
Run: `pnpm tsc --noEmit` → expect clean.
Run: `pnpm vitest run` → expect all green (the new column defaults FREE; nothing should break, but the full suite is the gate per the schema-change memory).

**Step 5 — commit.**
```bash
git add prisma/schema.prisma prisma/migrations/20260608000000_project_access_tier
git commit -m "feat(access): Project.accessTier (PUBLIC/FREE/PREMIUM); WROOM=PUBLIC"
```

---

## Task A2: `isPublicPath` — admit guide + courses routes

**Files:**
- Modify: `src/lib/admin-routes.ts`
- Test: `src/lib/__tests__/admin-routes.test.ts`

**Step 1 — failing tests.** Add to the `isPublicPath` describe:

```ts
it("admits guide routes (page enforces accessTier) and /courses", () => {
  expect(isPublicPath("/projects/wroom/v1/guide")).toBe(true);
  expect(isPublicPath("/projects/wroom/v1/guide/REQUIREMENTS")).toBe(true);
  expect(isPublicPath("/courses")).toBe(true);
  expect(isPublicPath("/courses/anything")).toBe(true);
});
it("still does not admit non-guide project routes", () => {
  expect(isPublicPath("/projects/wroom/v1")).toBe(false);
  expect(isPublicPath("/projects/new")).toBe(false);
});
```

**Step 2 — run, expect fail.** `npx vitest run src/lib/__tests__/admin-routes.test.ts`

**Step 3 — implement.** Extend `isPublicPath`:

```ts
export function isPublicPath(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  const top = segments[0];
  if (top === "parts") return segments[1] !== "new";
  if (top === "courses") return true;
  // Guide routes are public-ELIGIBLE; the guide page enforces accessTier.
  if (top === "projects") return segments[3] === "guide";
  return false;
}
```
(Note: `isAdminOnlyPath` already returns false for guide routes — unchanged. `/courses` is not admin-only.)

**Step 4 — run, expect pass.** Same command. Also re-run to confirm existing isPublicPath/isAdminOnlyPath cases still pass.

**Step 5 — commit.** `git commit -am "feat(access): isPublicPath admits guide + /courses (page-gated)"`

---

## Task A3: page-level access gate

**Files:**
- Create: `src/lib/public-access.ts`
- Test: `src/lib/__tests__/public-access.test.ts`
- Modify: guide card page `src/app/projects/[slug]/[revLabel]/guide/[stage]/page.tsx`; guide hub `src/app/projects/[slug]/[revLabel]/guide/page.tsx`

**Step 1 — failing test** (`public-access.test.ts`):

```ts
import { describe, it, expect } from "vitest";
import { resolvePublicLessonAccess } from "@/lib/public-access";

describe("resolvePublicLessonAccess", () => {
  it("allows any signed-in user (role logic handles the rest)", () => {
    expect(resolvePublicLessonAccess({ hasSession: true, accessTier: "FREE" })).toBe("allow");
    expect(resolvePublicLessonAccess({ hasSession: true, accessTier: "PREMIUM" })).toBe("allow");
  });
  it("allows anonymous ONLY on PUBLIC projects", () => {
    expect(resolvePublicLessonAccess({ hasSession: false, accessTier: "PUBLIC" })).toBe("allow");
  });
  it("redirects anonymous on non-PUBLIC projects", () => {
    expect(resolvePublicLessonAccess({ hasSession: false, accessTier: "FREE" })).toBe("redirectSignIn");
    expect(resolvePublicLessonAccess({ hasSession: false, accessTier: "PREMIUM" })).toBe("redirectSignIn");
  });
});
```

**Step 2 — run, expect fail.**

**Step 3 — implement** (`public-access.ts`):

```ts
// Page-level gate for guide routes (middleware admits them; the page decides).
// Signed-in users fall through to the existing role/enrollment logic. Anonymous
// users may read only PUBLIC projects; otherwise they're sent to sign in.
export function resolvePublicLessonAccess(input: {
  hasSession: boolean;
  accessTier: string;
}): "allow" | "redirectSignIn" {
  if (input.hasSession) return "allow";
  return input.accessTier === "PUBLIC" ? "allow" : "redirectSignIn";
}
```

**Step 4 — run, expect pass.**

**Step 5 — wire into the guide pages.** In BOTH guide pages:
- Add `accessTier: true` to the `db.project.findUnique(... select)`.
- Right after `const session = await auth()`, add:
```ts
if (
  resolvePublicLessonAccess({
    hasSession: !!session?.user?.email,
    accessTier: project.accessTier,
  }) === "redirectSignIn"
) {
  redirect("/sign-in");
}
```
(import `redirect` from `next/navigation`; `project` is already resolved before `auth()` in the card page — ensure `accessTier` is selected. In the hub page `session` is resolved after `project`; place the gate after both.)

**Step 6 — verify.** `npx vitest run src/lib/__tests__/public-access.test.ts` (pass) + `npx tsc --noEmit` (clean).

**Step 7 — commit.** `git add -A && git commit -m "feat(access): page-level PUBLIC gate on guide routes"`

> ⚠️ A2+A3 MUST land together: A2 opens guide routes to anonymous; A3 is what stops non-PUBLIC lessons leaking. Do not ship A2 without A3.

---

## Task A4: `x-pathname` request header in middleware

**Files:** Modify `src/proxy.ts`

**Step 1 — implement.** In the `auth(...)` callback, before the returns, forward the path as a header so the root layout can read it:

```ts
const requestHeaders = new Headers(req.headers);
requestHeaders.set("x-pathname", pathname);
// ...and replace `NextResponse.next()` with:
return NextResponse.next({ request: { headers: requestHeaders } });
```
(Keep the existing redirect branches; only the final `next()` carries the header.)

**Step 2 — verify.** `npx tsc --noEmit` (clean). No unit test (middleware); covered by the A5 manual check.

**Step 3 — commit.** `git commit -am "feat(chrome): forward x-pathname header from middleware"`

---

## Task A5: adaptive public chrome (root layout)

**Files:**
- Create: `src/lib/chrome.ts` + test `src/lib/__tests__/chrome.test.ts`
- Create: `src/components/SignUpCta.tsx` (anonymous CTA)
- Modify: `src/app/layout.tsx`; `src/components/MainNav.tsx` (already role-aware)

**Step 1 — failing test** (`chrome.test.ts`):

```ts
import { describe, it, expect } from "vitest";
import { shouldRenderChrome } from "@/lib/chrome";

describe("shouldRenderChrome", () => {
  it("renders for signed-in users on any non-signin route", () => {
    expect(shouldRenderChrome({ pathname: "/learn", signedIn: true })).toBe(true);
  });
  it("renders for anonymous on public routes", () => {
    expect(shouldRenderChrome({ pathname: "/courses", signedIn: false })).toBe(true);
    expect(shouldRenderChrome({ pathname: "/parts", signedIn: false })).toBe(true);
    expect(shouldRenderChrome({ pathname: "/projects/w/v1/guide/REQUIREMENTS", signedIn: false })).toBe(true);
  });
  it("never renders on /sign-in", () => {
    expect(shouldRenderChrome({ pathname: "/sign-in", signedIn: false })).toBe(false);
  });
  it("does not render for anonymous on non-public routes", () => {
    expect(shouldRenderChrome({ pathname: "/learn", signedIn: false })).toBe(false);
  });
});
```

**Step 2 — run, expect fail.**

**Step 3 — implement** (`chrome.ts`):

```ts
import { isPublicPath } from "@/lib/admin-routes";

export function shouldRenderChrome(input: {
  pathname: string;
  signedIn: boolean;
}): boolean {
  if (input.pathname === "/sign-in") return false;
  return input.signedIn || isPublicPath(input.pathname);
}
```

**Step 4 — run, expect pass.**

**Step 5 — SignUpCta** (`SignUpCta.tsx`): a small server component — a gold CTA linking to `/sign-in` with copy "Sign up free — track your progress, earn mastery, get the project files." (Match the bench glass-button styling.)

**Step 6 — wire layout.** In `src/app/layout.tsx`:
- `import { headers } from "next/headers"; import { shouldRenderChrome } from "@/lib/chrome";`
- `const pathname = (await headers()).get("x-pathname") ?? "";`
- Replace `email ?` header/footer guards with `shouldRenderChrome({ pathname, signedIn: !!email }) ?`.
- In the header right cluster: `{email ? <UserMenu .../> : <SignUpCta />}` (and the explicit Sign-out form only when `email`). `MainNav` already hides admin links for non-admins (anonymous → role null → shows Learn? No: gate "Learn" too for anonymous — pass `role` and treat anonymous as public: MainNav should show Courses + Parts for anonymous). Update `MainNav` LINKS to include `{ href: "/courses", label: "Courses", adminOnly: false }` and show Courses/Parts to everyone, Learn only when signed in. Add a `signedIn` prop to MainNav for the Learn link.

**Step 7 — verify.** `npx tsc --noEmit` (clean) + `npx vitest run src/lib/__tests__/chrome.test.ts` (pass).

**Step 8 — commit.** `git add -A && git commit -m "feat(chrome): public header/footer for anonymous on public routes + sign-up CTA"`

---

## Task A6: `/courses` public index

**Files:** Create `src/app/courses/page.tsx` (+ optional `src/components/CourseCard.tsx`)

**Step 1 — implement.** Server component:
- Query: `db.project.findMany({ where: { accessTier: "PUBLIC", publishedRevisionId: { not: null }, archivedAt: null }, select: { slug, name, description, track, level, publishedRevision: { select: { label: true } } } })`.
- Render a bench card grid; each card → `/projects/{slug}/{publishedRevision.label}/guide` with name, track/level chips, description.
- Empty state: "Courses are coming soon."
- (SEO metadata + JSON-LD added in PR B.)

**Step 2 — verify.** `npx tsc --noEmit` (clean). Manual: `/courses` lists WROOM.

**Step 3 — commit.** `git commit -am "feat(courses): public /courses index of PUBLIC projects"`

---

## Task A7: PR A — verify + ship

- `pnpm tsc --noEmit` (clean) + `pnpm vitest run` (all green).
- **Manual (3 roles):** anonymous → `/courses` + WROOM guide load with public chrome + sign-up CTA; a non-PUBLIC project's guide redirects anonymous to `/sign-in`; signed-in learner + admin unchanged; `/sign-in` still chrome-free.
- `git push -u origin feat/public-lessons-seo`; open PR A. (CI must be green; merging deploys to prod — verify in the preview first.)

---

# PR B — SEO surface (on the same branch, after A merges or stacked)

## Task B1: metadataBase + canonical helper + per-page `generateMetadata`

**Files:**
- Create: `src/lib/seo/canonical.ts` + test `src/lib/__tests__/seo-canonical.test.ts`
- Modify: `src/app/layout.tsx` (metadataBase); guide card + hub, project page, `/courses`, `/parts` list + `[id]` (add `generateMetadata`)

**Step 1 — failing test** (canonical):

```ts
import { describe, it, expect } from "vitest";
import { canonicalLessonPath } from "@/lib/seo/canonical";

describe("canonicalLessonPath", () => {
  it("points at the published revision label, not the viewed one", () => {
    expect(canonicalLessonPath({ slug: "wroom", publishedLabel: "v1", stage: "REQUIREMENTS" }))
      .toBe("/projects/wroom/v1/guide/REQUIREMENTS");
  });
  it("returns null when there is no published revision", () => {
    expect(canonicalLessonPath({ slug: "wroom", publishedLabel: null, stage: "REQUIREMENTS" })).toBeNull();
  });
});
```

**Step 2-4 — implement + pass:**
```ts
export function canonicalLessonPath(input: {
  slug: string; publishedLabel: string | null; stage: string;
}): string | null {
  if (!input.publishedLabel) return null;
  return `/projects/${input.slug}/${encodeURIComponent(input.publishedLabel)}/guide/${input.stage}`;
}
```

**Step 5 — metadataBase.** In `layout.tsx` `metadata`: add `metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL ?? "https://foundry.onethousanddrones.com")`. (Add `NEXT_PUBLIC_SITE_URL` to `src/env.ts` as optional.)

**Step 6 — generateMetadata.** Add `export async function generateMetadata({ params })` to each page. Lesson example (card page):
```ts
export async function generateMetadata({ params }): Promise<Metadata> {
  const { slug, revLabel, stage } = await params;
  // resolve project (name, publishedRevision.label) + card (title, lead)
  const title = `${card.title} — ${project.name}`;
  const description = card.lead ?? `${project.name}: ${stage} stage of the build guide.`;
  const canonical = canonicalLessonPath({ slug, publishedLabel: project.publishedRevision?.label ?? null, stage });
  return {
    title, description,
    alternates: canonical ? { canonical } : undefined,
    openGraph: { title, description, type: "article", url: canonical ?? undefined },
    twitter: { card: "summary_large_image", title, description },
  };
}
```
Apply the analogous pattern to hub/project/courses/parts (title from name; description from description/lead).

**Step 7 — verify + commit.** `npx tsc --noEmit`; `npx vitest run src/lib/__tests__/seo-canonical.test.ts`. `git commit -am "feat(seo): metadataBase, canonical-to-published, per-page generateMetadata"`

---

## Task B2: dynamic OG image

**Files:** Create `src/app/projects/[slug]/[revLabel]/guide/[stage]/opengraph-image.tsx` (and a project-level one if desired)

**Step 1 — implement** via `ImageResponse` (1200×630): deep-space bg, gold brand mark/text, project name + stage. Export `size`, `contentType = "image/png"`, `alt`, and `runtime = "nodejs"` (Prisma read for the title — or pass via params only to stay edge-safe; prefer reading just `params` + a DB title with nodejs runtime).

**Step 2 — verify.** `npx tsc --noEmit`; visit the route in dev → PNG renders.

**Step 3 — commit.** `git commit -am "feat(seo): dynamic Open Graph images for lessons"`

---

## Task B3: JSON-LD (Course + Breadcrumb + HowTo)

**Files:**
- Create: `src/lib/seo/jsonld.ts` + test `src/lib/__tests__/seo-jsonld.test.ts`
- Create: `src/components/seo/JsonLd.tsx`
- Modify: lesson page (HowTo + Breadcrumb), hub/project (Course), `/courses` (ItemList)

**Step 1 — failing tests** for `courseJsonLd`, `breadcrumbJsonLd`, `guideCardToHowTo` — assert `@context`/`@type` and that `guideCardToHowTo` maps a `steps` block to `HowToStep[]` with names, and pulls BOM items into `supply` when present.

**Step 2-4 — implement + pass.** Pure builders returning plain objects:
```ts
export function courseJsonLd(p): object { return { "@context":"https://schema.org","@type":"Course", name:p.name, description:p.description, provider:{ "@type":"Organization", name:"One Thousand Drones" }, educationalLevel:p.level ?? undefined }; }
export function breadcrumbJsonLd(items): object { /* BreadcrumbList from [{name,url}] */ }
export function guideCardToHowTo(card, project): object { /* @type HowTo; step: from steps blocks; supply: from BOM */ }
```
`<JsonLd data={obj} />` renders `<script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(data)}} />`.

**Step 5 — inject** the relevant builders into each page's JSX.

**Step 6 — verify + commit.** `npx vitest run src/lib/__tests__/seo-jsonld.test.ts`; `npx tsc --noEmit`. `git commit -am "feat(seo): Course/Breadcrumb/HowTo JSON-LD"`

---

## Task B4: sitemap + robots

**Files:** Create `src/app/sitemap.ts`, `src/app/robots.ts`

**Step 1 — sitemap.ts.** `export default async function sitemap(): Promise<MetadataRoute.Sitemap>` — query PUBLIC published projects → for each, all `GUIDE_STAGES` URLs at the published label + the guide hub; add `/courses`, `/parts`, and each part's `/parts/[id]`; absolute URLs via the site base.

**Step 2 — robots.ts.** `export default function robots(): MetadataRoute.Robots` — `rules: { userAgent: "*", allow: "/", disallow: ["/projects", "/learn", "/api"] }, sitemap: "<base>/sitemap.xml"`. (Note: `/projects` disallow won't block the guide subpaths from being indexed via the sitemap, but keep crawlers off operator pages; if needed, allow `/projects/*/*/guide` explicitly.)

**Step 3 — verify.** `npx tsc --noEmit`; visit `/sitemap.xml` + `/robots.txt` in dev.

**Step 4 — commit.** `git commit -am "feat(seo): dynamic sitemap.xml + robots.txt"`

---

## Task B5: PR B — verify + ship

- `pnpm tsc --noEmit` + `pnpm vitest run` (all green).
- **Manual SEO check (view-source on the public WROOM lesson):** `<link rel="canonical">` → published rev; `og:*` + `twitter:*` tags; the OG image route returns a PNG; JSON-LD blocks (Course/Breadcrumb/HowTo) present and valid (paste into Google's Rich Results Test); `/sitemap.xml` + `/robots.txt` resolve.
- Push; open PR B.

---

## Notes / risks
- `main` auto-deploys to prod — verify each PR in its Vercel preview (esp. anonymous access + chrome) before merge.
- A2 without A3 would leak non-PUBLIC lessons to anonymous — ship them together.
- Schema task (A1) is the only migration; honor the full-tsc + full-vitest discipline.
- Out of scope: entitlements/paywall/payments (Phase 2–3), flagging the other tracks' flagships PUBLIC, HowTo enrichment.
