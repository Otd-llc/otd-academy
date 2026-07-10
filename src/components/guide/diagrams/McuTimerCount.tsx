// Clocks and timers: count the ticks, fire on schedule (diagram-standards v2).
// MCU cluster, diagram 7. Owner-picked T6: a three-lane scope trace.
//
// Teaching point (lesson 6): a clock is a steady stream of pulses; a timer is a
// hardware counter wired to it that increments on every tick, and when it reaches
// its target count N it fires an event and reloads. Three aligned lanes: the clock
// pulses, the count climbing to N and rolling over, and the event fired at each
// rollover. Because it counts a fixed frequency, the rate is exact.
//
// Scope paths computed once at module scope. Color via CSS classes; Saira for the
// count numbers. Header + caption from the DiagramFrame.
import { DiagramFrame } from "./DiagramFrame";

const X0 = 70, TW = 48, TICKS = 8, N = 4;
const UNIT = 14, YB = 160;
const FIRES = [X0 + N * TW, X0 + 2 * N * TW];

const CLK = (() => {
  const yTop = 40, yBot = 64;
  let d = `M${X0} ${yBot}`;
  let x = X0;
  for (let i = 0; i < TICKS; i++) {
    const h = TW / 2;
    d += ` L${x} ${yTop} L${x + h} ${yTop} L${x + h} ${yBot} L${x + TW} ${yBot}`;
    x += TW;
  }
  return d;
})();

const COUNT = (() => {
  let d = `M${X0} ${YB}`;
  let c = 0;
  for (let i = 1; i <= TICKS; i++) {
    const x = X0 + i * TW;
    d += ` L${x} ${(YB - c * UNIT).toFixed(1)}`;
    c++;
    if (c >= N) { d += ` L${x} ${(YB - N * UNIT).toFixed(1)} L${x} ${YB}`; c = 0; }
    else d += ` L${x} ${(YB - c * UNIT).toFixed(1)}`;
  }
  return d;
})();

export function McuTimerCount({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="MICROCONTROLLERS · TIMERS"
      tone="gold"
      title="Count the ticks, fire on schedule"
      ariaLabel="A timer drawn as a three-lane scope trace. The top lane is a steady clock of square pulses. The middle lane is the timer's count, a staircase that climbs one step on every clock tick, from zero up to its target N, then drops back to zero. The bottom lane is the event the timer fires at each rollover, aligned to the moment the count reaches N. Because it counts a fixed frequency, the event repeats at an exact rate, such as a 1 Hz blink or a 250 Hz sample."
      caption={caption}
      defaultCaption="A timer counts clock ticks and fires every N of them, then reloads. Because it counts a fixed frequency, the rate is exact, a 1 Hz blink or a steady 250 Hz sample."
    >
      <style>{CSS}</style>
      <div className="tm">
        <svg className="tm-svg" viewBox="0 0 540 226" aria-hidden="true">
          {FIRES.map((x) => (
            <line key={x} x1={x} y1="34" x2={x} y2="204" className="tm-guide" />
          ))}

          <text x={X0 - 10} y="52" textAnchor="end" className="tm-lbl-clk">CLK</text>
          <path d={CLK} className="tm-clk" />

          <path d={COUNT} className="tm-count" />
          {Array.from({ length: N + 1 }, (_, k) => (
            <text key={k} x={X0 - 10} y={YB - k * UNIT + 4} textAnchor="end" className="tm-num">{k}</text>
          ))}
          <text x={X0 + 2 * N * TW + 14} y={YB - N * UNIT + 4} className="tm-count-lbl">count</text>

          {FIRES.map((x) => (
            <g key={x}>
              <line x1={x} y1="200" x2={x} y2="178" className="tm-fire" />
              <circle cx={x} cy="178" r="3.5" className="tm-firedot" />
            </g>
          ))}
          <text x={X0 - 10} y="192" textAnchor="end" className="tm-lbl-fire">FIRE</text>

          <text x="270" y="222" textAnchor="middle" className="tm-note">a steady rate: a 1 Hz blink, or exactly 250 Hz sampling</text>
        </svg>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.tm{max-width:36rem;margin-inline:auto;}
.tm-svg{display:block;width:100%;height:auto;overflow:visible;}
.tm-guide{stroke:var(--color-panel-border,#3a3f50);stroke-width:1;stroke-dasharray:2 4;}
.tm-clk{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2;}
.tm-count{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2.4;stroke-linejoin:round;}
.tm-fire{stroke:var(--color-signal-blue,#4a8fff);stroke-width:2.4;}
.tm-firedot{fill:var(--color-signal-blue,#4a8fff);}
.tm-num{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:700;font-size:12px;fill:var(--color-muted,#aaaaaa);}
.tm-count-lbl{font-family:var(--font-mono,"Space Mono",monospace);font-size:9.5px;fill:var(--color-muted,#aaaaaa);}
.tm-lbl-clk{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:10px;letter-spacing:.08em;fill:var(--color-command-gold,#c8963e);}
.tm-lbl-fire{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:10px;letter-spacing:.08em;fill:var(--color-signal-blue,#4a8fff);}
.tm-note{font-family:var(--font-mono,"Space Mono",monospace);font-size:10.5px;fill:var(--color-muted,#aaaaaa);}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .tm-svg{opacity:0;transform:translateY(6px);}
.dgfrm.armed.in .tm-svg{opacity:1;transform:none;transition:opacity .6s ease,transform .6s cubic-bezier(.2,.7,.2,1);}
@media (prefers-reduced-motion:reduce){
  .dgfrm .tm-svg{opacity:1!important;transform:none!important;transition:none!important;}
}
`;
