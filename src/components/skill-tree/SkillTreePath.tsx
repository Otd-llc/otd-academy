// The guided skill-tree path (server component — NO "use client").
//
// Replaces the old track×level matrix + SVG edge overlay. Research (and your
// GTM notes) say a public curriculum reads better as a single guided "main
// quest" than as the engineer's branching DAG: lead with ONE path from the
// first board to the capstones, with side projects as offshoots. This renders
// at EVERY breakpoint (no desktop/mobile split, so each node has exactly one
// DOM id — the `#node-<slug>` anchor is unambiguous).
//
// Structure:
//   • The main path = `criticalPathOrder(...)` (the SAME ordering that drives
//     `isNext`), top→bottom, threaded by a vertical rule. Each step is a
//     full-width `SkillNodeCard`.
//   • Off-path projects attach under their nearest on-path prerequisite in a
//     collapsed native `<details>` "+N related builds" (no client JS). Anything
//     with no on-path prereq falls into a final "More builds" details so nothing
//     is dropped.
//   • The two capstones (the EEG BCI + the fleet hub) are the destination — a
//     "THE BUILD" divider marks where the path arrives at them.
//
// Tokens match SkillNodeCard / CurriculumDag: panel-border, deep-space,
// command-gold, text-muted, font-mono, font-display.

import { SkillNodeCard } from "@/components/skill-tree/SkillNodeCard";
import { criticalPathOrder } from "@/lib/skill-tree-core";
import type { SkillNode, SkillTree } from "@/lib/skill-tree-core";
import type { HrefViewer } from "@/lib/skill-tree-href";

export interface SkillTreePathProps {
  tree: SkillTree;
  viewer: HrefViewer;
}

// The capstones — the destination the whole path converges on. Slug-keyed (the
// title is clean; the celebration is presentational), mirrors SkillNodeCard.
const CAPSTONE_SLUGS = new Set(["l3-01-eeg-front-end", "l3-05-wireless-hub"]);

// A collapsed disclosure of off-path builds, attached under a path step (or
// standalone for the orphan bucket). Native <details>/<summary> — no client JS.
function RelatedBuilds({
  label,
  nodes,
  viewer,
}: {
  label: string;
  nodes: SkillNode[];
  viewer: HrefViewer;
}) {
  if (nodes.length === 0) return null;
  return (
    <details className="mt-3 rounded border border-panel-border bg-deep-space/40">
      <summary className="cursor-pointer select-none px-3 py-2 font-mono text-xs uppercase tracking-wider text-muted marker:text-command-gold">
        {label}
      </summary>
      <div className="flex flex-col gap-2 border-t border-panel-border p-3">
        {nodes.map((n) => (
          <SkillNodeCard key={n.slug} node={n} viewer={viewer} />
        ))}
      </div>
    </details>
  );
}

export function SkillTreePath({ tree, viewer }: SkillTreePathProps) {
  if (tree.nodes.length === 0) return null;

  // The main path, in critical-path (topological) order — same ordering as
  // `isNext`, so the anchored next step is always on the path.
  const path = criticalPathOrder(tree.nodes, tree.edges);

  // Off-path nodes attach under their nearest on-path prerequisite; the rest
  // collect into the orphan bucket. (Logic carried over from the prior spine.)
  const pathSlugs = new Set(path.map((n) => n.slug));
  const offPath = tree.nodes.filter((n) => !pathSlugs.has(n.slug));
  const childrenByParent = new Map<string, SkillNode[]>();
  const orphans: SkillNode[] = [];
  for (const node of offPath) {
    let parentSlug: string | null = null;
    for (const e of tree.edges) {
      if (e.toSlug === node.slug && pathSlugs.has(e.fromSlug)) {
        parentSlug = e.fromSlug;
        break;
      }
    }
    if (parentSlug === null) {
      orphans.push(node);
      continue;
    }
    const arr = childrenByParent.get(parentSlug);
    if (arr) arr.push(node);
    else childrenByParent.set(parentSlug, [node]);
  }

  // Where the path first reaches a capstone — we drop a "THE BUILD" divider
  // there to mark the destination. -1 if (defensively) no capstone is on-path.
  const firstCapstoneIdx = path.findIndex((n) => CAPSTONE_SLUGS.has(n.slug));

  return (
    <div className="mx-auto max-w-2xl">
      <ol className="flex flex-col gap-6 border-l border-panel-border pl-5 sm:pl-6">
        {path.map((node, i) => (
          <li key={node.slug} className="relative">
            {/* Destination divider — rendered just before the first capstone. */}
            {i === firstCapstoneIdx && firstCapstoneIdx > 0 ? (
              <div className="mb-6 -ml-5 flex items-center gap-3 sm:-ml-6">
                <span className="h-px flex-1 bg-command-gold/40" />
                <span className="font-mono text-xs uppercase tracking-[0.2em] text-command-gold">
                  ★ The build · your destination
                </span>
                <span className="h-px flex-1 bg-command-gold/40" />
              </div>
            ) : null}

            {/* Tick on the rail. The first step gets a "START" cue. */}
            <span
              aria-hidden="true"
              className="absolute -left-[1.45rem] top-5 h-2.5 w-2.5 rounded-full border border-panel-border bg-deep-space sm:-left-[1.7rem]"
            />
            {i === 0 ? (
              <span className="mb-2 inline-block font-mono text-[10px] uppercase tracking-[0.2em] text-command-gold">
                Start here ↓
              </span>
            ) : null}

            <SkillNodeCard node={node} viewer={viewer} />
            <RelatedBuilds
              label={`+${childrenByParent.get(node.slug)?.length ?? 0} related builds`}
              nodes={childrenByParent.get(node.slug) ?? []}
              viewer={viewer}
            />
          </li>
        ))}
      </ol>

      <RelatedBuilds
        label={`More builds (${orphans.length})`}
        nodes={orphans}
        viewer={viewer}
      />
    </div>
  );
}
