// A single learning path, rendered as a honeycomb spine (server component).
//
// Takes an ALREADY-ORDERED list of the path's nodes (its goal + prerequisite
// chain, topo-sorted by `resolvePath`) and lays them out as one clean vertical
// list: hex medallions threaded by a copper trace, the readable title/tagline
// slab beside each. The path's GOAL (the build it leads to) is the destination
// — a "THE BUILD" divider marks it and its card is emphasised. The first
// still-available step is the path-local "next" (pulsing hex). Renders at every
// breakpoint, so each node has exactly one DOM id (`#node-<slug>`).
//
// No branch/disclosure machinery: branches are *other paths* now, so a path is
// a straight line. Ordering lives in `skill-paths.ts`; this is a pure renderer.

import { SkillNodeCard } from "@/components/skill-tree/SkillNodeCard";
import { HexMedallion } from "@/components/skill-tree/HexMedallion";
import type { SkillNode } from "@/lib/skill-tree-core";
import type { HrefViewer } from "@/lib/skill-tree-href";

export interface SkillTreePathProps {
  nodes: SkillNode[]; // pre-ordered (resolvePath)
  goalSlug?: string; // the build this path leads to (emphasised); absent for bench
  viewer: HrefViewer;
}

export function SkillTreePath({ nodes, goalSlug, viewer }: SkillTreePathProps) {
  if (nodes.length === 0) return null;

  const goalIdx = goalSlug ? nodes.findIndex((n) => n.slug === goalSlug) : -1;
  // Path-local "next": the first still-available step in this path's order.
  const nextIdx = nodes.findIndex((n) => n.state === "available");

  return (
    <div className="mx-auto max-w-2xl">
      <ol className="flex flex-col gap-8">
        {nodes.map((node, i) => {
          const isGoal = i === goalIdx;
          const isLast = i === nodes.length - 1;
          return (
            <li key={node.slug} className="flex flex-col gap-5">
              {/* Destination divider — just before the path's goal build. */}
              {isGoal && goalIdx > 0 ? (
                <div className="flex items-center gap-3">
                  <span className="h-px flex-1 bg-command-gold/40" />
                  <span className="font-mono text-xs uppercase tracking-[0.2em] text-command-gold">
                    ★ Your destination
                  </span>
                  <span className="h-px flex-1 bg-command-gold/40" />
                </div>
              ) : null}

              <div className="flex gap-4">
                {/* Hex rail: medallion + copper trace down to the next step. */}
                <div className="flex w-[72px] shrink-0 flex-col items-center">
                  <HexMedallion
                    state={node.state}
                    track={node.track}
                    level={node.level}
                    isNext={i === nextIdx}
                    isCapstone={isGoal}
                  />
                  {!isLast ? (
                    <span
                      aria-hidden="true"
                      className="mt-2 w-px flex-1 bg-command-gold/25"
                      style={{ marginBottom: "-2rem" }}
                    />
                  ) : null}
                </div>

                {/* Slab: the readable detail. The goal build gets a gold frame. */}
                <div className="min-w-0 flex-1">
                  {i === 0 ? (
                    <span className="mb-2 inline-block font-mono text-[10px] uppercase tracking-[0.2em] text-command-gold">
                      Start here ↓
                    </span>
                  ) : null}
                  {isGoal ? (
                    <span className="mb-2 inline-block rounded border border-command-gold/50 bg-command-gold/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-command-gold">
                      ★ The goal
                    </span>
                  ) : null}
                  <div
                    className={
                      isGoal
                        ? "rounded-xl p-px shadow-[0_0_18px_-2px_var(--color-command-gold)] ring-1 ring-command-gold/40"
                        : undefined
                    }
                  >
                    <SkillNodeCard node={node} viewer={viewer} />
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
