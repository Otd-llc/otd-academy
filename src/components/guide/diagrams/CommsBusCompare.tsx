// The three on-board buses at a glance (v2). Communication & Interfaces cluster.
// Owner-picked O2 (10-option round): a mini-topology card per bus.
//
// Teaching point: pick the bus by the job. UART joins two devices point to point
// over two wires at low-to-moderate speed. I2C shares two wires among many
// addressed devices at moderate speed. SPI runs fastest over three shared lines
// plus one chip-select per device. The card shows each bus's SHAPE next to its
// wire count, device count, and relative speed, so the trade-offs read at a glance.
//
// Landscape desktop/print: three cards side by side, each a mini topology (a
// callback to the serial/UART, I2C, and SPI diagrams) over its stats. REFLOWS on
// a phone to three stacked cards. Token-only color: gold = the forward/clock/data
// lines, blue = the return line (UART RX, I2C SCL, SPI MISO).
import { DiagramFrame } from "./DiagramFrame";

type Mini = "uart" | "i2c" | "spi";
const BUSES: { name: string; wires: string; dev: string; speed: number; mini: Mini }[] = [
  { name: "UART", wires: "2", dev: "2", speed: 1, mini: "uart" },
  { name: "I2C", wires: "2", dev: "MANY", speed: 2, mini: "i2c" },
  { name: "SPI", wires: "3+", dev: "1/CS", speed: 3, mini: "spi" },
];
const CX = [110, 300, 490];

// Each mini is drawn around a centre (cx, cy); the same helper serves the desktop
// cards and the phone cards, so the shapes stay identical.
function Mini({ kind, cx, cy }: { kind: Mini; cx: number; cy: number }) {
  if (kind === "uart") {
    return (
      <>
        <rect className="bc-box" x={cx - 52} y={cy - 10} width={30} height={20} rx={3} />
        <rect className="bc-box" x={cx + 22} y={cy - 10} width={30} height={20} rx={3} />
        <line className="bc-g" x1={cx - 22} y1={cy - 4} x2={cx + 22} y2={cy - 4} />
        <line className="bc-b" x1={cx - 22} y1={cy + 4} x2={cx + 22} y2={cy + 4} />
      </>
    );
  }
  if (kind === "i2c") {
    return (
      <>
        <line className="bc-g" x1={cx - 55} y1={cy - 6} x2={cx + 55} y2={cy - 6} />
        <line className="bc-b" x1={cx - 55} y1={cy + 4} x2={cx + 55} y2={cy + 4} />
        {[-30, 0, 30].map((dx) => (
          <g key={dx}>
            <rect className="bc-box" x={cx + dx - 9} y={cy + 14} width={18} height={12} rx={2} />
            <line className="bc-g" x1={cx + dx - 3} y1={cy + 14} x2={cx + dx - 3} y2={cy - 6} />
            <circle className="bc-dot-g" cx={cx + dx - 3} cy={cy - 6} r={3.5} />
            <line className="bc-b" x1={cx + dx + 3} y1={cy + 14} x2={cx + dx + 3} y2={cy + 4} />
            <circle className="bc-dot-b" cx={cx + dx + 3} cy={cy + 4} r={3.5} />
          </g>
        ))}
      </>
    );
  }
  return (
    <>
      <rect className="bc-box" x={cx - 55} y={cy - 8} width={26} height={30} rx={3} />
      <rect className="bc-box" x={cx + 28} y={cy - 14} width={28} height={16} rx={2} />
      <rect className="bc-box" x={cx + 28} y={cy + 8} width={28} height={16} rx={2} />
      <line className="bc-g" x1={cx - 29} y1={cy - 2} x2={cx + 28} y2={cy - 8} />
      <line className="bc-g" x1={cx - 29} y1={cy + 4} x2={cx + 28} y2={cy + 14} />
      <line className="bc-b" x1={cx - 29} y1={cy + 10} x2={cx + 28} y2={cy + 20} />
    </>
  );
}

function SpeedBar({ cx, y, n }: { cx: number; y: number; n: number }) {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <rect key={i} className={i < n ? "bc-seg-on" : "bc-seg-off"} x={cx - 27 + i * 19} y={y} width={15} height={10} rx={2} />
      ))}
    </>
  );
}

export function CommsBusCompare({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="COMMS · CHOOSE A BUS"
      tone="gold"
      title="The three buses at a glance"
      ariaLabel="The three on-board buses side by side. UART joins two devices point to point over two wires, TX and RX, at low to moderate speed. I2C shares two wires, SDA and SCL, among many devices addressed on the bus, at moderate speed. SPI is the fastest, over three shared lines plus one chip-select per device. Pick UART for a simple stream, I2C when pins are short and speed does not matter, and SPI when you need speed."
      caption={caption}
      defaultCaption="UART joins two devices, I2C shares two wires among many, and SPI trades pins for speed."
    >
      <style>{CSS}</style>

      {/* desktop / print: three mini-topology cards */}
      <svg className="bc-scene" viewBox="0 0 600 228" aria-hidden="true">
        {BUSES.map((b, i) => {
          const cx = CX[i];
          return (
            <g key={b.name}>
              <rect className="bc-card" x={cx - 84} y={22} width={168} height={190} rx={8} />
              <text className="bc-hd" x={cx} y={56} textAnchor="middle">{b.name}</text>
              <Mini kind={b.mini} cx={cx} cy={106} />
              <text className="bc-line" x={cx} y={168} textAnchor="middle">{b.wires} WIRES · {b.dev}</text>
              <text className="bc-k" x={cx} y={188} textAnchor="middle">SPEED</text>
              <SpeedBar cx={cx} y={194} n={b.speed} />
            </g>
          );
        })}
      </svg>

      {/* phone: three stacked cards */}
      <ul className="bc-list" aria-hidden="true">
        {BUSES.map((b) => (
          <li key={b.name} className="bc-li">
            <span className="bc-li-hd">{b.name}</span>
            <svg viewBox="0 0 170 62" className="bc-mini">
              <Mini kind={b.mini} cx={85} cy={32} />
            </svg>
            <div className="bc-li-stats">
              <span className="bc-li-wires">{b.wires} WIRES · {b.dev}</span>
              <svg viewBox="0 0 60 12" className="bc-li-speed"><SpeedBar cx={30} y={1} n={b.speed} /></svg>
            </div>
          </li>
        ))}
      </ul>
    </DiagramFrame>
  );
}

const CSS = `
.bc-scene{display:block;width:100%;height:auto;overflow:visible;}
.bc-card{fill:var(--color-diagram-surface,#1f2438);stroke:var(--color-panel-border,#3a3f50);stroke-width:1.5;}
.bc-hd{font-family:var(--font-display,"Bebas Neue",sans-serif);font-size:26px;letter-spacing:.03em;fill:var(--color-command-gold,#c8963e);}
.bc-box{fill:var(--color-diagram-surface,#1f2438);stroke:var(--color-command-gold,#c8963e);stroke-width:1.6;}
.bc-g{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2;stroke-linecap:round;}
.bc-b{fill:none;stroke:var(--color-signal-blue,#4a8fff);stroke-width:2;stroke-linecap:round;}
.bc-dot-g{fill:var(--color-command-gold,#c8963e);}
.bc-dot-b{fill:var(--color-signal-blue,#4a8fff);}
.bc-line{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:12px;letter-spacing:.03em;fill:var(--color-title,#f1ece0);}
.bc-k{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:10px;letter-spacing:.06em;fill:var(--color-muted,#aaa);text-transform:uppercase;}
.bc-seg-on{fill:var(--color-command-gold,#c8963e);}
.bc-seg-off{fill:none;stroke:var(--color-panel-border,#3a3f50);stroke-width:1.4;}

/* phone reflow */
.bc-list{display:none;list-style:none;margin:0;padding:0;flex-direction:column;gap:.7rem;}
@container (max-width:520px){ .bc-scene{display:none;} .bc-list{display:flex;} }
.bc-li{display:flex;align-items:center;gap:.5rem;padding:.7rem .8rem;border-radius:8px;
  }
.bc-li-hd{font-family:var(--font-display,"Bebas Neue",sans-serif);font-size:1.5rem;letter-spacing:.03em;color:var(--color-command-gold,#c8963e);min-width:44px;}
.bc-mini{flex:1;max-width:112px;height:auto;overflow:visible;}
.bc-li-stats{display:flex;flex-direction:column;align-items:flex-end;gap:.35rem;min-width:88px;flex-shrink:0;}
.bc-li-wires{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.68rem;letter-spacing:.01em;color:var(--color-title,#f1ece0);text-align:right;}
.bc-li-speed{width:54px;height:12px;overflow:visible;}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .bc-seg-on{opacity:0;}
.dgfrm.armed.in .bc-seg-on{opacity:1;transition:opacity .5s ease .3s;}
@media (prefers-reduced-motion:reduce){ .dgfrm .bc-seg-on{opacity:1!important;} }
`;
