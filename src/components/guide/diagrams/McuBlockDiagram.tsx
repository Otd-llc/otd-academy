// What is inside a microcontroller (v2). Microcontrollers & ESP32 cluster.
//
// Teaching point: a microcontroller is one chip that holds the processor, the
// memory, and the peripherals. The CPU and memory stay inside; the peripherals
// (GPIO, ADC, timers, serial) are the bridge that reaches the outside world.
//
// Landscape desktop/print: the die on the left with three stacked zones
// (processor, memory, peripherals) tied by an internal bus, wired out on the
// right to three things in the world (an LED it drives, a sensor it reads, a chip
// it talks to). REFLOWS on a phone to full-width stacked cards. Token-only color.
import { DiagramFrame } from "./DiagramFrame";

function Led({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <path className="bd-glyph-g" d="M-8,-9 L-8,9 L8,0 Z" />
      <line className="bd-glyph-g" x1={8} y1={-9} x2={8} y2={9} />
      <path className="bd-glyph-g" d="M2,-13 L6,-19 M8,-11 L12,-17" fill="none" />
    </g>
  );
}

function SensorWave({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect className="bd-glyph-b-fill" x={-13} y={-11} width={26} height={22} rx={3} />
      <path className="bd-glyph-b" fill="none" d="M-9,2 C-6,-8 -3,-8 0,0 C3,8 6,8 9,-2" />
    </g>
  );
}

function ChipIc({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect className="bd-glyph-g-fill" x={-11} y={-9} width={22} height={18} rx={2} />
      <circle className="bd-glyph-dot" cx={-5} cy={-3} r={1.6} />
      {[-6, 0, 6].map((o) => (
        <line key={`l${o}`} className="bd-glyph-g" x1={-11} y1={o} x2={-16} y2={o} />
      ))}
      {[-6, 0, 6].map((o) => (
        <line key={`r${o}`} className="bd-glyph-g" x1={11} y1={o} x2={16} y2={o} />
      ))}
    </g>
  );
}

export function McuBlockDiagram({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="MICROCONTROLLERS · WHAT IS INSIDE"
      tone="gold"
      title="One chip, three parts"
      ariaLabel="What is inside a microcontroller, drawn as one chip. The die holds three stacked zones tied by an internal bus. The processor zone is the CPU, with 2 cores on the ESP32-S3. The memory zone holds RAM, the working memory that is volatile, and flash, which keeps the firmware. The peripherals zone holds GPIO, ADC, timers, and serial blocks. The peripherals are the bridge to the outside world: the chip drives an LED, reads a sensor, and talks to another chip."
      caption={caption}
      defaultCaption="One chip holds the CPU, the memory, and the peripherals. The peripherals reach the outside world."
    >
      <style>{CSS}</style>

      <div className="bd">
        {/* desktop / print */}
        <svg className="bd-scene" viewBox="0 0 660 292" aria-hidden="true">
          {/* the die */}
          <rect className="bd-die" x={16} y={14} width={404} height={264} rx={12} />

          {/* internal bus spine + taps */}
          <line className="bd-bus" x1={26} y1={57} x2={26} y2={214} />
          <line className="bd-bus" x1={26} y1={57} x2={32} y2={57} />
          <line className="bd-bus" x1={26} y1={127} x2={32} y2={127} />
          <line className="bd-bus" x1={26} y1={214} x2={32} y2={214} />

          {/* PROCESSOR zone */}
          <rect className="bd-zone" x={32} y={28} width={372} height={58} rx={5} />
          <text className="bd-zeye" x={48} y={47}>PROCESSOR</text>
          <text className="bd-name" x={48} y={76}>CPU</text>
          <text className="bd-num" x={292} y={76}>2</text>
          <text className="bd-nlabel" x={314} y={76}>CORES</text>

          {/* MEMORY zone */}
          <rect className="bd-zone" x={32} y={98} width={372} height={58} rx={5} />
          <text className="bd-zeye" x={48} y={117}>MEMORY</text>
          <rect className="bd-cell" x={150} y={104} width={118} height={46} rx={4} />
          <text className="bd-cname" x={209} y={126} textAnchor="middle">RAM</text>
          <text className="bd-note" x={209} y={142} textAnchor="middle">working, volatile</text>
          <rect className="bd-cell" x={278} y={104} width={118} height={46} rx={4} />
          <text className="bd-cname" x={337} y={126} textAnchor="middle">FLASH</text>
          <text className="bd-note" x={337} y={142} textAnchor="middle">keeps firmware</text>

          {/* PERIPHERALS zone */}
          <rect className="bd-zone" x={32} y={168} width={372} height={92} rx={5} />
          <text className="bd-zeye" x={48} y={187}>PERIPHERALS</text>
          {["GPIO", "ADC", "TIMERS", "SERIAL"].map((p, i) => (
            <g key={p}>
              <rect className="bd-cell" x={44 + i * 88} y={200} width={80} height={50} rx={4} />
              <text className="bd-pname" x={84 + i * 88} y={230} textAnchor="middle">{p}</text>
            </g>
          ))}

          {/* peripherals reach out: right-edge spine tapped from the peripheral zone */}
          <line className="bd-bus" x1={404} y1={214} x2={420} y2={214} />
          <line className="bd-out" x1={420} y1={92} x2={420} y2={238} />

          {/* LED — driven (gold, out) */}
          <line className="bd-out" x1={420} y1={92} x2={452} y2={92} />
          <path className="bd-out" fill="none" d="M444,87 L452,92 L444,97" />
          <Led x={478} y={92} />
          <text className="bd-wname" x={512} y={88}>LED</text>
          <text className="bd-note" x={512} y={105}>you drive it</text>

          {/* SENSOR — read (blue, in) */}
          <line className="bd-in" x1={452} y1={165} x2={420} y2={165} />
          <path className="bd-in" fill="none" d="M428,160 L420,165 L428,170" />
          <SensorWave x={478} y={165} />
          <text className="bd-wname" x={512} y={161}>SENSOR</text>
          <text className="bd-note" x={512} y={178}>you read it</text>

          {/* CHIP — talk (gold, both ways) */}
          <line className="bd-out" x1={420} y1={238} x2={452} y2={238} />
          <path className="bd-out" fill="none" d="M444,233 L452,238 L444,243" />
          <path className="bd-out" fill="none" d="M428,233 L420,238 L428,243" />
          <ChipIc x={478} y={238} />
          <text className="bd-wname" x={512} y={234}>CHIP</text>
          <text className="bd-note" x={512} y={251}>you talk to it</text>
        </svg>

        {/* phone reflow */}
        <div className="bd-phone" aria-hidden="true">
          <p className="bd-phd">Inside the chip</p>
          <div className="bd-prow"><span className="bd-peye">Processor</span><span className="bd-pv">CPU · 2 cores</span></div>
          <div className="bd-prow"><span className="bd-peye">Memory</span><span className="bd-pv">RAM (volatile) · FLASH (firmware)</span></div>
          <div className="bd-prow"><span className="bd-peye">Peripherals</span><span className="bd-pv">GPIO · ADC · TIMERS · SERIAL</span></div>
          <p className="bd-parrow">the peripherals reach out to</p>
          <p className="bd-phd">The world</p>
          <div className="bd-pworld"><span>LED <em>drive it</em></span><span>SENSOR <em>read it</em></span><span>CHIP <em>talk to it</em></span></div>
        </div>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.bd{display:block;}
.bd-scene{display:block;width:100%;height:auto;overflow:visible;}
.bd-die{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2.5;}
.bd-zone{fill:var(--color-navy-dark,#1a1a2e);stroke:var(--color-panel-border,#3a3f50);stroke-width:1.2;}
.bd-cell{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:1.4;}
.bd-bus{stroke:var(--color-command-gold,#c8963e);stroke-width:1.6;stroke-linecap:round;}
.bd-out{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;}
.bd-in{fill:none;stroke:var(--color-signal-blue,#4a8fff);stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;}
.bd-hd{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:11px;letter-spacing:.16em;fill:var(--color-muted,#aaa);}
.bd-zeye{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:11px;letter-spacing:.14em;fill:var(--color-command-gold,#c8963e);}
.bd-name{font-family:var(--font-display,"Bebas Neue",sans-serif);font-size:26px;letter-spacing:.03em;fill:var(--color-title,#f1ece0);}
.bd-num{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:26px;fill:var(--color-command-gold,#c8963e);}
.bd-nlabel{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:12px;letter-spacing:.1em;fill:var(--color-muted,#aaa);}
.bd-cname{font-family:var(--font-display,"Bebas Neue",sans-serif);font-size:20px;letter-spacing:.03em;fill:var(--color-title,#f1ece0);}
.bd-pname{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:14px;letter-spacing:.06em;fill:var(--color-text,#e8e8e8);}
.bd-wname{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:13px;letter-spacing:.05em;fill:var(--color-title,#f1ece0);}
.bd-note{font-family:var(--font-mono,"Space Mono",monospace);font-weight:400;font-size:10.5px;fill:var(--color-muted,#aaa);}
.bd-glyph-g{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}
.bd-glyph-g-fill{fill:var(--color-navy-dark,#1a1a2e);stroke:var(--color-command-gold,#c8963e);stroke-width:2;}
.bd-glyph-b{fill:none;stroke:var(--color-signal-blue,#4a8fff);stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}
.bd-glyph-b-fill{fill:var(--color-navy-dark,#1a1a2e);stroke:var(--color-signal-blue,#4a8fff);stroke-width:1.8;}
.bd-glyph-dot{fill:var(--color-command-gold,#c8963e);}

/* phone reflow */
.bd-phone{display:none;}
@media (max-width:520px){ .bd-scene{display:none;} .bd-phone{display:block;text-align:left;} }
.bd-phd{margin:.2rem 0 .5rem;font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:var(--color-muted,#aaa);}
.bd-prow{display:flex;flex-direction:column;gap:.15rem;border:1px solid var(--color-panel-border,#3a3f50);background:var(--color-navy-dark,#1a1a2e);border-radius:6px;padding:.55rem .7rem;margin-bottom:.5rem;}
.bd-peye{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.66rem;letter-spacing:.12em;text-transform:uppercase;color:var(--color-command-gold,#c8963e);}
.bd-pv{font-family:var(--font-mono,"Space Mono",monospace);font-size:.92rem;color:var(--color-text,#e8e8e8);}
.bd-parrow{margin:.1rem 0 .6rem;text-align:center;font-family:var(--font-serif,"Lora",serif);font-style:italic;font-size:.85rem;color:var(--color-command-gold,#c8963e);}
.bd-pworld{display:flex;flex-direction:column;gap:.4rem;}
.bd-pworld span{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.9rem;color:var(--color-title,#f1ece0);}
.bd-pworld em{font-style:normal;font-weight:400;font-size:.82rem;color:var(--color-muted,#aaa);}
`;
