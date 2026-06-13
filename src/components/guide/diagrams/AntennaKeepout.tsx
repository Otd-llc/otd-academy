// WROOM antenna keep-out as a responsive HTML component.
//
// Why not the /guide-diagrams SVG: a fixed-viewBox SVG scales to its container,
// so on a ~360px phone a 780-wide canvas renders at ~0.46x and ANY text shrinks
// below an accessible size. Here every label is real CSS px (clamped, never
// below ~14px) that does NOT scale with the viewport; only the small board
// graphic (a contained inline SVG with NO text) carries the picture. The board
// graphic sits centred on top; the annotations read below as normal short
// paragraphs. Header / frame / caption come from the shared DiagramFrame
// (site-standard Bebas title); this file supplies only the graphic body.
//
// The module is drawn at a realistic ~0.7 aspect (not a thin sliver) and its
// PCB antenna OVERHANGS the board's top edge, inside the no-copper keep-out.
//
// BRAND (onethousanddrones.com/brand): gold-dominant on Deep Space, Navy Dark
// module/board fills, white glyph, muted body. No off-palette hues. All colours
// via @theme tokens with literal fallbacks so a standalone render still resolves.
import { DiagramFrame } from "./DiagramFrame";

export function AntennaKeepout({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="LAYOUT · ANTENNA KEEP-OUT"
      tone="gold"
      title="Keep the antenna zone clear"
      ariaLabel="Top view of the carrier board: the ESP32-S3-WROOM-1 module (U1) sits at the board edge with its PCB antenna overhanging the top edge inside a no-copper keep-out; the module's pads sit below the keep-out on the ground pour, which fills the rest of the board."
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
              <pattern
                id="akzpour"
                width="8"
                height="8"
                patternTransform="rotate(45)"
                patternUnits="userSpaceOnUse"
              >
                <line x1="0" y1="0" x2="0" y2="8" stroke="#aaaaaa" strokeWidth="1" strokeOpacity="0.32" />
              </pattern>
            </defs>
            {/* board flooded with ground pour */}
            <rect x="24" y="78" width="172" height="144" rx="8" fill="url(#akzpour)" stroke="#c8963e" strokeWidth="2.5" />
            {/* keep-out: clear no-copper band punched out of the pour at the board edge, around the antenna */}
            <rect x="66" y="78" width="88" height="46" fill="#08090d" stroke="#c8963e" strokeWidth="2" strokeDasharray="6 4" />
            {/* module body: sits on the board, pads below the keep-out */}
            <rect x="72" y="96" width="76" height="106" rx="2" fill="#1f2438" stroke="#c8963e" strokeWidth="2.5" />
            {/* antenna head: overhangs ABOVE the board's top edge (y=78) */}
            <rect x="72" y="48" width="76" height="48" fill="#1f2438" stroke="#c8963e" strokeWidth="2" />
            {/* castellated pads, all BELOW the keep-out */}
            <g stroke="#c8963e" strokeWidth="2.5">
              <line x1="72" y1="138" x2="62" y2="138" />
              <line x1="72" y1="154" x2="62" y2="154" />
              <line x1="72" y1="170" x2="62" y2="170" />
              <line x1="72" y1="186" x2="62" y2="186" />
              <line x1="148" y1="138" x2="158" y2="138" />
              <line x1="148" y1="154" x2="158" y2="154" />
              <line x1="148" y1="170" x2="158" y2="170" />
              <line x1="148" y1="186" x2="158" y2="186" />
              <line x1="92" y1="202" x2="92" y2="212" />
              <line x1="110" y1="202" x2="110" y2="212" />
              <line x1="128" y1="202" x2="128" y2="212" />
            </g>
            {/* meandered PCB antenna, overhanging the board top edge */}
            <path
              d="M83,80 v-20 h9 v20 h9 v-20 h9 v20 h9 v-20 h9 v20 h9 v-20"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.5"
            />
            {/* module ref */}
            <text
              x="110"
              y="172"
              textAnchor="middle"
              fill="#ffffff"
              fontFamily="'Space Mono',monospace"
              fontSize="15"
              fontWeight="700"
            >
              U1
            </text>
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
