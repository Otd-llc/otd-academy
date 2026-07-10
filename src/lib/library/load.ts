// Public read path for Library mini-lessons. Anonymous callers only ever see
// published + PUBLIC rows; keeping the query here (one place) means the route
// and the index can't drift on the gating. Returns null when missing/unpublished
// so the route 404s.
import { db } from "@/lib/db";
import { byClusterThenOrdinal, bucketByCluster } from "@/lib/library/cluster-order";

export async function loadPublicMiniLesson(slug: string) {
  return db.miniLesson.findFirst({
    where: { slug, published: true, accessTier: "PUBLIC" },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
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

// The flat list of every published, PUBLIC lesson (feeds the landing's ItemList
// JSON-LD over ALL lessons). Cluster-MAJOR: registry `order` then `clusterOrdinal`
// (byClusterThenOrdinal), so the two clusters group instead of interleave. The
// `updatedAt desc` DB order only sets the tie-break among equal-rank rows (the
// "other" bucket, all clusterOrdinal 0) — freshest-first there.
export async function listPublishedMiniLessons() {
  const rows = await db.miniLesson.findMany({
    where: { published: true, accessTier: "PUBLIC" },
    orderBy: { updatedAt: "desc" },
    select: { slug: true, title: true, summary: true, updatedAt: true, cluster: true, clusterOrdinal: true },
  });
  return byClusterThenOrdinal(rows);
}

// Published, PUBLIC lessons grouped into per-cluster buckets (registry order) for
// the clustered landing, plus a trailing "other" bucket for null/unknown-cluster
// rows that §4.1 MUST render so a null-cluster lesson never silently disappears.
export async function listPublishedByCluster() {
  const rows = await db.miniLesson.findMany({
    where: { published: true, accessTier: "PUBLIC" },
    orderBy: { updatedAt: "desc" },
    // `createdAt` rides along for the landing's "new & updated" rail + featured
    // freshness fallback (pickFeatured / pickFreshRail); bucketByCluster is
    // generic over the row shape, so the extra field passes through untouched.
    select: {
      slug: true,
      title: true,
      summary: true,
      createdAt: true,
      updatedAt: true,
      cluster: true,
      clusterOrdinal: true,
    },
  });
  return bucketByCluster(rows);
}

// Published, PUBLIC lessons WITH content blocks for a Field Guide PDF.
//  • With a `cluster` arg → that cluster's book, DB-sorted by clusterOrdinal asc
//    (scoped to one cluster, so a bare column sort is correct).
//  • No arg → the combined book: cluster-MAJOR via byClusterThenOrdinal so the
//    clusters group (never interleaved). `cluster`/`clusterOrdinal` are always
//    selected so the combined path has the fields to group + drive part dividers.
export async function loadPublicLibraryForBook(cluster?: string) {
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
