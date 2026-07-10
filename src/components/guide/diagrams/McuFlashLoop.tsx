// The flashing loop (diagram-standards v2). MCU cluster, diagram 6.
// Owner-picked F4: a real loop with esptool at the hub.
//
// Teaching point (lesson 5): flashing is a load-and-go loop. You write source,
// compile it to a binary, flash it with esptool over USB into the bootloader and
// on into flash, and the next reset runs it; change the code and the loop repeats.
// A cyclic process gets a real loop (four nodes on a landscape ellipse, gold
// forward arcs, a blue return arc), with esptool, the tool you run each upload,
// at the hub.
//
// Arc geometry computed once at module scope. Color via CSS classes (marker fills
// included) so both themes flip. Header + caption from the DiagramFrame.
import { DiagramFrame } from "./DiagramFrame";

const CX = 270, CY = 118, RX = 196, RY = 80;
const pt = (deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [CX + RX * Math.cos(a), CY + RY * Math.sin(a)];
};
const arcD = (a1: number, a2: number, gap = 18) => {
  const [x1, y1] = pt(a1 + gap), [x2, y2] = pt(a2 - gap);
  return `M${x1.toFixed(1)} ${y1.toFixed(1)} A${RX} ${RY} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
};
const NODES = [
  { deg: 180, t: "WRITE", s: "your source code" },
  { deg: 270, t: "COMPILE", s: "to a binary image" },
  { deg: 360, t: "FLASH", s: "esptool over USB" },
  { deg: 450, t: "RUN", s: "on the next reset" },
];

export function McuFlashLoop({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="MICROCONTROLLERS · FLASHING"
      tone="gold"
      title="The load-and-go loop"
      ariaLabel="The flashing loop, drawn as a cycle. You write your source code, compile it to a binary image, flash it with esptool over USB into the ESP32's bootloader and on into flash, and the next reset runs it. esptool, at the hub, is the upload tool you run each time. Change the code and the loop repeats, the same every time you hit upload."
      caption={caption}
      defaultCaption="Compile the source to a binary, flash it with esptool over USB into the bootloader and flash, and the next reset runs it. Change the code and the loop repeats."
    >
      <style>{CSS}</style>
      <div className="fl">
        <svg className="fl-svg" viewBox="0 0 540 236" aria-hidden="true">
          <defs>
            <marker id="fl-g" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto">
              <path d="M0 0 L6 3 L0 6 Z" className="fl-mk-g" />
            </marker>
            <marker id="fl-b" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto">
              <path d="M0 0 L6 3 L0 6 Z" className="fl-mk-b" />
            </marker>
          </defs>

          <path d={arcD(180, 270)} className="fl-arc-g" markerEnd="url(#fl-g)" />
          <path d={arcD(270, 360)} className="fl-arc-g" markerEnd="url(#fl-g)" />
          <path d={arcD(360, 450)} className="fl-arc-g" markerEnd="url(#fl-g)" />
          <path d={arcD(450, 540)} className="fl-arc-b" markerEnd="url(#fl-b)" />

          {NODES.map((n) => {
            const [x, y] = pt(n.deg);
            return (
              <g key={n.t}>
                <rect x={x - 58} y={y - 26} width="116" height="52" rx="8" className="fl-node" />
                <text x={x} y={y - 2} textAnchor="middle" className="fl-title">{n.t}</text>
                <text x={x} y={y + 13} textAnchor="middle" className="fl-sub">{n.s}</text>
              </g>
            );
          })}

          <circle cx={CX} cy={CY} r="31" className="fl-hub" />
          <text x={CX} y={CY - 1} textAnchor="middle" className="fl-hub-t">esptool</text>
          <text x={CX} y={CY + 12} textAnchor="middle" className="fl-hub-s">each upload</text>
        </svg>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.fl{max-width:36rem;margin-inline:auto;}
.fl-svg{display:block;width:100%;height:auto;overflow:visible;}
.fl-arc-g{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2.2;}
.fl-arc-b{fill:none;stroke:var(--color-signal-blue,#4a8fff);stroke-width:2.2;}
.fl-mk-g{fill:var(--color-command-gold,#c8963e);}
.fl-mk-b{fill:var(--color-signal-blue,#4a8fff);}
.fl-node{fill:var(--color-navy-dark,#1a1a2e);stroke:var(--color-command-gold,#c8963e);stroke-width:1.8;}
.fl-title{font-family:var(--font-display,"Bebas Neue",sans-serif);font-size:18px;letter-spacing:.03em;fill:var(--color-title,#f1ece0);}
.fl-sub{font-family:var(--font-mono,"Space Mono",monospace);font-size:9.5px;fill:var(--color-muted,#aaaaaa);}
.fl-hub{fill:var(--color-navy-dark,#1a1a2e);stroke:var(--color-signal-blue,#4a8fff);stroke-width:1.7;}
.fl-hub-t{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:11px;fill:var(--color-signal-blue,#4a8fff);}
.fl-hub-s{font-family:var(--font-mono,"Space Mono",monospace);font-size:8.5px;fill:var(--color-muted,#aaaaaa);}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .fl-svg{opacity:0;transform:translateY(6px);}
.dgfrm.armed.in .fl-svg{opacity:1;transform:none;transition:opacity .6s ease,transform .6s cubic-bezier(.2,.7,.2,1);}
@media (prefers-reduced-motion:reduce){
  .dgfrm .fl-svg{opacity:1!important;transform:none!important;transition:none!important;}
}
`;
