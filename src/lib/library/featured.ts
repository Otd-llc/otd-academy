// Editorial merchandising for the /library masthead + the "new & updated" rail.
//
// PURE over the flat lesson list (no DB) so it is unit-testable and the page
// stays a thin view. Input is whatever listPublishedByCluster produced,
// flattened: published + PUBLIC rows carrying slug/title/summary/cluster/
// clusterOrdinal/createdAt/updatedAt.
//
// Why config + fallback (not a `featured` column): the flagship picks are an
// editorial call that changes rarely, so a hand-maintained slug list is simpler
// than a schema column + admin UI — and any slug that unpublishes/renames just
// falls through to a freshness fallback, so the masthead is never blank.

export type LessonMeta = {
  slug: string;
  title: string;
  summary: string | null;
  cluster: string | null;
  clusterOrdinal: number;
  createdAt: Date;
  updatedAt: Date;
};

// The masthead features, in order (lead first). EDITORIAL — hand-picked flagship
// guides that should span two different clusters (a brand hook + a foundational
// entry). Edit this list to re-merchandise; unknown/unpublished slugs are
// skipped, not rendered.
export const FEATURED_SLUGS: string[] = [
  "control-a-drone-with-your-brain",
  "voltage-current-resistance",
];

const FEATURE_COUNT = 2;
const DAY_MS = 86_400_000;

// Sort a COPY by freshness: updatedAt desc, then createdAt desc, then a stable
// registry-ish tie-break (ordinal, slug). Dates in this DB are day-granular, so
// ties are common and MUST resolve deterministically or the masthead/rail would
// flicker between builds.
function freshestFirst(lessons: LessonMeta[]): LessonMeta[] {
  return [...lessons].sort(
    (a, b) =>
      b.updatedAt.getTime() - a.updatedAt.getTime() ||
      b.createdAt.getTime() - a.createdAt.getTime() ||
      a.clusterOrdinal - b.clusterOrdinal ||
      a.slug.localeCompare(b.slug),
  );
}

// NEW = created and last-updated on the same day (never revised since publish);
// otherwise it has been edited after publish → UPD. Both are honest freshness
// signals; neither is decorative.
function isNew(l: LessonMeta): boolean {
  return l.updatedAt.getTime() - l.createdAt.getTime() < DAY_MS;
}

// Resolve the masthead features: the configured slugs that are live, then — if
// fewer than FEATURE_COUNT resolve — topped up with the freshest lessons from
// clusters not already represented (so the two features never share a cluster).
// A tiny library (one cluster) is the only case that may repeat a cluster, and
// only to avoid rendering a short masthead.
export function pickFeatured(lessons: LessonMeta[]): LessonMeta[] {
  const bySlug = new Map(lessons.map((l) => [l.slug, l]));
  const picked: LessonMeta[] = [];
  const usedClusters = new Set<string | null>();

  for (const slug of FEATURED_SLUGS) {
    const l = bySlug.get(slug);
    if (l && !picked.includes(l)) {
      picked.push(l);
      usedClusters.add(l.cluster);
      if (picked.length === FEATURE_COUNT) return picked;
    }
  }
  const fresh = freshestFirst(lessons);
  for (const l of fresh) {
    if (picked.length === FEATURE_COUNT) break;
    if (picked.includes(l) || usedClusters.has(l.cluster)) continue;
    picked.push(l);
    usedClusters.add(l.cluster);
  }
  // Last resort (single-cluster library): allow a same-cluster fill so the
  // masthead is never short.
  for (const l of fresh) {
    if (picked.length === FEATURE_COUNT) break;
    if (!picked.includes(l)) picked.push(l);
  }
  return picked;
}

export type FreshLesson = LessonMeta & { freshTag: "NEW" | "UPD" };

// The "new & updated" rail: the freshest guides, at most `perCluster` per cluster
// (so the rail spans the library instead of stacking one cluster's rows),
// newest first, capped at `limit`.
export function pickFreshRail(
  lessons: LessonMeta[],
  { limit = 6, perCluster = 1 }: { limit?: number; perCluster?: number } = {},
): FreshLesson[] {
  const counts = new Map<string | null, number>();
  const rail: FreshLesson[] = [];
  for (const l of freshestFirst(lessons)) {
    if (rail.length === limit) break;
    const n = counts.get(l.cluster) ?? 0;
    if (n >= perCluster) continue;
    counts.set(l.cluster, n + 1);
    rail.push({ ...l, freshTag: isNew(l) ? "NEW" : "UPD" });
  }
  return rail;
}
