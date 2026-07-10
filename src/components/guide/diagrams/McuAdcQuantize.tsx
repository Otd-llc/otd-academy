// ADC quantization: a voltage becomes a number (diagram-standards v2).
// MCU cluster, diagram 3. Owner-picked Q1.
//
// Teaching point (lesson 2): an ADC splits its input range into steps and reports
// which step the voltage lands on. A smooth analog input (blue) rises across the
// range; the gold staircase is the quantized output, climbing one code at a time
// under the curve. The reference marks the top step (full scale); the bit count
// sets how many steps, so the ESP32's 12 bits give 4096. Eight shown for clarity.
//
// Chart paths are computed once at module scope (deterministic). Color via CSS
// classes so both themes flip; Saira for the code numbers. Caption from the frame.
import { DiagramFrame } from "./DiagramFrame";

const N = 8;
const PX0 = 64, PX1 = 430, PY0 = 194, PYT = 34, H = PY0 - PYT;
const vy = (v: number) => PY0 - v * H;
const curveY = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t);

const CURVE = (() => {
  let d = "M";
  for (let i = 0; i <= 64; i++) {
    const t = i / 64, x = PX0 + t * (PX1 - PX0), y = vy(curveY(t));
    d += `${i ? "L" : ""}${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  return d;
})();

const STAIR = (() => {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 200; i++) {
    const t = i / 200, x = PX0 + t * (PX1 - PX0);
    const lvl = Math.max(0, Math.min(N - 1, Math.floor(curveY(t) * N)));
    pts.push([x, lvl]);
  }
  let d = `M${pts[0][0].toFixed(1)} ${vy(pts[0][1] / N).toFixed(1)}`;
  let cur = pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [x, lvl] = pts[i];
    if (lvl !== cur) { d += ` L${x.toFixed(1)} ${vy(cur / N).toFixed(1)} L${x.toFixed(1)} ${vy(lvl / N).toFixed(1)}`; cur = lvl; }
  }
  d += ` L${pts[pts.length - 1][0].toFixed(1)} ${vy(cur / N).toFixed(1)}`;
  return d;
})();

export function McuAdcQuantize({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="MICROCONTROLLERS · ADC"
      tone="gold"
      title="A voltage becomes a number"
      ariaLabel="An analog-to-digital converter turning a smooth voltage into a number. A smooth analog input curve rises across the range; the converter reports the discrete step the voltage lands on, drawn as a gold staircase that climbs one code at a time under the curve. The reference voltage marks the top step, full scale, and the codes count up the right side. The ESP32's 12-bit converter has 4096 such steps; eight are shown for clarity."
      caption={caption}
      defaultCaption="A smooth voltage in, a numbered step out: the reference sets full scale and the bit count sets how many steps, so the ESP32's 12 bits give 4096 of them."
    >
      <style>{CSS}</style>
      <div className="adc">
        <svg className="adc-svg" viewBox="0 0 540 230" aria-hidden="true">
          {/* level grid */}
          {Array.from({ length: N + 1 }, (_, k) => (
            <line key={k} x1={PX0} y1={vy(k / N)} x2={PX1} y2={vy(k / N)} className="adc-grid" />
          ))}
          {/* axes */}
          <line x1={PX0} y1={PYT} x2={PX0} y2={PY0} className="adc-axis" />
          <line x1={PX0} y1={PY0} x2={PX1} y2={PY0} className="adc-axis" />
          {/* Vref full-scale */}
          <line x1={PX0} y1={PYT} x2={PX1} y2={PYT} className="adc-vref" />
          <text x={PX1} y={PYT - 6} textAnchor="end" className="adc-vref-lbl">Vref · FULL SCALE</text>
          {/* signals */}
          <path d={CURVE} className="adc-curve" />
          <path d={STAIR} className="adc-stair" />
          <text x={PX0 + 80} y={PYT + 16} className="adc-analog">analog in</text>
          {/* codes */}
          {Array.from({ length: N }, (_, k) => (
            <text key={k} x={PX1 + 10} y={vy(k / N + 0.5 / N) + 4} className="adc-code">{k}</text>
          ))}
          <text x={PX1 + 10} y={PY0 + 2} className="adc-lbl-sm">code</text>
          <text x={PX0 - 8} y={PY0 + 3} textAnchor="end" className="adc-zero">0</text>
          <text x="270" y="216" textAnchor="middle" className="adc-axlbl">INPUT VOLTAGE →</text>
        </svg>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.adc{max-width:36rem;margin-inline:auto;}
.adc-svg{display:block;width:100%;height:auto;overflow:visible;}
.adc-grid{stroke:var(--color-panel-border,#3a3f50);stroke-width:1;stroke-dasharray:2 4;}
.adc-axis{stroke:var(--color-panel-border,#3a3f50);stroke-width:1.3;}
.adc-vref{stroke:var(--color-command-gold,#c8963e);stroke-width:1.3;stroke-dasharray:5 4;}
.adc-vref-lbl{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:700;font-size:13px;fill:var(--color-command-gold,#c8963e);}
.adc-curve{fill:none;stroke:var(--color-signal-blue,#4a8fff);stroke-width:2.4;}
.adc-stair{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2.8;stroke-linejoin:round;}
.adc-analog{font-family:var(--font-mono,"Space Mono",monospace);font-size:12px;fill:var(--color-signal-blue,#4a8fff);}
.adc-code{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:700;font-size:13px;fill:var(--color-muted,#aaaaaa);}
.adc-lbl-sm{font-family:var(--font-mono,"Space Mono",monospace);font-size:10px;fill:var(--color-muted,#aaaaaa);}
.adc-zero{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:700;font-size:13px;fill:var(--color-muted,#aaaaaa);}
.adc-axlbl{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:700;font-size:13px;letter-spacing:.04em;fill:var(--color-muted,#aaaaaa);}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .adc-svg{opacity:0;transform:translateY(6px);}
.dgfrm.armed.in .adc-svg{opacity:1;transform:none;transition:opacity .6s ease,transform .6s cubic-bezier(.2,.7,.2,1);}
@media (prefers-reduced-motion:reduce){
  .dgfrm .adc-svg{opacity:1!important;transform:none!important;transition:none!important;}
}
`;
