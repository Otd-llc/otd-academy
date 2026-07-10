// Serial vs parallel, seen on a scope (v2). Communication & Interfaces cluster.
// Owner-picked O5 (10-option round).
//
// Teaching point: a serial bus is ONE wire whose voltage toggles through the
// byte one bit-time after another, so the byte lives in the line's shape over
// time. A parallel bus is EIGHT wires read at a single clock edge, so the whole
// byte sits across the wires at one instant. Serial spends time to save wires;
// parallel spends wires to save time, which is why small boards, short on pins,
// go serial.
//
// Landscape desktop/print: two waveform panels stacked, gold serial over blue
// parallel. REFLOWS to two stacked cards on a phone (SVG text would scale under
// the ~14px floor otherwise). Token-only color: gold = serial, blue = parallel.
import { DiagramFrame } from "./DiagramFrame";

const BITS = [1, 0, 1, 1, 0, 0, 1, 0];
const SX0 = 120; // serial first cell x
const SCW = 46; // serial cell width

// A square-wave path across `bits`, high at `hy`, low at `ly`, cell width `cw`.
function wavePath(x0: number, hy: number, ly: number, cw: number): string {
  let y = BITS[0] ? hy : ly;
  let d = `M${x0},${y}`;
  let x = x0;
  for (const b of BITS) {
    const yl = b ? hy : ly;
    if (yl !== y) d += ` L${x},${yl}`;
    x += cw;
    d += ` L${x},${yl}`;
    y = yl;
  }
  return d;
}

export function CommsSerialVsParallel({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="COMMS · A BUS"
      tone="gold"
      title="Serial vs parallel"
      ariaLabel="Serial versus parallel, seen as signals. On top, a serial bus is one wire whose voltage toggles through eight bits in sequence, 1 0 1 1 0 0 1 0, one bit-time after another, so the byte lives in the shape of the line over time. Below, a parallel bus is eight wires read at a single clock edge, each wire holding one bit of the same byte at the same instant. Serial spends time to save wires; parallel spends wires to save time, which is why small boards, short on pins, use serial."
      caption={caption}
      defaultCaption="Serial is one wire toggling through the byte over time; parallel is eight wires, the whole byte read at a single clock edge."
    >
      <style>{CSS}</style>

      {/* desktop / print: two waveform panels */}
      <svg className="svp-scene" viewBox="0 0 560 248" aria-hidden="true">
        {/* serial: one wire toggling over time */}
        <text className="svp-hd svp-g" x={12} y={28}>SERIAL</text>
        <text className="svp-sub" x={12} y={46}>1 WIRE</text>
        <path className="svp-wave-g" d={wavePath(SX0, 34, 66, SCW)} />
        {BITS.map((b, i) => (
          <text key={i} className="svp-bit" x={SX0 + SCW * i + SCW / 2} y={90} textAnchor="middle">{b}</text>
        ))}
        <text className="svp-sub" x={SX0 + (SCW * BITS.length) / 2} y={110} textAnchor="middle">TIME →</text>

        <line className="svp-div" x1={12} y1={122} x2={548} y2={122} />

        {/* parallel: eight wires read at one edge */}
        <text className="svp-hd svp-b" x={12} y={150}>PARALLEL</text>
        <text className="svp-sub" x={12} y={168}>8 WIRES</text>
        {BITS.map((b, i) => {
          const y = 145 + i * 11;
          return (
            <g key={i}>
              <rect className="svp-pcell" x={100} y={y - 5} width={26} height={10} rx={2} />
              <text className="svp-bit-s" x={113} y={y} textAnchor="middle" dominantBaseline="central">{b}</text>
              <line className="svp-wave-b" x1={140} y1={y} x2={524} y2={y} />
            </g>
          );
        })}
        <line className="svp-edge" x1={132} y1={139} x2={132} y2={226} />
        <text className="svp-sub" x={334} y={240} textAnchor="middle">ALL EIGHT AT ONE CLOCK EDGE</text>
      </svg>

      {/* phone: two stacked cards */}
      <ul className="svp-list" aria-hidden="true">
        <li>
          <span className="svp-li-lbl svp-g">SERIAL · 1 WIRE, 8 BIT-TIMES</span>
          <svg viewBox="0 0 320 70" className="svp-mini">
            <path className="svp-wave-g" d={wavePath(10, 14, 50, 37.5)} />
          </svg>
          <span className="svp-byte">1 0 1 1 0 0 1 0</span>
        </li>
        <li>
          <span className="svp-li-lbl svp-b">PARALLEL · 8 WIRES, 1 EDGE</span>
          <svg viewBox="0 0 320 116" className="svp-mini">
            {BITS.map((b, i) => {
              const y = 8 + i * 14;
              return <line key={i} className="svp-wave-b" x1={44} y1={y} x2={306} y2={y} />;
            })}
            <line className="svp-edge" x1={36} y1={4} x2={36} y2={110} />
          </svg>
          <span className="svp-byte">1 0 1 1 0 0 1 0</span>
        </li>
      </ul>
    </DiagramFrame>
  );
}

const CSS = `
.svp-scene{display:block;width:100%;height:auto;overflow:visible;}
.svp-hd{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:15px;letter-spacing:.1em;}
.svp-g{fill:var(--color-command-gold,#c8963e);color:var(--color-command-gold,#c8963e);}
.svp-b{fill:var(--color-signal-blue,#4a8fff);color:var(--color-signal-blue,#4a8fff);}
.svp-sub{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:12px;letter-spacing:.08em;
  fill:var(--color-muted,#aaa);text-transform:uppercase;}
.svp-bit{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:19px;
  fill:var(--color-title,#f1ece0);}
.svp-bit-s{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:12px;
  fill:var(--color-title,#f1ece0);}
.svp-pcell{fill:var(--color-navy-dark,#1a1a2e);stroke:var(--color-signal-blue,#4a8fff);stroke-width:1.5;}
.svp-wave-g{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;}
.svp-wave-b{fill:none;stroke:var(--color-signal-blue,#4a8fff);stroke-width:2.6;stroke-linecap:round;}
.svp-div{stroke:var(--color-panel-border,#3a3f50);stroke-width:1.5;stroke-dasharray:4 4;}
.svp-edge{stroke:var(--color-muted,#aaa);stroke-width:1.5;stroke-dasharray:3 3;}

/* phone reflow */
.svp-list{display:none;list-style:none;margin:0;padding:0;flex-direction:column;gap:.7rem;}
@media (max-width:520px){ .svp-scene{display:none;} .svp-list{display:flex;} }
.svp-list li{display:flex;flex-direction:column;gap:.5rem;padding:.8rem 1rem;border-radius:6px;text-align:left;
  background:var(--color-navy-dark,#1a1a2e);box-shadow:inset 0 0 0 1.5px var(--color-panel-border,#3a3f50);}
.svp-li-lbl{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.82rem;letter-spacing:.06em;}
.svp-mini{display:block;width:100%;max-width:300px;height:auto;margin:0 auto;overflow:visible;}
.svp-byte{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:1.25rem;
  letter-spacing:.25em;color:var(--color-title,#f1ece0);text-align:center;}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .svp-wave-g,.dgfrm.armed .svp-wave-b{opacity:0;}
.dgfrm.armed.in .svp-wave-g{opacity:1;transition:opacity .5s ease .15s;}
.dgfrm.armed.in .svp-wave-b{opacity:1;transition:opacity .5s ease .35s;}
@media (prefers-reduced-motion:reduce){ .dgfrm .svp-wave-g,.dgfrm .svp-wave-b{opacity:1!important;} }
`;
