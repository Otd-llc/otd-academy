// On-chip peripheral + pin mux, as a crossbar (diagram-standards v2).
// MCU cluster, diagram 9. Owner-picked M2.
//
// Teaching point (lesson 8): a bus like SPI is a hardware block inside the chip.
// The pin mux routes its signals (SCLK, MOSI, MISO, CS) to almost any GPIO you
// choose. Drawn as a crossbar: rows are the signals, columns are pins, and a gold
// dot at a crossing means that signal is routed to that pin. The faint dots are
// the pins each signal could have gone to instead, which is what "any GPIO" means.
//
// Grid rendered by nested maps. Color via CSS classes; mono for labels. Header +
// caption from the DiagramFrame.
import { DiagramFrame } from "./DiagramFrame";

const ROWS = ["SCLK", "MOSI", "MISO", "CS"];
const COLS = ["G10", "G11", "G12", "G13", "G14"];
const CHOSEN = [0, 1, 2, 3]; // ROWS[i] routed to COLS[CHOSEN[i]]
const GX0 = 250, GY0 = 64, CW = 54, RH = 30;
const colX = (j: number) => GX0 + j * CW;
const rowY = (i: number) => GY0 + i * RH + 10;

export function McuPeripheralMux({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="MICROCONTROLLERS · PERIPHERALS"
      tone="gold"
      title="Route a bus block to your pins"
      ariaLabel="The pin mux drawn as a crossbar. On the left is the SPI hardware bus block. On the right is a grid whose rows are the SPI signals (the clock SCLK, data out MOSI, data in MISO, and chip-select CS) and whose columns are GPIO pins. A gold dot at a row-and-column crossing means that signal is routed to that pin; here SCLK goes to GPIO10, MOSI to GPIO11, MISO to GPIO12, and CS to GPIO13. The faint dots are the other pins each signal could have been routed to instead."
      caption={caption}
      defaultCaption="The pin mux is a crossbar: each SPI signal can route to almost any GPIO, and a gold dot marks the pin you picked for it."
    >
      <style>{CSS}</style>
      <div className="mx">
        <svg className="mx-svg" viewBox="0 0 540 220" aria-hidden="true">
          {/* SPI block */}
          <rect x="40" y="72" width="80" height="100" rx="8" className="mx-block" />
          <text x="80" y="118" textAnchor="middle" className="mx-block-t">SPI</text>
          <text x="80" y="136" textAnchor="middle" className="mx-block-s">bus block</text>
          <line x1="120" y1="120" x2={GX0 - 10} y2="120" className="mx-conn" />

          {/* column headers + vertical lines */}
          {COLS.map((c, j) => (
            <g key={c}>
              <text x={colX(j)} y={GY0 - 6} textAnchor="middle" className="mx-col">{c}</text>
              <line x1={colX(j)} y1={GY0} x2={colX(j)} y2={GY0 + ROWS.length * RH} className="mx-grid" />
            </g>
          ))}

          {/* rows: label, line, and the dots */}
          {ROWS.map((r, i) => (
            <g key={r}>
              <text x={GX0 - 18} y={rowY(i) + 4} textAnchor="end" className="mx-row">{r}</text>
              <line x1={GX0 - 10} y1={rowY(i)} x2={colX(COLS.length - 1) + 10} y2={rowY(i)} className="mx-grid" />
              {COLS.map((_, j) => (
                <circle key={j} cx={colX(j)} cy={rowY(i)} r={CHOSEN[i] === j ? 5 : 2.5}
                  className={CHOSEN[i] === j ? "mx-dot" : "mx-dot-faint"} />
              ))}
            </g>
          ))}

          <text x={GX0 + 100} y="200" textAnchor="middle" className="mx-note">a dot = that signal routed to that pin</text>
        </svg>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.mx{max-width:36rem;margin-inline:auto;}
.mx-svg{display:block;width:100%;height:auto;overflow:visible;}
.mx-block{fill:var(--color-diagram-surface,#1f2438);stroke:var(--color-command-gold,#c8963e);stroke-width:1.8;}
.mx-block-t{font-family:var(--font-display,"Bebas Neue",sans-serif);font-size:20px;letter-spacing:.03em;fill:var(--color-title,#f1ece0);}
.mx-block-s{font-family:var(--font-mono,"Space Mono",monospace);font-size:9px;fill:var(--color-muted,#aaaaaa);}
.mx-conn{stroke:var(--color-command-gold,#c8963e);stroke-width:1.8;}
.mx-grid{stroke:var(--color-panel-border,#3a3f50);stroke-width:1;}
.mx-col{font-family:var(--font-mono,"Space Mono",monospace);font-size:11px;fill:var(--color-muted,#aaaaaa);}
.mx-row{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:11px;fill:var(--color-command-gold,#c8963e);}
.mx-dot{fill:var(--color-command-gold,#c8963e);}
.mx-dot-faint{fill:var(--color-panel-border,#3a3f50);}
.mx-note{font-family:var(--font-mono,"Space Mono",monospace);font-size:10.5px;fill:var(--color-muted,#aaaaaa);}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .mx-svg{opacity:0;transform:translateY(6px);}
.dgfrm.armed.in .mx-svg{opacity:1;transform:none;transition:opacity .6s ease,transform .6s cubic-bezier(.2,.7,.2,1);}
@media (prefers-reduced-motion:reduce){
  .dgfrm .mx-svg{opacity:1!important;transform:none!important;transition:none!important;}
}
`;
