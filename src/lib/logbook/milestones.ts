// Pure milestone decision for the lesson-completion cascade (design §5/§7).
// Given the user's completed lesson slugs and the published slugs grouped by
// cluster, return which clusters are fully complete and whether the whole library
// is done. The award engine + BadgeEarned PK dedupe downstream, so returning an
// already-earned milestone here is a safe no-op — this helper only answers
// "what is complete right now against the CURRENT content set" (§7 grandfathering:
// growing the library reopens live completion but never revokes an earned patch).
export function milestonesFor(
  completedSlugs: Set<string>,
  publishedByCluster: Map<string, string[]>,
): { clusterKeys: string[]; libraryComplete: boolean } {
  const clusterKeys: string[] = [];
  const all: string[] = [];
  for (const [key, slugs] of publishedByCluster) {
    if (slugs.length === 0) continue; // empty clusters ignored (never emitted)
    for (const s of slugs) all.push(s);
    if (slugs.every((s) => completedSlugs.has(s))) clusterKeys.push(key);
  }
  const libraryComplete = all.length > 0 && all.every((s) => completedSlugs.has(s));
  return { clusterKeys, libraryComplete };
}
