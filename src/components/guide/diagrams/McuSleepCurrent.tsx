// Sleep current: the wake-measure-sleep cycle (v2). Microcontrollers cluster.
//
// Teaching point: a battery board wakes for a few milliseconds (drawing
// milliamps), does its work, then deep-sleeps for seconds (drawing microamps). It
// spends almost all its time on the low floor, so the sleep current is what sets
// the battery life.
//
// Landscape desktop/print: a current-versus-time trace, tall brief spikes over a
// long low floor, with the "most of the time asleep" span. REFLOWS on a phone to
// a stat pair + summary. Token-only color.
import { DiagramFrame } from "./DiagramFrame";

const BASE = 224, PEAK = 94, X0 = 70, X1 = 604;

function tracePath(): string {
  const spikes = [126, 300, 474];
  const hw = 8;
  let d = `M${X0},${BASE}`;
  for (const cx of spikes) {
    d += ` L${cx - hw},${BASE} L${cx - hw},${PEAK} L${cx + hw},${PEAK} L${cx + hw},${BASE}`;
  }
  d += ` L${X1},${BASE}`;
  return d;
}

export function McuSleepCurrent({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="MICROCONTROLLERS · SLEEP"
      tone="gold"
      title="Where the battery goes"
      ariaLabel="A current-versus-time trace of a battery board's wake-measure-sleep cycle. The current spikes briefly to the milliamp range each time the board wakes to take a reading and send it, then drops back to a long, flat microamp floor while it deep-sleeps for seconds. The board spends almost all of its time on that low floor, so the sleep current, not the brief spikes, is what sets the battery life."
      caption={caption}
      defaultCaption="Brief milliamp spikes to wake and work, then a long microamp floor asleep. The floor is where the time goes, so it sets the battery life."
    >
      <style>{CSS}</style>

      <div className="sc">
        {/* desktop / print */}
        <svg className="sc-scene" viewBox="0 0 660 300" aria-hidden="true">
          {/* axes */}
          <line className="sc-axis" x1={X0} y1={PEAK - 8} x2={X0} y2={BASE} />
          <line className="sc-axis" x1={X0} y1={BASE} x2={X1 + 6} y2={BASE} />
          <line className="sc-grid" x1={X0} y1={PEAK} x2={X1} y2={PEAK} />
          <text className="sc-yhi" x={X0 - 8} y={PEAK + 4} textAnchor="end">150 mA</text>
          <text className="sc-ylo" x={X0 - 8} y={BASE + 4} textAnchor="end">10 uA</text>
          <text className="sc-ax" x={(X0 + X1) / 2} y={BASE + 22} textAnchor="middle">time →</text>

          {/* the trace */}
          <path className="sc-trace" fill="none" d={tracePath()} />

          {/* wake label on the first spike */}
          <text className="sc-wake" x={126} y={72} textAnchor="middle">WAKE</text>
          <text className="sc-wsub" x={126} y={88} textAnchor="middle">read + send · ms</text>

          {/* "most of the time asleep" span along a floor segment */}
          <line className="sc-span" x1={140} y1={206} x2={286} y2={206} />
          <path className="sc-span" fill="none" d="M148,201 L140,206 L148,211" />
          <path className="sc-span" fill="none" d="M278,201 L286,206 L278,211" />
          <text className="sc-spanl" x={213} y={200} textAnchor="middle">deep sleep · seconds</text>
          <text className="sc-floor" x={213} y={240} textAnchor="middle">almost all the time is spent here</text>
        </svg>

        {/* phone reflow */}
        <div className="sc-phone" aria-hidden="true">
          <div className="sc-stats">
            <div className="sc-st"><span className="sc-sn sc-gold">150 mA</span><span className="sc-sl">awake · a few ms</span></div>
            <div className="sc-st"><span className="sc-sn sc-blue">10 uA</span><span className="sc-sl">asleep · seconds</span></div>
          </div>
          <p className="sc-sum">The board wakes briefly to work, then deep-sleeps a long time. It spends almost all its time on the low floor, so the sleep current sets the battery life.</p>
        </div>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.sc{display:block;}
.sc-scene{display:block;width:100%;height:auto;overflow:visible;}
.sc-axis{stroke:var(--color-panel-border,#3a3f50);stroke-width:1.5;}
.sc-grid{stroke:var(--color-panel-border,#3a3f50);stroke-width:1;stroke-dasharray:2 4;}
.sc-trace{stroke:var(--color-command-gold,#c8963e);stroke-width:2.6;stroke-linejoin:round;stroke-linecap:round;}
.sc-yhi{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:13px;fill:var(--color-command-gold,#c8963e);}
.sc-ylo{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:13px;fill:var(--color-signal-blue,#4a8fff);}
.sc-ax{font-family:var(--font-mono,"Space Mono",monospace);font-weight:400;font-size:12px;fill:var(--color-muted,#aaa);}
.sc-wake{font-family:var(--font-display,"Bebas Neue",sans-serif);font-size:17px;letter-spacing:.05em;fill:var(--color-command-gold,#c8963e);}
.sc-wsub{font-family:var(--font-mono,"Space Mono",monospace);font-weight:400;font-size:10px;fill:var(--color-muted,#aaa);}
.sc-span{fill:none;stroke:var(--color-signal-blue,#4a8fff);stroke-width:1.6;}
.sc-spanl{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:11.5px;fill:var(--color-signal-blue,#4a8fff);}
.sc-floor{font-family:var(--font-serif,"Lora",serif);font-style:italic;font-size:12.5px;fill:var(--color-muted,#aaa);}

/* phone reflow */
.sc-phone{display:none;}
@media (max-width:520px){ .sc-scene{display:none;} .sc-phone{display:block;} }
.sc-stats{display:flex;gap:1.2rem;margin-bottom:.6rem;}
.sc-st{display:flex;flex-direction:column;}
.sc-sn{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:1.9rem;line-height:1;}
.sc-gold{color:var(--color-command-gold,#c8963e);}
.sc-blue{color:var(--color-signal-blue,#4a8fff);}
.sc-sl{font-family:var(--font-mono,"Space Mono",monospace);font-size:.72rem;letter-spacing:.04em;color:var(--color-muted,#aaa);margin-top:.15rem;}
.sc-sum{margin:0;font-family:var(--font-serif,"Lora",serif);font-size:.94rem;line-height:1.5;color:var(--color-text,#e8e8e8);}
`;
