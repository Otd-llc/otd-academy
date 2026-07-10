// Li-ion discharge curve (v2). Power & Batteries cluster. Owner-picked D8
// ("usable plateau").
//
// Teaching point (batteries-101): a lithium cell's voltage is not one number.
// It starts at 4.2 V full, holds a long flat plateau near its 3.7 V nominal for
// most of the discharge, then falls off a cliff to 3.0 V empty. A dashed box
// marks the plateau: nearly all the usable charge lives in that flat band.
//
// Landscape desktop/print: an XY chart, voltage vs state of charge, with the
// three key voltages ON the y-axis (4.2 / 3.7 / 3.0). REFLOWS to a compact curve
// plus an HTML fact strip on a phone, so no axis label scales under the floor.
// Token-only color, so it re-themes in light + print.
import { DiagramFrame } from "./DiagramFrame";

// (state-of-charge %, cell volts): 100% full at left -> 0% empty at right.
const CURVE: [number, number][] = [
  [100, 4.15], [92, 3.98], [80, 3.88], [62, 3.8], [42, 3.74],
  [26, 3.66], [15, 3.55], [8, 3.38], [3, 3.16], [0, 3.0],
];

// desktop plot box
const X0 = 64, X1 = 474, Y0 = 34, Y1 = 166, VHI = 4.2, VLO = 3.0;
const mx = (s: number) => X0 + ((100 - s) / 100) * (X1 - X0);
const my = (v: number) => Y0 + ((VHI - v) / (VHI - VLO)) * (Y1 - Y0);
const line = (pts: [number, number][], fx: (s: number) => number, fy: (v: number) => number) =>
  pts.map(([s, v]) => `${fx(s).toFixed(1)},${fy(v).toFixed(1)}`).join(" ");

// phone mini plot box (shape only, no axis text)
const px = (s: number) => 8 + ((100 - s) / 100) * 284;
const py = (v: number) => 6 + ((VHI - v) / (VHI - VLO)) * 78;

export function DischargeCurve({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="BATTERIES 101"
      tone="gold"
      title="How a Li-ion cell's voltage falls as it drains"
      ariaLabel="A lithium-ion discharge curve, cell voltage against state of charge from 100 percent full on the left to 0 percent empty on the right. The voltage starts at 4.2 volts full, holds a long flat plateau near its 3.7 volt nominal for most of the discharge, then drops off a cliff to 3.0 volts empty. A dashed box marks the plateau: nearly all the usable charge sits in that flat band."
      caption={caption}
      defaultCaption="Full at 4.2 V, flat near 3.7 V for most of the discharge, then a cliff to 3.0 V. Nearly all the usable charge is in the flat band."
    >
      <style>{CSS}</style>

      <div className="dc">
        {/* desktop / print: the XY chart */}
        <svg className="dc-scene" viewBox="0 0 512 210" aria-hidden="true">
          {/* usable-charge plateau box */}
          <rect className="dc-plateau" x={mx(90)} y={my(4.02)} width={mx(15) - mx(90)} height={my(3.48) - my(4.02)} rx="3" />
          <text className="dc-plbl" x={(mx(90) + mx(15)) / 2} y={my(4.02) - 8} textAnchor="middle">most of the usable charge</text>

          {/* axes */}
          <line className="dc-ax" x1={X0} y1={Y0 - 4} x2={X0} y2={Y1} />
          <line className="dc-ax" x1={X0} y1={Y1} x2={X1 + 6} y2={Y1} />
          {/* y ticks = the three key voltages */}
          {([[4.2, "4.2"], [3.7, "3.7"], [3.0, "3.0"]] as [number, string][]).map(([v, t]) => (
            <text className="dc-tick" key={t} x={X0 - 9} y={my(v) + 4} textAnchor="end">{t}</text>
          ))}
          <text className="dc-ttl" x={X0 - 44} y={(Y0 + Y1) / 2} textAnchor="middle" transform={`rotate(-90 ${X0 - 44} ${(Y0 + Y1) / 2})`}>cell volts</text>
          {/* x ticks */}
          {([[100, "100%"], [50, "50%"], [0, "0%"]] as [number, string][]).map(([s, t]) => (
            <text className="dc-tick" key={t} x={mx(s)} y={Y1 + 20} textAnchor="middle">{t}</text>
          ))}
          <text className="dc-ttl" x={(X0 + X1) / 2} y={Y1 + 38} textAnchor="middle">state of charge</text>

          {/* the curve */}
          <polyline className="dc-curve" fill="none" points={line(CURVE, mx, my)} />
          {/* nominal marker on the plateau */}
          <circle className="dc-dot" cx={mx(42)} cy={my(3.74)} r="4" />
          <text className="dc-nom" x={mx(42)} y={my(3.74) + 20} textAnchor="middle">3.7 V nominal</text>
        </svg>

        {/* phone: compact curve + fact strip */}
        <div className="dc-list" aria-hidden="true">
          <svg viewBox="0 0 300 92" className="dc-mini">
            <rect className="dc-plateau" x={px(90)} y={py(4.02)} width={px(15) - px(90)} height={py(3.48) - py(4.02)} rx="3" />
            <polyline className="dc-curve" fill="none" points={line(CURVE, px, py)} />
          </svg>
          <ul className="dc-facts">
            <li><b>4.2 V</b> full</li>
            <li><b>3.7 V</b> nominal</li>
            <li><b>3.0 V</b> empty</li>
          </ul>
          <p className="dc-note">The flat middle is most of the usable charge; the ends are brief.</p>
        </div>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.dc{display:block;}
.dc-scene{display:block;width:100%;height:auto;overflow:visible;}
.dc-curve{stroke:var(--color-command-gold,#c8963e);stroke-width:3.5;fill:none;stroke-linecap:round;stroke-linejoin:round;}
.dc-plateau{fill:var(--color-command-gold,#c8963e);opacity:.12;stroke:var(--color-gold-light,#e8b865);stroke-width:1.5;stroke-dasharray:5 4;}
.dc-ax{stroke:var(--color-panel-border,#3a3f50);stroke-width:1.5;fill:none;}
.dc-dot{fill:var(--color-command-gold,#c8963e);}
.dc-tick{font-family:var(--font-mono,"Space Mono",monospace);fill:var(--color-muted,#aaa);font-size:13px;}
.dc-ttl{font-family:var(--font-mono,"Space Mono",monospace);fill:var(--color-muted,#aaa);font-size:12px;}
.dc-plbl{font-family:var(--font-mono,"Space Mono",monospace);fill:var(--color-muted,#aaa);font-size:12.5px;}
.dc-nom{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;fill:var(--color-command-gold,#c8963e);font-size:14px;}

/* phone reflow */
.dc-list{display:none;flex-direction:column;gap:.7rem;}
@media (max-width:520px){ .dc-scene{display:none;} .dc-list{display:flex;} }
.dc-mini{display:block;width:100%;height:auto;overflow:visible;}
.dc-facts{display:flex;justify-content:space-between;gap:.4rem;list-style:none;margin:0;padding:0;}
.dc-facts li{flex:1 1 0;text-align:center;padding:.45rem .3rem;border-radius:6px;
  background:var(--color-navy-dark,#1a1a2e);box-shadow:inset 0 0 0 1.5px var(--color-panel-border,#3a3f50);
  font-family:var(--font-mono,"Space Mono",monospace);font-size:.8rem;color:var(--color-muted,#aaa);}
.dc-facts b{display:block;font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;
  font-size:1.25rem;color:var(--color-command-gold,#c8963e);line-height:1.1;}
.dc-note{margin:0;text-align:left;font-family:var(--font-serif,"Lora",serif);font-size:.86rem;color:var(--color-muted,#aaa);line-height:1.45;}

/* Tier-B reveal off the frame's armed/in contract (settled under reduced-motion). */
.dgfrm.armed .dc-curve{opacity:0;}
.dgfrm.armed.in .dc-curve{opacity:1;transition:opacity .6s ease .15s;}
@media (prefers-reduced-motion:reduce){ .dgfrm .dc-curve{opacity:1!important;} }
`;
