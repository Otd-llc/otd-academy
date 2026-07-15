// Component placement, before/after (diagram-standards v2).
//
// Teaching point (lesson 3): the SAME parts placed two ways. Scattered, the
// ratsnest crosses itself in long tangled lines. Grouped, the USB connector sits
// at the board edge, the power parts and the MCU are each in their own zone, and
// the decoupling cap sits right at the MCU's power pin, so every net is short.
//
// Two board SVGs (shapes only, color via CSS classes so both themes flip and the
// `--light` raster works). Side by side on desktop (landscape); on a phone the two
// boards STACK so each is full width and its labels stay legible px rather than
// shrinking. Header + caption come from the shared DiagramFrame.
import { DiagramFrame } from "./DiagramFrame";

export function PcbPlacement({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="PCB · PLACEMENT"
      tone="gold"
      title="Placement decides how easy routing is"
      ariaLabel="Two boards with the same parts placed two ways. On the scattered board the microcontroller, regulator, USB connector, and decoupling caps are spread out, and the ratsnest of connections crosses itself in long tangled lines. On the grouped board the USB connector sits at the edge, the power parts and the microcontroller are each in their own zone, and the decoupling cap sits right at the microcontroller's power pin, so every connection is short. Good placement makes routing almost fall out."
      caption={caption}
      defaultCaption="Same parts, two placements: scattered crosses itself; grouped keeps every net short."
    >
      <style>{CSS}</style>
      <div className="plc">
        <div className="plc-board">
          <svg className="plc-svg" viewBox="0 0 210 150" aria-hidden="true">
            <rect x="4" y="4" width="202" height="142" rx="6" className="plc-brd" />
            <g className="plc-nets-bad">
              <path d="M54 100 L150 26" />
              <path d="M52 26 L54 98" />
              <path d="M92 116 L56 106" />
              <path d="M134 84 L150 30" />
              <path d="M54 104 L126 90" />
              <path d="M182 26 L60 30" />
            </g>
            {part(18, 92, 36, 20, "MCU")}
            {part(150, 18, 32, 16, "USB")}
            {part(78, 116, 28, 14, "REG")}
            {part(126, 84, 16, 12, "C")}
            {part(44, 26, 16, 12, "C")}
          </svg>
          <p className="plc-cap plc-bad">scattered</p>
        </div>

        <div className="plc-arrow" aria-hidden="true">→</div>

        <div className="plc-board">
          <svg className="plc-svg" viewBox="0 0 210 150" aria-hidden="true">
            <rect x="4" y="4" width="202" height="142" rx="6" className="plc-brd" />
            <rect x="14" y="34" width="74" height="84" rx="4" className="plc-zonef" />
            <rect x="112" y="34" width="86" height="84" rx="4" className="plc-zonef" />
            <rect x="14" y="34" width="74" height="84" className="plc-zone" />
            <rect x="112" y="34" width="86" height="84" className="plc-zone" />
            <text x="51" y="30" textAnchor="middle" className="plc-zlab">POWER</text>
            <text x="155" y="30" textAnchor="middle" className="plc-zlab">MCU</text>
            <g className="plc-nets-ok">
              <path d="M24 71 L30 71" />
              <path d="M64 71 L120 70" />
              <path d="M164 70 L166 70" />
            </g>
            {part(4, 60, 20, 22, "USB")}
            {part(30, 62, 34, 18, "REG")}
            {part(120, 56, 44, 28, "MCU")}
            <rect x="166" y="60" width="11" height="20" rx="2" className="plc-cap2" />
            <g className="plc-pins">
              <circle cx="24" cy="71" r="2.6" />
              <circle cx="120" cy="70" r="2.6" />
              <circle cx="164" cy="70" r="2.6" />
            </g>
          </svg>
          <p className="plc-cap plc-ok">grouped</p>
        </div>
      </div>
    </DiagramFrame>
  );
}

function part(x: number, y: number, w: number, h: number, label: string) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={3} className="plc-prt" />
      <text x={x + w / 2} y={y + h / 2 + 4} textAnchor="middle" className="plc-plabel">{label}</text>
    </g>
  );
}

const CSS = `
.plc{display:flex;align-items:center;justify-content:center;gap:clamp(.5rem,2.5vw,1rem);}
@container (max-width:520px){.plc{flex-direction:column;gap:.75rem;}}
.plc-board{flex:1 1 0;min-width:0;text-align:center;}
@container (max-width:520px){.plc-board{align-self:stretch;}}
.plc-svg{display:block;width:100%;height:auto;overflow:visible;}
.plc-arrow{flex:0 0 auto;color:var(--color-command-gold,#c8963e);font-size:1.5rem;line-height:1;}
@container (max-width:520px){.plc-arrow{transform:rotate(90deg);}}
.plc-cap{margin:.5rem 0 0;font-family:var(--font-mono,"Space Mono",monospace);font-size:clamp(.85rem,2.3vw,.95rem);letter-spacing:.03em;}
.plc-bad{color:var(--color-alert-red,#c5362f);}
.plc-ok{color:var(--color-status-green,#2f8a4d);}

.plc-brd{fill:var(--color-diagram-surface,#1f2438);stroke:var(--color-panel-border,#3a3f50);stroke-width:1.5;}
.plc-prt{fill:var(--color-deep-space,#08090d);stroke:var(--color-command-gold,#c8963e);stroke-width:1.7;}
.plc-plabel{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:12px;fill:var(--color-title,#f1ece0);}
.plc-nets-bad path{fill:none;stroke:var(--color-alert-red,#c5362f);stroke-width:1.5;stroke-linecap:round;}
.plc-nets-ok path{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:1.7;stroke-linecap:round;}
.plc-zone{fill:none;stroke:var(--color-panel-border,#3a3f50);stroke-width:1.2;stroke-dasharray:5 4;}
.plc-zonef{fill:var(--color-command-gold,#c8963e);opacity:.06;}
.plc-zlab{font-family:var(--font-mono,"Space Mono",monospace);font-size:10px;letter-spacing:.12em;fill:var(--color-muted,#aaaaaa);}
.plc-cap2{fill:var(--color-command-gold,#c8963e);}
.plc-pins circle{fill:var(--color-command-gold,#c8963e);}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .plc-board{opacity:0;transform:translateY(6px);}
.dgfrm.armed.in .plc-board{opacity:1;transform:none;transition:opacity .55s ease,transform .55s cubic-bezier(.2,.7,.2,1);}
.dgfrm.armed.in .plc-board:last-child{transition-delay:.12s;}
@media (prefers-reduced-motion:reduce){
  .dgfrm .plc-board{opacity:1!important;transform:none!important;transition:none!important;}
}
`;
