// Ground plane: the return current mirrored under the signal (v2).
//
// Teaching point (lesson 5): on a real board ground is a poured plane, and the
// return current follows the copper directly under the signal, so the loop stays
// tiny and the board stays quiet. Drawn as the SAME isometric two-layer block as
// the L1-01 "2-layer board, edge-on" diagram (top copper / woven FR4 core / copper
// ground plane), with a gold signal current on the top layer and a blue return
// current in the ground plane directly beneath it, plus the tiny coupling loop.
//
// Like TwoLayerCrossSection, the BOARD is a physical object with ONE fixed palette
// in both themes (a real PCB looks the same on a dark or light page); the literal
// colors are intentional, not a token miss. Only the DiagramFrame chrome re-themes.
// The markup is a module constant (no props / no user input) — safe to inject.
import { DiagramFrame } from "./DiagramFrame";

// ── fixed board + current palette (identical in dark and light) ────────────────
const CU = "#c8963e", CULIT = "#e8b865", CUSIDE = "#a5772c";
const FR4 = "#8a7d42", FR4SIDE = "#5f552b";
const SIG = "#e8b865", RET = "#4a8fff";

// ── isometric geometry ────────────────────────────────────────────────────────
const X = 24, Y = 96, W = 300, TC = 15, FR = 46, BC = 15, DX = 56, DY = 28;
const H = TC + FR + BC;
const topP = (x: number, y: number, w: number, dx: number, dy: number) => `M${x},${y} l${dx},-${dy} h${w} l-${dx},${dy} Z`;
const sideP = (x: number, y: number, w: number, h: number, dx: number, dy: number) => `M${x + w},${y} l${dx},-${dy} v${h} l-${dx},${dy} Z`;
const arrow = (x: number, y: number, c: string, dir: 1 | -1) => `<path d="M${x} ${y - 4.5} L${x + 7 * dir} ${y} L${x} ${y + 4.5}" fill="${c}"/>`;

function weave(x: number, y: number, w: number, h: number) {
  let g = `<g opacity="0.10">`;
  const st = 9;
  for (let i = -h; i < w; i += st) g += `<line x1="${x + Math.max(0, i)}" y1="${y + Math.max(0, -i)}" x2="${x + Math.min(w, i + h)}" y2="${y + Math.min(h, w - i)}" stroke="#ffffff" stroke-width="1"/>`;
  for (let i = 0; i < w + h; i += st) g += `<line x1="${x + Math.min(w, i)}" y1="${y + Math.max(0, i - w)}" x2="${x + Math.max(0, i - h)}" y2="${y + Math.min(h, i)}" stroke="#000000" stroke-width="1"/>`;
  return g + `</g>`;
}

function buildMarkup() {
  let g = "";
  // board block: copper / FR4 (woven) / copper, lit top copper
  g += `<path d="${sideP(X, Y, W, TC, DX, DY)}" fill="${CUSIDE}"/><path d="${sideP(X, Y + TC, W, FR, DX, DY)}" fill="${FR4SIDE}"/><path d="${sideP(X, Y + TC + FR, W, BC, DX, DY)}" fill="${CUSIDE}"/>`;
  g += `<rect x="${X}" y="${Y}" width="${W}" height="${TC}" fill="${CU}"/>`;
  g += `<rect x="${X}" y="${Y + TC}" width="${W}" height="${FR}" fill="${FR4}"/>` + weave(X, Y + TC, W, FR);
  g += `<rect x="${X}" y="${Y + TC + FR}" width="${W}" height="${BC}" fill="${CU}"/>`;
  g += `<path d="${topP(X, Y, W, DX, DY)}" fill="${CULIT}"/>`;
  g += `<path d="M${X},${Y} l${DX},-${DY} h${W}" fill="none" stroke="#ffffff" stroke-opacity="0.22" stroke-width="1.2"/>`;

  // currents: signal → on the top copper, return ← in the ground plane beneath
  const sy = Y + TC / 2, ry = Y + TC + FR + BC / 2, x0 = X + 40, x1 = X + W - 40;
  g += `<line x1="${x0}" y1="${sy}" x2="${x1 - 8}" y2="${sy}" stroke="${SIG}" stroke-width="3.4" stroke-linecap="round"/>` + arrow(x1 - 8, sy, SIG, 1);
  g += `<line x1="${x1}" y1="${ry}" x2="${x0 + 8}" y2="${ry}" stroke="${RET}" stroke-width="3.4" stroke-linecap="round"/>` + arrow(x0 + 8, ry, RET, -1);
  // the tiny coupling loop closing at each end
  g += `<path d="M${x1 - 4} ${sy} V${ry}" stroke="${RET}" stroke-width="1.4" stroke-dasharray="3 3" fill="none" opacity="0.7"/>`;
  g += `<path d="M${x0 + 4} ${ry} V${sy}" stroke="${SIG}" stroke-width="1.4" stroke-dasharray="3 3" fill="none" opacity="0.7"/>`;
  return g;
}
const MARKUP = buildMarkup();

export function PcbGroundPlane({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="PCB · GROUND PLANE"
      tone="gold"
      title="The return flows right under the signal"
      ariaLabel="An isometric edge-on view of a two-layer board: lit copper on top, a woven FR4 core, and a copper ground plane on the bottom. A gold signal current runs left to right along the top copper, and a blue return current runs right to left in the ground plane directly beneath it, mirroring the signal. Because the return follows the copper right under the signal, the loop between them stays tiny, which keeps the board quiet."
      caption={caption}
      defaultCaption="The gold signal on top and the blue return in the plane run right on top of each other, so the loop stays tiny and the board stays quiet."
    >
      <style>{CSS}</style>
      <div className="gpl">
        <svg className="gpl-svg" viewBox="0 76 400 116" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <g dangerouslySetInnerHTML={{ __html: MARKUP }} />
        </svg>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.gpl{max-width:34rem;margin-inline:auto;}
.gpl-svg{display:block;width:100%;height:auto;overflow:visible;}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .gpl-svg{opacity:0;transform:translateY(6px);}
.dgfrm.armed.in .gpl-svg{opacity:1;transform:none;transition:opacity .55s ease,transform .55s cubic-bezier(.2,.7,.2,1);}
@media (prefers-reduced-motion:reduce){
  .dgfrm .gpl-svg{opacity:1!important;transform:none!important;transition:none!important;}
}
`;
