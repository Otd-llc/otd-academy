// Level shifting, shown as a signal (v2). Communication & Interfaces cluster.
// Owner-picked O4 (10-option round): the same bits, a smaller swing.
//
// Teaching point: a level shifter translates a logic signal from one voltage
// domain to another. Here a 5 V signal passes through the shifter and comes out
// in a 3.3 V domain: the pattern of 1s and 0s is unchanged, but the swing drops
// from 5 V to 3.3 V, a level the 3.3 V part can accept safely. (The two waveforms'
// heights are drawn proportional to their voltages, ~3.3/5.)
//
// Landscape desktop/print: the 5 V waveform, a LEVEL SHIFTER block, and the 3.3 V
// waveform at a lower swing. REFLOWS on a phone to stacked in/out cards. Token-
// only color: gold = the 5 V signal, blue = the shifted 3.3 V signal.
import { DiagramFrame } from "./DiagramFrame";

const BITS = [1, 0, 1, 1, 0, 1];

// A square wave over `bits`, riding a baseline at `base`, high `amp` above it.
function wavePath(bits: number[], x0: number, cw: number, base: number, amp: number): string {
  let y = bits[0] ? base - amp : base;
  let d = `M${x0},${y}`;
  let x = x0;
  for (const b of bits) {
    const yl = b ? base - amp : base;
    if (yl !== y) d += ` L${x},${yl}`;
    x += cw;
    d += ` L${x},${yl}`;
    y = yl;
  }
  return d;
}

export function CommsLevelShift({ caption }: { caption?: string }) {
  const base = 176;
  return (
    <DiagramFrame
      eyebrow="COMMS · LEVEL SHIFTING"
      tone="gold"
      title="Same bits, a smaller swing"
      ariaLabel="Level shifting shown as a signal. On the left, a logic signal in a 5 volt domain swings between 0 and 5 volts. It passes through a level shifter, which keeps the same pattern of ones and zeros but drops the swing. On the right, the same bits come out in a 3.3 volt domain, swinging only 0 to 3.3 volts, a level the 3.3 volt part can accept safely."
      caption={caption}
      defaultCaption="A level shifter keeps the same 1s and 0s but drops the voltage swing from 5 V to 3.3 V."
    >
      <style>{CSS}</style>

      {/* desktop / print: the waveform transform */}
      <svg className="ls-scene" viewBox="0 0 580 232" aria-hidden="true">
        <line className="ls-base" x1={40} y1={base} x2={540} y2={base} />

        <text className="ls-v ls-v5" x={150} y={110} textAnchor="middle">5 V</text>
        <path className="ls-w5" d={wavePath(BITS, 44, 34, base, 52)} />

        <rect className="ls-shifter" x={252} y={112} width={76} height={64} rx={6} />
        <text className="ls-bt" x={290} y={140} textAnchor="middle">LEVEL</text>
        <text className="ls-bt" x={290} y={156} textAnchor="middle">SHIFTER</text>

        <text className="ls-v ls-v3" x={450} y={128} textAnchor="middle">3.3 V</text>
        <path className="ls-w3" d={wavePath(BITS, 336, 34, base, 34)} />

        <text className="ls-note" x={290} y={208} textAnchor="middle">SAME BITS · LOWER SWING</text>
      </svg>

      {/* phone: stacked in/out cards */}
      <div className="ls-list" aria-hidden="true">
        <div className="ls-card">
          <span className="ls-card-lbl ls-lbl5">5 V IN</span>
          <svg viewBox="0 0 300 56" className="ls-mini"><path className="ls-w5" d={wavePath(BITS, 6, 48, 48, 40)} /></svg>
        </div>
        <div className="ls-arrow">LEVEL SHIFTER ↓</div>
        <div className="ls-card">
          <span className="ls-card-lbl ls-lbl3">3.3 V OUT</span>
          <svg viewBox="0 0 300 56" className="ls-mini"><path className="ls-w3" d={wavePath(BITS, 6, 48, 48, 26)} /></svg>
        </div>
        <p className="ls-note-p">Same bits, a smaller swing.</p>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.ls-scene{display:block;width:100%;height:auto;overflow:visible;}
.ls-base{stroke:var(--color-panel-border,#3a3f50);stroke-width:1.4;stroke-dasharray:3 3;}
.ls-w5{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;}
.ls-w3{fill:none;stroke:var(--color-signal-blue,#4a8fff);stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;}
.ls-shifter{fill:var(--color-diagram-surface,#1f2438);stroke:var(--color-gold-light,#e8b865);stroke-width:2;}
.ls-bt{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:11px;fill:var(--color-title,#f1ece0);}
.ls-v{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:22px;}
.ls-v5{fill:var(--color-command-gold,#c8963e);}
.ls-v3{fill:var(--color-signal-blue,#4a8fff);}
.ls-note{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:11px;letter-spacing:.05em;fill:var(--color-muted,#aaa);text-transform:uppercase;}

/* phone reflow */
.ls-list{display:none;}
@container (max-width:520px){ .ls-scene{display:none;} .ls-list{display:block;} }
.ls-card{display:flex;flex-direction:column;gap:.5rem;padding:.8rem 1rem;border-radius:8px;
  }
.ls-card-lbl{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:1.3rem;}
.ls-lbl5{color:var(--color-command-gold,#c8963e);}
.ls-lbl3{color:var(--color-signal-blue,#4a8fff);}
.ls-mini{display:block;width:100%;max-width:300px;height:auto;overflow:visible;}
.ls-arrow{margin:.6rem 0;text-align:center;font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.78rem;
  letter-spacing:.06em;text-transform:uppercase;color:var(--color-gold-light,#e8b865);}
.ls-note-p{margin:.9rem 0 0;font-family:var(--font-mono,"Space Mono",monospace);font-size:.74rem;letter-spacing:.03em;
  text-transform:uppercase;color:var(--color-muted,#aaa);text-align:center;}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .ls-w3{opacity:0;}
.dgfrm.armed.in .ls-w3{opacity:1;transition:opacity .5s ease .35s;}
@media (prefers-reduced-motion:reduce){ .dgfrm .ls-w3{opacity:1!important;} }
`;
