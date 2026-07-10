// PWM duty cycle sets the average (v2). Microcontrollers & ESP32 cluster.
//
// Teaching point: switching a pin on and off fast, with a controllable on-
// fraction (duty cycle), averages to an in-between level. More on-time, higher
// average. Three duty cycles show it: 25, 50, 75 percent.
//
// Landscape desktop/print: three waveform panels side by side, gold square wave +
// blue dashed average. REFLOWS on a phone to three proportion rows. Token color.
import { DiagramFrame } from "./DiagramFrame";

const Y_HI = 92, Y_LO = 196; // Vsupply / 0 in plot coords

function squarePath(x0: number, x1: number, duty: number, periods: number): string {
  const T = (x1 - x0) / periods;
  let d = `M${x0},${Y_HI}`;
  for (let p = 0; p < periods; p++) {
    const xs = x0 + p * T;
    const xon = xs + duty * T;
    d += ` L${xon.toFixed(1)},${Y_HI} L${xon.toFixed(1)},${Y_LO} L${(xs + T).toFixed(1)},${Y_LO}`;
    if (p < periods - 1) d += ` L${(xs + T).toFixed(1)},${Y_HI}`;
  }
  return d;
}

function Panel({ px, duty, label, avg, showAxis }: { px: number; duty: number; label: string; avg: string; showAxis?: boolean }) {
  const x0 = px + 20, x1 = px + 180;
  const avgY = Y_LO - (Y_LO - Y_HI) * duty;
  return (
    <g>
      <text className="pwm-num" x={px + 100} y={62} textAnchor="middle">{label}<tspan className="pwm-pct">% DUTY</tspan></text>
      {/* baselines */}
      <line className="pwm-base" x1={x0} y1={Y_HI} x2={x1} y2={Y_HI} />
      <line className="pwm-base" x1={x0} y1={Y_LO} x2={x1} y2={Y_LO} />
      {showAxis ? (
        <>
          <text className="pwm-axl" x={x0 - 6} y={Y_HI + 4} textAnchor="end">Vsup</text>
          <text className="pwm-axl" x={x0 - 6} y={Y_LO + 4} textAnchor="end">0</text>
        </>
      ) : null}
      {/* average level */}
      <line className="pwm-avg" x1={x0} y1={avgY} x2={x1} y2={avgY} />
      {/* waveform */}
      <path className="pwm-wave" fill="none" d={squarePath(x0, x1, duty, 3)} />
      <text className="pwm-avgl" x={px + 100} y={222} textAnchor="middle">avg = {avg} · Vsup</text>
    </g>
  );
}

export function McuPwmDuty({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="MICROCONTROLLERS · PWM"
      tone="gold"
      title="Duty cycle sets the average"
      ariaLabel="Three pulse-width-modulation waveforms at different duty cycles. Each is a gold square wave switching between the supply voltage and zero, with a blue dashed line showing the average level it produces. At 25 percent duty the pin is on a quarter of each period and the average is 0.25 of the supply. At 50 percent it is on half the time and averages 0.5 of the supply. At 75 percent it is on three quarters of the time and averages 0.75 of the supply. The average tracks the on-fraction."
      caption={caption}
      defaultCaption="The on-fraction of each period, the duty cycle, sets the averaged output level."
    >
      <style>{CSS}</style>

      <div className="pwm">
        {/* desktop / print */}
        <svg className="pwm-scene" viewBox="0 0 660 250" aria-hidden="true">
          <Panel px={20} duty={0.25} label="25" avg="0.25" showAxis />
          <line className="pwm-div" x1={240} y1={50} x2={240} y2={210} />
          <Panel px={240} duty={0.5} label="50" avg="0.50" />
          <line className="pwm-div" x1={460} y1={50} x2={460} y2={210} />
          <Panel px={460} duty={0.75} label="75" avg="0.75" />
        </svg>

        {/* phone reflow */}
        <div className="pwm-phone" aria-hidden="true">
          {[["25", 25], ["50", 50], ["75", 75]].map(([l, d]) => (
            <div className="pwm-row" key={l as string}>
              <span className="pwm-rn">{l}<em>%</em></span>
              <span className="pwm-bar"><span className="pwm-fill" style={{ width: `${d}%` }} /></span>
              <span className="pwm-ra">0.{l === "50" ? "50" : l === "25" ? "25" : "75"} Vsup</span>
            </div>
          ))}
          <p className="pwm-sum">The on-fraction of each period sets the average level.</p>
        </div>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.pwm{display:block;}
.pwm-scene{display:block;width:100%;height:auto;overflow:visible;}
.pwm-base{stroke:var(--color-panel-border,#3a3f50);stroke-width:1;stroke-dasharray:2 4;}
.pwm-div{stroke:var(--color-panel-border,#3a3f50);stroke-width:1.2;stroke-dasharray:3 5;}
.pwm-wave{stroke:var(--color-command-gold,#c8963e);stroke-width:2.6;stroke-linejoin:round;stroke-linecap:round;}
.pwm-avg{stroke:var(--color-signal-blue,#4a8fff);stroke-width:2;stroke-dasharray:5 4;}
.pwm-num{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:26px;fill:var(--color-command-gold,#c8963e);}
.pwm-pct{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:12px;letter-spacing:.08em;fill:var(--color-muted,#aaa);}
.pwm-axl{font-family:var(--font-mono,"Space Mono",monospace);font-weight:400;font-size:11px;fill:var(--color-muted,#aaa);}
.pwm-avgl{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:14px;fill:var(--color-signal-blue,#4a8fff);}

/* phone reflow */
.pwm-phone{display:none;}
@media (max-width:520px){ .pwm-scene{display:none;} .pwm-phone{display:block;} }
.pwm-row{display:flex;align-items:center;gap:.6rem;margin-bottom:.6rem;}
.pwm-rn{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:1.5rem;color:var(--color-command-gold,#c8963e);min-width:2.6rem;}
.pwm-rn em{font-style:normal;font-size:.9rem;color:var(--color-muted,#aaa);margin-left:.1rem;}
.pwm-bar{flex:1;height:14px;border:1px solid var(--color-panel-border,#3a3f50);border-radius:3px;overflow:hidden;background:var(--color-navy-dark,#1a1a2e);}
.pwm-fill{display:block;height:100%;background:var(--color-command-gold,#c8963e);}
.pwm-ra{font-family:var(--font-mono,"Space Mono",monospace);font-size:.8rem;color:var(--color-signal-blue,#4a8fff);min-width:5rem;text-align:right;}
.pwm-sum{margin:.3rem 0 0;font-family:var(--font-serif,"Lora",serif);font-size:.9rem;color:var(--color-muted,#aaa);}
`;
