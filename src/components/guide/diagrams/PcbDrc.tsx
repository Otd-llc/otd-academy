// DRC: the three classic violations flagged on a board (diagram-standards v2).
//
// Teaching point (lesson 7): the design-rule check is the board's spell-check. It
// flags what the fabricator cannot make. Three classic violations, each marked in
// red: a clearance violation (two traces too close), an unrouted net (pads joined
// only by a dashed ratsnest, no copper yet), and silk on a pad (a silkscreen line
// crossing a pad where solder must wet).
//
// One inline SVG; color via CSS classes so both themes flip and `--light` works.
// Red is used ONLY for the fault markers (per the palette rule). Labels are SVG
// text sized for the landscape mobile floor. Header + caption from DiagramFrame.
import { DiagramFrame } from "./DiagramFrame";

export function PcbDrc({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="PCB · DRC"
      tone="gold"
      title="The design-rule check is the board's spell-check"
      ariaLabel="A board layout with three design-rule violations flagged in red. First, a clearance violation: two copper traces run too close together. Second, an unrouted net: two pads are joined only by a dashed ratsnest line, with no copper trace between them yet. Third, silk on a pad: a silkscreen line crosses a pad where solder must wet. The design-rule check flags each of these against the fabricator's limits, and you clear every marker before you leave the layout."
      caption={caption}
      defaultCaption="DRC flags what the fab cannot make: a clearance too tight, a net not routed, silk over a pad."
    >
      <style>{CSS}</style>
      <div className="drc">
        <svg className="drc-svg" viewBox="0 0 372 146" aria-hidden="true">
          <rect x="10" y="8" width="200" height="122" rx="6" className="drc-brd" />

          {/* clearance: two traces too close */}
          <path d="M30 34 H150" className="drc-cu" />
          <path d="M30 46 H150" className="drc-cu" />
          {marker(90, 40)}
          <line x1="100" y1="40" x2="228" y2="30" className="drc-lead" />
          <text x="234" y="36" className="drc-lbl">clearance</text>

          {/* unrouted net: ratsnest between two pads, no copper */}
          <rect x="28" y="66" width="16" height="12" rx="2" className="drc-pad" />
          <rect x="150" y="66" width="16" height="12" rx="2" className="drc-pad" />
          <path d="M44 72 H150" className="drc-rats" />
          {marker(97, 72)}
          <line x1="107" y1="72" x2="228" y2="66" className="drc-lead" />
          <text x="234" y="72" className="drc-lbl">unrouted net</text>

          {/* silk over a pad */}
          <rect x="58" y="98" width="20" height="15" rx="2" className="drc-pad" />
          <path d="M46 105 H92" className="drc-silk" />
          {marker(68, 105)}
          <line x1="78" y1="105" x2="228" y2="110" className="drc-lead" />
          <text x="234" y="112" className="drc-lbl">silk on pad</text>
        </svg>
      </div>
    </DiagramFrame>
  );
}

function marker(x: number, y: number) {
  return (
    <g>
      <circle cx={x} cy={y} r={10} className="drc-mk" />
      <text x={x} y={y + 5} textAnchor="middle" className="drc-bang">!</text>
    </g>
  );
}

const CSS = `
.drc{max-width:34rem;margin-inline:auto;}
.drc-svg{display:block;width:100%;height:auto;overflow:visible;}
.drc-brd{fill:var(--color-navy-dark,#1a1a2e);stroke:var(--color-panel-border,#3a3f50);stroke-width:1.4;}
.drc-cu{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:3;stroke-linecap:round;}
.drc-pad{fill:var(--color-command-gold,#c8963e);}
.drc-silk{fill:none;stroke:var(--color-muted,#aaaaaa);stroke-width:1.6;}
.drc-rats{fill:none;stroke:var(--color-muted,#aaaaaa);stroke-width:1.3;stroke-dasharray:4 3;}
.drc-mk{fill:none;stroke:var(--color-alert-red,#ef5350);stroke-width:2;}
.drc-bang{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:14px;fill:var(--color-alert-red,#ef5350);}
.drc-lead{stroke:var(--color-alert-red,#ef5350);stroke-width:1.1;stroke-dasharray:2 2;fill:none;}
.drc-lbl{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:16px;fill:var(--color-alert-red,#ef5350);}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .drc-svg{opacity:0;transform:translateY(6px);}
.dgfrm.armed.in .drc-svg{opacity:1;transform:none;transition:opacity .55s ease,transform .55s cubic-bezier(.2,.7,.2,1);}
@media (prefers-reduced-motion:reduce){
  .dgfrm .drc-svg{opacity:1!important;transform:none!important;transition:none!important;}
}
`;
