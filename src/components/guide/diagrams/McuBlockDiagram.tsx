// What is inside a microcontroller (v2). Microcontrollers & ESP32 cluster.
// Owner-picked composition B9 ("the bus spine") from the diagram-1 round-2 sandbox.
//
// Teaching point: a microcontroller is one chip that ties a processor, memory,
// and a set of peripherals together on a single shared internal bus. The CPU, the
// RAM and flash, and the peripheral blocks (GPIO, ADC, timers, serial, radio) all
// hang off that one bus.
//
// Landscape desktop/print: a horizontal system bus with the blocks tapping it
// above and below. REFLOWS on a phone to the bus + a grouped block list.
// Token-only color.
import { DiagramFrame } from "./DiagramFrame";

const TOP = [
  { n: "CPU", x: 90 }, { n: "RAM", x: 210 }, { n: "FLASH", x: 330 }, { n: "TIMERS", x: 450 },
];
const BOT = [
  { n: "GPIO", x: 90 }, { n: "ADC", x: 210 }, { n: "SERIAL", x: 330 }, { n: "RF", x: 450 },
];
const BUS_Y = 104, BUS_H = 20;

export function McuBlockDiagram({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="MICROCONTROLLERS · WHAT IS INSIDE"
      tone="gold"
      title="One chip, all on one bus"
      ariaLabel="What is inside a microcontroller, drawn as a shared internal bus. A single system bus runs across the middle of the chip, and every block hangs off it. Above the bus sit the processor (the CPU) and the memory (RAM, the working memory, and flash, which keeps the firmware), along with the timers. Below the bus sit the peripherals that reach the outside world: GPIO, the ADC, the serial buses, and the radio. Because they all share one bus on one die, the CPU can read and write any of them. That is what makes it one chip instead of a boardful of parts."
      caption={caption}
      defaultCaption="One chip ties the processor, the memory, and the peripherals together on a single shared internal bus."
    >
      <style>{CSS}</style>

      <div className="bd">
        {/* desktop / print */}
        <svg className="bd-scene" viewBox="0 0 540 216" aria-hidden="true">
          {/* the system bus */}
          <rect className="bd-busfill" x={40} y={BUS_Y} width={460} height={BUS_H} rx={4} />
          <rect className="bd-busln" x={40} y={BUS_Y} width={460} height={BUS_H} rx={4} />
          <text className="bd-buslbl" x={270} y={BUS_Y + 14} textAnchor="middle">SYSTEM BUS</text>

          {/* top blocks + taps */}
          {TOP.map((b) => (
            <g key={b.n}>
              <rect className="bd-blk" x={b.x - 42} y={44} width={84} height={34} rx={5} />
              <text className="bd-nm" x={b.x} y={66} textAnchor="middle">{b.n}</text>
              <line className="bd-tap" x1={b.x} y1={78} x2={b.x} y2={BUS_Y} />
            </g>
          ))}

          {/* bottom blocks + taps */}
          {BOT.map((b) => (
            <g key={b.n}>
              <line className="bd-tap" x1={b.x} y1={BUS_Y + BUS_H} x2={b.x} y2={150} />
              <rect className="bd-blk" x={b.x - 42} y={150} width={84} height={34} rx={5} />
              <text className="bd-nm" x={b.x} y={172} textAnchor="middle">{b.n}</text>
            </g>
          ))}

          {/* role labels in the gutters */}
          <text className="bd-role" x={40} y={38} textAnchor="start">PROCESSOR · MEMORY</text>
          <text className="bd-role" x={500} y={200} textAnchor="end">PERIPHERALS · RADIO</text>
        </svg>

        {/* phone reflow */}
        <div className="bd-phone" aria-hidden="true">
          <p className="bd-pbus">SYSTEM BUS <span>ties it all together</span></p>
          <div className="bd-prow"><span className="bd-peye">Processor</span><span className="bd-pv">CPU · 2 cores</span></div>
          <div className="bd-prow"><span className="bd-peye">Memory</span><span className="bd-pv">RAM (volatile) · FLASH (firmware)</span></div>
          <div className="bd-prow"><span className="bd-peye">Peripherals</span><span className="bd-pv">GPIO · ADC · TIMERS · SERIAL · RF</span></div>
        </div>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.bd{display:block;}
.bd-scene{display:block;width:100%;height:auto;overflow:visible;}
.bd-busfill{fill:var(--color-command-gold,#c8963e);opacity:.16;}
.bd-busln{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:1.6;}
.bd-blk{fill:var(--color-navy-dark,#1a1a2e);stroke:var(--color-command-gold,#c8963e);stroke-width:1.7;}
.bd-tap{stroke:var(--color-command-gold,#c8963e);stroke-width:1.7;stroke-linecap:round;}
.bd-buslbl{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:11px;letter-spacing:.16em;fill:var(--color-command-gold,#c8963e);}
.bd-nm{font-family:var(--font-display,"Bebas Neue",sans-serif);font-size:19px;letter-spacing:.03em;fill:var(--color-title,#f1ece0);}
.bd-role{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:10px;letter-spacing:.14em;fill:var(--color-muted,#aaa);}

/* phone reflow */
.bd-phone{display:none;}
@media (max-width:520px){ .bd-scene{display:none;} .bd-phone{display:block;text-align:left;} }
.bd-pbus{margin:0 0 .7rem;text-align:center;font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.82rem;letter-spacing:.14em;color:var(--color-command-gold,#c8963e);border:1px solid var(--color-command-gold,#c8963e);border-radius:5px;padding:.4rem;background:color-mix(in srgb, var(--color-command-gold,#c8963e) 12%, transparent);}
.bd-pbus span{display:block;font-weight:400;font-size:.66rem;letter-spacing:.04em;color:var(--color-muted,#aaa);margin-top:.15rem;}
.bd-prow{display:flex;flex-direction:column;gap:.15rem;border:1px solid var(--color-panel-border,#3a3f50);background:var(--color-navy-dark,#1a1a2e);border-radius:6px;padding:.55rem .7rem;margin-bottom:.5rem;}
.bd-peye{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.66rem;letter-spacing:.12em;text-transform:uppercase;color:var(--color-command-gold,#c8963e);}
.bd-pv{font-family:var(--font-mono,"Space Mono",monospace);font-size:.92rem;color:var(--color-text,#e8e8e8);}
`;
