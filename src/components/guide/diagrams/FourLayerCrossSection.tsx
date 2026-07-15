// 4-layer board stackup (sig / GND / GND / sig), drawn as an isometric block.
//
// Teaching point: signals live on the OUTSIDE (F.Cu top, B.Cu bottom); two solid
// ground planes sit INSIDE (In1.Cu, In2.Cu), so every signal layer hugs an
// adjacent plane. The USB D+/D- pair rides F.Cu directly over the continuous
// In1.Cu plane — a clean, continuous reference the whole run. This is why L1.01 is
// four layers, not two: the native-USB pair is a forced long diagonal a 2-layer
// reference can't stay continuous under. Companion to TwoLayerCrossSection.
//
// Like its 2-layer sibling, the BOARD keeps ONE fixed palette in BOTH themes (a
// real PCB looks the same on a dark or light page); the board/trace colours are
// literal + intentional (NOT tokens). Only the chrome (frame, title, the layer
// key) re-themes. On a phone the block scales and the key reflows to a stacked
// list so its text stays real px.
import { DiagramFrame } from "./DiagramFrame";

// ── fixed board palette (identical in dark and light) ──────────────────────────
const CU = { f: "#c8963e", l: "#e8b865", s: "#a5772c" }; // copper
const PRE = { f: "#8a7d42", s: "#5f552b" };              // prepreg
const CORE = { f: "#796d3a", s: "#524824" };             // FR4 core

// ── stack model, top → bottom ──────────────────────────────────────────────────
type Layer = { k: "sig" | "gnd" | "pre" | "core"; t: number };
const STACK: Layer[] = [
  { k: "sig", t: 11 },   // F.Cu
  { k: "pre", t: 12 },   // prepreg
  { k: "gnd", t: 11 },   // In1.Cu (GND plane)
  { k: "core", t: 28 },  // core
  { k: "gnd", t: 11 },   // In2.Cu (GND plane)
  { k: "pre", t: 12 },   // prepreg
  { k: "sig", t: 11 },   // B.Cu
];
const TOTAL = STACK.reduce((a, l) => a + l.t, 0);

// ── isometric geometry ─────────────────────────────────────────────────────────
const X = 30, Y0 = 58, W = 250, DX = 54, DY = 27;
const topP = (x: number, y: number, w: number) => `M${x},${y} l${DX},-${DY} h${w} l-${DX},${DY} Z`;
const sideP = (x: number, y: number, w: number, h: number) => `M${x + w},${y} l${DX},-${DY} v${h} l-${DX},${DY} Z`;
const colFor = (k: Layer["k"]) => (k === "pre" ? PRE : k === "core" ? CORE : CU);

// faint fiberglass weave over the dielectric front faces
function weave(x: number, y: number, w: number, h: number) {
  let g = `<g opacity="0.10">`;
  const st = 9;
  for (let i = -h; i < w; i += st)
    g += `<line x1="${x + Math.max(0, i)}" y1="${y + Math.max(0, -i)}" x2="${x + Math.min(w, i + h)}" y2="${y + Math.min(h, w - i)}" stroke="#ffffff" stroke-width="1"/>`;
  return g + `</g>`;
}

// the USB pair: two FLUSH copper traces patterned in the F.Cu top (bright bare
// copper + a dark keyline so they read against the copper; traces aren't raised).
function pairMarkup() {
  const x0 = X + W * 0.20, len = W * 0.48, dt = 0.06;
  const trace = (df: number) => {
    const p1x = x0 + df * DX, p1y = Y0 - df * DY, p2x = x0 + len + df * DX, p2y = Y0 - df * DY,
      p3x = x0 + len + (df + dt) * DX, p3y = Y0 - (df + dt) * DY, p4x = x0 + (df + dt) * DX, p4y = Y0 - (df + dt) * DY;
    return `<path d="M${p1x},${p1y} L${p2x},${p2y} L${p3x},${p3y} L${p4x},${p4y} Z" fill="${CU.l}" stroke="#5f4a1e" stroke-width="1.1"/>`;
  };
  const tx = x0 + 0.18 * DX;
  return (
    trace(0.18) + trace(0.48) +
    `<line x1="${tx - 4}" y1="22" x2="${tx}" y2="${Y0 - 0.18 * DY - 1}" class="x4-leader"/>` +
    `<text x="${tx - 16}" y="18" class="x4-pairlbl">D+ / D- pair</text>`
  );
}

function buildMarkup() {
  let g = "";
  // contact shadow
  g += `<path d="M${X + 2},${Y0 + TOTAL + 3} L${X + W + 2},${Y0 + TOTAL + 3} L${X + W + DX + 2},${Y0 + TOTAL - DY + 3} L${X + DX + 2},${Y0 + TOTAL - DY + 3} Z" fill="#000000" opacity="0.32" filter="url(#x4Blur)"/>`;
  // layers, top → bottom (side face + front face + weave on dielectrics)
  let y = Y0;
  for (const L of STACK) {
    const c = colFor(L.k);
    g += `<path d="${sideP(X, y, W, L.t)}" fill="${c.s}"/>`;
    g += `<rect x="${X}" y="${y}" width="${W}" height="${L.t}" fill="${c.f}"/>`;
    if (L.k === "pre" || L.k === "core") g += weave(X, y, W, L.t);
    y += L.t;
  }
  // lit top surface + highlight lip
  g += `<path d="${topP(X, Y0, W)}" fill="${CU.l}"/>`;
  g += `<path d="M${X},${Y0} l${DX},-${DY} h${W}" fill="none" stroke="#ffffff" stroke-opacity="0.22" stroke-width="1.2"/>`;
  g += pairMarkup();
  return g;
}
// Static, module-constant markup (no props / no user input) — safe to inject.
const MARKUP = buildMarkup();

export function FourLayerCrossSection({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="STACKUP · EDGE-ON"
      tone="gold"
      title="A 4-layer board, edge-on"
      ariaLabel="Isometric edge-on view of a four-layer circuit board. On top is F.Cu, the signal layer, carrying your traces including the USB D+/D- differential pair, drawn as two flush copper traces. Directly below it is In1.Cu, a solid ground plane, the reference the pair rides over. Then the FR4 core, then In2.Cu, a second solid ground plane, the reference for the bottom signals. On the bottom is B.Cu, the signal layer that fans the GPIO out, hugging In2. Thin prepreg layers insulate the outer copper from the planes. Signals sit on the outside and two ground planes sit inside, so every signal layer hugs a plane."
      caption={caption}
      defaultCaption="Signals outside, two ground planes inside, so every signal layer hugs a plane."
    >
      <style>{CSS}</style>
      <div className="x4-wrap">
        <svg className="x4-svg" viewBox="0 0 380 172" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <defs>
            <filter id="x4Blur" x="-30%" y="-120%" width="160%" height="360%">
              <feGaussianBlur stdDeviation="3" />
            </filter>
          </defs>
          <g dangerouslySetInnerHTML={{ __html: MARKUP }} />
        </svg>

        <ul className="x4-key">
          <li>
            <span className="x4-sw" style={{ background: CU.f }} aria-hidden="true" />
            <span className="x4-txt"><b>F.Cu · signal</b>your traces + the USB D+/D- pair</span>
          </li>
          <li>
            <span className="x4-sw" style={{ background: CU.f }} aria-hidden="true" />
            <span className="x4-txt"><b>In1.Cu · GND plane</b>the pair&apos;s reference, directly below</span>
          </li>
          <li>
            <span className="x4-sw" style={{ background: CU.f }} aria-hidden="true" />
            <span className="x4-txt"><b>In2.Cu · GND plane</b>reference for the bottom signals</span>
          </li>
          <li>
            <span className="x4-sw" style={{ background: CU.f }} aria-hidden="true" />
            <span className="x4-txt"><b>B.Cu · signal</b>GPIO fan-out, hugging In2</span>
          </li>
        </ul>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.x4-wrap{display:flex;align-items:center;justify-content:center;gap:clamp(1rem,4vw,1.8rem);}
@container (max-width:520px){.x4-wrap{flex-direction:column;gap:1rem;}}
.x4-svg{display:block;width:100%;height:auto;overflow:visible;flex:1 1 56%;min-width:0;max-width:380px;}
.x4-pairlbl{fill:var(--color-command-gold,#c8963e);font-family:var(--font-mono,"Space Mono",monospace);font-size:10px;font-weight:700;}
.x4-leader{stroke:var(--color-command-gold,#c8963e);stroke-width:1;}

.x4-key{margin:0;padding:0;list-style:none;flex:1 1 42%;min-width:0;display:flex;flex-direction:column;gap:clamp(.6rem,2.2vw,.9rem);text-align:left;}
@container (max-width:520px){.x4-key{flex-basis:auto;align-self:stretch;}}
.x4-key li{display:flex;align-items:flex-start;gap:.65rem;}
.x4-sw{flex:0 0 auto;width:15px;height:15px;margin-top:3px;border-radius:3px;box-shadow:0 0 0 1px rgba(0,0,0,.35);}
.x4-txt{min-width:0;font-family:var(--font-serif,"Lora",serif);font-size:clamp(.88rem,2.3vw,1rem);line-height:1.4;color:var(--color-muted,#aaa);}
.x4-txt b{display:block;font-family:var(--font-mono,"Space Mono",monospace);font-size:clamp(.95rem,2.6vw,1.1rem);font-weight:700;color:var(--color-title,#f1ece0);letter-spacing:.01em;margin-bottom:.1rem;}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .x4-svg,.dgfrm.armed .x4-key li{opacity:0;transform:translateY(6px);}
.dgfrm.armed.in .x4-svg{opacity:1;transform:none;transition:opacity .55s ease,transform .55s cubic-bezier(.2,.7,.2,1);}
.dgfrm.armed.in .x4-key li{opacity:1;transform:none;transition:opacity .5s ease,transform .5s ease;}
.dgfrm.armed.in .x4-key li:nth-child(2){transition-delay:.08s;}
.dgfrm.armed.in .x4-key li:nth-child(3){transition-delay:.16s;}
.dgfrm.armed.in .x4-key li:nth-child(4){transition-delay:.24s;}
@media (prefers-reduced-motion:reduce){
  .dgfrm .x4-svg,.dgfrm .x4-key li{opacity:1!important;transform:none!important;transition:none!important;}
}
`;
