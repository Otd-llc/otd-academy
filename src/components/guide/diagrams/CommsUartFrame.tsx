// One UART frame on a single wire (v2). Communication & Interfaces cluster.
// Owner-picked V1 (O7 + O1 variations round): labelled waveform over a named
// slot band.
//
// Teaching point: UART has no clock line, so a byte is wrapped in a frame the
// receiver can find. The line idles high. A start bit pulls it low for one
// bit-time; then eight data bits (D0 to D7) carry the byte, least-significant
// first; then a stop bit returns the line high. Ten bit-times in all, each
// lasting 1/baud, which is why both ends must be preset to the same baud rate.
// The frame here carries 0x41, the letter A (LSB-first on the wire: 1 0 0 0 0 0 1 0).
//
// Landscape desktop/print: waveform, bit values above, a named slot band below.
// REFLOWS on a phone to a mini waveform + a wrapping row of slot chips (SVG text
// would scale under the ~14px floor otherwise). Token-only color: gold = the
// data/payload, blue = the start/stop framing bits.
import { DiagramFrame } from "./DiagramFrame";

const DATA = [1, 0, 0, 0, 0, 0, 1, 0]; // 0x41 'A', LSB-first on the wire
const FR = [1, 0, ...DATA, 1, 1]; // idle, start, 8 data, stop, idle (12 cells)
const X0 = 56;
const CW = 40;
const HY = 42;
const LY = 82;
const cx = (i: number) => X0 + CW * i + CW / 2;

// The ten framed bit-times (cells 1..10): start, D0..D7, stop.
const SLOTS = Array.from({ length: 10 }, (_, i) => ({
  cell: 1 + i,
  name: i === 0 ? "ST" : i === 9 ? "SP" : `D${i - 1}`,
  value: i === 0 ? 0 : i === 9 ? 1 : DATA[i - 1],
  framing: i === 0 || i === 9,
}));

function wavePath(): string {
  let y = FR[0] ? HY : LY;
  let d = `M${X0},${y}`;
  let x = X0;
  for (const b of FR) {
    const yl = b ? HY : LY;
    if (yl !== y) d += ` L${x},${yl}`;
    x += CW;
    d += ` L${x},${yl}`;
    y = yl;
  }
  return d;
}

export function CommsUartFrame({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="COMMS · UART"
      tone="gold"
      title="A UART frame"
      ariaLabel="The anatomy of one UART frame on a single wire, carrying the byte 0x41, the letter A, sent least-significant bit first. The line idles high. A start bit pulls it low for one bit-time. Then eight data bits, D0 through D7, carry the byte 1 0 0 0 0 0 1 0. Then a stop bit returns the line high. Ten bit-times in all, and because there is no separate clock line, both ends must be preset to the same baud rate."
      caption={caption}
      defaultCaption="One UART frame: idle high, a start bit, eight data bits (D0 to D7), then a stop bit back to high."
    >
      <style>{CSS}</style>

      {/* desktop / print: waveform + named slot band */}
      <svg className="uf-scene" viewBox="0 0 560 170" aria-hidden="true">
        {DATA.map((b, i) => (
          <text key={i} className="uf-bit" x={cx(2 + i)} y={HY - 12} textAnchor="middle">{b}</text>
        ))}
        <path className="uf-wave" d={wavePath()} />
        {SLOTS.map((s) => {
          const x = X0 + CW * s.cell + 3;
          const w = CW - 6;
          const y = LY + 18;
          return (
            <g key={s.name}>
              <rect className={s.framing ? "uf-slot-b" : "uf-slot-g"} x={x} y={y} width={w} height={20} rx={3} />
              <text className={s.framing ? "uf-name uf-name-b" : "uf-name uf-name-g"} x={x + w / 2} y={y + 13} textAnchor="middle">{s.name}</text>
            </g>
          );
        })}
        <text className="uf-idle" x={cx(0)} y={LY + 60} textAnchor="middle">IDLE</text>
        <text className="uf-idle" x={cx(11)} y={LY + 60} textAnchor="middle">IDLE</text>
      </svg>

      {/* phone: mini waveform + wrapping slot chips */}
      <div className="uf-list" aria-hidden="true">
        <svg viewBox="0 0 480 60" className="uf-mini" preserveAspectRatio="xMidYMid meet">
          <path className="uf-wave" d={miniPath()} />
        </svg>
        <ul className="uf-chips">
          {SLOTS.map((s) => (
            <li key={s.name} className={s.framing ? "uf-chip uf-chip-b" : "uf-chip uf-chip-g"}>
              <span className="uf-chip-name">{s.name}</span>
              <span className="uf-chip-val">{s.value}</span>
            </li>
          ))}
        </ul>
        <p className="uf-idle-note">The line idles high before and after the frame.</p>
      </div>
    </DiagramFrame>
  );
}

// mini waveform for the phone card (no labels), scaled to a 480x60 box.
function miniPath(): string {
  const x0 = 8;
  const cw = 464 / FR.length;
  const hy = 12;
  const ly = 48;
  let y = FR[0] ? hy : ly;
  let d = `M${x0},${y}`;
  let x = x0;
  for (const b of FR) {
    const yl = b ? hy : ly;
    if (yl !== y) d += ` L${x.toFixed(1)},${yl}`;
    x += cw;
    d += ` L${x.toFixed(1)},${yl}`;
    y = yl;
  }
  return d;
}

const CSS = `
.uf-scene{display:block;width:100%;height:auto;overflow:visible;}
.uf-wave{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;}
.uf-bit{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:15px;fill:var(--color-title,#f1ece0);}
.uf-slot-g{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:1.6;}
.uf-slot-b{fill:none;stroke:var(--color-signal-blue,#4a8fff);stroke-width:1.6;}
.uf-name{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:11px;letter-spacing:.03em;}
.uf-name-g{fill:var(--color-command-gold,#c8963e);}
.uf-name-b{fill:var(--color-signal-blue,#4a8fff);}
.uf-idle{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:11px;letter-spacing:.05em;
  fill:var(--color-muted,#aaa);text-transform:uppercase;}

/* phone reflow */
.uf-list{display:none;}
@media (max-width:520px){ .uf-scene{display:none;} .uf-list{display:block;} }
.uf-mini{display:block;width:100%;max-width:340px;height:auto;margin:0 auto .9rem;overflow:visible;}
.uf-chips{display:flex;flex-wrap:wrap;justify-content:center;gap:.45rem;list-style:none;margin:0;padding:0;}
.uf-chip{display:flex;flex-direction:column;align-items:center;gap:1px;min-width:34px;padding:.3rem .35rem;border-radius:5px;
  background:var(--color-navy-dark,#1a1a2e);}
.uf-chip-g{box-shadow:inset 0 0 0 1.5px var(--color-command-gold,#c8963e);}
.uf-chip-b{box-shadow:inset 0 0 0 1.5px var(--color-signal-blue,#4a8fff);}
.uf-chip-name{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.72rem;letter-spacing:.02em;}
.uf-chip-g .uf-chip-name{color:var(--color-command-gold,#c8963e);}
.uf-chip-b .uf-chip-name{color:var(--color-signal-blue,#4a8fff);}
.uf-chip-val{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:1.1rem;color:var(--color-title,#f1ece0);}
.uf-idle-note{margin:.9rem 0 0;font-family:var(--font-mono,"Space Mono",monospace);font-size:.74rem;letter-spacing:.04em;
  text-transform:uppercase;color:var(--color-muted,#aaa);text-align:center;}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .uf-wave{opacity:0;}
.dgfrm.armed.in .uf-wave{opacity:1;transition:opacity .55s ease .15s;}
@media (prefers-reduced-motion:reduce){ .dgfrm .uf-wave{opacity:1!important;} }
`;
