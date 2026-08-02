// The ONE definition of the app's cache window, shared by every `use cache` reader.
// The owner specified a 1-HOUR window (2026-07-15).
//
// Written inline rather than as the named profile cacheLife("hours") on purpose: the
// built-in profiles' real numbers are documented only for "default" (5m stale / 15m
// revalidate), so "hours" could silently resolve to a window nobody chose. Inline
// keeps the intent on the page and the value auditable.
//
//   stale      3600  — serve stale for up to an hour while revalidating
//   revalidate 3600  — refresh in the background hourly
//   expire    86400  — hard ceiling; an un-invalidated entry never outlives a day
//
// READ SIDE ONLY — this is for cacheLife(). Do NOT pass it to revalidateTag().
// That function's second parameter is typed `string | CacheLifeConfig`, but
// CacheLifeConfig is `{ expire?: number }`: it reads ONLY `expire` and discards
// `stale`/`revalidate`. Passing this there silently asks for a 24-HOUR grace window
// instead of the hour it looks like it is asking for, and TypeScript cannot catch it
// (a variable reference fires no excess-property check). An earlier revision of this
// file did exactly that, on the false premise that the write side must "name the same
// profile the read side was cached under". It must not; the two are unrelated.
//
// The write side therefore uses updateTag(), which takes no profile at all —
// see src/lib/actions/mini-lesson.ts.
//
// Consumers: src/lib/library/load.ts, src/lib/skill-tree.ts, src/app/sitemap.ts,
// src/app/courses/[slug]/page.tsx, src/app/pricing/page.tsx, src/lib/parts/load.ts.
export const ONE_HOUR = {
  stale: 3600,
  revalidate: 3600,
  expire: 86_400,
} as const;

// Cache tags. Constants rather than inline strings: the reader that SETS a tag and
// the writer that INVALIDATES it live in different files, and a typo on either side
// is silent — the content just goes stale for an hour with nothing to grep for.
export const TAG_MINI_LESSONS = "mini-lessons";
export const TAG_PROJECTS = "projects";
export const TAG_PARTS = "parts";
export const miniLessonTag = (slug: string) => `mini-lesson-${slug}`;
// Per-project guide content (the cached anonymous guide read,
// src/lib/guide/cached-guide-read.ts). Invalidated by every guide-card write —
// see invalidateGuideContent in src/lib/cache-invalidate.ts.
export const guideContentTag = (slug: string) => `guide-content-${slug}`;

/**
 * The public /c/<shareCode> page for one saved hex cluster.
 *
 * CLUSTER-level, keyed on the cluster id rather than the share code, and there
 * is deliberately no per-revision tag. Revisions are immutable, and every event
 * that changes what /c/ renders is cluster-level: archive, unarchive, and
 * account deletion. A per-revision tag would additionally have left 99 stale
 * pages after archiving a 100-revision cluster, where this invalidates all of
 * them at once.
 *
 * Rename is NOT one of those events: /c/ renders summary.nameAtSave, which a
 * rename cannot reach, and the HexCluster.name fallback applies only when
 * userId is null — a state in which nobody can rename.
 */
export const hexClusterTag = (clusterId: string) => `hex-cluster-${clusterId}`;
