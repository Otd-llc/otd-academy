// Mobile critical-path spine (server component — NO "use client").
//
// The narrow (`<lg`) counterpart to `SkillTreeGrid`. Where the grid lays the
// whole DAG into a four-track matrix (`hidden lg:block`), this renders a single
// vertical column: the critical-path spine, top→bottom in the same topological
// order the core computes (`criticalPathOrder`, the shared source of truth that
// also drives `isNext`). The spine is `lg:hidden` — the two views never show at
// once. This mirrors CurriculumDag's responsive split.
//
// Each spine node is a full-width `SkillNodeCard`, stacked vertically and joined
// by a thin vertical rule (pure CSS — a left border on the rail, no SVG).
//
// Off-spine nodes (criticalPath === false — the bench tools + any parallel
// non-critical builds) don't get their own spine slot. Each attaches under its
// nearest spine parent (a prerequisite that IS on the spine) inside a collapsed
// native `<details>` "+N related builds" disclosure — no client JS. Off-spine
// nodes with no on-spine prerequisite fall into a final "More builds" details so
// nothing is silently dropped.
//
// Tokens match the SkillTreeGrid / SkillNodeCard / CurriculumDag vocabulary:
// panel-border, deep-space, command-gold, text-muted, font-mono.

import { SkillNodeCard } from "@/components/skill-tree/SkillNodeCard";
import { criticalPathOrder } from "@/lib/skill-tree-core";
import type { SkillNode, SkillTree } from "@/lib/skill-tree-core";
import type { HrefViewer } from "@/lib/skill-tree-href";

export interface SkillTreeSpineProps {
  tree: SkillTree;
  viewer: HrefViewer;
}

// A small collapsed disclosure of off-spine builds, attached under a spine node
// (or used standalone for the orphan bucket). Native <details>/<summary> — no
// client JS. Renders nothing when there are no nodes to show.
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
          <SkillNodeCard
            key={n.slug}
            node={n}
            viewer={viewer}
            idPrefix="spine-node"
          />
        ))}
      </div>
    </details>
  );
}

export function SkillTreeSpine({ tree, viewer }: SkillTreeSpineProps) {
  // Empty/missing — render nothing.
  if (tree.nodes.length === 0) return null;

  // Spine nodes in critical-path (topological) order — the SAME ordering the
  // core uses for `isNext`, so the node anchored by Task 9 (`isNext`) lands on
  // the spine. `criticalPathOrder` already filters to `criticalPath === true`.
  const spine = criticalPathOrder(tree.nodes, tree.edges);

  // Off-spine nodes = everything not on the spine. We attach each to its nearest
  // on-spine prerequisite; whatever has none falls into the orphan bucket.
  const spineSlugs = new Set(spine.map((n) => n.slug));
  const offSpine = tree.nodes.filter((n) => !spineSlugs.has(n.slug));

  // For each off-spine node, find an on-spine prerequisite (an incoming `from`
  // edge whose source is on the spine) and attach the node under it. Children
  // are bucketed by spine-parent slug; orphans (no on-spine prereq) collect for
  // the bottom "More builds" details.
  const childrenByParent = new Map<string, SkillNode[]>();
  const orphans: SkillNode[] = [];

  for (const node of offSpine) {
    let parentSlug: string | null = null;
    for (const e of tree.edges) {
      if (e.toSlug === node.slug && spineSlugs.has(e.fromSlug)) {
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

  return (
    // Mobile only (<lg): the grid (`hidden lg:block`) takes over at lg+.
    <div className="lg:hidden">
      {/* The spine rail: a left border draws the continuous vertical rule that
          threads the stacked cards together. Each node sits in a row offset from
          the rule, with its related-builds disclosure tucked beneath it. */}
      <ol className="flex flex-col gap-6 border-l border-panel-border pl-5">
        {spine.map((node) => (
          <li key={node.slug} className="relative">
            {/* Node tick on the rail. */}
            <span
              aria-hidden="true"
              className="absolute -left-[1.4rem] top-5 h-2 w-2 rounded-full border border-panel-border bg-deep-space"
            />
            <SkillNodeCard node={node} viewer={viewer} idPrefix="spine-node" />
            <RelatedBuilds
              label={`+${childrenByParent.get(node.slug)?.length ?? 0} related builds`}
              nodes={childrenByParent.get(node.slug) ?? []}
              viewer={viewer}
            />
          </li>
        ))}
      </ol>

      {/* Orphans — off-spine nodes with no on-spine prerequisite. Surfaced in a
          final details so they're never dropped. */}
      <RelatedBuilds
        label={`More builds (${orphans.length})`}
        nodes={orphans}
        viewer={viewer}
      />
    </div>
  );
}
