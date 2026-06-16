// Pure, DB-free, React-free skill-tree state engine.
//
// Computes per-node access state, the single "next" node, and (internally) the
// deterministic critical-path order. Mirrors the tier semantics of
// `resolveLessonAccess` in `src/lib/public-access.ts` — do not diverge.

export type NodeState =
  | "done"
  | "available"
  | "locked-prereq"
  | "locked-account" // anon viewing a FREE node — "Sign in (free)" funnel
  | "locked-paywall"
  | "preview"
  | "coming-soon";

export interface RawProject {
  slug: string;
  name: string;
  publicTitle: string | null;
  tagline: string | null;
  track: "SENSE" | "ACT" | "POWER" | "COMMS" | null;
  level: "L1" | "L2" | "L3" | null;
  accessTier: "PUBLIC" | "FREE" | "PREMIUM";
  criticalPath: boolean;
  priceCents: number | null;
  published: boolean;
  // Label of the published Revision (for the project-outline href in Task 5).
  // Carried through untouched — ignored by all state logic.
  publishedLabel: string | null;
}

export interface RawEdge {
  fromSlug: string; // dependsOn (prerequisite)
  toSlug: string; // dependent
  kind: "FOUNDATION" | "DE_RISK" | "SHARED_BLOCK";
}

export interface Viewer {
  signedIn: boolean;
  isAdmin: boolean;
  completedSlugs: Set<string>; // COMPLETED|MASTERED enrollments
  entitledSlugs: Set<string>; // PREMIUM unlocks
}

export interface SkillNode extends RawProject {
  title: string; // publicTitle ?? name
  state: NodeState;
  isNext: boolean;
  missingPrereqs: { slug: string; title: string }[];
}

export interface SkillTree {
  nodes: SkillNode[];
  edges: RawEdge[];
}

const titleOf = (p: RawProject): string => p.publicTitle ?? p.name;

// Tie-break ordinals for the critical-path frontier.
const LEVEL_ORDER: Record<string, number> = { L1: 0, L2: 1, L3: 2 };
const TRACK_ORDER: Record<string, number> = {
  COMMS: 0,
  ACT: 1,
  SENSE: 2,
  POWER: 3,
};

function levelRank(p: RawProject): number {
  return p.level ? (LEVEL_ORDER[p.level] ?? 99) : 99;
}
function trackRank(p: RawProject): number {
  return p.track ? (TRACK_ORDER[p.track] ?? 99) : 99;
}

// Frontier tie-break: level asc, then track asc, then slug asc.
function tieBreak(a: RawProject, b: RawProject): number {
  const l = levelRank(a) - levelRank(b);
  if (l !== 0) return l;
  const t = trackRank(a) - trackRank(b);
  if (t !== 0) return t;
  return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
}

/**
 * Deterministic critical-path order via Kahn's algorithm, restricted to
 * `criticalPath === true` nodes. Edges touching non-critical-path nodes are
 * ignored. Frontier ties broken by (level, track, slug). Defensive against
 * cycles / missing nodes: if Kahn stalls, the remaining nodes are appended in
 * tie-break order so the function always terminates and returns every node.
 *
 * Generic over `RawProject` so callers can pass already-computed `SkillNode`s
 * (which extend `RawProject`) and get them back in critical-path order — the
 * single source of truth shared by `computeSkillTree`'s `isNext` walk and the
 * mobile spine (`SkillTreeSpine`).
 */
export function criticalPathOrder<T extends RawProject>(
  projects: T[],
  edges: RawEdge[],
): T[] {
  return topoOrder(
    projects.filter((p) => p.criticalPath),
    edges,
  );
}

/**
 * Topologically order an ARBITRARY node subset by the same rules as
 * `criticalPathOrder` (Kahn; frontier tie-broken by level → track → slug; only
 * edges fully within the subset contribute; cycle/missing nodes appended in
 * tie-break order so it always terminates). Used to order a single learning
 * path's prerequisite chain (`skill-paths.ts`).
 */
export function topoOrder<T extends RawProject>(
  spine: T[],
  edges: RawEdge[],
): T[] {
  const bySlug = new Map(spine.map((p) => [p.slug, p]));

  const indegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const p of spine) {
    indegree.set(p.slug, 0);
    adj.set(p.slug, []);
  }
  for (const e of edges) {
    // Only edges fully within the spine contribute to ordering.
    if (!bySlug.has(e.fromSlug) || !bySlug.has(e.toSlug)) continue;
    if (e.fromSlug === e.toSlug) continue;
    adj.get(e.fromSlug)!.push(e.toSlug);
    indegree.set(e.toSlug, (indegree.get(e.toSlug) ?? 0) + 1);
  }

  const result: T[] = [];
  const placed = new Set<string>();
  // Active frontier = spine nodes with indegree 0, kept sorted by tieBreak.
  let frontier = spine.filter((p) => (indegree.get(p.slug) ?? 0) === 0);

  while (frontier.length > 0) {
    frontier.sort(tieBreak);
    const next = frontier.shift()!;
    if (placed.has(next.slug)) continue;
    placed.add(next.slug);
    result.push(next);
    for (const toSlug of adj.get(next.slug) ?? []) {
      const d = (indegree.get(toSlug) ?? 0) - 1;
      indegree.set(toSlug, d);
      if (d === 0) {
        const p = bySlug.get(toSlug);
        if (p && !placed.has(toSlug)) frontier.push(p);
      }
    }
  }

  // Defensive: any node Kahn couldn't place (cycle / corrupt indegree) is
  // appended in tie-break order so the result still covers the whole spine.
  if (placed.size < spine.length) {
    const remaining = spine
      .filter((p) => !placed.has(p.slug))
      .sort(tieBreak);
    result.push(...remaining);
  }

  return result;
}

/**
 * Compute the access state of a single node. Top-down, first match wins —
 * total over every (tier × session × admin × entitled × prereq × published)
 * combination.
 */
function computeState(
  p: RawProject,
  viewer: Viewer,
  hasUnmetPrereq: boolean,
): NodeState {
  // 1. Unpublished — nothing actionable for anyone.
  if (!p.published) return "coming-soon";
  // 2. Already completed.
  if (viewer.completedSlugs.has(p.slug)) return "done";
  // 3. Admin sees every published node as actionable.
  if (viewer.isAdmin) return "available";
  // 4. Anon short-circuit — tier-only, skips ALL prereq logic.
  if (!viewer.signedIn) {
    if (p.accessTier === "PUBLIC") return "preview";
    if (p.accessTier === "FREE") return "locked-account";
    return "locked-paywall"; // PREMIUM
  }
  // 5. Signed-in PREMIUM without entitlement.
  if (p.accessTier === "PREMIUM" && !viewer.entitledSlugs.has(p.slug)) {
    return "locked-paywall";
  }
  // 6. Signed-in with an unsatisfied prereq (even an entitled PREMIUM node).
  if (hasUnmetPrereq) return "locked-prereq";
  // 7. Otherwise actionable.
  return "available";
}

export function computeSkillTree(
  projects: RawProject[],
  edges: RawEdge[],
  viewer: Viewer,
): SkillTree {
  const bySlug = new Map(projects.map((p) => [p.slug, p]));

  // Incoming prerequisite edges per dependent slug.
  const incoming = new Map<string, string[]>();
  for (const e of edges) {
    const arr = incoming.get(e.toSlug) ?? [];
    arr.push(e.fromSlug);
    incoming.set(e.toSlug, arr);
  }

  const nodes: SkillNode[] = projects.map((p) => {
    const prereqSlugs = incoming.get(p.slug) ?? [];
    const missingPrereqs = prereqSlugs
      .filter((fromSlug) => !viewer.completedSlugs.has(fromSlug))
      .map((fromSlug) => {
        const dep = bySlug.get(fromSlug);
        return {
          slug: fromSlug,
          title: dep ? titleOf(dep) : fromSlug,
        };
      });

    const state = computeState(p, viewer, missingPrereqs.length > 0);

    return {
      ...p,
      title: titleOf(p),
      state,
      isNext: false,
      missingPrereqs,
    };
  });

  // isNext: at most one, walking critical-path order.
  const nodeBySlug = new Map(nodes.map((n) => [n.slug, n]));
  const order = criticalPathOrder(projects, edges);
  let nextSlug: string | null = null;
  for (const p of order) {
    const n = nodeBySlug.get(p.slug);
    if (!n) continue;
    if (viewer.signedIn) {
      // Signed-in (incl. admin): first node whose state is available.
      if (n.state === "available") {
        nextSlug = n.slug;
        break;
      }
    } else {
      // Anon: first PUBLIC, non-done, preview node.
      if (
        p.accessTier === "PUBLIC" &&
        n.state !== "done" &&
        n.state === "preview"
      ) {
        nextSlug = n.slug;
        break;
      }
    }
  }
  if (nextSlug) {
    nodeBySlug.get(nextSlug)!.isNext = true;
  }

  return { nodes, edges };
}
