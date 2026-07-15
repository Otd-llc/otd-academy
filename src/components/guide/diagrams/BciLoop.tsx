// The brain-computer interface loop as a responsive diagram (v2).
//
// Teaching point: every BCI is the same loop — MEASURE the brain signal, DECODE
// it into an intent, issue a COMMAND, and a DEVICE acts; then FEEDBACK closes the
// loop, because the user gets better at producing clean, classifiable states by
// seeing the result. The feedback return is what makes a BCI as much skill as
// hardware, so it is a distinct blue path, not just another forward step.
//
// v2: an actual ring on desktop/print (a landscape ellipse) with four themed icon
// nodes — a signal receiver (measure), a chip (decode), a "go" token (command),
// and a drone (device) — gold forward arcs and a blue feedback arc closing the
// circle. Reflows to a vertical stack of the four stages on a narrow phone
// (directive 1). Token-only color via CSS classes; blue = the feedback return.
import { DiagramFrame } from "./DiagramFrame";

// --- ring geometry (SSR-safe, deterministic) ---
const CX = 280, CY = 128, RX = 112, RY = 78;
const cosd = (a: number) => Math.cos((a * Math.PI) / 180);
const sind = (a: number) => Math.sin((a * Math.PI) / 180);
const pt = (a: number): [number, number] => [CX + RX * cosd(a), CY + RY * sind(a)];
function arcD(a1: number, a2: number): string {
  const [x1, y1] = pt(a1), [x2, y2] = pt(a2);
  return `M${x1.toFixed(1)},${y1.toFixed(1)} A${RX},${RY} 0 0 1 ${x2.toFixed(1)},${y2.toFixed(1)}`;
}
function headD(a2: number): string {
  const [x, y] = pt(a2), [xb, yb] = pt(a2 - 7);
  const ang = Math.atan2(y - yb, x - xb), L = 8;
  return `M${x.toFixed(1)},${y.toFixed(1)} L${(x - L * Math.cos(ang - 0.5)).toFixed(1)},${(y - L * Math.sin(ang - 0.5)).toFixed(1)} M${x.toFixed(1)},${y.toFixed(1)} L${(x - L * Math.cos(ang + 0.5)).toFixed(1)},${(y - L * Math.sin(ang + 0.5)).toFixed(1)}`;
}

// --- node icon shapes (reused desktop + phone) ---
// Lucide radio-tower (24-space), Lucide-style chip, "go" token, quadcopter — all
// via CSS classes so they re-theme in light mode.
const RadioShapes = () => (
  <>
    <path className="bci-il" d="M4.9 16.1C1 12.2 1 5.8 4.9 1.9" />
    <path className="bci-il" d="M7.8 4.7a6.14 6.14 0 0 0-.8 7.5" />
    <circle className="bci-il" cx="12" cy="9" r="2" />
    <path className="bci-il" d="M16.2 4.8c2 2 2.26 5.11.8 7.47" />
    <path className="bci-il" d="M19.1 1.9a9.96 9.96 0 0 1 0 14.1" />
    <path className="bci-il" d="M9.5 18h5" />
    <path className="bci-il" d="m8 22 4-11 4 11" />
  </>
);
const ChipShapes = () => (
  <>
    <rect className="bci-if" x="-15" y="-15" width="30" height="30" rx="3" />
    {[-8, 0, 8].map((k) => (
      <g className="bci-il" key={k}>
        <line x1={k} y1="-20" x2={k} y2="-15" />
        <line x1={k} y1="15" x2={k} y2="20" />
        <line x1="-20" y1={k} x2="-15" y2={k} />
        <line x1="15" y1={k} x2="20" y2={k} />
      </g>
    ))}
    <path className="bci-ithin" d="M-9,-9 L9,9 M-9,-3 L3,9 M-3,-9 L9,3 M-9,3 L-3,9 M3,-9 L9,-3" />
  </>
);
const GoShapes = () => (
  <>
    <rect className="bci-if" x="-24" y="-14" width="48" height="28" rx="14" style={{ strokeWidth: 2.2 }} />
    <text className="bci-go" x="0" y="5" textAnchor="middle">go</text>
  </>
);
const DRONE_ARMS: [number, number][] = [[-18, -11], [18, -11], [-18, 11], [18, 11]];
const DroneShapes = () => (
  <>
    {DRONE_ARMS.map((p, i) => (
      <g className="bci-il" key={i}>
        <line x1="0" y1="0" x2={p[0]} y2={p[1]} />
        <circle cx={p[0]} cy={p[1]} r="8" />
      </g>
    ))}
    <rect className="bci-if" x="-8" y="-7" width="16" height="14" rx="3" />
  </>
);

const M = pt(-90), D = pt(0), C = pt(90), DE = pt(180);
const STAGES = [
  { name: "Measure", sub: "the brain signal", vb: "0 0 24 24", inner: <RadioShapes /> },
  { name: "Decode", sub: "into an intent", vb: "-24 -24 48 48", inner: <ChipShapes /> },
  { name: "Command", sub: "issue it", vb: "-28 -18 56 36", inner: <GoShapes /> },
  { name: "Device", sub: "acts", vb: "-26 -18 52 36", inner: <DroneShapes /> },
];

export function BciLoop({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="WHAT IS A BCI"
      tone="gold"
      title="Measure, decode, command, repeat"
      ariaLabel="Every brain-computer interface is the same loop: measure the brain signal, decode it into an intent, issue a command, and a device acts on it. Then feedback closes the loop: the user sees the result and adapts, getting better at producing clean, classifiable brain states. That feedback return is why a BCI is as much a learned skill as it is hardware."
      caption={caption}
      defaultCaption="The feedback return is the point: users learn to produce cleaner brain states by seeing the result. A BCI is skill plus hardware."
    >
      <style>{CSS}</style>

      <div className="bci">
        {/* desktop / print: the ring */}
        <div className="bci-ring">
          <svg className="bci-svg" viewBox="0 0 560 232" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <path className="bci-fwd" d={arcD(-70, -20)} /><path className="bci-fwd" d={headD(-20)} />
            <path className="bci-fwd" d={arcD(20, 70)} /><path className="bci-fwd" d={headD(70)} />
            <path className="bci-fwd" d={arcD(110, 160)} /><path className="bci-fwd" d={headD(160)} />
            <path className="bci-fb" d={arcD(200, 250)} /><path className="bci-fb" d={headD(250)} />

            <g transform={`translate(${M[0]},${M[1]}) scale(1.45) translate(-12,-12)`}><RadioShapes /></g>
            <g transform={`translate(${D[0]},${D[1]}) scale(0.82)`}><ChipShapes /></g>
            <g transform={`translate(${C[0]},${C[1]}) scale(0.8)`}><GoShapes /></g>
            <g transform={`translate(${DE[0]},${DE[1]}) scale(0.85)`}><DroneShapes /></g>

            <text className="bci-nm" x={M[0]} y={M[1] - 28} textAnchor="middle">Measure</text>
            <text className="bci-nm" x={D[0] + 26} y={D[1] + 4}>Decode</text>
            <text className="bci-nm" x={C[0]} y={C[1] + 32} textAnchor="middle">Command</text>
            <text className="bci-nm" x={DE[0] - 26} y={DE[1] + 4} textAnchor="end">Device</text>
            <text className="bci-fbl" x={pt(224)[0] - 6} y={pt(224)[1]} textAnchor="end">feedback</text>
          </svg>
        </div>

        {/* phone: vertical stage stack */}
        <ol className="bci-cards" aria-hidden="true">
          {STAGES.map((s, i) => (
            <li className="bci-row" key={s.name}>
              <svg className="bci-thumb" viewBox={s.vb} preserveAspectRatio="xMidYMid meet">{s.inner}</svg>
              <span className="bci-rtext"><b>{s.name}</b> · {s.sub}</span>
              {i === STAGES.length - 1 ? null : <span className="bci-down" aria-hidden="true">↓</span>}
            </li>
          ))}
          <li className="bci-foot"><span aria-hidden="true">↩ </span>feedback: you see the result and adapt, producing cleaner brain states</li>
        </ol>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.bci-svg,.bci-thumb{overflow:visible;display:block;}
.bci-svg{width:100%;height:auto;}
.bci-fwd{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2.4;stroke-linecap:round;}
.bci-fb{fill:none;stroke:var(--color-signal-blue,#4a8fff);stroke-width:2.4;stroke-linecap:round;}
.bci-il{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}
.bci-ithin{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;}
.bci-if{fill:var(--color-diagram-surface,#1f2438);stroke:var(--color-command-gold,#c8963e);stroke-width:2;stroke-linejoin:round;}
.bci-go{fill:var(--color-command-gold,#c8963e);font-family:var(--font-mono,"Space Mono",monospace);font-size:12px;font-weight:700;}
.bci-nm{fill:var(--color-title,#f1ece0);font-family:var(--font-mono,"Space Mono",monospace);font-size:13px;font-weight:700;}
.bci-fbl{fill:var(--color-signal-blue,#4a8fff);font-family:var(--font-mono,"Space Mono",monospace);font-size:11px;font-weight:700;}

/* phone reflow: vertical stage stack */
.bci-cards{display:none;list-style:none;margin:0;padding:0;flex-direction:column;gap:.35rem;text-align:left;}
@container (max-width:520px){
  .bci-ring{display:none;}
  .bci-cards{display:flex;}
}
.bci-row{display:flex;align-items:center;gap:.7rem;padding:.5rem .3rem;position:relative;}
.bci-thumb{flex:0 0 40px;width:40px;height:40px;}
.bci-rtext{font-family:var(--font-mono,"Space Mono",monospace);font-size:.9rem;color:var(--color-muted,#aaa);}
.bci-rtext b{color:var(--color-title,#f1ece0);font-weight:700;}
.bci-down{position:absolute;left:1.35rem;bottom:-.62rem;color:var(--color-command-gold,#c8963e);font-weight:700;font-size:.9rem;line-height:1;z-index:1;}
.bci-foot{margin-top:.55rem;padding:.6rem .75rem;border-radius:6px;
  background:color-mix(in srgb,var(--color-signal-blue,#4a8fff) 8%,transparent);
  box-shadow:inset 0 0 0 1.5px var(--color-signal-blue,#4a8fff);
  font-family:var(--font-serif,"Lora",serif);font-size:.86rem;line-height:1.4;color:var(--color-text,#e8e8e8);}
.bci-foot span{color:var(--color-signal-blue,#4a8fff);font-weight:700;}

/* Tier-B reveal off the frame's armed/in contract. */
.dgfrm.armed .bci-row,.dgfrm.armed .bci-foot{opacity:0;transform:translateY(5px);}
.dgfrm.armed.in .bci-row,.dgfrm.armed.in .bci-foot{opacity:1;transform:none;transition:opacity .5s ease,transform .5s cubic-bezier(.2,.7,.2,1);}
.dgfrm.armed.in .bci-row:nth-child(2){transition-delay:.06s;}
.dgfrm.armed.in .bci-row:nth-child(3){transition-delay:.12s;}
.dgfrm.armed.in .bci-row:nth-child(4){transition-delay:.18s;}
.dgfrm.armed.in .bci-foot{transition-delay:.26s;}
@media (prefers-reduced-motion:reduce){.dgfrm .bci-row,.dgfrm .bci-foot{opacity:1!important;transform:none!important;}}
`;
