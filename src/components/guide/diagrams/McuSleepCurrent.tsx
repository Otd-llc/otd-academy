// Sleep current: the wake-measure-sleep cycle (diagram-standards v2).
// MCU cluster, diagram 10. Owner-picked SL5: the trace plus runtime bars.
//
// Teaching point (lesson 9): a battery board wakes for a few milliseconds (drawing
// milliamps), works, then deep-sleeps for seconds (drawing microamps). Because it
// is asleep almost the whole time, the low sleep floor sets the average current,
// and so the battery life: hours if always on, months if mostly asleep (the
// lesson's own "difference between hours and months"). Top is the current trace;
// below, two runtime bars compare the two. Current values are illustrative ESP32
// ballparks; the bar lengths are illustrative, not to scale.
//
// Trace path computed once at module scope. Color via CSS classes; Saira for the
// current numbers. Header + caption from the DiagramFrame.
import { DiagramFrame } from "./DiagramFrame";

const X0 = 70, X1 = 478, YT = 44, YB = 118;
const CYC = [70, 230, 390], SW = 22;
const TRACE = (() => {
  let d = `M${X0} ${YB}`;
  CYC.forEach((cx) => { d += ` L${cx} ${YB} L${cx} ${YT} L${cx + SW * 0.7} ${YT} L${cx + SW} ${YB}`; });
  d += ` L${X1} ${YB}`;
  return d;
})();
const AREA = `${TRACE} L${X1} ${YB} L${X0} ${YB} Z`;

export function McuSleepCurrent({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="MICROCONTROLLERS · SLEEP"
      tone="gold"
      title="The sleep floor sets the battery life"
      ariaLabel="A current-versus-time trace of a wake-measure-sleep cycle: brief tall active spikes reaching about 150 milliamps, each followed by a long flat sleep floor near 10 microamps, repeating. Below, two runtime bars compare a board left always on, which lasts hours, against one that is mostly asleep, which lasts months. The low sleep floor, held almost the whole time, is what sets the battery life."
      caption={caption}
      defaultCaption="Brief active spikes, then a long low sleep floor near 10 microamps. Because the board is asleep almost the whole time, that floor sets the battery life: hours if always on, months if mostly asleep."
    >
      <style>{CSS}</style>
      <div className="sc">
        <svg className="sc-svg" viewBox="0 0 540 226" aria-hidden="true">
          <defs>
            <linearGradient id="sc-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" className="sc-g0" />
              <stop offset="1" className="sc-g1" />
            </linearGradient>
          </defs>

          {/* current trace */}
          <line x1={X0} y1="28" x2={X0} y2={YB} className="sc-axis" />
          <line x1={X0} y1={YB} x2={X1 + 12} y2={YB} className="sc-axis" />
          <text x={X0 - 8} y={YT + 4} textAnchor="end" className="sc-num">150 mA</text>
          <text x={X0 - 8} y={YB + 2} textAnchor="end" className="sc-num">10 µA</text>
          <path d={AREA} className="sc-area" />
          <path d={TRACE} className="sc-trace" />
          <text x={CYC[0] + 24} y={YT - 2} className="sc-active">active</text>
          <text x="16" y="80" textAnchor="middle" className="sc-axlbl" transform="rotate(-90 16 80)">current</text>

          {/* runtime bars */}
          <text x="40" y="150" className="sc-runlbl">battery runtime</text>
          <text x="40" y="170" className="sc-barlbl">always on</text>
          <rect x="188" y="159" width="58" height="14" rx="2" className="sc-bar-dim" />
          <text x="252" y="170" className="sc-barval-dim">hours</text>
          <text x="40" y="200" className="sc-barlbl-g">mostly asleep</text>
          <rect x="188" y="189" width="252" height="14" rx="2" className="sc-bar-gold" />
          <text x="446" y="200" className="sc-barval">months</text>
          <text x={X1 + 12} y="219" textAnchor="end" className="sc-note">bars illustrative, not to scale</text>
        </svg>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.sc{max-width:36rem;margin-inline:auto;}
.sc-svg{display:block;width:100%;height:auto;overflow:visible;}
.sc-axis{stroke:var(--color-panel-border,#3a3f50);stroke-width:1.3;}
.sc-num{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:700;font-size:12px;fill:var(--color-muted,#aaaaaa);}
.sc-g0{stop-color:var(--color-command-gold,#c8963e);stop-opacity:.35;}
.sc-g1{stop-color:var(--color-command-gold,#c8963e);stop-opacity:0;}
.sc-area{fill:url(#sc-fill);}
.sc-trace{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2.4;stroke-linejoin:round;}
.sc-active{font-family:var(--font-mono,"Space Mono",monospace);font-size:10px;fill:var(--color-command-gold,#c8963e);}
.sc-axlbl{font-family:var(--font-mono,"Space Mono",monospace);font-size:11px;fill:var(--color-muted,#aaaaaa);}
.sc-runlbl{font-family:var(--font-mono,"Space Mono",monospace);font-size:10px;letter-spacing:.1em;text-transform:uppercase;fill:var(--color-muted,#aaaaaa);}
.sc-barlbl{font-family:var(--font-mono,"Space Mono",monospace);font-size:11px;fill:var(--color-muted,#aaaaaa);}
.sc-barlbl-g{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:11px;fill:var(--color-command-gold,#c8963e);}
.sc-bar-dim{fill:var(--color-panel-border,#3a3f50);}
.sc-bar-gold{fill:var(--color-command-gold,#c8963e);}
.sc-barval-dim{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:700;font-size:12px;fill:var(--color-muted,#aaaaaa);}
.sc-barval{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:700;font-size:13px;fill:var(--color-command-gold,#c8963e);}
.sc-note{font-family:var(--font-mono,"Space Mono",monospace);font-size:8.5px;fill:var(--color-muted,#aaaaaa);}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .sc-svg{opacity:0;transform:translateY(6px);}
.dgfrm.armed.in .sc-svg{opacity:1;transform:none;transition:opacity .6s ease,transform .6s cubic-bezier(.2,.7,.2,1);}
@media (prefers-reduced-motion:reduce){
  .dgfrm .sc-svg{opacity:1!important;transform:none!important;transition:none!important;}
}
`;
