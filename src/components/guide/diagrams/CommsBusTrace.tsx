// Debugging a bus: a good ACK vs a missing one (v2). Communication & Interfaces
// cluster. Owner-picked O3 (good vs bad), built as the two captures stacked.
//
// Teaching point: a logic analyzer turns "it does not work" into one visible
// difference. Both captures clock out the same I2C address; they differ only at
// the ninth clock, the acknowledgement slot. After the eighth bit the controller
// releases SDA, so it rises to high in both. On a healthy bus the addressed
// device then pulls SDA low to answer (an ACK). On a broken bus no device is
// present, so SDA stays high (no ACK). That missing dip is the classic "the bus
// does nothing" symptom, made visible.
//
// Landscape desktop/print: two stacked SCL/SDA captures, the ACK slot highlighted
// green (answered) on top and red (no answer) below. REFLOWS on a phone to two
// stacked cards. Token-only color: blue = SCL, gold = SDA, green = a good ACK,
// red = the missing ACK.
import { DiagramFrame } from "./DiagramFrame";

const BITS = [0, 0, 1, 1, 1, 0, 1, 0]; // I2C address 0x1D + W, MSB first
const X0 = 112;
const CW = 40;
const N = 9; // 8 address bits + the ACK slot
const ACK_X = X0 + 8 * CW; // left edge of the ACK slot
const RIGHT = X0 + N * CW;

// SCL clock: idle high, then N low-high pulses.
function sclPath(hi: number, lo: number): string {
  let d = `M40,${hi} L${X0},${hi}`;
  for (let i = 0; i < N; i++) {
    const cs = X0 + i * CW;
    d += ` L${cs},${lo} L${cs + CW * 0.5},${lo} L${cs + CW * 0.5},${hi} L${cs + CW},${hi}`;
  }
  return d;
}

// SDA: idle high, START drop, 8 address bits, then the ACK slot. After bit 8 the
// controller releases the line (it rises to `hi`); a device that answers pulls it
// low (`ackLow`), a missing device leaves it high.
function sdaPath(hi: number, lo: number, ackLow: boolean): string {
  let d = `M40,${hi} L${X0 - 10},${hi} L${X0},${lo}`;
  for (let i = 0; i < 8; i++) {
    const bl = BITS[i] ? hi : lo;
    d += ` L${X0 + i * CW},${bl} L${X0 + (i + 1) * CW},${bl}`;
  }
  d += ` L${ACK_X},${hi}`; // release: SDA rises at the ACK slot
  if (ackLow) d += ` L${ACK_X + 8},${hi} L${ACK_X + 8},${lo} L${RIGHT},${lo}`; // device pulls low
  else d += ` L${RIGHT},${hi}`; // no device: stays high
  return d;
}

export function CommsBusTrace({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="COMMS · DEBUG"
      tone="gold"
      title="Reading the ACK on a capture"
      ariaLabel="Two I2C logic-analyzer captures compared, differing only at the ninth clock, the acknowledgement slot. Both clock out the same address, and after the eighth bit the controller releases SDA so it rises high. On a healthy bus, top, the addressed device then pulls SDA low to answer, an acknowledgement. On a broken bus, bottom, no device is there, so SDA stays high: no acknowledgement. A logic analyzer turns a bus that does nothing into that one visible difference."
      caption={caption}
      defaultCaption="The only difference is the ninth clock: a device that answers pulls SDA low (ACK); a missing device leaves it high (no ACK)."
    >
      <style>{CSS}</style>

      {/* desktop / print: two stacked captures */}
      <svg className="bt-scene" viewBox="0 0 600 240" aria-hidden="true">
        {/* healthy: SDA dips low in the ACK slot */}
        <text className="bt-hd bt-ok" x={40} y={34}>HEALTHY BUS · DEVICE ANSWERS</text>
        <rect className="bt-ok-box" x={ACK_X} y={44} width={CW} height={66} rx={3} />
        <path className="bt-scl" d={sclPath(52, 70)} />
        <path className="bt-sda" d={sdaPath(86, 104, true)} />
        <text className="bt-rl bt-scl-t" x={44} y={66}>SCL</text>
        <text className="bt-rl bt-sda-t" x={44} y={100}>SDA</text>
        <text className="bt-slot bt-ok" x={ACK_X + CW / 2} y={124} textAnchor="middle">ACK</text>

        {/* broken: SDA stays high in the ACK slot */}
        <text className="bt-hd bt-no" x={40} y={152}>BROKEN BUS · NOBODY HOME</text>
        <rect className="bt-no-box" x={ACK_X} y={160} width={CW} height={66} rx={3} />
        <path className="bt-scl" d={sclPath(168, 186)} />
        <path className="bt-sda" d={sdaPath(202, 220, false)} />
        <text className="bt-rl bt-scl-t" x={44} y={182}>SCL</text>
        <text className="bt-rl bt-sda-t" x={44} y={216}>SDA</text>
        <text className="bt-slot bt-no" x={ACK_X + CW / 2} y={238} textAnchor="middle">NO ACK</text>
      </svg>

      {/* phone: two stacked cards */}
      <ul className="bt-list" aria-hidden="true">
        <li className="bt-li bt-li-ok">
          <span className="bt-li-hd bt-ok">ACK · SDA DIPS LOW</span>
          <svg viewBox="0 0 300 66" className="bt-mini" aria-hidden="true">
            <rect className="bt-ok-box" x={236} y={4} width={58} height={58} rx={3} />
            <path className="bt-scl" d="M6,16 L58,16 L58,28 L114,28 L114,16 L170,16 L170,28 L226,28 L226,16 L294,16" />
            <path className="bt-sda" d="M6,30 L110,30 L110,44 L200,44 L200,30 L236,30 L236,56 L294,56" />
          </svg>
          <span className="bt-li-v bt-ok">device answered</span>
        </li>
        <li className="bt-li bt-li-no">
          <span className="bt-li-hd bt-no">NO ACK · SDA STAYS HIGH</span>
          <svg viewBox="0 0 300 66" className="bt-mini" aria-hidden="true">
            <rect className="bt-no-box" x={236} y={4} width={58} height={58} rx={3} />
            <path className="bt-scl" d="M6,16 L58,16 L58,28 L114,28 L114,16 L170,16 L170,28 L226,28 L226,16 L294,16" />
            <path className="bt-sda" d="M6,30 L110,30 L110,44 L200,44 L200,30 L294,30" />
          </svg>
          <span className="bt-li-v bt-no">no device answered</span>
        </li>
      </ul>
    </DiagramFrame>
  );
}

const CSS = `
.bt-scene{display:block;width:100%;height:auto;overflow:visible;}
.bt-scl{fill:none;stroke:var(--color-signal-blue,#4a8fff);stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round;}
.bt-sda{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round;}
.bt-hd{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:11px;letter-spacing:.04em;text-transform:uppercase;}
.bt-ok{fill:var(--color-status-green,#66bb6a);color:var(--color-status-green,#66bb6a);}
.bt-no{fill:var(--color-alert-red,#ef5350);color:var(--color-alert-red,#ef5350);}
.bt-ok-box{fill:var(--color-status-green,#66bb6a);opacity:.13;}
.bt-no-box{fill:var(--color-alert-red,#ef5350);opacity:.13;}
.bt-slot{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:11px;letter-spacing:.03em;}
.bt-rl{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:10px;}
.bt-scl-t{fill:var(--color-signal-blue,#4a8fff);}
.bt-sda-t{fill:var(--color-command-gold,#c8963e);}

/* phone reflow */
.bt-list{display:none;list-style:none;margin:0;padding:0;flex-direction:column;gap:.7rem;}
@container (max-width:520px){ .bt-scene{display:none;} .bt-list{display:flex;} }
.bt-li{display:flex;flex-direction:column;gap:.5rem;padding:.8rem 1rem;border-radius:8px;}
.bt-li-ok{box-shadow:inset 0 0 0 1.5px var(--color-status-green,#66bb6a);}
.bt-li-no{box-shadow:inset 0 0 0 1.5px var(--color-alert-red,#ef5350);}
.bt-li-hd{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.78rem;letter-spacing:.02em;}
.bt-mini{display:block;width:100%;max-width:280px;height:auto;overflow:visible;}
.bt-li-v{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.72rem;text-transform:uppercase;letter-spacing:.03em;text-align:center;}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .bt-ok-box,.dgfrm.armed .bt-no-box{opacity:0;}
.dgfrm.armed.in .bt-ok-box{opacity:.13;transition:opacity .5s ease .3s;}
.dgfrm.armed.in .bt-no-box{opacity:.13;transition:opacity .5s ease .45s;}
@media (prefers-reduced-motion:reduce){ .dgfrm .bt-ok-box{opacity:.13!important;} .dgfrm .bt-no-box{opacity:.13!important;} }
`;
