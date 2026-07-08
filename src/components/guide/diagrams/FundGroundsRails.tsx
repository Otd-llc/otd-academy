// Grounds and rails: a plane spreads the return current, a thin trace forces it
// single-file (v2). Fundamentals cluster. Owner-picked I6 (variants-of-H1 round).
//
// Teaching point: ground is the shared return path. A ground plane is a sheet of
// copper, so the return current fans out over many short parallel paths and its
// impedance stays tiny. A thin trace is a straw: the same current is squeezed
// down one long narrow path, where resistance and inductance build up and parts
// stop agreeing on where zero volts is. This is why a poured plane beats a trace.
//
// Landscape desktop/print: two panels side by side. REFLOWS to two stacked cards
// on a phone. Token-only color; gold = the copper plane, blue = return current,
// red = the thin trace; green/red labels mark the better/worse layout.
import { DiagramFrame } from "./DiagramFrame";

const SPREAD_ENDS: [number, number][] = [
  [35, 128],
  [65, 134],
  [95, 137],
  [125, 134],
  [155, 128],
];

function Arrow({ x1, y1, x2, y2, cls }: { x1: number; y1: number; x2: number; y2: number; cls: string }) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const h = 8;
  const hx1 = (x2 - h * Math.cos(a - 0.45)).toFixed(1);
  const hy1 = (y2 - h * Math.sin(a - 0.45)).toFixed(1);
  const hx2 = (x2 - h * Math.cos(a + 0.45)).toFixed(1);
  const hy2 = (y2 - h * Math.sin(a + 0.45)).toFixed(1);
  return (
    <>
      <line className={cls} x1={x1} y1={y1} x2={x2} y2={y2} />
      <path className={cls} fill="none" d={`M${hx1},${hy1} L${x2},${y2} L${hx2},${hy2}`} />
    </>
  );
}

// one panel in local coords (0..190 x 0..150)
function Panel({ spread }: { spread: boolean }) {
  return (
    <>
      {spread ? (
        <rect className="gr-plane" x={10} y={46} width={170} height={96} rx={4} />
      ) : null}
      <rect className="gr-board" x={10} y={46} width={170} height={96} rx={4} fill="none" />
      <rect className="gr-chip" x={60} y={6} width={70} height={30} rx={3} />
      <text className="gr-chip-t" x={95} y={26} textAnchor="middle">U1</text>
      {spread ? (
        SPREAD_ENDS.map(([ex, ey], i) => (
          <Arrow key={i} x1={95} y1={38} x2={ex} y2={ey} cls="gr-ret" />
        ))
      ) : (
        <>
          <line className="gr-trace" x1={95} y1={38} x2={95} y2={138} />
          <Arrow x1={95} y1={44} x2={95} y2={130} cls="gr-ret" />
        </>
      )}
    </>
  );
}

export function FundGroundsRails({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="FUNDAMENTALS · GROUNDS & RAILS"
      tone="gold"
      title="Grounds and power rails"
      ariaLabel="Two ways the return current gets back to the supply. On the left, over a ground plane, the current fans out from the chip across the copper along many short parallel paths, so the plane's impedance stays tiny. On the right, over a single thin trace, the same current is forced single-file down one narrow path, adding resistance and inductance and letting parts disagree on ground. A plane is a sheet and a trace is a straw, which is why a poured ground plane beats a thin trace."
      caption={caption}
      defaultCaption="Ground is the shared return. A plane lets it spread over many short paths; a thin trace squeezes it single-file down one."
    >
      <style>{CSS}</style>

      {/* desktop / print: two panels */}
      <svg className="gr-scene" viewBox="0 0 520 230" aria-hidden="true">
        <text className="gr-lbl gr-good" x="140" y="52" textAnchor="middle">PLANE · SPREADS</text>
        <g transform="translate(45,66)">
          <Panel spread />
        </g>
        <line className="gr-div" x1="260" y1="60" x2="260" y2="205" />
        <text className="gr-lbl gr-bad" x="380" y="52" textAnchor="middle">TRACE · SINGLE-FILE</text>
        <g transform="translate(285,66)">
          <Panel spread={false} />
        </g>
      </svg>

      {/* phone: two stacked cards */}
      <ul className="gr-list" aria-hidden="true">
        <li>
          <span className="gr-li-lbl gr-good">PLANE · SPREADS</span>
          <svg viewBox="0 0 190 150" className="gr-mini">
            <Panel spread />
          </svg>
        </li>
        <li>
          <span className="gr-li-lbl gr-bad">TRACE · SINGLE-FILE</span>
          <svg viewBox="0 0 190 150" className="gr-mini">
            <Panel spread={false} />
          </svg>
        </li>
      </ul>
    </DiagramFrame>
  );
}

const CSS = `
.gr-scene{display:block;width:100%;height:auto;overflow:visible;}
.gr-plane{fill:var(--color-command-gold,#c8963e);opacity:.22;}
.gr-board{stroke:var(--color-panel-border,#3a3f50);stroke-width:1.5;}
.gr-chip{fill:var(--color-navy-dark,#1f2438);stroke:var(--color-command-gold,#c8963e);stroke-width:2;}
.gr-chip-t{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:12px;fill:var(--color-text,#e8e8e8);}
.gr-ret{fill:none;stroke:var(--color-signal-blue,#4a8fff);stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;}
.gr-trace{stroke:var(--color-alert-red,#ef5350);stroke-width:1.5;stroke-linecap:round;}
.gr-div{stroke:var(--color-panel-border,#3a3f50);stroke-width:1.5;stroke-dasharray:4 4;}
.gr-lbl{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:12px;letter-spacing:.06em;}
.gr-good{fill:var(--color-status-green,#66bb6a);color:var(--color-status-green,#66bb6a);}
.gr-bad{fill:var(--color-alert-red,#ef5350);color:var(--color-alert-red,#ef5350);}

/* phone reflow */
.gr-list{display:none;list-style:none;margin:0;padding:0;flex-direction:column;gap:.6rem;}
@media (max-width:520px){ .gr-scene{display:none;} .gr-list{display:flex;} }
.gr-list li{display:flex;flex-direction:column;gap:.4rem;padding:.7rem .9rem;border-radius:6px;text-align:left;
  background:var(--color-navy-dark,#1f2438);box-shadow:inset 0 0 0 1.5px var(--color-panel-border,#3a3f50);}
.gr-mini{display:block;width:70%;max-width:230px;height:auto;margin:0 auto;overflow:visible;}
.gr-li-lbl{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.82rem;letter-spacing:.06em;}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .gr-ret{opacity:0;}
.dgfrm.armed.in .gr-ret{opacity:1;transition:opacity .5s ease .2s;}
@media (prefers-reduced-motion:reduce){ .dgfrm .gr-ret{opacity:1!important;} }
`;
