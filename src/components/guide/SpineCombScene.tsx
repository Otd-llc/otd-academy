"use client";

// SpineCombScene — every prism of a one-point spine, in one svg, as a silhouette.
//
// Draws all three combs on the site: the build-guide hub (`GuideHoneycomb`), the
// /courses skill tree (`SkillHoneycomb`) and the /courses go-further ribbon
// (`PathHoneycomb`). It replaced `HexPrismScene`, the three-point scene, which has no
// callers left and has been deleted.
//
// It takes `HexSolid`s, which carry their own face and rear points, so it is
// orientation-agnostic: the go-further ribbon hands it FLAT-top hexes when laced and
// pointy-top ones when collapsed, and nothing here has to know.
//
// PAINT ORDER. `HexPrismScene` sorts cells by depth and draws each one's slab and face
// together, which is correct for the three-point grid where every cell has a depth of
// its own. It is wrong here: under one-point every near face shares a depth, so no
// cell order puts each slab behind its neighbour's face. A converging cast reaches
// ACROSS the neighbour that should occlude it, and the cells on the far side of the
// vanishing point lean the other way. So this draws every prism's sides first, then
// every face on top. A prism body always lies behind every face, so that is not a
// tie-break, it is the answer.
//
// HIDDEN LINES. Painting faces over slabs hides a slab wherever a face is OPAQUE, and
// that is not the same as hiding it wherever a face IS: a completed cell's fill, the
// current cell's drop-shadow and the artwork over the top all let slab edges read
// through, and the comb came out looking like a wireframe. The slab layer is therefore
// MASKED by the union of every face. Nothing draws inside any hex, whatever that hex
// is filled with, and what survives is the silhouette.
//
// Colour is entirely token-driven, so the comb flips with the theme.

import { useId } from "react";
import { svgPath, type HexSolid } from "@/lib/hex-perspective";
import { spineStroke } from "@/lib/comb-spine";
/**
 * One cell's visual state. It used to live in `HexPrismScene`, the three-point scene
 * this replaced; that file is gone, so the type moved here rather than outliving its
 * component as an orphan import.
 */
export interface HexPrismCellState {
  /** the four honeycomb visual states, as the `.gh-node` classes use them. */
  kind: "done" | "current" | "pending" | "blocked";
  /** recede a cell the viewer cannot reach yet (`.gh-node.sk-dim`). */
  dim?: boolean;
  /** the go-further comb strokes by TRACK, not by completion state. */
  accent?: string;
  /** that comb's flagship sits a little brighter than its siblings at rest. */
  flag?: boolean;
  /**
   * Per-cell opacity, 0..1. Undefined means opaque.
   *
   * `dim` is a fixed 60% recede and is the right answer for a cell the viewer cannot
   * reach yet. This is for a caller that needs a CONTINUOUS one - the alpha carousel
   * ghosts its off-window cells on a falloff, and without this the prisms are the one
   * part of a cell that cannot recede: the scene is a single svg, so HTML opacity on
   * the cell reaches its type and its artwork and never its hex. That left a ghost
   * outlined at full strength around faded contents.
   */
  alpha?: number;
}

/** The six side quads of one prism: each near edge swept to its far counterpart. */
function sides(s: HexSolid) {
  return s.face.map((a, k) => [a, s.face[(k + 1) % 6]!, s.rear[(k + 1) % 6]!, s.rear[k]!]);
}

export function SpineCombScene({
  solids,
  sceneW,
  sceneH,
  cellW,
  cells,
  hot,
  /** stroke by the cell's own accent instead of by completion state, and dim at rest.
   *  The go-further comb colours by TRACK, not by progress; the same flag exists on
   *  `HexPrismScene` and drives the same `.ghp-cell.track` rules in globals.css. */
  track = false,
}: {
  solids: HexSolid[];
  /** the container's pixel box; the viewBox is drawn 1:1 against it so the cells'
   *  HTML can be positioned straight off the measured layout. */
  sceneW: number;
  sceneH: number;
  /** the measured cell width, which every stroke is a share of. */
  cellW: number;
  cells: HexPrismCellState[];
  hot?: number | null;
  track?: boolean;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const maskId = `spine-faces-${uid}`;

  // THE MASK REGION IS A CLIP. Anything outside `x/y/width/height` is not rendered at
  // all, so the region has to contain every point the slab layer draws, not just the
  // scene box. The vertical spine holds that by accident: its vanishing point is at
  // the centre of the run, so rear faces are pulled INWARD. The go-further ribbon does
  // not - its vanishing point sits below the run so every rear face is pushed PAST the
  // bottom edge, and a region of exactly the scene box sliced ~16px off the lower
  // hexes' prisms at desktop width, as a hard horizontal line. Measured, not guessed.
  // So the region is the ink's own bounds with a margin.
  let x0 = 0;
  let y0 = 0;
  let x1 = sceneW;
  let y1 = sceneH;
  for (const s of solids) {
    for (const [px, py] of [...s.face, ...s.rear]) {
      if (px < x0) x0 = px;
      if (py < y0) y0 = py;
      if (px > x1) x1 = px;
      if (py > y1) y1 = py;
    }
  }
  const pad = Math.max(4, cellW * 0.1);
  const mx = x0 - pad;
  const my = y0 - pad;
  const mw = Math.max(1, x1 - x0 + pad * 2);
  const mh = Math.max(1, y1 - y0 + pad * 2);
  const swFace = spineStroke("face", cellW);
  const swSide = spineStroke("side", cellW);

  const cls = (i: number) => {
    const c = cells[i];
    if (!c) return null;
    return [
      "ghp-cell",
      track ? "track" : c.kind,
      c.dim ? "dim" : "",
      c.flag ? "flag" : "",
      hot === i ? "hot" : "",
    ]
      .filter(Boolean)
      .join(" ");
  };
  /**
   * Per-cell group style: the track accent, which `.ghp-cell.track` strokes through
   * `var(--accent)` and therefore has to reach the group, plus any continuous alpha.
   */
  const styleOf = (i: number): React.CSSProperties | undefined => {
    const c = cells[i];
    if (!c) return undefined;
    const st: React.CSSProperties = {};
    if (c.accent) (st as Record<string, string>)["--accent"] = c.accent;
    if (c.alpha !== undefined && c.alpha < 1) st.opacity = c.alpha;
    return Object.keys(st).length ? st : undefined;
  };

  return (
    <svg
      className="ghp"
      viewBox={`0 0 ${sceneW} ${sceneH}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        {/* white keeps, black cuts: everything outside every hex face survives. The
            faces are grown by half a face stroke so the slab is cut at the OUTSIDE of
            the outline rather than at its centreline, which would leave a hairline of
            slab peeking along every shared edge. */}
        <mask id={maskId} maskUnits="userSpaceOnUse" x={mx} y={my} width={mw} height={mh}>
          <rect x={mx} y={my} width={mw} height={mh} fill="white" />
          {solids.map((s) => (
            <path
              key={s.i}
              d={svgPath(s.face)}
              fill="black"
              stroke="black"
              strokeWidth={swFace}
              strokeLinejoin="round"
            />
          ))}
        </mask>
      </defs>

      {/* pass 1 — every slab, cut wherever any face covers it */}
      <g mask={`url(#${maskId})`}>
        {solids.map((s) => {
          const c = cls(s.i);
          if (!c) return null;
          return (
            <g key={`slab-${s.i}`} className={c} style={styleOf(s.i)}>
              <path className="ghp-side" d={svgPath(s.rear)} strokeWidth={swSide} />
              {sides(s).map((q, k) => (
                <path key={k} className="ghp-side" d={svgPath(q)} strokeWidth={swSide} />
              ))}
            </g>
          );
        })}
      </g>

      {/* pass 2 — every face, over every slab.
          No inline fill here, deliberately. An earlier cut forced the honey gradient
          onto completed cells from this component, and an inline style beats every
          stylesheet rule, so it overrode `.ghp-cell.done .ghp-face` in globals.css —
          which had deliberately abandoned that gold plate for a 14% gold wash over
          deep space. The ink rules that go with the wash are ivory and muted, sized
          for a dark face, so forcing gold back under them made every completed cell
          unreadable. The stylesheet knows what a done cell looks like; this component
          draws the shape. */}
      {solids.map((s) => {
        const c = cls(s.i);
        if (!c) return null;
        return (
          <g key={`face-${s.i}`} className={c} style={styleOf(s.i)}>
            <path className="ghp-face" d={svgPath(s.face)} strokeWidth={swFace} />
          </g>
        );
      })}
    </svg>
  );
}
