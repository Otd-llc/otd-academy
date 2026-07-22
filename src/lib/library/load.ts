// Public read path for Library mini-lessons. Anonymous callers only ever see
// published + PUBLIC rows; keeping the query here (one place) means the route
// and the index can't drift on the gating. Returns null when missing/unpublished
// so the route 404s.
//
// CACHING (cacheComponents): these reads are user-independent, so they are cached
// for an hour and tagged. That is the point of the whole migration -- it makes the
// public pages' DB reads a function of TIME (~24/day) instead of TRAFFIC. Edits
// fire updateTag (src/lib/actions/mini-lesson.ts), so the hour is only the fallback,
// not the edit-to-live latency.
//
// A `use cache` function may not read the session -- none of these do. Do not add
// an auth() call to anything in this file.
import { cacheLife, cacheTag } from "next/cache";

import { db } from "@/lib/db";
import { ONE_HOUR, TAG_MINI_LESSONS, miniLessonTag } from "@/lib/cache-profile";
import { byClusterThenOrdinal, bucketByCluster } from "@/lib/library/cluster-order";

/**
 * A published PUBLIC lesson by slug, or null.
 *
 * The membership check is NOT redundant with the query's `where` — it is what bounds
 * the cache. `use cache` keys on arguments, and callers pass the raw `[slug]` route
 * param, which matches ANY string. Without this guard a crawler walking broken links
 * (or a scanner spraying paths) mints one cache entry AND one DB query per distinct
 * garbage string, and those negative entries evict real lessons from the LRU. That
 * would defeat the entire point of this file: DB reads would scale with the number of
 * distinct URLs requested, i.e. with traffic.
 *
 * Checking against the cached row set costs no query of its own — cachedPublishedRows
 * is the same hourly read the index already does — and bounds the cache key space to
 * exactly the lessons that exist. This mirrors loadPublicLibraryForBook, whose caller
 * validates the cluster against the registry before the cached call.
 */
export async function loadPublicMiniLesson(slug: string) {
  const known = await cachedPublishedRows();
  if (!known.some((r) => r.slug === slug)) return null;
  return cachedMiniLesson(slug);
}

async function cachedMiniLesson(slug: string) {
  "use cache";
  cacheLife(ONE_HOUR);
  // Tagged both broadly and narrowly so a single-lesson edit does not blow the
  // whole index, and an index-wide reseed still catches this row.
  cacheTag(TAG_MINI_LESSONS, miniLessonTag(slug));
  return db.miniLesson.findFirst({
    where: { slug, published: true, accessTier: "PUBLIC" },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      cluster: true, // → the lesson page's Field Guide lead-magnet CTA
      contentBlocks: true,
      seoTitle: true,
      seoDescription: true,
      byline: true,
      lastVerifiedAt: true,
      updatedAt: true,
      createdAt: true,
      relatedProjects: {
        orderBy: { ordinal: "asc" },
        select: {
          role: true,
          project: {
            select: {
              slug: true,
              name: true,
              publicTitle: true,
              tagline: true,
              accessTier: true,
              publishedRevisionId: true,
              publishedRevision: { select: { label: true } },
            },
          },
        },
      },
    },
  });
}

// The published, PUBLIC mini-lessons linked to a project (either role) — the
// "concepts behind this build" reading list rendered on the course page. The
// inbound half of the internal-linking spine. Deduped by slug (a lesson may hold
// more than one role for the same project) and title-sorted for a stable order.
export async function loadProjectMiniLessons(projectId: string) {
  "use cache";
  cacheLife(ONE_HOUR);
  cacheTag(TAG_MINI_LESSONS);
  const rows = await db.projectMiniLesson.findMany({
    where: { projectId, miniLesson: { published: true, accessTier: "PUBLIC" } },
    select: { miniLesson: { select: { slug: true, title: true, summary: true } } },
  });
  const seen = new Set<string>();
  const lessons: { slug: string; title: string; summary: string | null }[] = [];
  for (const r of rows) {
    if (seen.has(r.miniLesson.slug)) continue;
    seen.add(r.miniLesson.slug);
    lessons.push(r.miniLesson);
  }
  return lessons.sort((a, b) => a.title.localeCompare(b.title));
}

// Published, PUBLIC lessons grouped into per-cluster buckets (registry order) for
// the clustered landing, plus a trailing "other" bucket for null/unknown-cluster
// rows that §4.1 MUST render so a null-cluster lesson never silently disappears.
//
// NOTE the split: `use cache` sits on the ROW QUERY, not on listPublishedByCluster
// itself, because bucketByCluster returns a Map<string, T[]> and whether Next
// serializes a Map across the cache boundary is not an assumption worth making.
// The Map is built OUTSIDE the boundary, from cached plain rows.
//
// The rows carry Date values (createdAt/updatedAt) and plain scalars, all of which
// serialize cleanly. Keep it that way: if a future select adds a Prisma Decimal, it
// will not cross the boundary.
async function cachedPublishedRows() {
  "use cache";
  cacheLife(ONE_HOUR);
  cacheTag(TAG_MINI_LESSONS);
  const rows = await db.miniLesson.findMany({
    where: { published: true, accessTier: "PUBLIC" },
    orderBy: { updatedAt: "desc" },
    // `createdAt` rides along for the landing's "new & updated" rail + featured
    // freshness fallback (pickFeatured / pickFreshRail).
    //
    // `readingMinutes` / `diagramSrc` are STORED columns, derived from
    // contentBlocks on write by the db.ts client extension. They used to be
    // derived live here, which meant SELECTing all 69 rows' contentBlocks --
    // ~306 kB of wire per call, twice per /library render -- to keep ~18 kB of
    // scalars. Do NOT reintroduce contentBlocks here.
    // See docs/plans/2026-07-15-library-derived-columns.md.
    //
    // bucketByCluster is generic over the row shape, so these pass through.
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
  return rows;
}

export async function listPublishedByCluster() {
  return bucketByCluster(await cachedPublishedRows());
}

/**
 * Thin card metadata for one published PUBLIC lesson — title + hero diagram src.
 * Null when the slug is unknown or unpublished.
 *
 * Costs NO query of its own: it reads the same hourly cached row set the index uses.
 * That matters because the caller is the per-lesson OG image route, which is hit for
 * all 69 lessons by crawlers and social unfurlers. That route used to issue its own
 * `findFirst` selecting `contentBlocks` — the fat column — purely to re-derive the
 * first diagram's src, which is exactly what the stored `diagramSrc` column already
 * holds (both come from firstDiagramSrc; see src/lib/library/derived.ts).
 *
 * Bounded by construction: the lookup is a find over the cached rows, so an unknown
 * slug costs nothing and mints no cache entry.
 */
export async function loadLessonCardMeta(slug: string) {
  const rows = await cachedPublishedRows();
  return rows.find((r) => r.slug === slug) ?? null;
}

// Published, PUBLIC lessons WITH content blocks for a Field Guide PDF.
//  • With a `cluster` arg → that cluster's book, DB-sorted by clusterOrdinal asc
//    (scoped to one cluster, so a bare column sort is correct).
//  • No arg → the combined book: cluster-MAJOR via byClusterThenOrdinal so the
//    clusters group (never interleaved). `cluster`/`clusterOrdinal` are always
//    selected so the combined path has the fields to group + drive part dividers.
export async function loadPublicLibraryForBook(cluster?: string) {
  "use cache";
  cacheLife(ONE_HOUR);
  cacheTag(TAG_MINI_LESSONS);
  const rows = await db.miniLesson.findMany({
    where: { published: true, accessTier: "PUBLIC", ...(cluster ? { cluster } : {}) },
    orderBy: cluster ? { clusterOrdinal: "asc" } : { updatedAt: "desc" },
    select: {
      slug: true,
      title: true,
      summary: true,
      byline: true,
      updatedAt: true,
      contentBlocks: true,
      cluster: true,
      clusterOrdinal: true,
    },
  });
  return cluster ? rows : byClusterThenOrdinal(rows);
}
