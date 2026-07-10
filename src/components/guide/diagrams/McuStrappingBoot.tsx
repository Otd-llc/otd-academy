// Boot strapping: one pin, two boot paths (diagram-standards v2).
// MCU cluster, diagram 5. Owner-picked S4: the level -> path table.
//
// Teaching point (lesson 4): at reset the ESP32 samples its boot strapping pin to
// pick how to boot. Left HIGH (its default) it runs the firmware already in flash;
// held LOW (which is what pressing BOOT does) it enters the download bootloader and
// waits to be flashed. Two rows: the reset-time level on the left, the path on the
// right. Gold = the default run path, blue = the download path.
//
// HTML rows, so the text stays crisp and reflows on a phone. Token color, both
// themes. Header + caption from the DiagramFrame.
import { DiagramFrame } from "./DiagramFrame";

const ROWS = [
  { cls: "run", level: "HIGH", sub: "default", outcome: "RUN firmware in flash" },
  { cls: "dl", level: "LOW", sub: "BOOT pressed", outcome: "DOWNLOAD bootloader" },
];

export function McuStrappingBoot({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="MICROCONTROLLERS · BOOT"
      tone="gold"
      title="Two boot paths, chosen at reset"
      ariaLabel="At reset the ESP32 samples its boot strapping pin to choose how to boot. If the pin is high, its default level, the chip runs the firmware already in flash. If the pin is held low, which is what pressing the BOOT button does, the chip enters the download bootloader and waits to be flashed."
      caption={caption}
      defaultCaption="At reset the chip reads the strapping pins: left at their default level it runs the firmware in flash; with the boot pin held low it enters the download bootloader."
    >
      <style>{CSS}</style>
      <div className="sb">
        <p className="sb-head">At reset the boot pin is...</p>
        {ROWS.map((r) => (
          <div key={r.cls} className={`sb-row sb-${r.cls}`}>
            <span className="sb-state">{r.level}</span>
            <span className="sb-sub">({r.sub})</span>
            <span className="sb-arr">→</span>
            <span className="sb-out">{r.outcome}</span>
          </div>
        ))}
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.sb{max-width:34rem;margin-inline:auto;}
.sb-head{margin:0 0 .7rem;font-family:var(--font-mono,"Space Mono",monospace);font-size:clamp(.72rem,2vw,.8rem);
  letter-spacing:.14em;text-transform:uppercase;color:var(--color-muted,#aaaaaa);}
.sb-row{display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;
  border:1.6px solid var(--color-panel-border,#3a3f50);border-radius:8px;padding:.7rem .9rem;margin-bottom:.6rem;}
.sb-run{border-color:var(--color-command-gold,#c8963e);}
.sb-dl{border-color:var(--color-signal-blue,#4a8fff);}
.sb-state{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:700;
  font-size:clamp(1.05rem,3vw,1.3rem);flex:0 0 auto;min-width:3.2rem;}
.sb-run .sb-state{color:var(--color-command-gold,#c8963e);}
.sb-dl .sb-state{color:var(--color-signal-blue,#4a8fff);}
.sb-sub{font-family:var(--font-mono,"Space Mono",monospace);font-size:clamp(.72rem,1.9vw,.82rem);color:var(--color-muted,#aaaaaa);}
.sb-arr{font-size:clamp(1rem,2.6vw,1.25rem);margin-left:auto;flex:0 0 auto;}
.sb-run .sb-arr{color:var(--color-command-gold,#c8963e);}
.sb-dl .sb-arr{color:var(--color-signal-blue,#4a8fff);}
.sb-out{font-family:var(--font-display,"Bebas Neue",sans-serif);font-size:clamp(1.15rem,3.2vw,1.5rem);
  letter-spacing:.03em;color:var(--color-title,#f1ece0);flex:1 1 auto;text-align:right;}
@media (max-width:400px){ .sb-arr{margin-left:0;} .sb-out{text-align:left;flex-basis:100%;} }

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .sb-row{opacity:0;transform:translateY(6px);}
.dgfrm.armed.in .sb-row{opacity:1;transform:none;transition:opacity .5s ease,transform .5s cubic-bezier(.2,.7,.2,1);}
.dgfrm.armed.in .sb-row:nth-child(3){transition-delay:.12s;}
@media (prefers-reduced-motion:reduce){
  .dgfrm .sb-row{opacity:1!important;transform:none!important;transition:none!important;}
}
`;
