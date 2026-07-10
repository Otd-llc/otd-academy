// PWM: the on-fraction sets the level (diagram-standards v2).
// MCU cluster, diagram 4. Owner-picked P3: three panels side by side.
//
// Teaching point (lesson 3): a digital pin is only fully on or fully off, but
// switch it fast with a controllable on-fraction (the duty cycle) and it averages
// to a level in between. 25 percent duty averages a quarter of the supply, 50
// percent a half, 75 percent three-quarters. Each panel shows the square wave and
// a blue dashed line at the average it produces; the average rises with the duty.
//
// Three SVG panels in a flex row, so on a phone they stack full-width and the
// labels never shrink. Token color, both themes. Header + caption from DiagramFrame.
import { DiagramFrame } from "./DiagramFrame";

const X0 = 10, XW = 130, YT = 48, YB = 138, PER = 2;

function pwmPath(duty: number) {
  const T = XW / PER;
  let d = `M${X0} ${YT}`;
  let x = X0;
  for (let p = 0; p < PER; p++) {
    const hi = T * duty;
    d += ` L${(x + hi).toFixed(1)} ${YT} L${(x + hi).toFixed(1)} ${YB} L${(x + T).toFixed(1)} ${YB}`;
    if (p < PER - 1) d += ` L${(x + T).toFixed(1)} ${YT}`;
    x += T;
  }
  return d;
}

const PANELS = [
  { duty: 0.25, lbl: "25%", avg: "¼" },
  { duty: 0.5, lbl: "50%", avg: "½" },
  { duty: 0.75, lbl: "75%", avg: "¾" },
];

export function McuPwmDuty({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="MICROCONTROLLERS · PWM"
      tone="gold"
      title="The on-fraction sets the level"
      ariaLabel="Three PWM waveforms at 25, 50, and 75 percent duty cycle, side by side. Each is a square wave that spends that fraction of every period high; a blue dashed line marks the average output level it produces, rising from a quarter of the supply at 25 percent duty, to a half at 50 percent, to three-quarters at 75 percent. The on-fraction of each period sets the average."
      caption={caption}
      defaultCaption="Three duty cycles and the average each produces: the on-fraction of every period sets the level, from a quarter at 25 percent up to three-quarters at 75 percent."
    >
      <style>{CSS}</style>
      <div className="pw">
        {PANELS.map((p) => {
          const yAvg = YB - p.duty * (YB - YT);
          return (
            <svg key={p.lbl} className="pw-svg" viewBox="0 0 150 178" aria-hidden="true">
              <text x="75" y="26" textAnchor="middle" className="pw-duty">{p.lbl}</text>
              <text x="75" y="40" textAnchor="middle" className="pw-dutysub">duty</text>
              <line x1={X0} y1={YB} x2={X0 + XW} y2={YB} className="pw-base" />
              <path d={pwmPath(p.duty)} className="pw-wave" />
              <line x1={X0} y1={yAvg} x2={X0 + XW} y2={yAvg} className="pw-avg" />
              <text x="75" y="166" textAnchor="middle" className="pw-avglbl">avg {p.avg}</text>
            </svg>
          );
        })}
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.pw{display:flex;gap:.5rem;align-items:center;justify-content:center;max-width:36rem;margin-inline:auto;}
.pw-svg{flex:1 1 150px;min-width:0;max-width:180px;height:auto;overflow:visible;}
@media (max-width:520px){
  .pw{flex-direction:column;gap:.4rem;}
  .pw-svg{max-width:min(300px,100%);}
}
.pw-wave{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2.4;stroke-linejoin:round;}
.pw-avg{stroke:var(--color-signal-blue,#4a8fff);stroke-width:1.8;stroke-dasharray:5 4;}
.pw-base{stroke:var(--color-panel-border,#3a3f50);stroke-width:1;}
.pw-duty{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:700;font-size:19px;fill:var(--color-title,#f1ece0);}
.pw-dutysub{font-family:var(--font-mono,"Space Mono",monospace);font-size:9.5px;letter-spacing:.1em;fill:var(--color-muted,#aaaaaa);}
.pw-avglbl{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:700;font-size:14px;fill:var(--color-signal-blue,#4a8fff);}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .pw-svg{opacity:0;transform:translateY(6px);}
.dgfrm.armed.in .pw-svg{opacity:1;transform:none;transition:opacity .55s ease,transform .55s cubic-bezier(.2,.7,.2,1);}
.dgfrm.armed.in .pw-svg:nth-child(2){transition-delay:.1s;}
.dgfrm.armed.in .pw-svg:nth-child(3){transition-delay:.2s;}
@media (prefers-reduced-motion:reduce){
  .dgfrm .pw-svg{opacity:1!important;transform:none!important;transition:none!important;}
}
`;
