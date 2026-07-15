// Voltage divider, worked with real numbers (v2). Fundamentals cluster.
// Owner-picked E3 (variants-of-D1 round): a 5 V input across two 10 kΩ
// resistors taps out at 2.5 V.
//
// Teaching point: two resistors in series split the voltage, and the tap
// between them is Vout = Vin × R2 ÷ (R1 + R2). Equal resistors halve the input.
//
// Landscape desktop/print: the divider schematic on the left, the arithmetic on
// the right. REFLOWS on a phone to a full-width schematic over an HTML formula so
// the labels never scale under the floor. Token-only color.
import { DiagramFrame } from "./DiagramFrame";

// vertical zigzag resistor points, y-centred column at cx, from y0 down h
function vResPoints(cx: number, y0: number, h: number): string {
  const n = 6;
  const seg = h / n;
  const pts: [number, number][] = [[cx, y0]];
  for (let i = 0; i < n; i++) pts.push([cx + (i % 2 ? 8 : -8), y0 + seg * (i + 0.5)]);
  pts.push([cx, y0 + h]);
  return pts.map((p) => p.join(",")).join(" ");
}

function Divider({ cx, arrowLen }: { cx: number; arrowLen: number }) {
  const ax = cx + arrowLen;
  return (
    <>
      {/* Vin */}
      <line className="vd-wire" x1={cx} y1={45} x2={cx} y2={70} />
      <circle className="vd-node" cx={cx} cy={45} r={4} />
      <text className="vd-v" x={cx} y={34} textAnchor="middle">5 V</text>
      {/* R1 */}
      <polyline className="vd-wire" fill="none" points={vResPoints(cx, 70, 45)} />
      <text className="vd-r" x={cx - 40} y={97} textAnchor="end">10k</text>
      {/* tap + Vout */}
      <circle className="vd-node" cx={cx} cy={130} r={4} />
      <line className="vd-flow" x1={cx} y1={130} x2={ax} y2={130} />
      <path className="vd-flow" fill="none" d={`M${ax - 8},125 L${ax},130 L${ax - 8},135`} />
      <text className="vd-out" x={(cx + ax) / 2} y={120} textAnchor="middle">2.5 V</text>
      {/* R2 */}
      <polyline className="vd-wire" fill="none" points={vResPoints(cx, 130, 45)} />
      <text className="vd-r" x={cx - 40} y={157} textAnchor="end">10k</text>
      {/* GND */}
      <line className="vd-wire" x1={cx} y1={175} x2={cx} y2={200} />
      <line className="vd-wire" x1={cx - 13} y1={200} x2={cx + 13} y2={200} />
      <line className="vd-wire" x1={cx - 8} y1={205} x2={cx + 8} y2={205} />
      <line className="vd-wire" x1={cx - 3} y1={210} x2={cx + 3} y2={210} />
    </>
  );
}

export function FundVoltageDivider({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="FUNDAMENTALS · VOLTAGE DIVIDER"
      tone="gold"
      title="Voltage dividers"
      ariaLabel="A voltage divider worked with real numbers. A 5 volt input feeds two resistors in series, R1 of 10 kilohms on top and R2 of 10 kilohms on the bottom, with the tap between them going to ground. The output at the tap is Vout equals Vin times R2 divided by R1 plus R2, which is 5 times 10k over 20k, equal to one half of 5 volts, or 2.5 volts. Equal resistors halve the input."
      caption={caption}
      defaultCaption="Vout = Vin × R2 / (R1 + R2). Two equal resistors halve the input: 5 V taps out at 2.5 V."
    >
      <style>{CSS}</style>

      <div className="vd">
        {/* desktop / print: schematic + arithmetic */}
        <svg className="vd-scene" viewBox="0 0 520 235" aria-hidden="true">
          <Divider cx={150} arrowLen={85} />
          <text className="vd-eq" x={340} y={118} textAnchor="middle">2.5 = 5 ·</text>
          <text className="vd-eq" x={445} y={110} textAnchor="middle">10k</text>
          <line className="vd-frac" x1={410} y1={118} x2={480} y2={118} />
          <text className="vd-eq" x={445} y={135} textAnchor="middle">20k</text>
          <text className="vd-half" x={400} y={175} textAnchor="middle">= ½ · 5 V</text>
        </svg>

        {/* phone: full-width schematic + HTML formula */}
        <div className="vd-phone" aria-hidden="true">
          <svg className="vd-mini" viewBox="0 0 190 230">
            <Divider cx={95} arrowLen={70} />
          </svg>
          <p className="vd-formula">
            Vout = Vin · <span className="vd-fr"><span className="vd-num">R2</span><span className="vd-den">R1+R2</span></span>
          </p>
          <p className="vd-result">10k / 10k → ½ → 2.5 V</p>
        </div>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.vd{display:block;}
.vd-scene{display:block;width:100%;height:auto;overflow:visible;}
.vd-wire{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;}
.vd-flow{fill:none;stroke:var(--color-signal-blue,#4a8fff);stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;}
.vd-node{fill:var(--color-command-gold,#c8963e);}
.vd-v{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:15px;fill:var(--color-command-gold,#c8963e);}
.vd-out{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:15px;fill:var(--color-signal-blue,#4a8fff);}
.vd-r{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:13px;fill:var(--color-text,#e8e8e8);}
.vd-eq{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:16px;fill:var(--color-title,#f1ece0);}
.vd-frac{stroke:var(--color-title,#f1ece0);stroke-width:1.5;}
.vd-half{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:15px;fill:var(--color-command-gold,#c8963e);}

/* phone reflow */
.vd-phone{display:none;}
@container (max-width:520px){ .vd-scene{display:none;} .vd-phone{display:block;} }
.vd-mini{display:block;width:70%;max-width:220px;height:auto;margin:0 auto;overflow:visible;}
.vd-formula{margin:.4rem 0 0;text-align:center;font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:1.3rem;color:var(--color-title,#f1ece0);display:flex;align-items:center;justify-content:center;gap:.4rem;}
.vd-fr{display:inline-flex;flex-direction:column;align-items:center;line-height:1;}
.vd-fr .vd-den{border-top:2px solid currentColor;padding-top:.05rem;}
.vd-result{margin:.5rem 0 0;text-align:center;font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.9rem;color:var(--color-command-gold,#c8963e);}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .vd-flow,.dgfrm.armed .vd-out{opacity:0;}
.dgfrm.armed.in .vd-flow,.dgfrm.armed.in .vd-out{opacity:1;transition:opacity .5s ease .25s;}
@media (prefers-reduced-motion:reduce){
  .dgfrm .vd-flow,.dgfrm .vd-out{opacity:1!important;}
}
`;
