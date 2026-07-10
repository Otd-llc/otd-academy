// Clocks and timers: count ticks, fire every N (v2). Microcontrollers cluster.
//
// Teaching point: a timer counts the steady clock and fires an event every N
// ticks, so the time between fires is N divided by the clock frequency. That is
// how a board holds an exact rate.
//
// Landscape desktop/print: a clock waveform over the running count, with a fire
// marker each time the count reaches N, and the period formula. REFLOWS on a
// phone to a summary. Token-only color.
import { DiagramFrame } from "./DiagramFrame";

const X0 = 118, TW = 64, TICKS = 8, N = 4;
const Y_HI = 66, Y_LO = 92;

function clockPath(): string {
  let d = `M${X0},${Y_HI}`;
  for (let i = 0; i < TICKS; i++) {
    const xh = X0 + i * TW, xm = xh + TW / 2, xe = xh + TW;
    d += ` L${xm},${Y_HI} L${xm},${Y_LO} L${xe},${Y_LO} L${xe},${Y_HI}`;
  }
  return d;
}

export function McuTimerCount({ caption }: { caption?: string }) {
  const fires = [N - 1, 2 * N - 1]; // tick index where the count reaches N
  return (
    <DiagramFrame
      eyebrow="MICROCONTROLLERS · CLOCKS & TIMERS"
      tone="gold"
      title="Count the ticks, fire every N"
      ariaLabel="A steady clock signal, drawn as a square wave of ticks, drives a timer that counts each tick. The running count is shown under the ticks: 1, 2, 3, 4, then it resets and counts again. Every time the count reaches N (here 4) the timer fires an event, an interrupt, marked below. The time between fires is N ticks, which equals N divided by the clock frequency f-clk. That is how a board keeps an exact rate."
      caption={caption}
      defaultCaption="A timer counts clock ticks and fires an event every N of them. The time between fires is N divided by the clock frequency."
    >
      <style>{CSS}</style>

      <div className="tc">
        {/* desktop / print */}
        <svg className="tc-scene" viewBox="0 0 660 300" aria-hidden="true">
          <text className="tc-lbl" x={20} y={83} textAnchor="start">CLOCK</text>
          <path className="tc-clk" fill="none" d={clockPath()} />

          {/* running count under each tick */}
          <text className="tc-lbl" x={20} y={130} textAnchor="start">COUNT</text>
          {Array.from({ length: TICKS }, (_, i) => {
            const v = (i % N) + 1;
            const cx = X0 + i * TW + TW / 2;
            const hit = v === N;
            return (
              <text key={i} className={hit ? "tc-cnt tc-hit" : "tc-cnt"} x={cx} y={132} textAnchor="middle">{v}</text>
            );
          })}

          {/* fire markers each time count hits N */}
          {fires.map((i) => {
            const cx = X0 + i * TW + TW / 2;
            return (
              <g key={i}>
                <line className="tc-fire" x1={cx} y1={Y_LO} x2={cx} y2={192} />
                <path className="tc-fire" fill="none" d={`M${cx - 6},184 L${cx},192 L${cx + 6},184`} />
                <text className="tc-firel" x={cx} y={210} textAnchor="middle">FIRE</text>
                <text className="tc-fires" x={cx} y={224} textAnchor="middle">event</text>
              </g>
            );
          })}

          {/* period span between fires */}
          {(() => {
            const xa = X0 + fires[0] * TW + TW / 2, xb = X0 + fires[1] * TW + TW / 2;
            return (
              <g>
                <line className="tc-span" x1={xa} y1={166} x2={xb} y2={166} />
                <path className="tc-span" fill="none" d={`M${xa + 8},161 L${xa},166 L${xa + 8},171`} />
                <path className="tc-span" fill="none" d={`M${xb - 8},161 L${xb},166 L${xb - 8},171`} />
                <text className="tc-spanl" x={(xa + xb) / 2} y={160} textAnchor="middle">N ticks</text>
              </g>
            );
          })()}

          {/* period formula */}
          <text className="tc-eq" x={330} y={258} textAnchor="middle">
            t = N / f<tspan className="tc-sub" dy={4}>clk</tspan>
          </text>
        </svg>

        {/* phone reflow */}
        <div className="tc-phone" aria-hidden="true">
          <p className="tc-psum">The clock ticks steadily; the timer counts the ticks. Every <b>N</b> ticks it fires an event.</p>
          <p className="tc-peq">t = N / f<sub>clk</sub></p>
          <p className="tc-pnote">so a bigger N, or a slower clock, means a longer gap between fires.</p>
        </div>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.tc{display:block;}
.tc-scene{display:block;width:100%;height:auto;overflow:visible;}
.tc-clk{stroke:var(--color-command-gold,#c8963e);stroke-width:2.6;stroke-linejoin:round;stroke-linecap:round;}
.tc-lbl{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:11px;letter-spacing:.12em;fill:var(--color-muted,#aaa);}
.tc-cnt{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:20px;fill:var(--color-muted,#aaa);}
.tc-hit{fill:var(--color-command-gold,#c8963e);font-size:23px;}
.tc-fire{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;}
.tc-firel{font-family:var(--font-display,"Bebas Neue",sans-serif);font-size:16px;letter-spacing:.06em;fill:var(--color-command-gold,#c8963e);}
.tc-fires{font-family:var(--font-mono,"Space Mono",monospace);font-weight:400;font-size:10px;fill:var(--color-muted,#aaa);}
.tc-span{fill:none;stroke:var(--color-signal-blue,#4a8fff);stroke-width:1.6;}
.tc-spanl{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:11px;fill:var(--color-signal-blue,#4a8fff);}
.tc-eq{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:22px;fill:var(--color-title,#f1ece0);}
.tc-sub{font-size:14px;fill:var(--color-muted,#aaa);}

/* phone reflow */
.tc-phone{display:none;}
@media (max-width:520px){ .tc-scene{display:none;} .tc-phone{display:block;} }
.tc-psum{margin:0 0 .5rem;font-family:var(--font-serif,"Lora",serif);font-size:.95rem;line-height:1.5;color:var(--color-text,#e8e8e8);}
.tc-psum b{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;color:var(--color-command-gold,#c8963e);}
.tc-peq{margin:.2rem 0;font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:1.5rem;color:var(--color-title,#f1ece0);}
.tc-pnote{margin:.2rem 0 0;font-family:var(--font-serif,"Lora",serif);font-size:.9rem;color:var(--color-muted,#aaa);}
`;
