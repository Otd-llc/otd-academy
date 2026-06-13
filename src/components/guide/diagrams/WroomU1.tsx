// Shared ESP32-S3-WROOM-1 (U1) module drawing, so U1 looks IDENTICAL in every
// diagram: a SQUARE body with the PCB-antenna tab on top. Returned as an SVG
// <g> in a local coord space — local (0,0) is the top-left of the antenna tab;
// the square body runs y=BODY_TOP..(BODY_TOP+BODY) at x=0..BODY.
//
// CONVENTION: a diagram places the board so its TOP EDGE sits at the body top
// (global y = y + BODY_TOP*scale). The antenna tab then overhangs ABOVE the
// board edge — exactly as the real module is laid out on a carrier board.

export const WROOM_BODY = 100; // body is a WROOM_BODY x WROOM_BODY square
export const WROOM_BODY_TOP = 28; // local y where the square body / board edge begins

export function WroomU1({ x = 0, y = 0, scale = 1 }: { x?: number; y?: number; scale?: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      {/* square module body */}
      <rect x="0" y="28" width="100" height="100" rx="4" fill="#1f2438" stroke="#c8963e" strokeWidth="2.5" />
      {/* antenna tab on top — overhangs the board's top edge */}
      <rect x="23" y="0" width="54" height="28" fill="#1f2438" stroke="#c8963e" strokeWidth="2" />
      {/* meandered PCB antenna inside the tab */}
      <path d="M30,24 v-14 h7.5 v14 h7.5 v-14 h7.5 v14 h7.5 v-14 h7.5 v14" fill="none" stroke="#ffffff" strokeWidth="2.5" />
      {/* castellated pads on the long edges */}
      <g stroke="#c8963e" strokeWidth="2.5">
        <line x1="0" y1="46" x2="-9" y2="46" />
        <line x1="0" y1="64" x2="-9" y2="64" />
        <line x1="0" y1="82" x2="-9" y2="82" />
        <line x1="0" y1="100" x2="-9" y2="100" />
        <line x1="0" y1="118" x2="-9" y2="118" />
        <line x1="100" y1="46" x2="109" y2="46" />
        <line x1="100" y1="64" x2="109" y2="64" />
        <line x1="100" y1="82" x2="109" y2="82" />
        <line x1="100" y1="100" x2="109" y2="100" />
        <line x1="100" y1="118" x2="109" y2="118" />
      </g>
      {/* ref */}
      <text x="50" y="88" textAnchor="middle" fill="#ffffff" fontFamily="'Space Mono',monospace" fontSize="22" fontWeight="700">U1</text>
    </g>
  );
}
