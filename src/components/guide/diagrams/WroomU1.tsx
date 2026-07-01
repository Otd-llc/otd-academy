// Shared ESP32-S3-WROOM-1 (U1) module drawing, so U1 looks IDENTICAL in every
// diagram: a SQUARE body with the PCB-antenna section across the FULL width of
// the module on top (the real WROOM antenna spans the whole top edge — it is the
// same width as the body, NOT a narrow tab). Returned as an SVG <g> in a local
// coord space — local (0,0) is the top-left of the antenna section; the square
// body runs y=BODY_TOP..(BODY_TOP+BODY) at x=0..BODY.
//
// CONVENTION: a diagram places the board so its TOP EDGE sits at the body top
// (global y = y + BODY_TOP*scale). The full-width antenna section then overhangs
// ABOVE the board edge — as the real module is laid out on a carrier board.

export const WROOM_BODY = 100; // body is a WROOM_BODY x WROOM_BODY square
export const WROOM_BODY_TOP = 30; // local y where the square body / board edge begins

export function WroomU1({ x = 0, y = 0, scale = 1 }: { x?: number; y?: number; scale?: number }) {
  // Token-only color (via inline vars so it re-themes inside any diagram, with no
  // dependence on a diagram-local CSS class): navy body, gold stroke, ink glyph.
  const navy = "var(--color-navy-dark, #1f2438)";
  const gold = "var(--color-command-gold, #c8963e)";
  const ink = "var(--color-title, #f1ece0)";
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      {/* square module body */}
      <rect x="0" y="30" width="100" height="100" rx="4" style={{ fill: navy, stroke: gold }} strokeWidth="2.5" />
      {/* antenna section — FULL module width, on top, overhangs the board edge */}
      <rect x="0" y="0" width="100" height="30" rx="2" style={{ fill: navy, stroke: gold }} strokeWidth="2.5" />
      {/* meandered PCB antenna spanning the full width of the section */}
      <path d="M10 26 V11 H22 V26 H34 V11 H46 V26 H58 V11 H70 V26 H82 V11 H90 V26"
        style={{ fill: "none", stroke: ink }} strokeWidth="2.5" strokeLinejoin="miter" />
      {/* castellated pads on the long edges of the body */}
      <g style={{ stroke: gold }} strokeWidth="2.5">
        <line x1="0" y1="48" x2="-9" y2="48" />
        <line x1="0" y1="65" x2="-9" y2="65" />
        <line x1="0" y1="82" x2="-9" y2="82" />
        <line x1="0" y1="99" x2="-9" y2="99" />
        <line x1="0" y1="116" x2="-9" y2="116" />
        <line x1="100" y1="48" x2="109" y2="48" />
        <line x1="100" y1="65" x2="109" y2="65" />
        <line x1="100" y1="82" x2="109" y2="82" />
        <line x1="100" y1="99" x2="109" y2="99" />
        <line x1="100" y1="116" x2="109" y2="116" />
      </g>
      <text x="50" y="89" textAnchor="middle" style={{ fill: ink }} fontFamily="'Space Mono',monospace" fontSize="22" fontWeight="700">U1</text>
    </g>
  );
}
