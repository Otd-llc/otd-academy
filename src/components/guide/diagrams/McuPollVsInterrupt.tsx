// Polling versus interrupts (diagram-standards v2). MCU cluster, diagram 8.
// Owner-picked I4: a circling loop, versus a straight jump.
//
// Teaching point (lesson 7): polling loops and reads a pin over and over, mostly
// finding nothing and burning cycles. An interrupt flips it: the hardware watches,
// and the instant the event fires it jumps the CPU straight into a short handler
// (the ISR). Left panel draws polling as a loop that circles through checks; right
// panel draws the interrupt as a straight event-to-ISR path. Gold = the checking
// loop, blue = the event/interrupt path.
//
// Two SVG panels in a flex row, so they stack full-width on a phone. Token color,
// both themes. Header + caption from the DiagramFrame.
import { DiagramFrame } from "./DiagramFrame";

function Bolt({ x, y }: { x: number; y: number }) {
  return <path d={`M${x} ${y} l -7 12 l 5 0 l -5 12 l 13 -16 l -5 0 l 5 -8 z`} className="pi-bolt" />;
}

const CHECKS = [
  { x: 100, y: 54 },
  { x: 156, y: 110 },
  { x: 100, y: 166 },
  { x: 44, y: 110 },
];

export function McuPollVsInterrupt({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="MICROCONTROLLERS · INTERRUPTS"
      tone="gold"
      title="Ask over and over, or be told"
      ariaLabel="Two ways to catch an event, compared. On the left, polling is drawn as a loop: the CPU circles through repeated checks of a pin, asking again and again and mostly finding nothing. On the right, an interrupt is drawn as a straight path: the event fires and jumps the CPU directly into a short interrupt service routine, the ISR, with no checking and a near-instant response."
      caption={caption}
      defaultCaption="Polling circles through checks over and over; an interrupt jumps the CPU straight to the handler the moment the event fires."
    >
      <style>{CSS}</style>
      <div className="pi">
        {/* POLLING — a loop */}
        <svg className="pi-svg" viewBox="0 0 210 210" aria-hidden="true">
          <defs>
            <marker id="pi-g" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0 0 L6 3 L0 6 Z" className="pi-mk-g" />
            </marker>
          </defs>
          <text x="100" y="16" textAnchor="middle" className="pi-lbl-g">POLLING</text>
          <circle cx="100" cy="110" r="56" className="pi-ring" />
          <path d="M100 54 A56 56 0 0 1 152 92" className="pi-ring-arrow" markerEnd="url(#pi-g)" />
          {CHECKS.map((c, i) => (
            <g key={i}>
              <circle cx={c.x} cy={c.y} r="13" className="pi-node" />
              <text x={c.x} y={c.y + 4} textAnchor="middle" className="pi-q">?</text>
            </g>
          ))}
          <text x="100" y="106" textAnchor="middle" className="pi-mid">check,</text>
          <text x="100" y="120" textAnchor="middle" className="pi-mid">recheck</text>
          <text x="100" y="196" textAnchor="middle" className="pi-note">loops, mostly finds nothing</text>
        </svg>

        <div className="pi-div" aria-hidden="true" />

        {/* INTERRUPT — a straight jump */}
        <svg className="pi-svg pi-svg-r" viewBox="0 0 250 210" aria-hidden="true">
          <defs>
            <marker id="pi-b" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0 0 L6 3 L0 6 Z" className="pi-mk-b" />
            </marker>
          </defs>
          <text x="125" y="16" textAnchor="middle" className="pi-lbl-b">INTERRUPT</text>
          <line x1="20" y1="150" x2="230" y2="150" className="pi-work" />
          <text x="24" y="170" className="pi-note">CPU free for other work</text>
          <line x1="60" y1="150" x2="60" y2="112" className="pi-jump" />
          <Bolt x={59} y={112} />
          <text x="42" y="104" className="pi-evt">event</text>
          <line x1="72" y1="96" x2="150" y2="96" className="pi-jump" markerEnd="url(#pi-b)" />
          <rect x="152" y="78" width="76" height="36" rx="7" className="pi-isr" />
          <text x="190" y="101" textAnchor="middle" className="pi-isr-t">ISR</text>
          <text x="125" y="196" textAnchor="middle" className="pi-note">jumps the instant it fires</text>
        </svg>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.pi{display:flex;gap:.7rem;align-items:center;justify-content:center;max-width:36rem;margin-inline:auto;}
.pi-svg{flex:1 1 200px;min-width:0;max-width:220px;height:auto;overflow:visible;}
.pi-svg-r{max-width:264px;}
.pi-div{flex:0 0 0;align-self:stretch;border-left:1px dashed var(--color-panel-border,#3a3f50);margin:1rem 0;}
@container (max-width:520px){
  .pi{flex-direction:column;gap:.3rem;}
  .pi-svg{max-width:min(300px,100%);}
  .pi-div{align-self:stretch;border-left:0;border-top:1px dashed var(--color-panel-border,#3a3f50);margin:0 2rem;width:auto;}
}
.pi-ring{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:1.8;stroke-dasharray:4 5;}
.pi-ring-arrow{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2;}
.pi-mk-g{fill:var(--color-command-gold,#c8963e);}
.pi-mk-b{fill:var(--color-signal-blue,#4a8fff);}
.pi-node{fill:var(--color-diagram-surface,#1f2438);stroke:var(--color-command-gold,#c8963e);stroke-width:1.6;}
.pi-q{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:12px;fill:var(--color-muted,#aaaaaa);}
.pi-mid{font-family:var(--font-mono,"Space Mono",monospace);font-size:10px;fill:var(--color-muted,#aaaaaa);}
.pi-lbl-g{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:11px;letter-spacing:.12em;fill:var(--color-command-gold,#c8963e);}
.pi-lbl-b{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:11px;letter-spacing:.12em;fill:var(--color-signal-blue,#4a8fff);}
.pi-work{stroke:var(--color-command-gold,#c8963e);stroke-width:3;stroke-linecap:round;}
.pi-jump{stroke:var(--color-signal-blue,#4a8fff);stroke-width:2.2;stroke-linecap:round;}
.pi-bolt{fill:var(--color-signal-blue,#4a8fff);}
.pi-evt{font-family:var(--font-mono,"Space Mono",monospace);font-size:10px;fill:var(--color-signal-blue,#4a8fff);}
.pi-isr{fill:var(--color-diagram-surface,#1f2438);stroke:var(--color-signal-blue,#4a8fff);stroke-width:1.6;}
.pi-isr-t{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:12px;fill:var(--color-title,#f1ece0);}
.pi-note{font-family:var(--font-mono,"Space Mono",monospace);font-size:9.5px;fill:var(--color-muted,#aaaaaa);}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .pi-svg{opacity:0;transform:translateY(6px);}
.dgfrm.armed.in .pi-svg{opacity:1;transform:none;transition:opacity .55s ease,transform .55s cubic-bezier(.2,.7,.2,1);}
.dgfrm.armed.in .pi-svg-r{transition-delay:.12s;}
@media (prefers-reduced-motion:reduce){
  .dgfrm .pi-svg{opacity:1!important;transform:none!important;transition:none!important;}
}
`;
