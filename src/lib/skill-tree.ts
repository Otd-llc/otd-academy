// Thin DB shell over the pure `computeSkillTree` engine. Loads the non-archived
// projects, the dependency edges, and the viewer's role / completed-enrollments /
// entitlements, maps DB rows to the `Raw*` shapes, then delegates. One pass, no
// N+1 (everything fetched in a single Promise.all).
//
// CACHING (cacheComponents): the split is deliberate. The project GRAPH (projects +
// edges) is user-independent, so it is cached for an hour and every viewer -- anon
// or signed-in -- gets the cached DB read. Only `loadViewer` is per-user, and it
// stays uncached.
//
// Do NOT put `use cache` on buildSkillTree itself: it keys on its arguments, so
// caching a per-user call would silently mint a cache entry per learner. The
// expensive part is the DB read anyway; computeSkillTree is pure CPU.
import { cacheLife, cacheTag } from "next/cache";

import { db } from "@/lib/db";
import { ONE_HOUR } from "@/lib/cache-profile";
import {
  computeSkillTree,
  type RawEdge,
  type RawProject,
  type SkillTree,
  type Viewer,
} from "@/lib/skill-tree-core";

export async function buildSkillTree(
  userId: string | null,
): Promise<SkillTree> {
  const { projects, edges } = await cachedProjectGraph();
  const viewer = await loadViewer(userId);
  return computeSkillTree(projects, edges, viewer);
}

/**
 * Every non-archived project slug, from the cached graph (no query of its own).
 *
 * Exists so callers that take a raw `[slug]` route param can bound their cache keys
 * before hitting a `use cache` function. `use cache` keys on arguments, and a route
 * param matches ANY string — so an unbounded caller mints one entry (and one DB
 * query) per distinct garbage URL a crawler or scanner tries, which is exactly the
 * traffic-scales-with-DB-reads behaviour this caching exists to eliminate.
 */
export async function knownProjectSlugs(): Promise<Set<string>> {
  const { projects } = await cachedProjectGraph();
  return new Set(projects.map((p) => p.slug));
}

// The user-independent half: every non-archived project and every dependency edge,
// mapped to the pure engine's Raw* shapes. Returns plain arrays of scalars, which
// serialize cleanly across the cache boundary (no Set/Map/Decimal -- keep it so).
async function cachedProjectGraph(): Promise<{
  projects: RawProject[];
  edges: RawEdge[];
}> {
  "use cache";
  cacheLife(ONE_HOUR);
  cacheTag("projects");

  const [projectRows, edgeRows] = await Promise.all([
    db.project.findMany({
      where: { archivedAt: null },
      select: {
        slug: true,
        name: true,
        publicTitle: true,
        tagline: true,
        track: true,
        level: true,
        accessTier: true,
        criticalPath: true,
        priceCents: true,
        stripePriceId: true, // both → resolveBuyPriceCents guard (Task 5)
        publishedRevisionId: true,
        publishedRevision: { select: { label: true } }, // outline href (Task 5)
      },
    }),
    db.projectDependency.findMany({
      select: {
        kind: true,
        dependsOnProject: { select: { slug: true } },
        dependentProject: { select: { slug: true } },
      },
    }),
  ]);

  const projects: RawProject[] = projectRows.map((p) => ({
    slug: p.slug,
    name: p.name,
    publicTitle: p.publicTitle,
    tagline: p.tagline,
    track: p.track,
    level: p.level,
    accessTier: p.accessTier,
    criticalPath: p.criticalPath,
    priceCents: p.priceCents,
    stripePriceId: p.stripePriceId,
    published: p.publishedRevisionId != null,
    publishedLabel: p.publishedRevision?.label ?? null,
  }));

  const edges: RawEdge[] = edgeRows.map((e) => ({
    // from = prerequisite (dependsOn), to = dependent.
    fromSlug: e.dependsOnProject.slug,
    toSlug: e.dependentProject.slug,
    kind: e.kind,
  }));

  return { projects, edges };
}

async function loadViewer(userId: string | null): Promise<Viewer> {
  if (userId == null) {
    return {
      signedIn: false,
      isAdmin: false,
      completedSlugs: new Set<string>(),
      entitledSlugs: new Set<string>(),
    };
  }

  const [user, completed, entitled] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { role: true } }),
    db.enrollment.findMany({
      where: { userId, status: { in: ["COMPLETED", "MASTERED"] } },
      select: { project: { select: { slug: true } } },
    }),
    db.entitlement.findMany({
      where: { userId },
      select: { project: { select: { slug: true } } },
    }),
  ]);

  const completedSlugs = new Set<string>(completed.map((e) => e.project.slug));
  // Entitlement.projectId is nullable (bundles, Phase 4) — skip null-project rows.
  const entitledSlugs = new Set<string>();
  for (const e of entitled) {
    if (e.project?.slug) entitledSlugs.add(e.project.slug);
  }

  return {
    signedIn: true,
    isAdmin: user?.role === "ADMIN",
    completedSlugs,
    entitledSlugs,
  };
}
