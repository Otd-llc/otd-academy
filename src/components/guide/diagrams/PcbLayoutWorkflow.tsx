// PCB layout workflow as a responsive HTML component (diagram-standards.md v2).
//
// The teaching model is lesson 1's thesis: the schematic editor and the PCB
// editor are two files that share ONE netlist. So the diagram is two editor
// columns flanking a central netlist hub, not a flat six-box rail. The netlist
// disc is the pivot: the schematic side writes it, the board side reads it.
//
// Not a scaled SVG: every label is real CSS px (clamped, never below ~14px) so
// it stays legible on a phone, where the three columns stack instead of cramming.
// Token-only color (both themes flip); the hub glyph fills via CSS classes, never
// a hex/`var()` presentation attribute, so it re-themes and survives `--light`.
// Header + caption come from the shared DiagramFrame; this file is the body only.
import { DiagramFrame } from "./DiagramFrame";

export function PcbLayoutWorkflow({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="PCB · WORKFLOW"
      tone="gold"
      title="From schematic to board"
      ariaLabel="The PCB workflow runs from schematic to board through one shared netlist. In the schematic editor you draw the circuit and give every part a footprint. That produces the netlist, the machine-readable list of which pins connect to which. The PCB editor reads the same netlist to place the parts, route the copper, pass the design-rule check, and export the gerbers. Because the two files share one netlist, they can never silently disagree."
      caption={caption}
      defaultCaption="Two editors, one shared netlist: the contract that keeps the schematic and the board in sync."
    >
      <style>{CSS}</style>
      <div className="plw">
        <div className="plw-side plw-left">
          <p className="plw-zlab">Schematic editor</p>
          <p className="plw-stage">Schematic</p>
          <p className="plw-stage">Footprints</p>
        </div>

        <svg className="plw-arrow" viewBox="0 0 44 16" aria-hidden="true">
          <line className="plw-arrow-l" x1="2" y1="8" x2="36" y2="8" />
          <path className="plw-arrow-h" d="M32 3 L42 8 L32 13" />
        </svg>

        <div className="plw-hub">
          <div className="plw-disc">
            <svg viewBox="0 0 34 34" aria-hidden="true">
              <circle className="plw-node" cx="7" cy="9" r="2.7" />
              <circle className="plw-node" cx="7" cy="25" r="2.7" />
              <circle className="plw-node" cx="27" cy="17" r="2.7" />
              <path className="plw-wire" d="M7 9 H17 V17 H27 M7 25 H17" />
            </svg>
          </div>
          <p className="plw-hublabel">Netlist</p>
          <p className="plw-hubsub">one shared file</p>
        </div>

        <svg className="plw-arrow" viewBox="0 0 44 16" aria-hidden="true">
          <line className="plw-arrow-l" x1="2" y1="8" x2="36" y2="8" />
          <path className="plw-arrow-h" d="M32 3 L42 8 L32 13" />
        </svg>

        <div className="plw-side plw-right">
          <p className="plw-zlab">PCB editor</p>
          <p className="plw-stage">Placement</p>
          <p className="plw-stage">Routing</p>
          <p className="plw-stage">DRC</p>
          <p className="plw-stage">Gerbers</p>
        </div>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.plw{display:flex;align-items:center;justify-content:center;gap:clamp(.5rem,2.2vw,1.15rem);}
.plw-side{flex:0 0 auto;display:flex;flex-direction:column;gap:clamp(.3rem,1.4vw,.55rem);}
.plw-left{text-align:right;align-items:flex-end;}
.plw-right{text-align:left;align-items:flex-start;}
.plw-zlab{margin:0 0 .35rem;font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;
  font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--color-muted,#aaaaaa);line-height:1.4;}
.plw-stage{margin:0;font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;
  font-size:clamp(1rem,2.9vw,1.3rem);line-height:1.25;color:var(--color-title,#f1ece0);white-space:nowrap;}

/* the flow arrows between a column and the hub */
.plw-arrow{flex:0 0 auto;width:clamp(26px,5.5vw,44px);height:auto;overflow:visible;}
.plw-arrow-l{stroke:var(--color-command-gold,#c8963e);stroke-width:2;}
.plw-arrow-h{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2.4;
  stroke-linejoin:round;stroke-linecap:round;}

/* the netlist hub */
.plw-hub{flex:0 0 auto;text-align:center;}
.plw-disc{width:clamp(58px,15vw,74px);height:clamp(58px,15vw,74px);margin:0 auto;border-radius:50%;
  border:2px solid var(--color-command-gold,#c8963e);background:var(--color-diagram-surface,#1f2438);
  display:flex;align-items:center;justify-content:center;}
.plw-disc svg{width:44%;height:44%;overflow:visible;}
.plw-node{fill:var(--color-command-gold,#c8963e);}
.plw-wire{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2;}
.plw-hublabel{margin:.5rem 0 0;font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;
  font-size:clamp(.85rem,2.4vw,1rem);letter-spacing:.14em;text-transform:uppercase;
  color:var(--color-command-gold,#c8963e);}
.plw-hubsub{margin:.15rem 0 0;font-family:var(--font-mono,"Space Mono",monospace);
  font-size:clamp(.78rem,2vw,.85rem);color:var(--color-muted,#aaaaaa);}

/* phone: stack the three columns; the arrows point down */
@container (max-width:520px){
  .plw{flex-direction:column;gap:clamp(.5rem,3vw,.9rem);}
  .plw-side{align-items:center;text-align:center;}
  .plw-left,.plw-right{align-items:center;text-align:center;}
  .plw-arrow{transform:rotate(90deg);width:34px;}
}
`;
