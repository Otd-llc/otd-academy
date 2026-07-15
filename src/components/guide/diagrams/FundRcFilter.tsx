// A low-pass filter passes low frequencies and blocks high ones (v2).
// Fundamentals cluster. Owner-picked G4 ("passes low, blocks high").
//
// Teaching point: a reactive part (a capacitor) reacts to how fast a signal
// changes. An RC low-pass lets a slow wave through nearly untouched and comes
// out shrunken for a fast one, because the cap can't follow the quick swings.
// The corner between the two is the cutoff fc = 1 / (2π R C).
//
// Landscape desktop/print: two wave rows, a low frequency passing over a high
// frequency attenuated. REFLOWS to two stacked cards on a phone. Token-only
// color; green marks the passed band, red the rejected one, blue the output.
import { DiagramFrame } from "./DiagramFrame";

// deterministic sine polyline points (SSR/exporter-safe: no Math.random)
function sinePts(x0: number, x1: number, cy: number, amp: number, cycles: number): string {
  const p: string[] = [];
  for (let x = x0; x <= x1; x += 3) {
    const t = (x - x0) / (x1 - x0);
    p.push(`${x},${(cy - amp * Math.sin(t * cycles * 2 * Math.PI)).toFixed(1)}`);
  }
  return p.join(" ");
}

function Row({
  cy,
  cycles,
  outAmp,
  inX,
  outX,
}: {
  cy: number;
  cycles: number;
  outAmp: number;
  inX: [number, number];
  outX: [number, number];
}) {
  const ax0 = inX[1] + 6;
  const ax1 = outX[0] - 6;
  return (
    <>
      <polyline className="rc-in" fill="none" points={sinePts(inX[0], inX[1], cy, 26, cycles)} />
      <line className="rc-arrow" x1={ax0} y1={cy} x2={ax1} y2={cy} />
      <path className="rc-arrow" fill="none" d={`M${ax1 - 8},${cy - 5} L${ax1},${cy} L${ax1 - 8},${cy + 5}`} />
      <polyline className="rc-out" fill="none" points={sinePts(outX[0], outX[1], cy, outAmp, cycles)} />
    </>
  );
}

export function FundRcFilter({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="FUNDAMENTALS · REACTANCE & FILTERS"
      tone="gold"
      title="Reactive parts and filtering"
      ariaLabel="A low-pass filter passing low frequencies and blocking high ones. In the top row a slow, low-frequency wave goes in and comes out at nearly full amplitude: it passes. In the bottom row a fast, high-frequency wave of the same size goes in and comes out much smaller: it is attenuated. A capacitor reacts to how fast a signal changes, so an RC filter keeps the lows and rejects the highs, with the changeover at the cutoff frequency fc equals one over two-pi R C."
      caption={caption}
      defaultCaption="A cap reacts to how fast a signal changes. An RC filter passes slow signals and shrinks fast ones; the corner is fc = 1 / (2π R C)."
    >
      <style>{CSS}</style>

      {/* desktop / print: two wave rows */}
      <svg className="rc-scene" viewBox="0 0 520 230" aria-hidden="true">
        <text className="rc-lbl rc-pass" x="135" y="58" textAnchor="middle">LOW FREQ · PASSES</text>
        <Row cy={100} cycles={1.5} outAmp={24} inX={[50, 210]} outX={[258, 460]} />
        <text className="rc-lbl rc-block" x="135" y="150" textAnchor="middle">HIGH FREQ · BLOCKED</text>
        <Row cy={190} cycles={8} outAmp={6} inX={[50, 210]} outX={[258, 460]} />
      </svg>

      {/* phone: two stacked cards */}
      <ul className="rc-list" aria-hidden="true">
        <li>
          <span className="rc-li-lbl rc-pass">LOW FREQ · PASSES</span>
          <svg viewBox="0 0 300 56" className="rc-mini">
            <polyline className="rc-in" fill="none" points={sinePts(6, 118, 28, 18, 1.5)} />
            <line className="rc-arrow" x1={126} y1={28} x2={150} y2={28} />
            <path className="rc-arrow" fill="none" d="M142,23 L150,28 L142,33" />
            <polyline className="rc-out" fill="none" points={sinePts(158, 294, 28, 17, 1.5)} />
          </svg>
        </li>
        <li>
          <span className="rc-li-lbl rc-block">HIGH FREQ · BLOCKED</span>
          <svg viewBox="0 0 300 56" className="rc-mini">
            <polyline className="rc-in" fill="none" points={sinePts(6, 118, 28, 18, 7)} />
            <line className="rc-arrow" x1={126} y1={28} x2={150} y2={28} />
            <path className="rc-arrow" fill="none" d="M142,23 L150,28 L142,33" />
            <polyline className="rc-out" fill="none" points={sinePts(158, 294, 28, 4, 7)} />
          </svg>
        </li>
      </ul>
    </DiagramFrame>
  );
}

const CSS = `
.rc-scene{display:block;width:100%;height:auto;overflow:visible;}
.rc-in{stroke:var(--color-muted,#aaa);stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}
.rc-out{stroke:var(--color-signal-blue,#4a8fff);stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;}
.rc-arrow{stroke:var(--color-command-gold,#c8963e);stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;fill:none;}
.rc-lbl{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:13px;letter-spacing:.08em;}
.rc-pass{fill:var(--color-status-green,#66bb6a);color:var(--color-status-green,#66bb6a);}
.rc-block{fill:var(--color-alert-red,#ef5350);color:var(--color-alert-red,#ef5350);}

/* phone reflow */
.rc-list{display:none;list-style:none;margin:0;padding:0;flex-direction:column;gap:.6rem;}
@container (max-width:520px){ .rc-scene{display:none;} .rc-list{display:flex;} }
.rc-list li{display:flex;flex-direction:column;gap:.35rem;padding:.6rem .2rem;text-align:left;}
.rc-mini{display:block;width:100%;height:auto;overflow:visible;}
.rc-li-lbl{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.82rem;letter-spacing:.06em;}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .rc-out{opacity:0;}
.dgfrm.armed.in .rc-out{opacity:1;transition:opacity .6s ease .2s;}
@media (prefers-reduced-motion:reduce){ .dgfrm .rc-out{opacity:1!important;} }
`;
