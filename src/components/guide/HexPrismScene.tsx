"use client";

// HexPrismScene — every prism of a honeycomb grid, in ONE svg, in three-point
// perspective.
//
// NO PRODUCTION CALLERS. All three combs (the build-guide hub, the /courses skill tree
// and the go-further ribbon) moved to `SpineCombScene` and the one-point projection on
// 2026-08-13. This is kept because `/sandbox/comb` renders it as the CONTROL the
// vertical cuts were judged against, and that round is the record of the pick. Its CSS
// (`.gh-3d`, `.sk-arw`) moved out of globals.css into the sandbox's own stylesheet, so
// nothing here is served to a visitor any more.
//
// It replaces the per-cell `HexPrism` shell those three used to render inside each
// cell. That arrangement could not survive a vanishing point: it drew a constant
// down-right oblique cast on every cell and relied on `zIndex: Math.round(left) + 1`
// to make each cast fall behind its right-hand neighbour's face. Once the casts
// converge, cells on one side lean the other way and no left-to-right order is
// correct. Collecting the prisms into one svg makes the question disappear — they
// paint far to near, which is simply true, and a nearer cell's prism covers a farther
// cell's face the way it should.
//
// The cells' CONTENT stays in HTML, positioned over the scene by the caller and
// scaled to its face. A foreshortened face cannot carry upright HTML, so labels are
// billboarded; that is the cost of the projection, decided in the sandbox round.
//
// Colour is entirely token-driven here, which also retires the baked `#eab94d` the
// old `.gh-3d` rules carried — the comb now flips with the theme.

import type { HexPrismCellState } from "@/components/guide/SpineCombScene";
import {
  paintOrder,
  prismSides,
  svgPath,
  type HexSolid,
} from "@/lib/hex-perspective";

/**
 * The path-direction arrows (K10), rebuilt on the projected centres rather than the
 * measured ones. They sit on the seam between consecutive cells, so once the comb is
 * in perspective they have to travel with the faces or they drift off the seams.
 * Shared by the hub and the skill tree, which drew identical copies of this.
 */
export function CombArrows({
  solids,
  vb,
  on,
  hot,
}: {
  solids: HexSolid[];
  vb: { x: number; y: number; w: number; h: number };
  /** per-pair: is the source cell already done (gold) or still ahead (dim). */
  on: boolean[];
  hot?: number | null;
}) {
  if (solids.length < 2) return null;
  return (
    <svg
      className="sk-arw"
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      {solids.slice(0, -1).map((a, i) => {
        const b = solids[i + 1]!;
        const ang = (Math.atan2(b.centre[1] - a.centre[1], b.centre[0] - a.centre[0]) * 180) / Math.PI;
        // K10 sizes were tuned on 200px cells; the projected scale keeps an arrow
        // the same size relative to the face it sits on, near or far.
        const sc = ((a.scale + b.scale) / 2) * 0.9;
        const cls = [on[i] ? "on" : "off", hot === i ? "hot" : ""].filter(Boolean).join(" ");
        return (
          <g
            key={i}
            className={cls}
            transform={`translate(${(a.centre[0] + b.centre[0]) / 2} ${(a.centre[1] + b.centre[1]) / 2}) rotate(${ang}) translate(${7 * sc} 0) scale(${sc})`}
          >
            <path d="M -6 -5 L 6 0 L -6 5 Z" style={{ animationDelay: `${i * 0.25}s` }} />
          </g>
        );
      })}
    </svg>
  );
}


export function HexPrismScene({
  solids,
  vb,
  cells,
  hot,
  /** the go-further comb: stroke by accent, no honey fill, dim at rest. */
  track = false,
}: {
  solids: HexSolid[];
  vb: { x: number; y: number; w: number; h: number };
  cells: HexPrismCellState[];
  hot?: number | null;
  track?: boolean;
}) {
  return (
    <svg
      className="ghp"
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <defs>
        <linearGradient id="ghp-honey" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--color-gold-light)" />
          <stop offset="1" stopColor="var(--color-gold-dim)" />
        </linearGradient>
      </defs>
      {paintOrder(solids).map((s) => {
        const c = cells[s.i];
        if (!c) return null;
        const cls = [
          "ghp-cell",
          track ? "track" : c.kind,
          c.dim ? "dim" : "",
          c.flag ? "flag" : "",
          hot === s.i ? "hot" : "",
        ]
          .filter(Boolean)
          .join(" ");
        // Stroke weight rides the cell's own foreshortening, so a receding cell's
        // outline thins with it instead of shouting from the back of the scene.
        const sw = 3 * s.scale;
        return (
          <g
            key={s.i}
            className={cls}
            style={c.accent ? ({ "--accent": c.accent } as React.CSSProperties) : undefined}
          >
            <path className="ghp-side" d={svgPath(s.rear)} strokeWidth={sw * 0.5} />
            {prismSides(s).map((q, k) => (
              <path key={k} className="ghp-side" d={svgPath(q)} strokeWidth={sw * 0.45} />
            ))}
            <path className="ghp-face" d={svgPath(s.face)} strokeWidth={sw} />
          </g>
        );
      })}
    </svg>
  );
}
