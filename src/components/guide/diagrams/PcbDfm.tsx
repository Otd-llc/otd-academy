// DFM cost drivers: the layer-count staircase (diagram-standards v2).
//
// Teaching point (lesson 9): a few choices move a board's price far more than
// the rest, and layer count is the biggest lever. Rising steps for a 2-layer,
// 4-layer, and 6+ layer board carry a $ / $$ / $$$ price tier; a note reminds
// that quantity, board size, finish, and lead time trim the rest. No dollar
// figures (the lesson gives none) — the tiers are relative.
//
// One inline SVG, color via CSS classes so both themes flip and `--light` works.
// The $ tier sits in --color-deep-space on a gold step (legible on either theme).
// Wide viewBox keeps the print embed landscape. Header + caption from DiagramFrame.
import { DiagramFrame } from "./DiagramFrame";

export function PcbDfm({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="PCB · COST DRIVERS"
      tone="gold"
      title="What moves a board's price"
      ariaLabel="A cost-driver staircase for PCB fabrication. Three rising steps show that a 2-layer board is the cheap tier ($), a 4-layer board steps up ($$), and a 6-plus layer board climbs fast ($$$), so layer count is the biggest price lever. A note adds that quantity, board size, surface finish, and lead time each trim the rest of the cost."
      caption={caption}
      defaultCaption="Layer count is the biggest price lever: two layers is cheap, four steps up, more climbs fast. Quantity, board size, finish, and lead time trim the rest."
    >
      <style>{CSS}</style>
      <div className="df">
        <svg className="df-svg" viewBox="0 0 460 172" aria-hidden="true">
          {STEPS.map((s, i) => {
            const top = 146 - s.h;
            return (
              <g key={s.name}>
                <rect x={s.x} y={top} width="96" height={s.h} rx="3" className={`df-r${i}`} />
                <text x={s.x + 48} y={top + s.h / 2 + 8} textAnchor="middle" className="df-tier">{s.tier}</text>
                <text x={s.x + 48} y={top - 10} textAnchor="middle" className="df-name">{s.name}</text>
                <text x={s.x + 48} y="164" textAnchor="middle" className="df-sub">{s.sub}</text>
              </g>
            );
          })}
          <line x1="30" y1="146" x2="430" y2="146" className="df-base" />
        </svg>
        <p className="df-note">then quantity, board size, surface finish, and lead time</p>
      </div>
    </DiagramFrame>
  );
}

const STEPS = [
  { name: "2-layer", tier: "$", sub: "cheap", h: 48, x: 44 },
  { name: "4-layer", tier: "$$", sub: "steps up", h: 88, x: 182 },
  { name: "6+ layer", tier: "$$$", sub: "climbs fast", h: 128, x: 320 },
];

const CSS = `
.df{max-width:34rem;margin-inline:auto;}
.df-svg{display:block;width:100%;height:auto;overflow:visible;}
.df-r0{fill:var(--color-gold-light,#e8b865);opacity:.65;}
.df-r1{fill:var(--color-command-gold,#c8963e);opacity:.85;}
.df-r2{fill:var(--color-command-gold,#c8963e);opacity:1;}
.df-tier{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:22px;fill:var(--color-deep-space,#08090d);}
.df-name{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:14px;fill:var(--color-title,#f1ece0);}
.df-sub{font-family:var(--font-mono,"Space Mono",monospace);font-size:12px;fill:var(--color-muted,#aaaaaa);}
.df-base{stroke:var(--color-panel-border,#3a3f50);stroke-width:1.4;}
.df-note{margin:.55rem 0 0;text-align:center;font-family:var(--font-mono,"Space Mono",monospace);
  font-size:clamp(.72rem,2vw,.82rem);color:var(--color-muted,#aaaaaa);}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .df-svg,.dgfrm.armed .df-note{opacity:0;transform:translateY(6px);}
.dgfrm.armed.in .df-svg{opacity:1;transform:none;transition:opacity .55s ease,transform .55s cubic-bezier(.2,.7,.2,1);}
.dgfrm.armed.in .df-note{opacity:1;transform:none;transition:opacity .5s ease .18s,transform .5s ease .18s;}
@media (prefers-reduced-motion:reduce){
  .dgfrm .df-svg,.dgfrm .df-note{opacity:1!important;transform:none!important;transition:none!important;}
}
`;
