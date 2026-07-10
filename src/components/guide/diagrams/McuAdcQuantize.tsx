// ADC quantization: a voltage becomes a number (v2). Microcontrollers cluster.
//
// Teaching point: an ADC samples a smooth analog voltage and snaps it to the
// nearest of a fixed set of levels, giving a whole number. The reference sets the
// top of the range (full scale); the bit count sets how many levels, so the step
// size is Vref divided by 2^N.
//
// Landscape desktop/print: a plot of the smooth signal (gold) with the quantized
// staircase (blue) it becomes, plus the reading panel on the right. Levels are
// drawn simplified (8) with the real 12-bit count called out. REFLOWS on a phone
// to a stat + summary. Token-only color.
import { DiagramFrame } from "./DiagramFrame";

const X0 = 70, X1 = 430, YT = 54, YB = 246;
const LEVELS = 8; // illustrative; the real ADC is 12-bit (4096)
const V = (t: number) => 0.5 - 0.42 * Math.cos(Math.PI * t); // smooth rise, fraction of full scale
const X = (t: number) => X0 + (X1 - X0) * t;
const Y = (f: number) => YB - (YB - YT) * f;
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

function analogPath(): string {
  const pts: string[] = [];
  for (let t = 0; t <= 1.0001; t += 0.02) pts.push(`${X(t).toFixed(1)},${Y(V(t)).toFixed(1)}`);
  return "M" + pts.join(" L");
}
function stairPath(): string {
  let d = "";
  for (let i = 0; i < LEVELS; i++) {
    const code = clamp(Math.round(V(i / LEVELS) * (LEVELS - 1)), 0, LEVELS - 1);
    const y = Y(code / (LEVELS - 1));
    const xa = X(i / LEVELS), xb = X((i + 1) / LEVELS);
    d += i === 0 ? `M${xa.toFixed(1)},${y.toFixed(1)}` : `L${xa.toFixed(1)},${y.toFixed(1)}`;
    d += ` L${xb.toFixed(1)},${y.toFixed(1)}`;
  }
  return d;
}

export function McuAdcQuantize({ caption }: { caption?: string }) {
  const gridY = Array.from({ length: LEVELS }, (_, k) => Y(k / (LEVELS - 1)));
  return (
    <DiagramFrame
      eyebrow="MICROCONTROLLERS · ADC"
      tone="gold"
      title="A voltage becomes a number"
      ariaLabel="An analog-to-digital converter turns a smooth voltage into a whole number. A plot shows a smooth rising analog signal in gold and the quantized staircase it becomes in blue, snapped to the nearest level. The reference voltage marks the top of the range, full scale, and zero volts is the bottom. The number of levels is set by the bit count: the ESP32 ADC is 12-bit, giving 4096 steps, so the step size is the reference voltage divided by 4096. Half of full scale reads as the code 2048."
      caption={caption}
      defaultCaption="The reference sets full scale; the bits set the steps. A 12-bit ADC gives 4096 levels, so a voltage snaps to the nearest one."
    >
      <style>{CSS}</style>

      <div className="adq">
        {/* desktop / print */}
        <svg className="adq-scene" viewBox="0 0 660 300" aria-hidden="true">
          {/* level gridlines */}
          {gridY.map((y, i) => (
            <line key={i} className="adq-grid" x1={X0} y1={y} x2={X1} y2={y} />
          ))}
          {/* axes */}
          <line className="adq-axis" x1={X0} y1={YT - 6} x2={X0} y2={YB} />
          <line className="adq-axis" x1={X0} y1={YB} x2={X1 + 6} y2={YB} />
          <text className="adq-ref" x={X0 - 10} y={YT + 2} textAnchor="end">Vref</text>
          <text className="adq-ax" x={X0 - 10} y={YB} textAnchor="end">0 V</text>
          <text className="adq-ax" x={(X0 + X1) / 2} y={YB + 20} textAnchor="middle">time →</text>

          {/* quantized staircase (what you get) */}
          <path className="adq-stair" fill="none" d={stairPath()} />
          {/* smooth analog (what came in) */}
          <path className="adq-analog" fill="none" d={analogPath()} />

          {/* sample highlight at half scale → code 2048 */}
          <line className="adq-samp" x1={X(0.5)} y1={Y(V(0.5))} x2={X(0.5)} y2={YB} />
          <circle className="adq-dot" cx={X(0.5)} cy={Y(V(0.5))} r={4.5} />
          <line className="adq-samp" x1={X(0.5)} y1={Y(V(0.5))} x2={452} y2={Y(V(0.5))} />
          <path className="adq-samp" fill="none" d={`M444,${Y(V(0.5)) - 5} L452,${Y(V(0.5))} L444,${Y(V(0.5)) + 5}`} />

          {/* reading panel */}
          <text className="adq-hd" x={556} y={70} textAnchor="middle">THE READING</text>
          <text className="adq-big" x={556} y={112} textAnchor="middle">4096</text>
          <text className="adq-unit" x={556} y={132} textAnchor="middle">steps (12-bit)</text>
          <rect className="adq-code" x={505} y={146} width={102} height={34} rx={5} />
          <text className="adq-codev" x={556} y={169} textAnchor="middle">2048</text>
          <text className="adq-note" x={556} y={200} textAnchor="middle">half scale → 2048</text>
          <text className="adq-step" x={556} y={228} textAnchor="middle">step = Vref / 4096</text>
        </svg>

        {/* phone reflow */}
        <div className="adq-phone" aria-hidden="true">
          <div className="adq-stat"><span className="adq-snum">4096</span><span className="adq-slab">steps · 12-bit</span></div>
          <p className="adq-sum">A smooth voltage snaps to the nearest step and reads as a whole number. The reference sets full scale; the step size is <b>Vref / 4096</b>. Half of full scale reads <b>2048</b>.</p>
        </div>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.adq{display:block;}
.adq-scene{display:block;width:100%;height:auto;overflow:visible;}
.adq-grid{stroke:var(--color-panel-border,#3a3f50);stroke-width:1;stroke-dasharray:2 4;}
.adq-axis{stroke:var(--color-panel-border,#3a3f50);stroke-width:1.5;}
.adq-analog{stroke:var(--color-command-gold,#c8963e);stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;}
.adq-stair{stroke:var(--color-signal-blue,#4a8fff);stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round;}
.adq-samp{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:1.6;stroke-dasharray:3 3;}
.adq-dot{fill:var(--color-command-gold,#c8963e);}
.adq-ref{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:13px;fill:var(--color-command-gold,#c8963e);}
.adq-ax{font-family:var(--font-mono,"Space Mono",monospace);font-weight:400;font-size:12px;fill:var(--color-muted,#aaa);}
.adq-hd{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:12px;letter-spacing:.13em;fill:var(--color-command-gold,#c8963e);}
.adq-big{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:38px;fill:var(--color-title,#f1ece0);}
.adq-unit{font-family:var(--font-mono,"Space Mono",monospace);font-weight:400;font-size:12px;fill:var(--color-muted,#aaa);}
.adq-code{fill:none;stroke:var(--color-signal-blue,#4a8fff);stroke-width:1.8;}
.adq-codev{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:20px;fill:var(--color-signal-blue,#4a8fff);}
.adq-note{font-family:var(--font-mono,"Space Mono",monospace);font-weight:400;font-size:11.5px;fill:var(--color-muted,#aaa);}
.adq-step{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:15px;fill:var(--color-text,#e8e8e8);}

/* phone reflow */
.adq-phone{display:none;}
@media (max-width:520px){ .adq-scene{display:none;} .adq-phone{display:block;text-align:left;} }
.adq-stat{display:flex;align-items:baseline;gap:.5rem;margin-bottom:.5rem;}
.adq-snum{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:2.4rem;line-height:1;color:var(--color-command-gold,#c8963e);}
.adq-slab{font-family:var(--font-mono,"Space Mono",monospace);font-size:.8rem;letter-spacing:.08em;text-transform:uppercase;color:var(--color-muted,#aaa);}
.adq-sum{margin:0;font-family:var(--font-serif,"Lora",serif);font-size:.94rem;line-height:1.5;color:var(--color-text,#e8e8e8);}
.adq-sum b{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;color:var(--color-title,#f1ece0);}
`;
