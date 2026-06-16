// Desktop skill-tree grid (server component — NO "use client").
//
// Lays the curriculum skill-tree nodes into a CSS grid:
//
//   • Columns: COMMS / ACT / SENSE / POWER (the four tracks)
//   • Rows:    L1 / L2 / L3 (levels)
//   • Root row: L1.01 (`l1-01-wroom-breakout`) spans the full width above the
//     track columns — it's the DAG root every track descends from.
//
// Bucketing mirrors `CurriculumDag.tsx`: nodes are bucketed into `track:level`
// cells, with an `Unassigned` bucket catching any node missing a track or level
// so nothing is silently dropped. This is the DESKTOP view (`hidden lg:block`);
// the mobile spine is built separately in Task 8.
//
// Each node renders via `SkillNodeCard` (which sets `id="node-${slug}"` on its
// own outer element). The grid container is `relative` so Task 7's decorative
// SVG edge overlay can absolutely-position itself over the grid and locate the
// node anchors by id.
//
// Tokens match the CurriculumDag / /courses vocabulary: panel-border,
// deep-space, command-gold, status-green, signal-blue, alert-red, text-muted,
// font-mono.

import { SkillNodeCard } from "@/components/skill-tree/SkillNodeCard";
import { SkillTreeEdges } from "@/components/skill-tree/SkillTreeEdges";
import type { SkillNode, SkillTree } from "@/lib/skill-tree-core";
import type { HrefViewer } from "@/lib/skill-tree-href";

// Column order: tracks left→right. Row order: levels top→bottom. These mirror
// CurriculumDag's TRACKS/LEVELS axes but with the COMMS-first track order the
// skill tree narrates against (COMMS · ACT · SENSE · POWER).
const TRACKS = ["COMMS", "ACT", "SENSE", "POWER"] as const;
const LEVELS = ["L1", "L2", "L3"] as const;

// The single DAG root that spans the top row above every track column.
const ROOT_SLUG = "l1-01-wroom-breakout";

// Track → accent color, mirroring CurriculumDag's chip palette.
const TRACK_COLOR: Record<string, string> = {
  SENSE: "text-status-green",
  ACT: "text-command-gold",
  POWER: "text-alert-red",
  COMMS: "text-signal-blue",
};

export interface SkillTreeGridProps {
  tree: SkillTree;
  viewer: HrefViewer;
}

export function SkillTreeGrid({ tree, viewer }: SkillTreeGridProps) {
  // Bucket into (track, level) cells; the root node is pulled out to span the
  // top row, and anything missing either axis falls through to `unassigned` —
  // same approach as CurriculumDag, so nodes are never silently dropped.
  const cells = new Map<string, SkillNode[]>();
  const unassigned: SkillNode[] = [];
  let root: SkillNode | null = null;

  for (const n of tree.nodes) {
    if (n.slug === ROOT_SLUG) {
      root = n;
      continue;
    }
    if (!n.track || !n.level) {
      unassigned.push(n);
      continue;
    }
    const key = `${n.track}:${n.level}`;
    const arr = cells.get(key);
    if (arr) arr.push(n);
    else cells.set(key, [n]);
  }

  // Nothing to render — empty grid skeleton still shows the axes below, but if
  // there are no nodes at all there's no point drawing anything.
  if (tree.nodes.length === 0) {
    return null;
  }

  return (
    // Desktop only (lg+): the matrix needs real width for four card columns +
    // the row-label rail. The mobile spine (`lg:hidden`) is Task 8.
    <div className="hidden lg:block">
      {/* Positioned ancestor: Task 7's decorative <svg> edge overlay mounts
          here as an absolutely-positioned sibling and locates each node by its
          `node-${slug}` id. Keep this `relative`. */}
      <div className="relative">
        {/* Root row — L1.01 spans the full grid width above the track columns,
            the central root every track descends from. Leading empty cell keeps
            it aligned with the 80px row-label rail used below. */}
        {root ? (
          <div className="grid grid-cols-[80px_repeat(4,1fr)] gap-2">
            <div className="flex items-center justify-end border border-panel-border bg-deep-space px-2 py-1 font-mono text-xs uppercase tracking-wider text-command-gold">
              ROOT
            </div>
            <div className="col-span-4">
              <SkillNodeCard node={root} viewer={viewer} />
            </div>
          </div>
        ) : null}

        {/* Column header row — track chips above each column. The leading empty
            cell aligns with the row-label column on the left. */}
        <div className="mt-2 grid grid-cols-[80px_repeat(4,1fr)] gap-2">
          <div />
          {TRACKS.map((t) => (
            <div
              key={t}
              className={`border border-panel-border bg-deep-space px-2 py-1 text-center font-mono text-xs uppercase tracking-wider ${TRACK_COLOR[t]}`}
            >
              {t}
            </div>
          ))}
        </div>

        {/* Body — one grid row per level. Each level's row gets a leading
            row-label cell, then four track cells. Empty cells render an em-dash
            placeholder so the grid skeleton stays visible. */}
        <div className="mt-2 grid grid-cols-[80px_repeat(4,1fr)] gap-2">
          {LEVELS.map((l) => (
            <SkillTreeGridRow
              key={l}
              level={l}
              cells={cells}
              viewer={viewer}
            />
          ))}
        </div>

        {/* Decorative SVG dependency edges (Task 7). Client overlay, absolutely
            positioned, pointer-events-none — locates node anchors by id and
            tracks them on resize. The grid stays fully navigable without it. */}
        <SkillTreeEdges edges={tree.edges} />
      </div>

      {/* Unassigned bucket — nodes missing track and/or level. Don't drop these
          silently; surface them as a row so curriculum metadata back-fill stays
          visible work (mirrors CurriculumDag). */}
      {unassigned.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-mono text-xs uppercase tracking-wider text-muted">
            UNASSIGNED · NO TRACK OR LEVEL
          </h2>
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
            {unassigned.map((n) => (
              <SkillNodeCard key={n.slug} node={n} viewer={viewer} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

// One row of the level grid. Emits CSS-grid children in row-major order: a
// leading level-label cell, then the four track cells. Mirrors CurriculumDag's
// `CurriculumGridRow`.
function SkillTreeGridRow({
  level,
  cells,
  viewer,
}: {
  level: (typeof LEVELS)[number];
  cells: Map<string, SkillNode[]>;
  viewer: HrefViewer;
}) {
  return (
    <>
      <div className="flex items-start justify-end border border-panel-border bg-deep-space px-2 py-1 font-mono text-xs uppercase tracking-wider text-command-gold">
        {level}
      </div>
      {TRACKS.map((t) => {
        const bucket = cells.get(`${t}:${level}`) ?? [];
        return (
          <div
            key={t}
            className="flex flex-col gap-2 border border-panel-border bg-deep-space/40 p-2"
          >
            {bucket.length === 0 ? (
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                —
              </p>
            ) : (
              bucket.map((n) => (
                <SkillNodeCard key={n.slug} node={n} viewer={viewer} />
              ))
            )}
          </div>
        );
      })}
    </>
  );
}
