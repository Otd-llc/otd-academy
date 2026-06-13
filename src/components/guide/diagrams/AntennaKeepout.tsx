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
      ariaLabel="Top view of the carrier board: the ESP32-S3-WROOM-1 module (U1) sits at the board edge with its PCB antenna overhanging inside a no-copper keep-out; the module's pads sit below the keep-out on the ground pour, which fills the rest of the board."
      caption={caption}
      defaultCaption="Clear copper and parts beneath the antenna."
    >
      <style>{CSS}</style>
      <div className="akz-body">
        <div className="akz-figwrap">
          <svg
            className="akz-svg"
            viewBox="0 0 200 280"
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
            {/* board outline flooded with ground pour */}
            <rect x="40" y="40" width="120" height="220" rx="8" fill="url(#akzpour)" stroke="#c8963e" strokeWidth="2.5" />
            {/* keep-out band: clear no-copper region punched out of the pour at the edge */}
            <rect x="71" y="40" width="58" height="46" fill="#08090d" stroke="#c8963e" strokeWidth="2" strokeDasharray="6 4" />
            {/* module: antenna head overhangs above the board edge */}
            <rect x="70" y="14" width="60" height="72" fill="#1f2438" stroke="#c8963e" strokeWidth="2" />
            <rect x="70" y="86" width="60" height="150" rx="2" fill="#1f2438" stroke="#c8963e" strokeWidth="2.5" />
            {/* castellated pads, all below the keep-out */}
            <g stroke="#c8963e" strokeWidth="2.5">
              <line x1="70" y1="100" x2="60" y2="100" />
              <line x1="70" y1="116" x2="60" y2="116" />
              <line x1="70" y1="132" x2="60" y2="132" />
              <line x1="70" y1="148" x2="60" y2="148" />
              <line x1="70" y1="164" x2="60" y2="164" />
              <line x1="70" y1="180" x2="60" y2="180" />
              <line x1="70" y1="196" x2="60" y2="196" />
              <line x1="70" y1="212" x2="60" y2="212" />
              <line x1="130" y1="100" x2="140" y2="100" />
              <line x1="130" y1="116" x2="140" y2="116" />
              <line x1="130" y1="132" x2="140" y2="132" />
              <line x1="130" y1="148" x2="140" y2="148" />
              <line x1="130" y1="164" x2="140" y2="164" />
              <line x1="130" y1="180" x2="140" y2="180" />
              <line x1="130" y1="196" x2="140" y2="196" />
              <line x1="130" y1="212" x2="140" y2="212" />
              <line x1="86" y1="236" x2="86" y2="246" />
              <line x1="100" y1="236" x2="100" y2="246" />
              <line x1="114" y1="236" x2="114" y2="246" />
            </g>
            {/* meandered PCB antenna inside the keep-out, overhanging the edge */}
            <path
              d="M78,80 v-13 h7 v13 h7 v-13 h7 v13 h7 v-13 h7 v13 h7 v-13 h7 v13"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.5"
            />
            {/* centred module ref */}
            <text
              x="100"
              y="166"
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
.akz-figwrap{width:100%;max-width:200px;}
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
