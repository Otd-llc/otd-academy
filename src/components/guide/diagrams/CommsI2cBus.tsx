// The I2C bus: two wires, many devices (v2). Communication & Interfaces cluster.
// Owner-picked O4 (10-option round): the "2 wires" stat beside a shared bus of
// addressed devices.
//
// Teaching point: I2C trades speed for pins. Just two shared wires, SDA (data)
// and SCL (clock), carry a whole bus of devices. Each device answers to its own
// 7-bit address, so the controller reaches any one of them without a select line,
// and adding a device costs no new wires.
//
// Landscape desktop/print: a big Saira "2 WIRES" stat, then the SDA/SCL pair with
// three addressed devices tapping both lines (junction dots). REFLOWS on a phone
// to the stat over a row of address chips (SVG text would scale under the ~14px
// floor otherwise). Token-only color: gold = SDA + the addresses, blue = SCL.
import { DiagramFrame } from "./DiagramFrame";

const SDA_Y = 78;
const SCL_Y = 102;
const RX1 = 236;
const RX2 = 550;
const DEVS = [
  { x: 312, addr: "0x1D" },
  { x: 412, addr: "0x50" },
  { x: 512, addr: "0x68" },
];
const DTOP = 158;

export function CommsI2cBus({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="COMMS · I2C"
      tone="gold"
      title="Two wires, many devices"
      ariaLabel="The I2C bus needs only two shared wires, SDA for data and SCL for the clock, to carry a whole bus of devices. Three devices hang on the same two lines, each answering to its own 7-bit address: 0x1D, 0x50, and 0x68. The controller reaches any one of them by sending its address, so adding another device costs no new wires."
      caption={caption}
      defaultCaption="Just two shared wires, SDA and SCL, carry a whole bus of devices, each reached by its own address."
    >
      <style>{CSS}</style>

      {/* desktop / print: the stat + the shared bus */}
      <svg className="i2c-scene" viewBox="0 0 580 220" aria-hidden="true">
        {/* stat */}
        <text className="i2c-num" x={118} y={116} textAnchor="middle">2</text>
        <text className="i2c-unit" x={118} y={144} textAnchor="middle">WIRES</text>
        <text className="i2c-unit" x={118} y={162} textAnchor="middle">SDA + SCL</text>
        <line className="i2c-div" x1={210} y1={40} x2={210} y2={196} />

        {/* the two shared lines */}
        <line className="i2c-sda" x1={RX1} y1={SDA_Y} x2={RX2} y2={SDA_Y} />
        <text className="i2c-sig i2c-sig-g" x={RX1} y={SDA_Y - 8}>SDA</text>
        <line className="i2c-scl" x1={RX1} y1={SCL_Y} x2={RX2} y2={SCL_Y} />
        <text className="i2c-sig i2c-sig-b" x={RX1} y={SCL_Y + 18}>SCL</text>

        {/* addressed devices tapping both lines */}
        {DEVS.map((d) => (
          <g key={d.addr}>
            <rect className="i2c-box" x={d.x - 38} y={DTOP} width={76} height={44} rx={5} />
            <text className="i2c-addr" x={d.x} y={DTOP + 27} textAnchor="middle">{d.addr}</text>
            <line className="i2c-sda" x1={d.x - 14} y1={DTOP} x2={d.x - 14} y2={SDA_Y} />
            <circle className="i2c-dot-g" cx={d.x - 14} cy={SDA_Y} r={4} />
            <line className="i2c-scl" x1={d.x + 14} y1={DTOP} x2={d.x + 14} y2={SCL_Y} />
            <circle className="i2c-dot-b" cx={d.x + 14} cy={SCL_Y} r={4} />
          </g>
        ))}
      </svg>

      {/* phone: stat over a row of address chips */}
      <div className="i2c-list" aria-hidden="true">
        <div className="i2c-stat">
          <span className="i2c-statnum">2</span>
          <span className="i2c-statunit">WIRES · SDA + SCL</span>
        </div>
        <div className="i2c-busbar">SHARED BUS</div>
        <ul className="i2c-chips">
          {DEVS.map((d) => (
            <li key={d.addr} className="i2c-chip">{d.addr}</li>
          ))}
        </ul>
        <p className="i2c-note">Every device shares the same two wires, reached by its address.</p>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.i2c-scene{display:block;width:100%;height:auto;overflow:visible;}
.i2c-num{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:52px;fill:var(--color-command-gold,#c8963e);}
.i2c-unit{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:12px;letter-spacing:.06em;
  fill:var(--color-muted,#aaa);text-transform:uppercase;}
.i2c-div{stroke:var(--color-panel-border,#3a3f50);stroke-width:1.5;stroke-dasharray:4 4;}
.i2c-sda{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2;stroke-linecap:round;}
.i2c-scl{fill:none;stroke:var(--color-signal-blue,#4a8fff);stroke-width:2;stroke-linecap:round;}
.i2c-sig{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:12px;letter-spacing:.02em;}
.i2c-sig-g{fill:var(--color-command-gold,#c8963e);}
.i2c-sig-b{fill:var(--color-signal-blue,#4a8fff);}
.i2c-box{fill:var(--color-diagram-surface,#1f2438);stroke:var(--color-command-gold,#c8963e);stroke-width:2;}
.i2c-addr{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:13px;fill:var(--color-gold-light,#e8b865);}
.i2c-dot-g{fill:var(--color-command-gold,#c8963e);}
.i2c-dot-b{fill:var(--color-signal-blue,#4a8fff);}

/* phone reflow */
.i2c-list{display:none;}
@container (max-width:520px){ .i2c-scene{display:none;} .i2c-list{display:block;text-align:center;} }
.i2c-stat{display:flex;flex-direction:column;align-items:center;gap:0;margin-bottom:.9rem;}
.i2c-statnum{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:3.4rem;line-height:1;color:var(--color-command-gold,#c8963e);}
.i2c-statunit{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.8rem;letter-spacing:.06em;text-transform:uppercase;color:var(--color-muted,#aaa);}
.i2c-busbar{margin:0 auto .7rem;padding:.4rem .8rem;max-width:200px;border-radius:6px;
  font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;
  color:var(--color-muted,#aaa);box-shadow:inset 0 0 0 1.5px var(--color-panel-border,#3a3f50);}
.i2c-chips{display:flex;flex-wrap:wrap;justify-content:center;gap:.5rem;list-style:none;margin:0;padding:0;}
.i2c-chip{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.95rem;padding:.4rem .7rem;border-radius:5px;
  color:var(--color-gold-light,#e8b865);background:var(--color-diagram-surface,#1f2438);box-shadow:inset 0 0 0 1.5px var(--color-command-gold,#c8963e);}
.i2c-note{margin:.9rem 0 0;font-family:var(--font-mono,"Space Mono",monospace);font-size:.74rem;letter-spacing:.03em;
  text-transform:uppercase;color:var(--color-muted,#aaa);}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .i2c-dot-g,.dgfrm.armed .i2c-dot-b{opacity:0;}
.dgfrm.armed.in .i2c-dot-g,.dgfrm.armed.in .i2c-dot-b{opacity:1;transition:opacity .5s ease .3s;}
@media (prefers-reduced-motion:reduce){ .dgfrm .i2c-dot-g,.dgfrm .i2c-dot-b{opacity:1!important;} }
`;
