// A pin three ways: pull-up, pull-down, floating (v2). Communication & Interfaces
// cluster. Owner-picked O1 (10-option round): the schematic, the level it reads,
// and the state word, for each of the three cases.
//
// Teaching point: a floating input has no defined level, so it drifts and reads
// noise. A pull-up resistor to the supply gives it a known idle high (a 1); a
// pull-down resistor to ground gives it a known idle low (a 0). The three panels
// show the same pin tied up, tied down, and left floating.
//
// Landscape desktop/print: three columns, each a mini schematic over a level line
// (flat high, flat low, or a noisy wander) and its state. REFLOWS on a phone to
// three stacked cards. Token-only color: gold = the pull-up / high, blue = the
// pull-down / low, red = the floating / undefined state (the one to avoid).
import { DiagramFrame } from "./DiagramFrame";

const CX = [110, 300, 490];

function ResistorV({ x, y1, y2 }: { x: number; y1: number; y2: number }) {
  const bh = 18;
  const by = (y1 + y2) / 2 - bh / 2;
  return (
    <>
      <line className="pud-g" x1={x} y1={y1} x2={x} y2={by} />
      <rect className="pud-res" x={x - 6} y={by} width={12} height={bh} rx={1} />
      <line className="pud-g" x1={x} y1={by + bh} x2={x} y2={y2} />
    </>
  );
}

function Gnd({ x, y }: { x: number; y: number }) {
  return (
    <>
      <line className="pud-gnd" x1={x} y1={y} x2={x} y2={y + 6} />
      <line className="pud-gnd" x1={x - 9} y1={y + 6} x2={x + 9} y2={y + 6} />
      <line className="pud-gnd" x1={x - 5} y1={y + 10} x2={x + 5} y2={y + 10} />
      <line className="pud-gnd" x1={x - 2} y1={y + 14} x2={x + 2} y2={y + 14} />
    </>
  );
}

// A deterministic jittery line (a floating pin picking up noise). No randomness so
// the raster is stable.
function noisyPath(x0: number, x1: number, cy: number, amp: number): string {
  const pts: string[] = [];
  for (let x = x0; x <= x1; x += 4) {
    const t = (x - x0) / (x1 - x0);
    const y = cy - amp * (Math.sin(t * 9 * 6.283) * 0.5 + Math.sin(t * 23 * 6.283 + 1) * 0.3 + Math.sin(t * 41 * 6.283) * 0.25);
    pts.push(`${x},${y.toFixed(1)}`);
  }
  return "M" + pts.join(" L");
}

export function CommsPullUpDown({ caption }: { caption?: string }) {
  const [u, d, f] = CX;
  return (
    <DiagramFrame
      eyebrow="COMMS · PULL-UPS"
      tone="gold"
      title="A pin, three ways"
      ariaLabel="The same input pin, tied three ways. With a pull-up resistor to 3.3 V, the pin idles high and reads a 1. With a pull-down resistor to ground, it idles low and reads a 0. With no resistor at all it floats, picking up noise and reading an unpredictable, undefined level. A pull-up or pull-down gives a line a known default; a floating input has none."
      caption={caption}
      defaultCaption="The same pin three ways: a pull-up holds it high, a pull-down holds it low, and with no resistor it floats and reads noise."
    >
      <style>{CSS}</style>

      {/* desktop / print: three columns */}
      <svg className="pud-scene" viewBox="0 0 600 224" aria-hidden="true">
        {/* pull-up */}
        <text className="pud-hd" x={u} y={40} textAnchor="middle">PULL-UP</text>
        <line className="pud-rail" x1={u - 30} y1={64} x2={u + 30} y2={64} />
        <text className="pud-vcc" x={u + 36} y={68}>3.3 V</text>
        <ResistorV x={u} y1={64} y2={120} />
        <circle className="pud-node" cx={u} cy={120} r={4} />
        <line className="pud-g" x1={u} y1={120} x2={u + 40} y2={120} />
        <text className="pud-pin" x={u + 44} y={124}>PIN</text>
        <line className="pud-lvl-hi" x1={u - 40} y1={160} x2={u + 40} y2={160} />
        <text className="pud-state pud-s-hi" x={u} y={200} textAnchor="middle">HIGH</text>

        {/* pull-down */}
        <text className="pud-hd" x={d} y={40} textAnchor="middle">PULL-DOWN</text>
        <line className="pud-g" x1={d} y1={64} x2={d} y2={80} />
        <circle className="pud-node" cx={d} cy={80} r={4} />
        <line className="pud-g" x1={d} y1={80} x2={d + 40} y2={80} />
        <text className="pud-pin" x={d + 44} y={84}>PIN</text>
        <ResistorV x={d} y1={80} y2={130} />
        <Gnd x={d} y={130} />
        <line className="pud-lvl-lo" x1={d - 40} y1={180} x2={d + 40} y2={180} />
        <text className="pud-state pud-s-lo" x={d} y={200} textAnchor="middle">LOW</text>

        {/* floating */}
        <text className="pud-hd" x={f} y={40} textAnchor="middle">FLOATING</text>
        <text className="pud-nores" x={f} y={70} textAnchor="middle">NO RESISTOR</text>
        <circle className="pud-node" cx={f} cy={90} r={4} />
        <line className="pud-g" x1={f} y1={90} x2={f + 40} y2={90} />
        <text className="pud-pin" x={f + 44} y={94}>PIN</text>
        <path className="pud-lvl-fl" d={noisyPath(f - 42, f + 42, 168, 12)} />
        <text className="pud-state pud-s-fl" x={f} y={200} textAnchor="middle">?</text>
      </svg>

      {/* phone: three stacked cards */}
      <ul className="pud-list" aria-hidden="true">
        <li className="pud-li">
          <span className="pud-li-hd pud-s-hi">PULL-UP</span>
          <svg viewBox="0 0 130 96" className="pud-mini" aria-hidden="true">
            <line className="pud-rail" x1={35} y1={14} x2={95} y2={14} />
            <ResistorV x={65} y1={14} y2={52} />
            <circle className="pud-node" cx={65} cy={52} r={4} />
            <line className="pud-g" x1={65} y1={52} x2={105} y2={52} />
            <line className="pud-lvl-hi" x1={25} y1={84} x2={105} y2={84} />
          </svg>
          <span className="pud-li-state pud-s-hi">HIGH · 1</span>
        </li>
        <li className="pud-li">
          <span className="pud-li-hd pud-s-lo">PULL-DOWN</span>
          <svg viewBox="0 0 130 96" className="pud-mini" aria-hidden="true">
            <circle className="pud-node" cx={65} cy={16} r={4} />
            <line className="pud-g" x1={65} y1={16} x2={105} y2={16} />
            <ResistorV x={65} y1={16} y2={56} />
            <Gnd x={65} y={56} />
            <line className="pud-lvl-lo" x1={25} y1={86} x2={105} y2={86} />
          </svg>
          <span className="pud-li-state pud-s-lo">LOW · 0</span>
        </li>
        <li className="pud-li">
          <span className="pud-li-hd pud-s-fl">FLOATING</span>
          <svg viewBox="0 0 130 96" className="pud-mini" aria-hidden="true">
            <circle className="pud-node" cx={65} cy={34} r={4} />
            <line className="pud-g" x1={65} y1={34} x2={105} y2={34} />
            <path className="pud-lvl-fl" d={noisyPath(23, 107, 78, 10)} />
          </svg>
          <span className="pud-li-state pud-s-fl">NOISE · ?</span>
        </li>
      </ul>
    </DiagramFrame>
  );
}

const CSS = `
.pud-scene{display:block;width:100%;height:auto;overflow:visible;}
.pud-hd{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:12px;letter-spacing:.04em;fill:var(--color-title,#f1ece0);text-transform:uppercase;}
.pud-rail{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2.2;}
.pud-res{fill:var(--color-navy-dark,#1a1a2e);stroke:var(--color-command-gold,#c8963e);stroke-width:2;}
.pud-g{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2;stroke-linecap:round;}
.pud-gnd{fill:none;stroke:var(--color-muted,#aaa);stroke-width:2;stroke-linecap:round;}
.pud-node{fill:var(--color-command-gold,#c8963e);}
.pud-vcc{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:11px;fill:var(--color-command-gold,#c8963e);}
.pud-pin{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:11px;fill:var(--color-muted,#aaa);}
.pud-nores{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:11px;fill:var(--color-muted,#aaa);letter-spacing:.03em;}
.pud-lvl-hi{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2.6;stroke-linecap:round;}
.pud-lvl-lo{fill:none;stroke:var(--color-signal-blue,#4a8fff);stroke-width:2.6;stroke-linecap:round;}
.pud-lvl-fl{fill:none;stroke:var(--color-alert-red,#ef5350);stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round;}
.pud-state{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:20px;}
.pud-s-hi{fill:var(--color-command-gold,#c8963e);color:var(--color-command-gold,#c8963e);}
.pud-s-lo{fill:var(--color-signal-blue,#4a8fff);color:var(--color-signal-blue,#4a8fff);}
.pud-s-fl{fill:var(--color-alert-red,#ef5350);color:var(--color-alert-red,#ef5350);}

/* phone reflow */
.pud-list{display:none;list-style:none;margin:0;padding:0;flex-direction:column;gap:.6rem;}
@media (max-width:520px){ .pud-scene{display:none;} .pud-list{display:flex;} }
.pud-li{display:flex;align-items:center;gap:.8rem;padding:.6rem .9rem;border-radius:8px;
  background:var(--color-navy-dark,#1a1a2e);box-shadow:inset 0 0 0 1.5px var(--color-panel-border,#3a3f50);}
.pud-li-hd{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.8rem;letter-spacing:.02em;min-width:88px;}
.pud-mini{flex:1;max-width:120px;height:auto;overflow:visible;}
.pud-li-state{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:1.1rem;min-width:78px;text-align:right;}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .pud-lvl-hi,.dgfrm.armed .pud-lvl-lo,.dgfrm.armed .pud-lvl-fl{opacity:0;}
.dgfrm.armed.in .pud-lvl-hi,.dgfrm.armed.in .pud-lvl-lo,.dgfrm.armed.in .pud-lvl-fl{opacity:1;transition:opacity .5s ease .3s;}
@media (prefers-reduced-motion:reduce){ .dgfrm .pud-lvl-hi,.dgfrm .pud-lvl-lo,.dgfrm .pud-lvl-fl{opacity:1!important;} }
`;
