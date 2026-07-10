// The SPI bus: one controller, two peripherals (v2). Communication & Interfaces
// cluster. Owner-picked V2 (O1 variations round): the clean canonical topology
// with junction dots, plus the "chip-select picks which one" takeaway.
//
// Teaching point: SPI shares three lines between every peripheral: SCK (the clock
// the controller drives), MOSI (data out from the controller), and MISO (data
// back to it). What is NOT shared is the chip-select: each peripheral gets its
// own CS from the controller. The controller talks to one peripheral at a time by
// pulling that peripheral's CS low; the shared bus reaches both, but only the
// selected one responds. That is why every extra peripheral costs another pin.
//
// Landscape desktop/print: controller left, two peripherals right, three shared
// rails tapped by both (junction dots), a CS line to each. REFLOWS on a phone to
// a controller card, a shared-bus bar, and two peripheral cards (SVG text would
// scale under the ~14px floor otherwise). Token-only color: gold = the shared
// clock/MOSI + the chip-selects, blue = the MISO return line.
import { DiagramFrame } from "./DiagramFrame";

const RAILS = [
  { name: "SCK", y: 94, wire: "spi-g", dot: "spi-dot-g" },
  { name: "MOSI", y: 112, wire: "spi-g", dot: "spi-dot-g" },
  { name: "MISO", y: 130, wire: "spi-b", dot: "spi-dot-b" },
];
const RX1 = 142;
const RX2 = 506;
const TAP = [408, 438, 468];
const P1_BOTTOM = 62;
const P2_TOP = 158;

function ArrowRight({ x, y, cls }: { x: number; y: number; cls: string }) {
  return <path className={cls} d={`M${x - 8},${y - 4} L${x},${y} L${x - 8},${y + 4}`} fill="none" />;
}

export function CommsSpiBus({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="COMMS · SPI"
      tone="gold"
      title="One controller, two peripherals"
      ariaLabel="An SPI bus with one controller and two peripherals. Three lines are shared by both peripherals: SCK, the clock the controller drives; MOSI, data from the controller; and MISO, data back to it. Each peripheral also has its own chip-select line from the controller, CS1 and CS2. The controller talks to one peripheral at a time by pulling that peripheral's chip-select low; the shared bus reaches both, but only the selected one responds, which is why every extra peripheral costs another pin."
      caption={caption}
      defaultCaption="SCK, MOSI, and MISO are shared by both peripherals; each gets its own chip-select."
    >
      <style>{CSS}</style>

      {/* desktop / print: the bus topology */}
      <svg className="spi-scene" viewBox="0 0 580 226" aria-hidden="true">
        {/* boxes */}
        <rect className="spi-box" x={26} y={58} width={116} height={104} rx={5} />
        <text className="spi-bt" x={84} y={114} textAnchor="middle">CONTROLLER</text>
        <rect className="spi-box" x={378} y={14} width={164} height={48} rx={5} />
        <text className="spi-bt" x={460} y={42} textAnchor="middle">PERIPHERAL 1</text>
        <rect className="spi-box" x={378} y={158} width={164} height={48} rx={5} />
        <text className="spi-bt" x={460} y={186} textAnchor="middle">PERIPHERAL 2</text>

        {/* shared rails + taps + junction dots */}
        {RAILS.map((r, i) => (
          <g key={r.name}>
            <line className={r.wire} x1={RX1} y1={r.y} x2={RX2} y2={r.y} />
            <text className={r.wire === "spi-b" ? "spi-sig spi-sig-b" : "spi-sig spi-sig-g"} x={RX1 + 10} y={r.y - 5}>{r.name}</text>
            <line className={r.wire} x1={TAP[i]} y1={P1_BOTTOM} x2={TAP[i]} y2={r.y} />
            <line className={r.wire} x1={TAP[i]} y1={P2_TOP} x2={TAP[i]} y2={r.y} />
            <circle className={r.dot} cx={TAP[i]} cy={r.y} r={4} />
          </g>
        ))}

        {/* chip-selects (own line each), routed clear of the rails */}
        <polyline className="spi-cs" points="142,80 358,80 358,36 378,36" fill="none" />
        <ArrowRight x={378} y={36} cls="spi-cs" />
        <text className="spi-sig spi-sig-cs" x={250} y={74} textAnchor="middle">CS1</text>
        <polyline className="spi-cs" points="142,144 358,144 358,184 378,184" fill="none" />
        <ArrowRight x={378} y={184} cls="spi-cs" />
        <text className="spi-sig spi-sig-cs" x={250} y={138} textAnchor="middle">CS2</text>

        <text className="spi-take" x={290} y={220} textAnchor="middle">THE CHIP-SELECT PICKS WHICH ONE</text>
      </svg>

      {/* phone: stacked cards */}
      <div className="spi-list" aria-hidden="true">
        <div className="spi-card spi-ctrl">CONTROLLER</div>
        <div className="spi-busbar">
          <span className="spi-busbar-lbl">SHARED BUS</span>
          <span className="spi-busbar-sig">SCK · MOSI · MISO</span>
        </div>
        <div className="spi-periphs">
          <div className="spi-card spi-p">
            <span>PERIPHERAL 1</span>
            <span className="spi-cschip">CS1</span>
          </div>
          <div className="spi-card spi-p">
            <span>PERIPHERAL 2</span>
            <span className="spi-cschip">CS2</span>
          </div>
        </div>
        <p className="spi-note">The chip-select picks which one.</p>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.spi-scene{display:block;width:100%;height:auto;overflow:visible;}
.spi-box{fill:var(--color-navy-dark,#1a1a2e);stroke:var(--color-command-gold,#c8963e);stroke-width:2;}
.spi-bt{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:14px;fill:var(--color-title,#f1ece0);}
.spi-g{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}
.spi-b{fill:none;stroke:var(--color-signal-blue,#4a8fff);stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}
.spi-cs{fill:none;stroke:var(--color-gold-light,#e8b865);stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}
.spi-dot-g{fill:var(--color-command-gold,#c8963e);}
.spi-dot-b{fill:var(--color-signal-blue,#4a8fff);}
.spi-sig{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:11px;letter-spacing:.02em;}
.spi-sig-g{fill:var(--color-command-gold,#c8963e);}
.spi-sig-b{fill:var(--color-signal-blue,#4a8fff);}
.spi-sig-cs{fill:var(--color-gold-light,#e8b865);}
.spi-take{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:11px;letter-spacing:.05em;
  fill:var(--color-muted,#aaa);text-transform:uppercase;}

/* phone reflow */
.spi-list{display:none;}
@media (max-width:520px){ .spi-scene{display:none;} .spi-list{display:block;} }
.spi-card{border-radius:6px;background:var(--color-navy-dark,#1a1a2e);
  box-shadow:inset 0 0 0 1.5px var(--color-command-gold,#c8963e);
  font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;color:var(--color-title,#f1ece0);}
.spi-ctrl{padding:.7rem;text-align:center;font-size:.9rem;letter-spacing:.03em;max-width:220px;margin:0 auto;}
.spi-busbar{display:flex;flex-direction:column;align-items:center;gap:2px;margin:.55rem auto;padding:.5rem .7rem;max-width:260px;
  border-radius:6px;box-shadow:inset 0 0 0 1.5px var(--color-command-gold,#c8963e);}
.spi-busbar-lbl{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.7rem;letter-spacing:.08em;
  text-transform:uppercase;color:var(--color-muted,#aaa);}
.spi-busbar-sig{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.9rem;color:var(--color-command-gold,#c8963e);}
.spi-periphs{display:flex;gap:.6rem;justify-content:center;}
.spi-p{display:flex;flex-direction:column;align-items:center;gap:.4rem;padding:.7rem .6rem;font-size:.8rem;text-align:center;flex:1;max-width:150px;}
.spi-cschip{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.75rem;padding:.12rem .5rem;border-radius:4px;
  color:var(--color-gold-light,#e8b865);box-shadow:inset 0 0 0 1.5px var(--color-gold-light,#e8b865);}
.spi-note{margin:.9rem 0 0;font-family:var(--font-mono,"Space Mono",monospace);font-size:.74rem;letter-spacing:.04em;
  text-transform:uppercase;color:var(--color-muted,#aaa);text-align:center;}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .spi-dot-g,.dgfrm.armed .spi-dot-b{opacity:0;}
.dgfrm.armed.in .spi-dot-g,.dgfrm.armed.in .spi-dot-b{opacity:1;transition:opacity .5s ease .3s;}
@media (prefers-reduced-motion:reduce){ .dgfrm .spi-dot-g,.dgfrm .spi-dot-b{opacity:1!important;} }
`;
