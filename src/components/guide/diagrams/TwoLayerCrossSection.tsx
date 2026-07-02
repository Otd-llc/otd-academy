// 2-layer board stackup, drawn as an isometric block (v2).
//
// Teaching point: a 2-layer board is top copper (signals + the parts) / FR4 core
// (the fiberglass insulator) / bottom copper (one continuous ground plane). A
// plated via is a copper-walled hole drilled through the core that ties the two
// copper layers together; the parts (an IC, a chip resistor) ride on top.
//
// v2: a landscape isometric block (was a tall vertical stack). The BOARD is a
// physical object, so it keeps ONE fixed palette in BOTH themes — a real PCB
// looks the same on a dark or light page. The board/component colours are
// literal + intentional (NOT tokens); only the chrome around it (frame, title,
// the layer key) re-themes. On a phone the block scales and the key reflows to a
// stacked list so its text stays real px.
import { DiagramFrame } from "./DiagramFrame";

// ── fixed board + component palette (identical in dark and light) ──────────────
const CU = "#c8963e", CULIT = "#e8b865", CUSIDE = "#a5772c";
const FR4 = "#8a7d42", FR4SIDE = "#5f552b", HOLE = "#0a0b10";
const PKG = "#23283a", PKGLIT = "#343b52", PKGSIDE = "#191d2b", PIN = "#b9bfca";
const BLK = "#181b22", BLKLIT = "#242833", BLKSIDE = "#0f1117";

// ── isometric geometry ────────────────────────────────────────────────────────
const X = 20, Y = 84, W = 300, TC = 16, FR = 56, BC = 16, DX = 60, DY = 30;
const H = TC + FR + BC;
const topP = (x: number, y: number, w: number, dx: number, dy: number) => `M${x},${y} l${dx},-${dy} h${w} l-${dx},${dy} Z`;
const sideP = (x: number, y: number, w: number, h: number, dx: number, dy: number) => `M${x + w},${y} l${dx},-${dy} v${h} l-${dx},${dy} Z`;

// an iso box with a subtle lit-edge highlight along the top-front lip
function boxSvg(x: number, y: number, w: number, h: number, dx: number, dy: number, front: string, lit: string, sd: string) {
  return (
    `<path d="${sideP(x, y, w, h, dx, dy)}" fill="${sd}"/>` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${front}"/>` +
    `<path d="${topP(x, y, w, dx, dy)}" fill="${lit}"/>` +
    `<path d="M${x},${y} l${dx},-${dy} h${w}" fill="none" stroke="#ffffff" stroke-opacity="0.22" stroke-width="1.2"/>`
  );
}

// a faint fiberglass weave over the FR4 front face
function weave(x: number, y: number, w: number, h: number) {
  let g = `<g opacity="0.10">`;
  const st = 9;
  for (let i = -h; i < w; i += st) g += `<line x1="${x + Math.max(0, i)}" y1="${y + Math.max(0, -i)}" x2="${x + Math.min(w, i + h)}" y2="${y + Math.min(h, w - i)}" stroke="#ffffff" stroke-width="1"/>`;
  for (let i = 0; i < w + h; i += st) g += `<line x1="${x + Math.min(w, i)}" y1="${y + Math.max(0, i - w)}" x2="${x + Math.max(0, i - h)}" y2="${y + Math.min(h, i)}" stroke="#000000" stroke-width="1"/>`;
  return g + `</g>`;
}

function buildMarkup() {
  let g = "";
  // tight contact shadow tracing the board's parallelogram footprint
  g += `<path d="M${X + 2},${Y + H + 3} L${X + W + 2},${Y + H + 3} L${X + W + DX + 2},${Y + H - DY + 3} L${X + DX + 2},${Y + H - DY + 3} Z" fill="#000000" opacity="0.34" filter="url(#xsecBlur)"/>`;

  // board block: copper / FR4 (woven) / copper, lit top copper
  g += `<path d="${sideP(X, Y, W, TC, DX, DY)}" fill="${CUSIDE}"/><path d="${sideP(X, Y + TC, W, FR, DX, DY)}" fill="${FR4SIDE}"/><path d="${sideP(X, Y + TC + FR, W, BC, DX, DY)}" fill="${CUSIDE}"/>`;
  g += `<rect x="${X}" y="${Y}" width="${W}" height="${TC}" fill="${CU}"/>`;
  g += `<rect x="${X}" y="${Y + TC}" width="${W}" height="${FR}" fill="${FR4}"/>`;
  g += weave(X, Y + TC, W, FR);
  g += `<rect x="${X}" y="${Y + TC + FR}" width="${W}" height="${BC}" fill="${CU}"/>`;
  g += `<path d="${topP(X, Y, W, DX, DY)}" fill="${CULIT}"/>`;

  // SOIC IC on the top copper, left
  const ibx = X + W * 0.10 + DX * 0.30, iby = Y - DY * 0.30, iw = 60, ih = 20, icdx = DX * 0.42, icdy = DY * 0.42;
  g += boxSvg(ibx, iby - ih, iw, ih, icdx, icdy, PKG, PKGLIT, PKGSIDE);
  for (let i = 0; i < 4; i++) g += `<rect x="${ibx + 6 + i * 16}" y="${iby - 2}" width="3" height="6" fill="${PIN}"/>`;
  g += `<circle cx="${ibx + 8}" cy="${iby - ih + 8}" r="2" fill="${PKGSIDE}"/>`;

  // chip resistor on the top copper, right of centre
  const rbx = X + W * 0.52 + DX * 0.5, rby = Y - DY * 0.5, rw = 28, rh = 12, rcdx = DX * 0.30, rcdy = DY * 0.30;
  g += boxSvg(rbx, rby - rh, rw, rh, rcdx, rcdy, BLK, BLKLIT, BLKSIDE);
  g += `<rect x="${rbx}" y="${rby - rh}" width="5" height="${rh}" fill="${CU}"/><rect x="${rbx + rw - 5}" y="${rby - rh}" width="5" height="${rh}" fill="${CU}"/>`;

  // plated via: copper walls + drilled hole through the core; a bare dark oval on
  // top (a cut through the via's centre shows only the hole, no copper rim).
  const vx = X + W * 0.80, vw = 18, wall = 4, y0 = Y, y1 = Y + H;
  g += `<rect x="${vx + wall}" y="${y0}" width="${vw - 2 * wall}" height="${y1 - y0}" fill="${HOLE}"/>`;
  g += `<rect x="${vx}" y="${y0}" width="${wall}" height="${y1 - y0}" fill="${CU}"/><rect x="${vx + vw - wall}" y="${y0}" width="${wall}" height="${y1 - y0}" fill="${CU}"/>`;
  g += `<ellipse cx="${vx + vw / 2}" cy="${y0}" rx="${(vw - 2 * wall) / 2 + 1}" ry="3" fill="${HOLE}"/>`;

  return g;
}
// Static, module-constant markup (no props / no user input) — safe to inject.
const MARKUP = buildMarkup();

export function TwoLayerCrossSection({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="STACKUP · EDGE-ON"
      tone="gold"
      title="A 2-layer board, edge-on"
      ariaLabel="Isometric view of a two-layer board. The top copper carries the signals and the parts, shown as an IC and a chip resistor. Below it is the FR4 core, the fiberglass insulator. Below that is the bottom copper, one continuous ground plane, the return path every signal flows back through. A plated via, a copper-walled hole drilled through the core, ties the top and bottom copper together."
      caption={caption}
      defaultCaption="Top: signals and parts. Bottom: one solid ground plane every signal returns through."
    >
      <style>{CSS}</style>
      <div className="xsec-wrap">
        <svg className="xsec-svg" viewBox="0 0 400 188" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <defs>
            <filter id="xsecBlur" x="-30%" y="-120%" width="160%" height="360%">
              <feGaussianBlur stdDeviation="3" />
            </filter>
          </defs>
          <g dangerouslySetInnerHTML={{ __html: MARKUP }} />
        </svg>

        <ul className="xsec-key">
          <li>
            <span className="xsec-sw" style={{ background: CU }} aria-hidden="true" />
            <span className="xsec-txt"><b>Top copper</b>signals + the parts</span>
          </li>
          <li>
            <span className="xsec-sw" style={{ background: FR4 }} aria-hidden="true" />
            <span className="xsec-txt"><b>FR4 core</b>the fiberglass insulator</span>
          </li>
          <li>
            <span className="xsec-sw" style={{ background: CU }} aria-hidden="true" />
            <span className="xsec-txt"><b>Bottom copper</b>one solid ground plane</span>
          </li>
        </ul>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.xsec-wrap{display:flex;align-items:center;justify-content:center;gap:clamp(1rem,4vw,1.8rem);}
@media (max-width:520px){.xsec-wrap{flex-direction:column;gap:1rem;}}
.xsec-svg{display:block;width:100%;height:auto;overflow:visible;flex:1 1 56%;min-width:0;max-width:360px;}

.xsec-key{margin:0;padding:0;list-style:none;flex:1 1 42%;min-width:0;display:flex;flex-direction:column;gap:clamp(.7rem,2.4vw,.95rem);text-align:left;}
@media (max-width:520px){.xsec-key{flex-basis:auto;align-self:stretch;}}
.xsec-key li{display:flex;align-items:flex-start;gap:.65rem;}
.xsec-sw{flex:0 0 auto;width:15px;height:15px;margin-top:3px;border-radius:3px;box-shadow:0 0 0 1px rgba(0,0,0,.35);}
.xsec-sw-via{background:radial-gradient(circle at 50% 50%, #0a0b10 0 3.4px, #c8963e 3.4px)!important;}
.xsec-txt{min-width:0;font-family:var(--font-serif,"Lora",serif);font-size:clamp(.9rem,2.4vw,1rem);line-height:1.4;color:var(--color-muted,#aaa);}
.xsec-txt b{display:block;font-family:var(--font-mono,"Space Mono",monospace);font-size:clamp(1rem,2.7vw,1.15rem);font-weight:700;color:var(--color-title,#f1ece0);letter-spacing:.01em;margin-bottom:.1rem;}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .xsec-svg,.dgfrm.armed .xsec-key li{opacity:0;transform:translateY(6px);}
.dgfrm.armed.in .xsec-svg{opacity:1;transform:none;transition:opacity .55s ease,transform .55s cubic-bezier(.2,.7,.2,1);}
.dgfrm.armed.in .xsec-key li{opacity:1;transform:none;transition:opacity .5s ease,transform .5s ease;}
.dgfrm.armed.in .xsec-key li:nth-child(2){transition-delay:.1s;}
.dgfrm.armed.in .xsec-key li:nth-child(3){transition-delay:.2s;}
@media (prefers-reduced-motion:reduce){
  .dgfrm .xsec-svg,.dgfrm .xsec-key li{opacity:1!important;transform:none!important;transition:none!important;}
}
`;
