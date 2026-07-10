// CC/CV lithium charge curve (v2). Power & Batteries cluster.
// Owner-picked C7 (minimal overlay).
//
// Teaching point (battery-charging): a lithium cell charges in two phases. In
// constant current (CC) the charge current is held flat while the cell voltage
// climbs to 4.2 V. At the knee the charger switches to constant voltage (CV): it
// holds 4.2 V while the current tapers off toward zero. Gold = voltage (the
// target that rises and holds), blue = current (secondary, tapers).
//
// Landscape time chart; reflows on a phone to a compact curve + an HTML two-phase
// strip so no label scales under the floor. Token-only color (re-themes in
// light + print).
import { DiagramFrame } from "./DiagramFrame";

const X0 = 72, X1 = 468, Y0 = 44, Y1 = 190, KNEE = 0.55;
const tx = (t: number) => X0 + t * (X1 - X0);
const vY = (v: number) => Y0 + ((4.4 - v) / 1.4) * (Y1 - Y0);
const iY = (i: number) => Y1 - i * (Y1 - Y0) * 0.92;
// voltage: climbs 3.4 -> 4.2 during CC, then flat at 4.2 during CV
const VP: [number, number][] = [[0, 3.4], [0.12, 3.68], [0.26, 3.93], [0.4, 4.09], [0.5, 4.17], [0.55, 4.2], [1, 4.2]];
// current: held flat during CC, then tapers during CV
const IP: [number, number][] = [[0, 0.85], [0.55, 0.85], [0.63, 0.6], [0.72, 0.42], [0.82, 0.28], [0.9, 0.18], [1, 0.1]];
const vline = (pts: [number, number][], fy: (v: number) => number) =>
  "M" + pts.map(([t, v]) => `${tx(t).toFixed(1)},${fy(v).toFixed(1)}`).join(" L");

// phone mini geometry
const mtx = (t: number) => 8 + t * 284;
const mvY = (v: number) => 6 + ((4.4 - v) / 1.4) * 74;
const miY = (i: number) => 80 - i * 74 * 0.92;
const mline = (pts: [number, number][], fy: (v: number) => number) =>
  "M" + pts.map(([t, v]) => `${mtx(t).toFixed(1)},${fy(v).toFixed(1)}`).join(" L");

export function CcCvCurve({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="BATTERY CHARGING"
      tone="gold"
      title="Constant current, then constant voltage"
      ariaLabel="A CC/CV lithium charge curve over time. In the constant-current phase the charge current, in blue, is held flat while the cell voltage, in gold, climbs to 4.2 volts. At the knee, marked by a dashed divider, the charger switches to the constant-voltage phase: it holds 4.2 volts while the current tapers off toward zero."
      caption={caption}
      defaultCaption="Constant current lifts the voltage to 4.2 V; then constant voltage holds it while the current tapers off."
    >
      <style>{CSS}</style>

      <div className="cc">
        {/* desktop / print: overlaid curves */}
        <svg className="cc-scene" viewBox="0 0 512 212" aria-hidden="true">
          <line className="cc-ax" x1={X0} y1={Y0 - 6} x2={X0} y2={Y1} />
          <line className="cc-ax" x1={X0} y1={Y1} x2={X1 + 6} y2={Y1} />
          <line className="cc-div" x1={tx(KNEE)} y1={Y0 - 2} x2={tx(KNEE)} y2={Y1} />
          {/* small phase tags */}
          <text className="cc-ph" x={tx(0.27)} y={Y0 - 12} textAnchor="middle">CC</text>
          <text className="cc-ph" x={tx(0.78)} y={Y0 - 12} textAnchor="middle">CV</text>
          {/* curves */}
          <path className="cc-v" fill="none" d={vline(VP, vY)} />
          <path className="cc-i" fill="none" d={vline(IP, iY)} />
          {/* curve labels */}
          <text className="cc-lv" x={tx(0.46)} y={vY(4.12) - 9} textAnchor="middle">voltage</text>
          <text className="cc-li" x={tx(0.3)} y={iY(0.85) - 9} textAnchor="middle">current</text>
          <text className="cc-t" x={(X0 + X1) / 2} y={Y1 + 22} textAnchor="middle">time</text>
        </svg>

        {/* phone: compact curve + two-phase strip */}
        <div className="cc-list" aria-hidden="true">
          <svg viewBox="0 0 300 90" className="cc-mini">
            <line className="cc-div" x1={mtx(KNEE)} y1="4" x2={mtx(KNEE)} y2="84" />
            <path className="cc-v" fill="none" d={mline(VP, mvY)} />
            <path className="cc-i" fill="none" d={mline(IP, miY)} />
          </svg>
          <ul className="cc-rules">
            <li><b className="cc-b-cc">CC</b>hold the current, the voltage climbs to 4.2 V</li>
            <li><b className="cc-b-cv">CV</b>hold 4.2 V, the current tapers off</li>
          </ul>
        </div>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.cc{display:block;}
.cc-scene{display:block;width:100%;height:auto;overflow:visible;}
.cc-ax{stroke:var(--color-panel-border,#3a3f50);stroke-width:1.5;fill:none;}
.cc-div{stroke:var(--color-gold-light,#e8b865);stroke-width:1.5;stroke-dasharray:5 4;fill:none;}
.cc-v{stroke:var(--color-command-gold,#c8963e);stroke-width:3.5;stroke-linecap:round;stroke-linejoin:round;}
.cc-i{stroke:var(--color-signal-blue,#4a8fff);stroke-width:3;stroke-linecap:round;stroke-linejoin:round;}
.cc-ph{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:12px;letter-spacing:.1em;fill:var(--color-muted,#aaa);}
.cc-lv{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:14px;fill:var(--color-command-gold,#c8963e);}
.cc-li{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:14px;fill:var(--color-signal-blue,#4a8fff);}
.cc-t{font-family:var(--font-mono,"Space Mono",monospace);font-size:12px;fill:var(--color-muted,#aaa);}

/* phone reflow */
.cc-list{display:none;flex-direction:column;gap:.7rem;}
@media (max-width:520px){ .cc-scene{display:none;} .cc-list{display:flex;} }
.cc-mini{display:block;width:100%;height:auto;overflow:visible;}
.cc-rules{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.45rem;text-align:left;}
.cc-rules li{font-family:var(--font-mono,"Space Mono",monospace);font-size:.86rem;color:var(--color-muted,#aaa);
  display:flex;align-items:baseline;gap:.6rem;line-height:1.4;}
.cc-rules b{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:1.05rem;flex:none;width:2.2rem;}
.cc-b-cc{color:var(--color-command-gold,#c8963e);}
.cc-b-cv{color:var(--color-signal-blue,#4a8fff);}

/* Tier-B reveal off the frame's armed/in contract (settled under reduced-motion). */
.dgfrm.armed .cc-i{opacity:0;}
.dgfrm.armed.in .cc-i{opacity:1;transition:opacity .6s ease .15s;}
@media (prefers-reduced-motion:reduce){ .dgfrm .cc-i{opacity:1!important;} }
`;
