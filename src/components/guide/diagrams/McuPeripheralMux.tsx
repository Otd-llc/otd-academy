// On-chip peripheral + pin mux (v2). Microcontrollers & ESP32 cluster.
//
// Teaching point: a bus like SPI is a hardware block inside the chip. Its signals
// (SCLK, MOSI, MISO, CS) route through a pin mux out to whichever GPIO pins you
// choose, so the hardware does the timing and you pick the layout.
//
// Landscape desktop/print: SPI block on the left, its four signals through a PIN
// MUX, cross-routed to chosen GPIO pins on the right. REFLOWS on a phone to a
// summary. Token-only color.
import { DiagramFrame } from "./DiagramFrame";

const SIG = [
  { n: "SCLK", y: 108 },
  { n: "MOSI", y: 146 },
  { n: "MISO", y: 184 },
  { n: "CS", y: 222 },
];
// cross-routing: signal index -> GPIO row y (deliberately reordered = "you pick")
const MAP = [184, 108, 222, 146];
const GPIO = ["GPIO11", "GPIO12", "GPIO13", "GPIO14"];
const MUX_L = 250, MUX_R = 344, GP_X = 470;

export function McuPeripheralMux({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="MICROCONTROLLERS · PERIPHERALS"
      tone="gold"
      title="The bus block, muxed to your pins"
      ariaLabel="An SPI hardware peripheral inside the chip drives four signals: SCLK the clock, MOSI and MISO the data lines, and CS the chip select. All four run into a pin mux, a routing block, which sends each one out to a GPIO pin of your choosing. The wires cross on the way out to show that any signal can go to any free pin: here they land on GPIO11 through GPIO14. The hardware handles the exact timing; you pick the pins."
      caption={caption}
      defaultCaption="An SPI block's signals route through the pin mux to whichever GPIO pins you choose. The hardware does the timing; you pick the layout."
    >
      <style>{CSS}</style>

      <div className="pm">
        {/* desktop / print */}
        <svg className="pm-scene" viewBox="0 0 660 300" aria-hidden="true">
          {/* SPI peripheral block */}
          <rect className="pm-blk" x={22} y={92} width={120} height={146} rx={7} />
          <text className="pm-blkt" x={82} y={128} textAnchor="middle">SPI</text>
          <text className="pm-blks" x={82} y={146} textAnchor="middle">hardware block</text>
          {SIG.map((s) => (
            <g key={s.n}>
              <line className="pm-w" x1={142} y1={s.y} x2={MUX_L} y2={s.y} />
              <text className="pm-sig" x={152} y={s.y - 7} textAnchor="start">{s.n}</text>
            </g>
          ))}

          {/* pin mux */}
          <rect className="pm-mux" x={MUX_L} y={92} width={MUX_R - MUX_L} height={146} rx={6} />
          <text className="pm-muxt" x={(MUX_L + MUX_R) / 2} y={160} textAnchor="middle">PIN</text>
          <text className="pm-muxt" x={(MUX_L + MUX_R) / 2} y={182} textAnchor="middle">MUX</text>

          {/* cross-routed wires out to chosen GPIO */}
          {SIG.map((s, i) => {
            const gy = MAP[i];
            return (
              <g key={s.n}>
                <path className="pm-w" fill="none" d={`M${MUX_R},${s.y} C${MUX_R + 60},${s.y} ${GP_X - 60},${gy} ${GP_X - 8},${gy}`} />
                <path className="pm-w" fill="none" d={`M${GP_X - 16},${gy - 5} L${GP_X - 8},${gy} L${GP_X - 16},${gy + 5}`} />
              </g>
            );
          })}

          {/* GPIO pins */}
          {GPIO.map((g, i) => {
            const y = SIG[i].y;
            return (
              <g key={g}>
                <rect className="pm-gp" x={GP_X} y={y - 16} width={92} height={32} rx={5} />
                <text className="pm-gpt" x={GP_X + 46} y={y + 5} textAnchor="middle">{g}</text>
              </g>
            );
          })}
          <text className="pm-note" x={GP_X + 46} y={262} textAnchor="middle">pins you choose</text>
        </svg>

        {/* phone reflow */}
        <div className="pm-phone" aria-hidden="true">
          <p className="pm-psum">The <b>SPI</b> block's signals (SCLK, MOSI, MISO, CS) run through the <b>pin mux</b> out to GPIO pins you choose.</p>
          <p className="pm-pnote">The hardware clocks the bits with exact timing; you just pick which pins the bus lands on.</p>
        </div>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.pm{display:block;}
.pm-scene{display:block;width:100%;height:auto;overflow:visible;}
.pm-blk{fill:var(--color-navy-dark,#1a1a2e);stroke:var(--color-command-gold,#c8963e);stroke-width:1.9;}
.pm-mux{fill:var(--color-navy-dark,#1a1a2e);stroke:var(--color-command-gold,#c8963e);stroke-width:1.7;stroke-dasharray:4 3;}
.pm-gp{fill:var(--color-navy-dark,#1a1a2e);stroke:var(--color-command-gold,#c8963e);stroke-width:1.7;}
.pm-w{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2.1;stroke-linecap:round;stroke-linejoin:round;}
.pm-blkt{font-family:var(--font-display,"Bebas Neue",sans-serif);font-size:30px;letter-spacing:.04em;fill:var(--color-title,#f1ece0);}
.pm-blks{font-family:var(--font-mono,"Space Mono",monospace);font-weight:400;font-size:11px;fill:var(--color-muted,#aaa);}
.pm-sig{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:12px;letter-spacing:.03em;fill:var(--color-command-gold,#c8963e);}
.pm-muxt{font-family:var(--font-display,"Bebas Neue",sans-serif);font-size:19px;letter-spacing:.06em;fill:var(--color-command-gold,#c8963e);}
.pm-gpt{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:13px;fill:var(--color-title,#f1ece0);}
.pm-note{font-family:var(--font-serif,"Lora",serif);font-style:italic;font-size:13px;fill:var(--color-muted,#aaa);}

/* phone reflow */
.pm-phone{display:none;}
@media (max-width:520px){ .pm-scene{display:none;} .pm-phone{display:block;} }
.pm-psum{margin:0 0 .5rem;font-family:var(--font-serif,"Lora",serif);font-size:.95rem;line-height:1.5;color:var(--color-text,#e8e8e8);}
.pm-psum b{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;color:var(--color-command-gold,#c8963e);}
.pm-pnote{margin:0;font-family:var(--font-serif,"Lora",serif);font-size:.9rem;color:var(--color-muted,#aaa);}
`;
