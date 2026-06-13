// WROOM antenna keep-out as a responsive HTML component.
//
// Why not the /guide-diagrams SVG: a fixed-viewBox SVG scales to its container,
// so on a ~360px phone a 780-wide canvas renders at ~0.46x and ANY text shrinks
// below an accessible size. Here every label is real CSS px (clamped, never
// below ~14px); only the small board graphic (a contained inline SVG with NO
// text) carries the picture. Header / frame / caption come from the shared
// DiagramFrame; the U1 module is the shared WroomU1 (square body + antenna tab)
// so it looks identical to U1 in every other diagram, with the antenna tab
// overhanging the board's top edge inside the dashed keep-out zone.
//
// BRAND (onethousanddrones.com/brand): gold-dominant on Deep Space, Navy Dark
// module/board fills, white glyph, muted body. No off-palette hues.
import { DiagramFrame } from "./DiagramFrame";
import { WroomU1 } from "./WroomU1";

export function AntennaKeepout({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="LAYOUT · ANTENNA KEEP-OUT"
      tone="gold"
      title="Keep the antenna zone clear"
      ariaLabel="Top view of the carrier board: the ESP32-S3-WROOM-1 module (U1) sits at the board edge with its PCB antenna overhanging the top edge inside a dashed no-copper keep-out; the module's pads sit below the keep-out on the ground pour, which fills the rest of the board."
      caption={caption}
      defaultCaption="Clear copper and parts beneath the antenna."
    >
      <style>{CSS}</style>
      <div className="akz-body">
        <div className="akz-figwrap">
          <svg
            className="akz-svg"
            viewBox="0 0 220 240"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            <defs>
              <pattern id="akzpour" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                <line x1="0" y1="0" x2="0" y2="8" stroke="#aaaaaa" strokeWidth="1" strokeOpacity="0.32" />
              </pattern>
            </defs>
            {/* board flooded with ground pour; its TOP EDGE is at the U1 body top */}
            <rect x="20" y="58" width="180" height="162" rx="8" fill="url(#akzpour)" stroke="#c8963e" strokeWidth="2.5" />
            {/* the WROOM: square body on the board, antenna tab overhanging the top edge */}
            <WroomU1 x={42} y={22} scale={1.3} />
            {/* keep-out: dashed no-copper zone around the antenna at the board edge */}
            <rect x="60" y="16" width="100" height="50" fill="none" stroke="#c8963e" strokeWidth="2" strokeDasharray="6 4" />
          </svg>
        </div>

        <ul className="akz-notes">
          <li className="akz-note akz-white">
            <span className="akz-key">PCB antenna</span>
            <span className="akz-val">overhangs the board edge (or sits over a board cut-out).</span>
          </li>
          <li className="akz-note akz-gold">
            <span className="akz-key">Keep-out</span>
            <span className="akz-val">
              no copper and no ground pour in this band &mdash; the dashed zone around the antenna.
            </span>
          </li>
          <li className="akz-note akz-white">
            <span className="akz-key">ESP32-S3-WROOM-1</span>
            <span className="akz-val">
              the module, placed as <strong>U1</strong> with its pads below the keep-out.
            </span>
          </li>
          <li className="akz-note akz-muted">
            <span className="akz-key">Ground pour</span>
            <span className="akz-val">copper fills everywhere except the keep-out (the hatched fill).</span>
          </li>
        </ul>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.akz-body{display:flex;flex-direction:column;align-items:center;
  gap:clamp(1.25rem,4vw,1.75rem);text-align:left;}
.akz-figwrap{width:100%;max-width:235px;}
.akz-svg{display:block;width:100%;height:auto;}

.akz-notes{list-style:none;margin:0;padding:0;width:100%;
  display:flex;flex-direction:column;gap:clamp(.7rem,2.2vw,.95rem);}
.akz-note{position:relative;padding-left:.85rem;border-left:2px solid var(--color-panel-border,#3a3f50);}
.akz-white{border-left-color:#fff;}
.akz-gold{border-left-color:var(--color-command-gold,#c8963e);}
.akz-muted{border-left-color:var(--color-muted,#aaa);}
.akz-key{display:block;font-weight:700;letter-spacing:.02em;
  font-size:clamp(1.05rem,3vw,1.25rem);line-height:1.2;}
.akz-white .akz-key{color:#fff;}
.akz-gold .akz-key{color:var(--color-command-gold,#c8963e);}
.akz-muted .akz-key{color:var(--color-gray-1,#e8e8e8);}
.akz-val{display:block;margin-top:.2rem;color:var(--color-muted,#aaa);
  font-family:var(--font-serif,"Lora",serif);
  font-size:clamp(.95rem,2.5vw,1.05rem);line-height:1.45;}
.akz-val strong{color:var(--color-gray-1,#e8e8e8);font-weight:700;}
`;
