// What is inside a microcontroller: the die floorplan (diagram-standards v2).
// Microcontrollers & ESP32 cluster, diagram 1. Owner-picked A7.
//
// Teaching point (lesson 0): a microcontroller is one chip that carries a CPU,
// its memory (SRAM + flash), a radio, and a row of peripherals on a single piece
// of silicon. The chip package is the hero — the CPU is the dominant block, the
// memory sits beside it (blue = data at rest), the radio fills a column, and the
// peripherals line the floor and break out through the pins to the world.
//
// One inline SVG, color via CSS classes so both themes flip. Reflows on a phone
// to the die header + a grouped block list. Header + caption from DiagramFrame.
import { DiagramFrame } from "./DiagramFrame";

const PADS = 10;
const PERIPHERALS = ["GPIO", "ADC", "TIMERS", "SERIAL", "USB"];

export function McuBlockDiagram({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="MICROCONTROLLERS · WHAT IS INSIDE"
      tone="gold"
      title="One chip, a whole computer"
      ariaLabel="What is inside a microcontroller, drawn as one die. Inside a single chip package sit the CPU (two cores, which runs your program), the memory (SRAM for the working variables and flash for the firmware), the radio (Wi-Fi and Bluetooth Low Energy), and a row of peripherals (GPIO, ADC, timers, serial, USB) that reach the outside world through the package pins. A desktop computer spreads those across many separate parts; a microcontroller puts them all on one piece of silicon."
      caption={caption}
      defaultCaption="One chip holds the CPU, the memory, the radio, and the peripherals on a single piece of silicon, with the pins breaking them out to the world."
    >
      <style>{CSS}</style>
      <div className="mb">
        <svg className="mb-svg" viewBox="0 0 540 250" aria-hidden="true">
          {/* package */}
          <rect x="60" y="30" width="420" height="190" rx="8" className="mb-pkg" />
          {Array.from({ length: PADS }, (_, i) => (
            <g key={i}>
              <rect x={96 + i * 38} y="20" width="9" height="7" rx="1.5" className="mb-pad" />
              <rect x={96 + i * 38} y="223" width="9" height="7" rx="1.5" className="mb-pad" />
            </g>
          ))}

          {/* CPU — dominant block */}
          <rect x="72" y="42" width="180" height="120" rx="4" className="mb-cpu" />
          <text x="162" y="98" textAnchor="middle" className="mb-nm-lg">CPU</text>
          <text x="162" y="118" textAnchor="middle" className="mb-sub">2 CORES</text>

          {/* memory — blue = data at rest */}
          <rect x="262" y="42" width="100" height="58" rx="4" className="mb-mem" />
          <text x="312" y="76" textAnchor="middle" className="mb-nm">SRAM</text>
          <rect x="262" y="104" width="100" height="58" rx="4" className="mb-mem" />
          <text x="312" y="138" textAnchor="middle" className="mb-nm">FLASH</text>

          {/* radio */}
          <rect x="372" y="42" width="96" height="120" rx="4" className="mb-rf" />
          <text x="420" y="96" textAnchor="middle" className="mb-nm">RADIO</text>
          <text x="420" y="114" textAnchor="middle" className="mb-tag">Wi-Fi / BLE</text>

          {/* peripheral floor */}
          {PERIPHERALS.map((p, i) => (
            <g key={p}>
              <rect x={72 + i * 79.2} y="172" width="72" height="34" rx="3" className="mb-per" />
              <text x={72 + i * 79.2 + 36} y="193" textAnchor="middle" className="mb-per-nm">{p}</text>
            </g>
          ))}

          <text x="270" y="242" textAnchor="middle" className="mb-die">ESP32-S3 · ONE PIECE OF SILICON</text>
        </svg>

        {/* phone reflow */}
        <div className="mb-phone" aria-hidden="true">
          <p className="mb-pdie">ESP32-S3 <span>one die</span></p>
          <div className="mb-prow"><span className="mb-peye">Processor</span><span className="mb-pv">CPU · 2 cores, runs your code</span></div>
          <div className="mb-prow mb-prow-b"><span className="mb-peye mb-peye-b">Memory</span><span className="mb-pv">SRAM (working) · FLASH (firmware)</span></div>
          <div className="mb-prow"><span className="mb-peye">Radio</span><span className="mb-pv">Wi-Fi · Bluetooth LE</span></div>
          <div className="mb-prow"><span className="mb-peye">Peripherals</span><span className="mb-pv">GPIO · ADC · TIMERS · SERIAL · USB</span></div>
        </div>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.mb{display:block;}
.mb-svg{display:block;width:100%;height:auto;overflow:visible;}
.mb-pkg{fill:var(--color-navy-dark,#1a1a2e);stroke:var(--color-command-gold,#c8963e);stroke-width:2.2;}
.mb-pad{fill:var(--color-command-gold,#c8963e);}
.mb-cpu{fill:var(--color-deep-space,#08090d);stroke:var(--color-command-gold,#c8963e);stroke-width:2;}
.mb-mem{fill:var(--color-deep-space,#08090d);stroke:var(--color-signal-blue,#4a8fff);stroke-width:1.7;}
.mb-rf{fill:var(--color-deep-space,#08090d);stroke:var(--color-gold-light,#e8b865);stroke-width:1.7;}
.mb-per{fill:var(--color-deep-space,#08090d);stroke:var(--color-gold-light,#e8b865);stroke-width:1.4;}
.mb-nm-lg{font-family:var(--font-display,"Bebas Neue",sans-serif);font-size:30px;letter-spacing:.03em;fill:var(--color-title,#f1ece0);}
.mb-nm{font-family:var(--font-display,"Bebas Neue",sans-serif);font-size:20px;letter-spacing:.03em;fill:var(--color-title,#f1ece0);}
.mb-sub{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:700;font-size:14px;letter-spacing:.06em;fill:var(--color-muted,#aaaaaa);}
.mb-tag{font-family:var(--font-mono,"Space Mono",monospace);font-size:11px;fill:var(--color-muted,#aaaaaa);}
.mb-per-nm{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:12px;fill:var(--color-title,#f1ece0);}
.mb-die{font-family:var(--font-mono,"Space Mono",monospace);font-size:11px;letter-spacing:.16em;fill:var(--color-muted,#aaaaaa);}

/* phone reflow */
.mb-phone{display:none;}
@media (max-width:520px){ .mb-svg{display:none;} .mb-phone{display:block;text-align:left;} }
.mb-pdie{margin:0 0 .7rem;text-align:center;font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.86rem;letter-spacing:.14em;color:var(--color-command-gold,#c8963e);border:1px solid var(--color-command-gold,#c8963e);border-radius:5px;padding:.45rem;}
.mb-pdie span{font-weight:400;letter-spacing:.04em;text-transform:none;color:var(--color-muted,#aaaaaa);}
.mb-prow{display:flex;flex-direction:column;gap:.15rem;border:1px solid var(--color-gold-light,#e8b865);background:var(--color-navy-dark,#1a1a2e);border-radius:6px;padding:.55rem .7rem;margin-bottom:.5rem;}
.mb-prow-b{border-color:var(--color-signal-blue,#4a8fff);}
.mb-peye{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;color:var(--color-command-gold,#c8963e);}
.mb-peye-b{color:var(--color-signal-blue,#4a8fff);}
.mb-pv{font-family:var(--font-mono,"Space Mono",monospace);font-size:.92rem;color:var(--color-text,#e8e8e8);}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .mb-svg,.dgfrm.armed .mb-phone{opacity:0;transform:translateY(6px);}
.dgfrm.armed.in .mb-svg,.dgfrm.armed.in .mb-phone{opacity:1;transform:none;transition:opacity .6s ease,transform .6s cubic-bezier(.2,.7,.2,1);}
@media (prefers-reduced-motion:reduce){
  .dgfrm .mb-svg,.dgfrm .mb-phone{opacity:1!important;transform:none!important;transition:none!important;}
}
`;
