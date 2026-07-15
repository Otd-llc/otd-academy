// Stackup: 2-layer vs 4-layer, iso blocks (diagram-standards v2).
//
// Teaching point (lesson 6): a stackup is the sandwich of copper and insulator a
// board is built from. Two layers is the cheap default (copper top / FR4 core /
// copper bottom). Four layers add two dedicated inner planes, a ground plane and
// a power plane, sandwiched close against the outer signal layers, so every
// signal has a return plane a fraction of a millimetre away.
//
// Drawn as two isometric blocks in the SAME style as the L1-01 "2-layer board,
// edge-on" diagram (TwoLayerCrossSection): lit copper, woven FR4/prepreg. The
// board is a physical object with ONE fixed palette in both themes; only the
// DiagramFrame chrome re-themes. Side by side on desktop; stacked on a phone.
// The 2-layer/4-layer captions are HTML px, so there is no in-SVG text to shrink.
import { DiagramFrame } from "./DiagramFrame";

// ── fixed board palette (identical in dark and light) ──────────────────────────
const CU = "#c8963e", CULIT = "#e8b865", CUSIDE = "#a5772c";
const PP = "#9a8b4c", PPSIDE = "#69602f", CORE = "#7e7238", CORESIDE = "#544c26";

const topP = (x: number, y: number, w: number, dx: number, dy: number) => `M${x},${y} l${dx},-${dy} h${w} l-${dx},${dy} Z`;
const sideP = (x: number, y: number, w: number, h: number, dx: number, dy: number) => `M${x + w},${y} l${dx},-${dy} v${h} l-${dx},${dy} Z`;
function weave(x: number, y: number, w: number, h: number) {
  let g = `<g opacity="0.09">`;
  const st = 8;
  for (let i = -h; i < w; i += st) g += `<line x1="${x + Math.max(0, i)}" y1="${y + Math.max(0, -i)}" x2="${x + Math.min(w, i + h)}" y2="${y + Math.min(h, w - i)}" stroke="#ffffff" stroke-width="1"/>`;
  for (let i = 0; i < w + h; i += st) g += `<line x1="${x + Math.min(w, i)}" y1="${y + Math.max(0, i - w)}" x2="${x + Math.max(0, i - h)}" y2="${y + Math.min(h, i)}" stroke="#000000" stroke-width="1"/>`;
  return g + `</g>`;
}

type Band = { h: number; fill: string; side: string; wv?: boolean };
const TWO: Band[] = [
  { h: 11, fill: CU, side: CUSIDE },
  { h: 40, fill: CORE, side: CORESIDE, wv: true },
  { h: 11, fill: CU, side: CUSIDE },
];
const FOUR: Band[] = [
  { h: 9, fill: CU, side: CUSIDE },
  { h: 15, fill: PP, side: PPSIDE, wv: true },
  { h: 10, fill: CU, side: CUSIDE },
  { h: 26, fill: CORE, side: CORESIDE, wv: true },
  { h: 10, fill: CU, side: CUSIDE },
  { h: 15, fill: PP, side: PPSIDE, wv: true },
  { h: 9, fill: CU, side: CUSIDE },
];

function block(bands: Band[], x: number, y0: number, w: number, dx: number, dy: number) {
  let y = y0;
  const rows = bands.map((b) => { const r = { y0: y, b }; y += b.h; return r; });
  let g = "";
  rows.forEach((o) => { g += `<path d="${sideP(x, o.y0, w, o.b.h, dx, dy)}" fill="${o.b.side}"/>`; });
  rows.forEach((o) => { g += `<rect x="${x}" y="${o.y0}" width="${w}" height="${o.b.h}" fill="${o.b.fill}"/>`; if (o.b.wv) g += weave(x, o.y0, w, o.b.h); });
  g += `<path d="${topP(x, y0, w, dx, dy)}" fill="${CULIT}"/>`;
  g += `<path d="M${x},${y0} l${dx},-${dy} h${w}" fill="none" stroke="#ffffff" stroke-opacity="0.22" stroke-width="1.2"/>`;
  return g;
}
const TWO_MARKUP = block(TWO, 20, 52, 140, 40, 20);
const FOUR_MARKUP = block(FOUR, 20, 32, 140, 40, 20);

export function PcbStackup({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="PCB · STACKUP"
      tone="gold"
      title="A stackup is a sandwich of copper and insulator"
      ariaLabel="Two boards edge-on. On the left a two-layer board: copper on top and bottom with an FR4 core between, so signals and ground share the two outer copper layers. On the right a four-layer board: the same outer signal layers, plus two dedicated inner copper planes, a ground plane and a power plane, sandwiched close against the signals by thin prepreg and a central core. The inner planes give every signal a return plane a fraction of a millimetre away, which is the reason to add layers."
      caption={caption}
      defaultCaption="Two layers is the cheap default; four adds dedicated inner ground and power planes, so every signal has a return plane right beside it."
    >
      <style>{CSS}</style>
      <div className="stk">
        <div className="stk-col">
          <svg className="stk-svg" viewBox="0 0 200 108" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
            <g dangerouslySetInnerHTML={{ __html: TWO_MARKUP }} />
          </svg>
          <p className="stk-cap stk-cap-m">2-layer</p>
        </div>
        <div className="stk-col">
          <svg className="stk-svg" viewBox="0 0 200 128" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
            <g dangerouslySetInnerHTML={{ __html: FOUR_MARKUP }} />
          </svg>
          <p className="stk-cap stk-cap-g">4-layer · inner planes</p>
        </div>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.stk{display:flex;align-items:flex-end;justify-content:center;gap:clamp(.6rem,3vw,1.4rem);}
@container (max-width:520px){.stk{flex-direction:column;align-items:stretch;gap:1.1rem;}}
.stk-col{flex:1 1 0;min-width:0;text-align:center;}
.stk-svg{display:block;width:100%;height:auto;overflow:visible;}
.stk-cap{margin:.5rem 0 0;font-family:var(--font-mono,"Space Mono",monospace);font-size:clamp(.82rem,2.2vw,.92rem);letter-spacing:.02em;}
.stk-cap-m{color:var(--color-muted,#aaaaaa);}
.stk-cap-g{color:var(--color-command-gold,#c8963e);}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .stk-col{opacity:0;transform:translateY(6px);}
.dgfrm.armed.in .stk-col{opacity:1;transform:none;transition:opacity .55s ease,transform .55s cubic-bezier(.2,.7,.2,1);}
.dgfrm.armed.in .stk-col:last-child{transition-delay:.12s;}
@media (prefers-reduced-motion:reduce){
  .dgfrm .stk-col{opacity:1!important;transform:none!important;transition:none!important;}
}
`;
