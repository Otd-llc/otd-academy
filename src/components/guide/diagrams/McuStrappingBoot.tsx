// Boot strapping: one pin, two boot paths (v2). Microcontrollers cluster.
//
// Teaching point: at reset the ESP32 samples a strapping pin (GPIO0, the BOOT
// pin). Left at its default HIGH it runs the firmware in flash; held LOW it
// enters the download bootloader and waits for a flashing tool. A stray pull on
// that pin picks the wrong path.
//
// Landscape desktop/print: reset → sample GPIO0 → branch to two outcome cards
// (RUN = gold, DOWNLOAD = blue). REFLOWS on a phone to two stacked cards. Tokens.
import { DiagramFrame } from "./DiagramFrame";

export function McuStrappingBoot({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="MICROCONTROLLERS · BOOT"
      tone="gold"
      title="One pin, two boot paths"
      ariaLabel="At reset the ESP32 samples its BOOT strapping pin, GPIO0, and branches to one of two outcomes. If the pin is high, its default, the chip runs the firmware already in flash. If the pin is held low, the chip enters the download bootloader and waits for a flashing tool like esptool. The pin is sampled once, at reset. A stray pull on the pin can force the wrong path and stop the board booting."
      caption={caption}
      defaultCaption="At reset the chip reads GPIO0: high runs your firmware, low enters the download bootloader."
    >
      <style>{CSS}</style>

      <div className="sb">
        {/* desktop / print */}
        <svg className="sb-scene" viewBox="0 0 660 296" aria-hidden="true">
          {/* reset event */}
          <text className="sb-eye" x={64} y={112} textAnchor="middle">AT RESET</text>
          <path className="sb-w" fill="none" d="M28,140 L48,140 L48,158 L80,158 L80,140 L100,140" />
          <text className="sb-sub" x={64} y={182} textAnchor="middle">power-up</text>

          {/* wire to the strapping pin */}
          <line className="sb-w" x1={100} y1={148} x2={132} y2={148} />

          {/* GPIO0 strapping pin */}
          <rect className="sb-pin" x={132} y={120} width={128} height={56} rx={5} />
          <text className="sb-pinn" x={196} y={146} textAnchor="middle">GPIO0</text>
          <text className="sb-pins" x={196} y={165} textAnchor="middle">BOOT · sampled once</text>

          {/* branch node */}
          <circle className="sb-node" cx={286} cy={148} r={4} />
          <line className="sb-w" x1={260} y1={148} x2={286} y2={148} />

          {/* HIGH → RUN (gold, up) */}
          <path className="sb-run" fill="none" d="M286,148 L308,148 L308,92 L406,92" />
          <path className="sb-run" fill="none" d="M398,87 L406,92 L398,97" />
          <text className="sb-cond sb-gold" x={357} y={80} textAnchor="middle">HIGH</text>
          <rect className="sb-card sb-card-run" x={408} y={66} width={224} height={54} rx={6} />
          <text className="sb-cn sb-gold" x={424} y={92}>RUN</text>
          <text className="sb-cs" x={424} y={109}>your firmware in flash</text>

          {/* LOW → DOWNLOAD (blue, down) */}
          <path className="sb-dl" fill="none" d="M286,148 L308,148 L308,206 L406,206" />
          <path className="sb-dl" fill="none" d="M398,201 L406,206 L398,211" />
          <text className="sb-cond sb-blue" x={357} y={228} textAnchor="middle">LOW</text>
          <rect className="sb-card sb-card-dl" x={408} y={180} width={224} height={54} rx={6} />
          <text className="sb-cn sb-blue" x={424} y={206}>DOWNLOAD</text>
          <text className="sb-cs" x={424} y={223}>bootloader waits for esptool</text>
        </svg>

        {/* phone reflow */}
        <div className="sb-phone" aria-hidden="true">
          <p className="sb-lead">At reset the chip reads <b>GPIO0</b>:</p>
          <div className="sb-pcard sb-pgold">
            <span className="sb-pcond">pin HIGH · default</span>
            <span className="sb-pout">RUN — your firmware in flash</span>
          </div>
          <div className="sb-pcard sb-pblue">
            <span className="sb-pcond">pin LOW · BOOT held</span>
            <span className="sb-pout">DOWNLOAD — bootloader waits for esptool</span>
          </div>
        </div>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.sb{display:block;}
.sb-scene{display:block;width:100%;height:auto;overflow:visible;}
.sb-w{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;}
.sb-run{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round;}
.sb-dl{fill:none;stroke:var(--color-signal-blue,#4a8fff);stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round;}
.sb-node{fill:var(--color-command-gold,#c8963e);}
.sb-pin{fill:var(--color-navy-dark,#1a1a2e);stroke:var(--color-command-gold,#c8963e);stroke-width:1.8;}
.sb-card{fill:var(--color-navy-dark,#1a1a2e);stroke-width:1.8;}
.sb-card-run{stroke:var(--color-command-gold,#c8963e);}
.sb-card-dl{stroke:var(--color-signal-blue,#4a8fff);}
.sb-eye{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:12px;letter-spacing:.14em;fill:var(--color-command-gold,#c8963e);}
.sb-sub{font-family:var(--font-mono,"Space Mono",monospace);font-weight:400;font-size:11px;fill:var(--color-muted,#aaa);}
.sb-pinn{font-family:var(--font-display,"Bebas Neue",sans-serif);font-size:22px;letter-spacing:.03em;fill:var(--color-title,#f1ece0);}
.sb-pins{font-family:var(--font-mono,"Space Mono",monospace);font-weight:400;font-size:11px;fill:var(--color-muted,#aaa);}
.sb-cond{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:12px;letter-spacing:.04em;}
.sb-cn{font-family:var(--font-display,"Bebas Neue",sans-serif);font-size:22px;letter-spacing:.03em;}
.sb-cs{font-family:var(--font-mono,"Space Mono",monospace);font-weight:400;font-size:12px;fill:var(--color-text,#e8e8e8);}
.sb-gold{fill:var(--color-command-gold,#c8963e);}
.sb-blue{fill:var(--color-signal-blue,#4a8fff);}

/* phone reflow */
.sb-phone{display:none;}
@media (max-width:520px){ .sb-scene{display:none;} .sb-phone{display:block;} }
.sb-lead{margin:0 0 .6rem;font-family:var(--font-serif,"Lora",serif);font-size:.95rem;color:var(--color-text,#e8e8e8);}
.sb-lead b{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;color:var(--color-title,#f1ece0);}
.sb-pcard{border:1px solid;border-radius:6px;background:var(--color-navy-dark,#1a1a2e);padding:.55rem .7rem;margin-bottom:.55rem;display:flex;flex-direction:column;gap:.2rem;}
.sb-pgold{border-color:var(--color-command-gold,#c8963e);}
.sb-pblue{border-color:var(--color-signal-blue,#4a8fff);}
.sb-pcond{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;color:var(--color-muted,#aaa);}
.sb-pgold .sb-pcond{color:var(--color-command-gold,#c8963e);}
.sb-pblue .sb-pcond{color:var(--color-signal-blue,#4a8fff);}
.sb-pout{font-family:var(--font-mono,"Space Mono",monospace);font-size:.9rem;color:var(--color-text,#e8e8e8);}
`;
