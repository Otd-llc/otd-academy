"use client";

// SANDBOX — every prism of a ONE-POINT comb, in one svg, with the interior lines gone.
//
// PAINT ORDER. The shipped `HexPrismScene` sorts cells by depth and draws each one's
// slab and face together. That is correct for the three-point comb, where every cell
// has a depth of its own. It is wrong here: under one-point every near face shares a
// depth, so no cell order exists that puts each slab behind its neighbour's face. A
// converging cast reaches ACROSS the neighbour that should occlude it, and the cells
// on the far side of the vanishing point lean the other way. So the scene draws all
// six sides of every prism first, then every face on top. A prism body always lies
// behind every face, so this is not a tie-break, it is the answer.
//
// HIDDEN LINES. Painting faces over slabs hides a slab wherever a face is OPAQUE, and
// that is not the same as hiding it wherever a face IS. A completed cell fills with a
// honey gradient, a current cell carries a drop-shadow, and the cells' own artwork
// sits over the top, so slab edges kept reading through the comb as a wireframe. The
// slab layer is therefore MASKED by the union of every face: no part of any prism can
// draw inside any hex, whatever that hex happens to be filled with. What survives is
// exactly the silhouette, which is what the drawing is supposed to be.
//
// STROKES scale with the cell (see `strokeFor`), matching the lesson-top ribbon's
// ratios rather than the flat 3px this scene first used.

import { useId } from "react";
import { svgPath, type HexSolid } from "@/lib/hex-perspective";
import type { HexPrismCellState } from "@/components/guide/SpineCombScene";
import { strokeFor } from "./geometry";

/** The six side quads of one prism: each near edge swept to its far counterpart. */
function sides(s: HexSolid) {
  return s.face.map((a, k) => [a, s.face[(k + 1) % 6]!, s.rear[(k + 1) % 6]!, s.rear[k]!]);
}

export function OnePointScene({
  solids,
  sceneW,
  sceneH,
  cellW,
  cells,
  hot,
  strokeMult = 1,
}: {
  solids: HexSolid[];
  sceneW: number;
  sceneH: number;
  /** the measured cell width, which every stroke is a share of. */
  cellW: number;
  cells: HexPrismCellState[];
  hot?: number | null;
  /** live weight trim on top of the lesson comb's ratios. */
  strokeMult?: number;
}) {
  const uid = useId().replace(/:/g, "");
  const maskId = `cv-faces-${uid}`;

  const swFace = strokeFor("face", cellW, strokeMult);
  const swSide = strokeFor("side", cellW, strokeMult);

  const cls = (i: number) => {
    const c = cells[i];
    if (!c) return null;
    return ["ghp-cell", c.kind, c.dim ? "dim" : "", hot === i ? "hot" : ""]
      .filter(Boolean)
      .join(" ");
  };

  return (
    // The viewBox is the container's own pixel box, drawn 1:1, so the cells' HTML can
    // be positioned straight off the measured layout with no unit conversion.
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
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={sceneW} height={sceneH}>
          <rect x="0" y="0" width={sceneW} height={sceneH} fill="white" />
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
            <g key={`slab-${s.i}`} className={c}>
              <path className="ghp-side" d={svgPath(s.rear)} strokeWidth={swSide} />
              {sides(s).map((q, k) => (
                <path key={k} className="ghp-side" d={svgPath(q)} strokeWidth={swSide} />
              ))}
            </g>
          );
        })}
      </g>

      {/* pass 2 — every face, over every slab.
          NO inline fill. An earlier cut forced the honey gradient on completed cells
          from here, and an inline style beats every stylesheet rule, so it overrode
          the shipped `.ghp-cell.done .ghp-face` (globals.css), which deliberately
          ABANDONED the honey plate for a 14% gold wash over deep space. The ink rules
          that go with that wash are ivory and muted, sized for a dark face, so
          forcing gold back under them put light type on a gold plate and made every
          completed cell unreadable. The stylesheet already knows what a done cell
          looks like; the scene's job is to draw the shape. */}
      {solids.map((s) => {
        const c = cls(s.i);
        if (!c) return null;
        return (
          <g key={`face-${s.i}`} className={c}>
            <path className="ghp-face" d={svgPath(s.face)} strokeWidth={swFace} />
          </g>
        );
      })}
    </svg>
  );
}
