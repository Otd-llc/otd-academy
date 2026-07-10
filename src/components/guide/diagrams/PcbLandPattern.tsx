// SMD land pattern (footprint) as a responsive component (diagram-standards v2).
//
// Teaching point (lesson 2): a footprint is the copper pads, courtyard, and
// silkscreen one package solders to. Worked as the AP2112K SOT-23-5: three pads
// along the bottom edge (pins 1,2,3), two along the top (5,4), the part body
// overlaid so the pads stick out where the leads land, and pin-1 marking the
// rotation. Drawn to real SOT-23-5 proportions (wider than tall), which is what
// keeps the figure landscape.
//
// The shapes + leaders are one inline SVG; color comes ONLY from CSS classes
// (var tokens, never a hex/`var()` presentation attribute) so the whole figure
// re-themes under data-theme="light" and survives the `--light` raster. Text is
// sized in viewBox units generous enough that at the ~0.85x mobile scale of a
// landscape figure every label still lands at/above the ~14px floor. Header +
// caption come from the shared DiagramFrame.
import { DiagramFrame } from "./DiagramFrame";

export function PcbLandPattern({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="PCB · FOOTPRINTS"
      tone="gold"
      title="A footprint is copper the part lands on"
      ariaLabel="The SOT-23-5 land pattern: five copper pads, three along the bottom edge numbered one, two, three, and two along the top numbered five and four. A dashed courtyard rectangle rings them, the keep-out that reserves the part's space. The part body sits over the middle so the pads stick out where the leads land. A dot beside pad one marks pin 1, which fixes the part's rotation. Confirm the pattern against the datasheet and the part drops straight onto its copper."
      caption={caption}
      defaultCaption="Pads to solder to, a courtyard that reserves space, and a pin-1 mark that fixes rotation."
    >
      <style>{CSS}</style>
      <div className="plp">
        <svg className="plp-svg" viewBox="0 -16 432 192" aria-hidden="true">
          {/* courtyard keep-out */}
          <rect x="10" y="6" width="300" height="128" className="plp-court" />
          {/* pads: bottom 1,2,3 · top 5,4 */}
          <g className="plp-pads">
            <rect x="37" y="101" width="42" height="22" rx="3" />
            <rect x="139" y="101" width="42" height="22" rx="3" />
            <rect x="241" y="101" width="42" height="22" rx="3" />
            <rect x="37" y="5" width="42" height="22" rx="3" />
            <rect x="241" y="5" width="42" height="22" rx="3" />
          </g>
          {/* part body, translucent, over the middle */}
          <rect x="90" y="34" width="140" height="64" rx="6" className="plp-body" />
          {/* pin-1 dot */}
          <circle cx="42" cy="128" r="5.5" className="plp-p1" />
          {/* leaders */}
          <path d="M310 10 L326 10" className="plp-lead-m" />
          <path d="M283 12 L326 44" className="plp-lead-m" />
          <path d="M42 128 L42 150" className="plp-lead-g" />
          {/* text (sized for the landscape floor) */}
          <text x="330" y="15" className="plp-t plp-t-m">courtyard</text>
          <text x="330" y="49" className="plp-t plp-t-m">pad</text>
          <text x="42" y="168" textAnchor="middle" className="plp-t plp-t-g">pin-1</text>
          <text x="160" y="72" textAnchor="middle" className="plp-t plp-t-body">body</text>
          <text x="58" y="20" textAnchor="middle" className="plp-t plp-num">5</text>
          <text x="262" y="20" textAnchor="middle" className="plp-t plp-num">4</text>
          <text x="58" y="116" textAnchor="middle" className="plp-t plp-num">1</text>
          <text x="160" y="116" textAnchor="middle" className="plp-t plp-num">2</text>
          <text x="262" y="116" textAnchor="middle" className="plp-t plp-num">3</text>
        </svg>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.plp{max-width:32rem;margin-inline:auto;}
.plp-svg{display:block;width:100%;height:auto;overflow:visible;}
.plp-court{fill:none;stroke:var(--color-panel-border,#3a3f50);stroke-width:1.6;stroke-dasharray:6 5;}
.plp-pads rect{fill:var(--color-command-gold,#c8963e);}
.plp-body{fill:var(--color-navy-dark,#1a1a2e);stroke:var(--color-command-gold,#c8963e);stroke-width:2;opacity:.62;}
.plp-p1{fill:var(--color-command-gold,#c8963e);}
.plp-lead-m{fill:none;stroke:var(--color-muted,#aaaaaa);stroke-width:1.3;stroke-dasharray:3 3;}
.plp-lead-g{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:1.6;}
.plp-t{font-family:var(--font-mono,"Space Mono",monospace);}
.plp-t-m{font-size:16px;fill:var(--color-muted,#aaaaaa);}
.plp-t-g{font-size:16px;font-weight:700;fill:var(--color-command-gold,#c8963e);}
.plp-t-body{font-size:17px;fill:var(--color-title,#f1ece0);}
.plp-num{font-size:17px;font-weight:700;fill:var(--color-deep-space,#08090d);}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .plp-svg{opacity:0;transform:translateY(6px);}
.dgfrm.armed.in .plp-svg{opacity:1;transform:none;transition:opacity .55s ease,transform .55s cubic-bezier(.2,.7,.2,1);}
@media (prefers-reduced-motion:reduce){
  .dgfrm .plp-svg{opacity:1!important;transform:none!important;transition:none!important;}
}
`;
