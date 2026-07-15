// Routing: trace width vs current, and a plated via (diagram-standards v2).
//
// Teaching point (lesson 4): a trace's width sets how much current it carries
// (IPC-2221) and a via is a plated hole that carries a trace to another layer.
// Left panel is the width-vs-current curve with a point marked at 1 A; right
// panel is an edge-on plated via: copper top and bottom layers, an FR4 core, and
// a drilled hole plated with copper walls (with annular pads) tying the layers,
// a trace entering on top and leaving on the bottom.
//
// Two SVGs (shapes only, color via CSS classes so both themes flip and `--light`
// works). Side by side on desktop; on a phone they stack full width so the axis
// and layer labels stay legible px. Header + caption from the shared DiagramFrame.
import { DiagramFrame } from "./DiagramFrame";

export function PcbRouting({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="PCB · ROUTING"
      tone="gold"
      title="A trace is a wire in copper"
      ariaLabel="Two panels. On the left, a curve of trace width against current: as the current rises the copper width needed climbs, following the IPC-2221 relationship, with a point marked at one amp. On the right, an edge-on cross-section of a plated via: a drilled hole plated with copper walls runs through the board's core and ties the top copper layer to the bottom, so a trace entering on the top can carry down to the bottom layer. A trace's width sets the current it carries; a via carries a trace to another layer."
      caption={caption}
      defaultCaption="Width sets the current a trace carries; a via carries a trace to another layer."
    >
      <style>{CSS}</style>
      <div className="rt">
        <div className="rt-panel">
          <svg className="rt-svg" viewBox="0 0 182 148" aria-hidden="true">
            <line x1="24" y1="106" x2="152" y2="106" className="rt-axis" />
            <line x1="24" y1="106" x2="24" y2="18" className="rt-axis" />
            <path d="M24 106 C 62 102, 94 80, 120 32 L120 106 Z" className="rt-area" />
            <path d="M24 106 C 62 102, 94 80, 120 32" className="rt-curve" />
            <line x1="88" y1="84" x2="88" y2="106" className="rt-lead" />
            <line x1="88" y1="84" x2="24" y2="84" className="rt-lead" />
            <circle cx="88" cy="84" r="3.6" className="rt-pt" />
            <text x="93" y="80" className="rt-t rt-t-ti">1 A</text>
            <text x="88" y="128" textAnchor="middle" className="rt-t rt-t-m">current →</text>
            <text x="10" y="62" transform="rotate(-90 10 62)" textAnchor="middle" className="rt-t rt-t-m">trace width</text>
          </svg>
          <p className="rt-cap">width from current</p>
        </div>

        <div className="rt-panel">
          <svg className="rt-svg" viewBox="0 0 192 148" aria-hidden="true">
            {/* layers: top copper / FR4 core / bottom copper */}
            <rect x="18" y="48" width="156" height="9" className="rt-cu" />
            <rect x="18" y="57" width="156" height="34" className="rt-core" />
            <rect x="18" y="91" width="156" height="9" className="rt-cu" />
            {/* plated via barrel: two copper walls + drilled hole, annular pads at each layer */}
            <rect x="88" y="44" width="20" height="9" rx="1.5" className="rt-cu" />
            <rect x="88" y="95" width="20" height="9" rx="1.5" className="rt-cu" />
            <rect x="90" y="48" width="5" height="52" className="rt-cu" />
            <rect x="101" y="48" width="5" height="52" className="rt-cu" />
            <rect x="95" y="48" width="6" height="52" className="rt-hole" />
            {/* trace in on top-left, out on bottom-right */}
            <path d="M26 52 H90" className="rt-trace" />
            <path d="M106 96 H166" className="rt-trace" />
            {/* current path down the barrel */}
            <path d="M98 55 V93" className="rt-flow" />
            <text x="98" y="38" textAnchor="middle" className="rt-t rt-t-ti">via</text>
            <line x1="18" y1="52" x2="9" y2="52" className="rt-lead" />
            <text x="3" y="49" className="rt-t rt-t-m">top</text>
            <line x1="18" y1="96" x2="9" y2="96" className="rt-lead" />
            <text x="3" y="112" className="rt-t rt-t-m">bottom</text>
          </svg>
          <p className="rt-cap">a plated via</p>
        </div>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.rt{display:flex;align-items:center;justify-content:center;gap:clamp(.6rem,3vw,1.4rem);}
@container (max-width:520px){.rt{flex-direction:column;gap:1rem;}}
.rt-panel{flex:1 1 0;min-width:0;text-align:center;}
@container (max-width:520px){.rt-panel{align-self:stretch;}}
.rt-svg{display:block;width:100%;height:auto;overflow:visible;}
.rt-cap{margin:.4rem 0 0;font-family:var(--font-mono,"Space Mono",monospace);font-size:clamp(.8rem,2.2vw,.9rem);color:var(--color-muted,#aaaaaa);}

.rt-axis{stroke:var(--color-muted,#aaaaaa);stroke-width:1.4;}
.rt-curve{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2.8;stroke-linecap:round;}
.rt-area{fill:var(--color-command-gold,#c8963e);opacity:.10;}
.rt-pt{fill:var(--color-command-gold,#c8963e);}
.rt-lead{stroke:var(--color-muted,#aaaaaa);stroke-width:1.2;stroke-dasharray:3 3;fill:none;}
.rt-cu{fill:var(--color-command-gold,#c8963e);}
.rt-core{fill:var(--color-diagram-surface,#1f2438);}
.rt-hole{fill:var(--color-deep-space,#08090d);}
.rt-trace{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:4;stroke-linecap:round;}
.rt-flow{fill:none;stroke:var(--color-gold-light,#e8b865);stroke-width:2;stroke-dasharray:2 3;stroke-linecap:round;}
.rt-t{font-family:var(--font-mono,"Space Mono",monospace);font-size:12px;}
.rt-t-m{fill:var(--color-muted,#aaaaaa);}
.rt-t-ti{fill:var(--color-title,#f1ece0);font-weight:700;}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .rt-panel{opacity:0;transform:translateY(6px);}
.dgfrm.armed.in .rt-panel{opacity:1;transform:none;transition:opacity .55s ease,transform .55s cubic-bezier(.2,.7,.2,1);}
.dgfrm.armed.in .rt-panel:last-child{transition-delay:.12s;}
@media (prefers-reduced-motion:reduce){
  .dgfrm .rt-panel{opacity:1!important;transform:none!important;transition:none!important;}
}
`;
