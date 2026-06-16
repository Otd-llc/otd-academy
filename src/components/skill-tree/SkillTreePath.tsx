// The guided skill-tree path — a honeycomb spine (server component, NO "use client").
//
// One guided "main quest" (not the engineer's branching matrix). The critical
// path runs top→bottom as a column of hexagon medallions threaded by a copper
// trace; each step's readable title/tagline sit in a slab beside its hex. Off-
// path projects tuck under their nearest on-path prerequisite in a collapsed
// "+N related builds" disclosure; orphans fall into a final "More builds". The
// two capstones (EEG BCI + fleet hub) are the destination — a "THE BUILD"
// divider marks the arrival and their cards are emphasised. Renders at every
// breakpoint, so each node has exactly one DOM id (`#node-<slug>`).
//
// Hex (state at a glance) = HexMedallion; slab (the readable detail) =
// SkillNodeCard. The honeycomb/copper-trace motif is OTD's hive + PCB theme.

import { SkillNodeCard } from "@/components/skill-tree/SkillNodeCard";
import { HexMedallion } from "@/components/skill-tree/HexMedallion";
import { criticalPathOrder } from "@/lib/skill-tree-core";
import type { SkillNode, SkillTree } from "@/lib/skill-tree-core";
import type { HrefViewer } from "@/lib/skill-tree-href";

export interface SkillTreePathProps {
  tree: SkillTree;
  viewer: HrefViewer;
}

// The capstones — the destination the path converges on. Slug-keyed (titles are
// clean; the celebration is presentational).
const CAPSTONE_SLUGS = new Set(["l3-01-eeg-front-end", "l3-05-wireless-hub"]);

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

  const path = criticalPathOrder(tree.nodes, tree.edges);

  // Off-path nodes attach under their nearest on-path prerequisite; the rest are
  // orphans. (Partition carried over from the prior spine — exhaustive, no drops.)
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

  const firstCapstoneIdx = path.findIndex((n) => CAPSTONE_SLUGS.has(n.slug));

  return (
    <div className="mx-auto max-w-2xl">
      <ol className="flex flex-col gap-8">
        {path.map((node, i) => {
          const isCapstone = CAPSTONE_SLUGS.has(node.slug);
          const isLast = i === path.length - 1;
          const children = childrenByParent.get(node.slug) ?? [];
          return (
            <li key={node.slug} className="flex flex-col gap-5">
              {/* Destination divider — just before the first capstone. */}
              {i === firstCapstoneIdx && firstCapstoneIdx > 0 ? (
                <div className="flex items-center gap-3">
                  <span className="h-px flex-1 bg-command-gold/40" />
                  <span className="font-mono text-xs uppercase tracking-[0.2em] text-command-gold">
                    ★ The build · your destination
                  </span>
                  <span className="h-px flex-1 bg-command-gold/40" />
                </div>
              ) : null}

              <div className="flex gap-4">
                {/* Hex rail column: medallion + the copper trace down to the next. */}
                <div className="flex w-[72px] shrink-0 flex-col items-center">
                  <HexMedallion
                    state={node.state}
                    track={node.track}
                    level={node.level}
                    isNext={node.isNext}
                    isCapstone={isCapstone}
                  />
                  {!isLast ? (
                    <span
                      aria-hidden="true"
                      className="mt-2 w-px flex-1 bg-command-gold/25"
                      style={{ marginBottom: "-2rem" }}
                    />
                  ) : null}
                </div>

                {/* Slab: the readable detail. Capstones get an emphasised frame. */}
                <div className="min-w-0 flex-1">
                  {i === 0 ? (
                    <span className="mb-2 inline-block font-mono text-[10px] uppercase tracking-[0.2em] text-command-gold">
                      Start here ↓
                    </span>
                  ) : null}
                  {isCapstone ? (
                    <span className="mb-2 inline-block rounded border border-command-gold/50 bg-command-gold/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-command-gold">
                      ★ Capstone
                    </span>
                  ) : null}
                  <div
                    className={
                      isCapstone
                        ? "rounded-xl p-px shadow-[0_0_18px_-2px_var(--color-command-gold)] ring-1 ring-command-gold/40"
                        : undefined
                    }
                  >
                    <SkillNodeCard node={node} viewer={viewer} />
                  </div>
                  <RelatedBuilds
                    label={`+${children.length} related builds`}
                    nodes={children}
                    viewer={viewer}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <RelatedBuilds
        label={`More builds (${orphans.length})`}
        nodes={orphans}
        viewer={viewer}
      />
    </div>
  );
}
