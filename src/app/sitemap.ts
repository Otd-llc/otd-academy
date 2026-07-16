// Dynamic sitemap.xml for the public SEO surface.
//
// Next App Router serves this at `/sitemap.xml`. It is server-evaluated (no
// "use client") and queries the DB at request/build time. We emit only the
// publicly crawlable URLs:
//   - the static public indexes `/courses` and `/parts`
//   - every part detail `/parts/{id}`
//   - the Library index `/library` plus every published PUBLIC mini-lesson
//     `/library/{slug}`, and the static `/glossary` reference index
//   - for each PUBLIC, published, non-archived project: the guide hub
//     `/projects/{slug}/{label}/guide` plus one URL per guide stage
//     `/projects/{slug}/{label}/guide/{STAGE}` (the 8 GUIDE_STAGES).
//   - for each PREMIUM, published, non-archived project: only the public
//     preview surface — the guide hub plus the card-0 (REQUIREMENTS) lesson.
//     Cards 1+ are paywalled, so they are deliberately omitted (they noindex).
//     FREE projects redirect anonymous visitors, so they are never listed.
//
// `/` is intentionally NOT public (no PUBLIC marketing home yet), so it is
// skipped. All URLs are ABSOLUTE — prefixed with `siteUrl()` (the same origin as
// layout's metadataBase, no trailing slash). Revision labels are encoded with
// `encodeURIComponent` to match the canonical guide URLs.
import type { MetadataRoute } from "next";
import { cacheLife, cacheTag } from "next/cache";

import { db } from "@/lib/db";
import { ONE_HOUR, TAG_MINI_LESSONS, TAG_PROJECTS } from "@/lib/cache-profile";
import { siteUrl } from "@/lib/seo/jsonld";
import { GUIDE_STAGES } from "@/lib/guide-templates/stage-skeletons";
import { BRIEF_KEYS } from "@/lib/brief-pages";
import { TOOLS } from "@/lib/tools/registry";

// DB-backed. The old force-dynamic existed because the CI build ran with a stub
// DATABASE_URL the query couldn't reach; CI now builds against the real ci-test
// branch, and cacheComponents rejects the config outright.
//
// CACHED for an hour: every crawler hits this and its four reads are
// user-independent, so it is a caching target rather than a request-time one.
// Tagged `mini-lessons` as well as `projects` — a new lesson that is missing from
// the sitemap for an hour is a real SEO cost, so a lesson edit refreshes this too.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  "use cache";
  cacheLife(ONE_HOUR);
  cacheTag(TAG_MINI_LESSONS, TAG_PROJECTS);

  const base = siteUrl();
  // Inside `use cache` this resolves once per cache fill, not per request — so
  // lastModified is accurate to the hour. That is strictly more honest than the
  // previous per-request `new Date()`, which told crawlers every URL had just
  // changed on every single fetch.
  const lastModified = new Date();

  const [projects, parts, miniLessons, comingSoonCourses] = await Promise.all([
    db.project.findMany({
      where: {
        accessTier: { in: ["PUBLIC", "PREMIUM"] },
        publishedRevisionId: { not: null },
        archivedAt: null,
      },
      select: {
        slug: true,
        accessTier: true,
        publishedRevision: { select: { label: true } },
      },
    }),
    db.part.findMany({ select: { id: true } }),
    db.miniLesson.findMany({
      where: { published: true, accessTier: "PUBLIC" },
      select: { slug: true, updatedAt: true },
    }),
    // Unbuilt PUBLIC/PREMIUM courses render an indexable preview/waitlist page at
    // `/courses/{slug}` (unique per-course content + the demand-capture form). A
    // BUILT course's `/courses/{slug}` 307-redirects to its guide, which is listed
    // via the `projects` query above, so only the unbuilt ones are emitted as
    // standalone course URLs here.
    db.project.findMany({
      where: {
        accessTier: { in: ["PUBLIC", "PREMIUM"] },
        publishedRevisionId: null,
        archivedAt: null,
      },
      select: { slug: true, updatedAt: true },
    }),
  ]);

  const entries: MetadataRoute.Sitemap = [
    { url: `${base}/courses`, lastModified },
    { url: `${base}/pricing`, lastModified },
    { url: `${base}/parts`, lastModified },
  ];

  // The static public briefs: the index + each brief key (overview, learner).
  entries.push({ url: `${base}/briefs`, lastModified });
  for (const key of BRIEF_KEYS) {
    entries.push({ url: `${base}/briefs/${key}`, lastModified });
  }

  for (const part of parts) {
    entries.push({ url: `${base}/parts/${part.id}`, lastModified });
  }

  // Public Library mini-lessons: the index + every published PUBLIC article.
  entries.push({ url: `${base}/library`, lastModified });
  for (const ml of miniLessons) {
    entries.push({ url: `${base}/library/${ml.slug}`, lastModified: ml.updatedAt });
  }

  // The public glossary index (static reference page).
  entries.push({ url: `${base}/glossary`, lastModified });

  // The public EE-tools hub + each calculator (static, from the TOOLS registry).
  entries.push({ url: `${base}/tools`, lastModified });
  for (const tool of TOOLS) {
    entries.push({ url: `${base}/tools/${tool.slug}`, lastModified });
  }

  // Coming-soon course landings: each unbuilt PUBLIC/PREMIUM course's indexable
  // preview/waitlist page (the per-course SEO surface + the "Tools for this build"
  // cluster links). Built courses 307-redirect `/courses/{slug}` to their guide
  // (already listed), so they are intentionally not emitted here.
  for (const course of comingSoonCourses) {
    entries.push({
      url: `${base}/courses/${course.slug}`,
      lastModified: course.updatedAt,
    });
  }

  for (const project of projects) {
    // PUBLIC/PREMIUM projects are always published (the query filters on
    // publishedRevisionId), so publishedRevision is non-null here; guard the
    // type and skip any anomalous row defensively.
    const label = project.publishedRevision?.label;
    if (!label) continue;
    const guideBase = `${base}/projects/${project.slug}/${encodeURIComponent(
      label,
    )}/guide`;
    entries.push({ url: guideBase, lastModified });
    // PREMIUM projects expose only their public preview: the hub + card-0
    // (REQUIREMENTS) lesson. Cards 1+ live behind the paywall (and noindex), so
    // they are intentionally absent. PUBLIC projects list every stage.
    const stages =
      project.accessTier === "PREMIUM" ? ["REQUIREMENTS"] : GUIDE_STAGES;
    for (const stage of stages) {
      entries.push({ url: `${guideBase}/${stage}`, lastModified });
    }
  }

  return entries;
}
