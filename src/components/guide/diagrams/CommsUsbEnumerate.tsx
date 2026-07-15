// USB enumeration: the handshake over D+/D- (v2). Communication & Interfaces
// cluster. Owner-picked V2 numbered steps + V8's differential-pair waveform
// (improved-O9 round).
//
// Teaching point: USB is a negotiated bus. The host and device connect over a
// single differential pair, D+ and D-, whose two wires swing in opposite
// directions (which cancels noise). Before any of your data crosses, they run a
// handshake called enumeration: the host resets the device, asks it to describe
// itself, the device answers with descriptors (who it is, how much current it
// needs), the host assigns an address and loads a driver. Only then does data flow.
//
// Landscape desktop/print: the D+/D- pair drawn as two opposite-swinging waves
// between host and device, then a numbered sequence-diagram of the five handshake
// steps, then the green "data flows" payoff. REFLOWS on a phone to a numbered
// step list. Token-only color: blue = the differential pair + the device's reply,
// gold = the host's requests, green = data (the payoff, success state).
import { DiagramFrame } from "./DiagramFrame";

const HX = 115; // host lifeline
const DX = 465; // device lifeline
const AX0 = 133; // arrow start (clear of the number chip)

type Step = { n: number; label: string; dir: "out" | "in" };
const STEPS: Step[] = [
  { n: 1, label: "RESET", dir: "out" },
  { n: 2, label: "GET DESCRIPTOR", dir: "out" },
  { n: 3, label: "I AM A GPS, 100 mA", dir: "in" },
  { n: 4, label: "SET ADDRESS", dir: "out" },
  { n: 5, label: "LOAD DRIVER", dir: "out" },
];
const Y0 = 94;
const DY = 26;
const DATA_Y = Y0 + STEPS.length * DY + 8; // 232

// D+ and D- as opposite-swinging waves between the boxes (5 whole cycles so the
// ends land flush on the box edges). Deterministic (no random) so the raster is
// stable across renders.
function wave(sign: 1 | -1): string {
  const x0 = 192;
  const x1 = 388;
  const cy = 44;
  const amp = 7;
  let d = `M${x0},${cy}`;
  for (let x = x0; x <= x1; x += 4) {
    const y = cy - sign * amp * Math.sin(((x - x0) / (x1 - x0)) * 5 * 2 * Math.PI);
    d += ` L${x},${y.toFixed(1)}`;
  }
  return d;
}

function Arrow({ x1, y, x2, cls }: { x1: number; y: number; x2: number; cls: string }) {
  const dir = x2 > x1 ? 1 : -1;
  return (
    <>
      <line className={cls} x1={x1} y1={y} x2={x2} y2={y} />
      <path className={cls} fill="none" d={`M${x2 - dir * 7},${y - 4} L${x2},${y} L${x2 - dir * 7},${y + 4}`} />
    </>
  );
}

export function CommsUsbEnumerate({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="COMMS · USB"
      tone="gold"
      title="The handshake over D+/D-"
      ariaLabel="How a USB device enumerates. A host and a device connect over a single differential pair, D-plus and D-minus, whose two wires swing in opposite directions. Before any data crosses, they run a handshake: step 1, the host resets the device; step 2, it asks for the device's descriptor; step 3, the device describes itself, for example a GPS that needs 100 mA; step 4, the host assigns it an address; step 5, the host loads a matching driver. Only after those five enumeration steps does data finally flow."
      caption={caption}
      defaultCaption="Host and device meet over the D+/D- pair, run the five-step enumeration handshake, and only then does data flow."
    >
      <style>{CSS}</style>

      {/* desktop / print: the pair + the numbered handshake */}
      <svg className="ue-scene" viewBox="0 0 580 262" aria-hidden="true">
        {/* link: differential pair */}
        <text className="ue-pair-lbl" x={290} y={14} textAnchor="middle">D+ / D- (DIFFERENTIAL PAIR)</text>
        <rect className="ue-box" x={40} y={22} width={150} height={44} rx={5} />
        <text className="ue-bt" x={115} y={42} textAnchor="middle">HOST</text>
        <text className="ue-bsub" x={115} y={56} textAnchor="middle">your computer</text>
        <rect className="ue-box" x={390} y={22} width={150} height={44} rx={5} />
        <text className="ue-bt" x={465} y={42} textAnchor="middle">DEVICE</text>
        <text className="ue-bsub" x={465} y={56} textAnchor="middle">the board</text>
        <path className="ue-b" d={wave(1)} />
        <path className="ue-b" d={wave(-1)} />

        {/* lifelines */}
        <line className="ue-life" x1={HX} y1={66} x2={HX} y2={DATA_Y + 4} />
        <line className="ue-life" x1={DX} y1={66} x2={DX} y2={DATA_Y + 4} />

        {/* numbered handshake steps */}
        {STEPS.map((s) => {
          const y = Y0 + (s.n - 1) * DY;
          const out = s.dir === "out";
          return (
            <g key={s.n}>
              <circle className={out ? "ue-chip-g" : "ue-chip-b"} cx={HX} cy={y} r={10} />
              <text className="ue-num" x={HX} y={y + 4} textAnchor="middle">{s.n}</text>
              <Arrow x1={out ? AX0 : DX} y={y} x2={out ? DX : AX0} cls={out ? "ue-g" : "ue-b"} />
              <text className={out ? "ue-sig ue-sig-g" : "ue-sig ue-sig-b"} x={(AX0 + DX) / 2 + 9} y={y - 5} textAnchor="middle">{s.label}</text>
            </g>
          );
        })}

        {/* payoff */}
        <line className="ue-grn" x1={HX} y1={DATA_Y} x2={DX} y2={DATA_Y} />
        <text className="ue-data" x={290} y={DATA_Y - 6} textAnchor="middle">THEN DATA FLOWS</text>
      </svg>

      {/* phone: numbered step list */}
      <div className="ue-list" aria-hidden="true">
        <div className="ue-linkrow">
          <span className="ue-tag">HOST</span>
          <span className="ue-pair">~ D+/D- ~</span>
          <span className="ue-tag">DEVICE</span>
        </div>
        <ol className="ue-steps">
          {STEPS.map((s) => (
            <li key={s.n} className={s.dir === "out" ? "ue-step ue-step-g" : "ue-step ue-step-b"}>
              <span className="ue-step-n">{s.n}</span>
              <span className="ue-step-l">{s.label}</span>
              <span className="ue-step-d">{s.dir === "out" ? "host →" : "← device"}</span>
            </li>
          ))}
        </ol>
        <div className="ue-data-row">THEN DATA FLOWS</div>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.ue-scene{display:block;width:100%;height:auto;overflow:visible;}
.ue-box{fill:var(--color-diagram-surface,#1f2438);stroke:var(--color-command-gold,#c8963e);stroke-width:2;}
.ue-bt{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:13px;fill:var(--color-title,#f1ece0);}
.ue-bsub{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:9px;fill:var(--color-muted,#aaa);letter-spacing:.03em;}
.ue-pair-lbl{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:11px;letter-spacing:.04em;fill:var(--color-signal-blue,#4a8fff);}
.ue-b{fill:none;stroke:var(--color-signal-blue,#4a8fff);stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}
.ue-g{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2;stroke-linecap:round;}
.ue-grn{fill:none;stroke:var(--color-status-green,#66bb6a);stroke-width:2.5;stroke-linecap:round;}
.ue-life{stroke:var(--color-panel-border,#3a3f50);stroke-width:1.4;stroke-dasharray:4 4;}
.ue-chip-g{fill:var(--color-command-gold,#c8963e);}
.ue-chip-b{fill:var(--color-signal-blue,#4a8fff);}
.ue-num{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:13px;fill:var(--color-deep-space,#08090d);}
.ue-sig{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:11px;letter-spacing:.02em;}
.ue-sig-g{fill:var(--color-command-gold,#c8963e);}
.ue-sig-b{fill:var(--color-signal-blue,#4a8fff);}
.ue-data{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:12px;letter-spacing:.04em;fill:var(--color-status-green,#66bb6a);}

/* phone reflow */
.ue-list{display:none;}
@container (max-width:520px){ .ue-scene{display:none;} .ue-list{display:block;} }
.ue-linkrow{display:flex;align-items:center;justify-content:center;gap:.5rem;margin-bottom:.8rem;}
.ue-tag{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.8rem;padding:.35rem .6rem;border-radius:5px;
  color:var(--color-title,#f1ece0);box-shadow:inset 0 0 0 1.5px var(--color-command-gold,#c8963e);}
.ue-pair{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.8rem;color:var(--color-signal-blue,#4a8fff);}
.ue-steps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.4rem;}
.ue-step{display:flex;align-items:center;gap:.6rem;padding:.45rem .7rem;border-radius:6px;
  }
.ue-step-n{display:flex;align-items:center;justify-content:center;width:22px;height:22px;flex-shrink:0;border-radius:50%;
  font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:.85rem;color:var(--color-deep-space,#08090d);}
.ue-step-g .ue-step-n{background:var(--color-command-gold,#c8963e);}
.ue-step-b .ue-step-n{background:var(--color-signal-blue,#4a8fff);}
.ue-step-l{flex:1;font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.78rem;color:var(--color-title,#f1ece0);}
.ue-step-d{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.66rem;letter-spacing:.02em;}
.ue-step-g .ue-step-d{color:var(--color-command-gold,#c8963e);}
.ue-step-b .ue-step-d{color:var(--color-signal-blue,#4a8fff);}
.ue-data-row{margin-top:.7rem;padding:.5rem;text-align:center;border-radius:6px;
  font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.8rem;letter-spacing:.04em;
  color:var(--color-status-green,#66bb6a);box-shadow:inset 0 0 0 1.5px var(--color-status-green,#66bb6a);}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .ue-grn{opacity:0;}
.dgfrm.armed.in .ue-grn{opacity:1;transition:opacity .5s ease .4s;}
@media (prefers-reduced-motion:reduce){ .dgfrm .ue-grn{opacity:1!important;} }
`;
