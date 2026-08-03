// An assembled CLUSTER, drawn from the real part geometry.
//
// The single-part glyph says "a hex tile". It cannot say "a mounting standard
// whose tiles carry load through each other", which is the thing the page is
// actually about. This places that same generated outline on the hex lattice at
// the REAL cell pitch, so the graphic is an assembly rather than a decorative
// repeat, and the gap between neighbours in the picture is the 0.25 mm design
// gap scaled up rather than whatever looked right.
//
// Vector and `currentColor` throughout, so it flips with the theme, scales to
// any size, and costs a few KB. A raster of the same thing would need two
// assets and would still be soft on a retina hero.
//
// SPACING. Neighbour centres sit `HEX_PITCH_MM` apart in six directions. Cell
// centres form a triangular lattice, so the basis is two vectors 60 degrees
// apart; which pair depends on the part's rotation in the projection, and the
// glyph is flat-top with its vertices on the horizontal axis, so neighbours lie
// perpendicular to the flats: 30 and 90 degrees, not 0 and 60. Getting that
// wrong does not error, it just interleaves the tiles into a mess.
import {
  BODY_OUTER,
  BODY_INNER,
  GLYPH_CENTRE,
  GLYPH_HALF,
  GLYPH_UNITS_PER_MM,
  TOP_INTERIOR,
} from "@/components/hex/HexBodyGlyph";
import { HEX_PITCH_MM } from "@/lib/hex-spec";

/** Axial cell coordinate. */
export type Cell = [q: number, r: number];

const PITCH_U = HEX_PITCH_MM * GLYPH_UNITS_PER_MM;
const COS30 = Math.cos(Math.PI / 6);

/** Axial (q, r) → glyph-space centre offset. */
function cellOffset(q: number, r: number): { x: number; y: number } {
  // Basis at 30 and 90 degrees (see the note above).
  return {
    x: PITCH_U * COS30 * q,
    y: PITCH_U * (0.5 * q + r),
  };
}

/** A few ready-made arrangements, so a caller picks a shape rather than
 *  hand-listing coordinates and accidentally drawing a disconnected cluster. */
export const ARRANGEMENTS = {
  /** One tile. */
  single: [[0, 0]] as Cell[],
  /** Two engaged tiles: the smallest thing that shows a JOINT, which is the
   *  whole claim of the system. */
  pair: [
    [0, 0],
    [0, -1],
  ] as Cell[],
  /** Three in a triangle. */
  trio: [
    [0, 0],
    [0, -1],
    [1, -1],
  ] as Cell[],
  /** A tile with all six neighbours: the densest statement of the lattice. */
  flower: [
    [0, 0],
    [0, -1],
    [1, -1],
    [1, 0],
    [0, 1],
    [-1, 1],
    [-1, 0],
  ] as Cell[],
  /** A short strip. */
  strip: [
    [-1, 0],
    [0, 0],
    [1, 0],
    [2, 0],
  ] as Cell[],
} satisfies Record<string, Cell[]>;

export function HexLattice({
  cells = ARRANGEMENTS.flower,
  /** `outline` reads as a mark; `top` adds the interior projection lines and
   *  reads as a drawing. `detail` keeps the interior but drops it to a low
   *  opacity, which gives depth without becoming noise at hero size. */
  detail = "outline",
  /** Emphasise one cell and dim the rest: "one tile, and the system it joins". */
  focus,
  strokeWidth = 10,
  className,
  title = "An assembled hex cluster, tiles engaged on all six dovetails",
}: {
  cells?: Cell[];
  detail?: "outline" | "top" | "detail";
  focus?: Cell;
  strokeWidth?: number;
  className?: string;
  title?: string;
}) {
  const offsets = cells.map(([q, r]) => ({ q, r, ...cellOffset(q, r) }));

  // Fit the viewBox to whatever was placed, so any arrangement is framed
  // without the caller computing bounds.
  //
  // A translated copy occupies GLYPH_CENTRE +/- GLYPH_HALF, not +/- centre.
  // Using the centre as the half-extent is what framed the first lattice 537
  // units too loose on every side, which made a correctly-tiled cluster look
  // like scattered parts.
  const pad = 40;
  const xs = offsets.map((o) => o.x);
  const ys = offsets.map((o) => o.y);
  const minX = GLYPH_CENTRE.x + Math.min(...xs) - GLYPH_HALF.x - pad;
  const maxX = GLYPH_CENTRE.x + Math.max(...xs) + GLYPH_HALF.x + pad;
  const minY = GLYPH_CENTRE.y + Math.min(...ys) - GLYPH_HALF.y - pad;
  const maxY = GLYPH_CENTRE.y + Math.max(...ys) + GLYPH_HALF.y + pad;

  const isFocused = (q: number, r: number) =>
    !focus || (focus[0] === q && focus[1] === r);

  return (
    <svg
      viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
      className={className}
      role="img"
      aria-label={title}
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {offsets.map((o, i) => (
          <g
            key={`${o.q},${o.r},${i}`}
            transform={`translate(${o.x} ${o.y})`}
            opacity={isFocused(o.q, o.r) ? 1 : 0.28}
          >
            <path d={BODY_OUTER} />
            {detail === "top" ? (
              <>
                <path d={BODY_INNER} />
                {TOP_INTERIOR.map((d, j) => (
                  <path key={j} d={d} />
                ))}
              </>
            ) : null}
            {detail === "detail" ? (
              <g opacity={0.35}>
                <path d={BODY_INNER} />
              </g>
            ) : null}
          </g>
        ))}
      </g>
    </svg>
  );
}
