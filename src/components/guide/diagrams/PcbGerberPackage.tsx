// Gerbers: the fab package as one zip (diagram-standards v2).
//
// Teaching point (lesson 9): gerbers are one file per copper, mask, and silk
// layer; add the drill file, the bill of materials, and the placement file, and
// you have the complete package a fab needs, zipped into one archive.
//
// A zip glyph (SVG shapes, color via CSS classes so both themes flip) beside an
// HTML contents list (real px text that stays legible and re-themes). Side by
// side on desktop; stacked on a phone. Header + caption from the DiagramFrame.
import { DiagramFrame } from "./DiagramFrame";

export function PcbGerberPackage({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="PCB · GERBERS"
      tone="gold"
      title="The files a factory reads to build your board"
      ariaLabel="The fab package as one zip archive. Inside it are seven gerber files, one for each copper, soldermask, and silkscreen layer plus the board outline; a drill file for where the holes go; a bill of materials listing the parts; and a placement file for where each part goes. Zip those together and that archive is the complete package a fabricator needs."
      caption={caption}
      defaultCaption="Zip the gerbers, drill, BOM, and placement together, and that archive is the complete package a fab needs."
    >
      <style>{CSS}</style>
      <div className="gz">
        <div className="gz-zipcol">
          <svg className="gz-svg" viewBox="0 0 92 92" aria-hidden="true">
            <rect x="15" y="15" width="62" height="62" rx="5" className="gz-zip" />
            <line x1="46" y1="15" x2="46" y2="77" className="gz-zln" />
            <rect x="41" y="40" width="10" height="12" rx="1.5" className="gz-tab" />
          </svg>
          <p className="gz-name">board.zip</p>
        </div>

        <ul className="gz-list">
          <li><b>7 &times; gerber</b> <span>copper, mask, silk, outline</span></li>
          <li><b>drill</b> <span>where the holes go</span></li>
          <li><b>BOM</b> <span>the parts</span></li>
          <li><b>placement</b> <span>where each part goes</span></li>
        </ul>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.gz{display:flex;align-items:center;justify-content:center;gap:clamp(1rem,4vw,1.8rem);}
@media (max-width:520px){.gz{flex-direction:column;gap:1rem;}}
.gz-zipcol{flex:0 0 auto;text-align:center;}
.gz-svg{display:block;width:clamp(76px,20vw,104px);height:auto;overflow:visible;margin:0 auto;}
.gz-name{margin:.45rem 0 0;font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;
  font-size:clamp(.85rem,2.3vw,1rem);color:var(--color-command-gold,#c8963e);}
.gz-zip{fill:var(--color-navy-dark,#1a1a2e);stroke:var(--color-command-gold,#c8963e);stroke-width:1.8;}
.gz-zln{stroke:var(--color-command-gold,#c8963e);stroke-width:2;stroke-dasharray:3 3;}
.gz-tab{fill:var(--color-command-gold,#c8963e);}

.gz-list{flex:1 1 auto;min-width:0;margin:0;padding:0;list-style:none;display:flex;flex-direction:column;
  gap:clamp(.55rem,2vw,.8rem);text-align:left;}
@media (max-width:520px){.gz-list{align-self:stretch;}}
.gz-list li{font-family:var(--font-serif,"Lora",serif);font-size:clamp(.92rem,2.5vw,1.05rem);
  line-height:1.35;color:var(--color-muted,#aaaaaa);}
.gz-list b{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;
  font-size:clamp(.95rem,2.6vw,1.1rem);color:var(--color-title,#f1ece0);margin-right:.35rem;}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .gz-zipcol,.dgfrm.armed .gz-list li{opacity:0;transform:translateY(6px);}
.dgfrm.armed.in .gz-zipcol{opacity:1;transform:none;transition:opacity .55s ease,transform .55s cubic-bezier(.2,.7,.2,1);}
.dgfrm.armed.in .gz-list li{opacity:1;transform:none;transition:opacity .5s ease,transform .5s ease;}
.dgfrm.armed.in .gz-list li:nth-child(2){transition-delay:.08s;}
.dgfrm.armed.in .gz-list li:nth-child(3){transition-delay:.16s;}
.dgfrm.armed.in .gz-list li:nth-child(4){transition-delay:.24s;}
@media (prefers-reduced-motion:reduce){
  .dgfrm .gz-zipcol,.dgfrm .gz-list li{opacity:1!important;transform:none!important;transition:none!important;}
}
`;
