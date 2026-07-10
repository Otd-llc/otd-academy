// Boost (step-up) topology (v2). Power & Batteries cluster. Owner-picked V6
// (cell -> boost -> a taller rail).
//
// Teaching point (boost-converters): a boost raises a lower voltage to a higher
// one, so a single 3.7 V lithium cell can drive a 5 V rail it could never reach on
// its own. Shown as a battery cell lifted by a boost arrow up to a taller 5 V rail
// bar (heights proportional to voltage). Gold = the cell / the "before", gold-light
// = the raised rail + the lift.
//
// Landscape; reflows on a phone to a compact glyph + an HTML "cell -> rail" line.
// Token-only color (re-themes in light + print).
import { DiagramFrame } from "./DiagramFrame";

const yB = 178, k = 23; // baseline, px per volt

export function BoostTopology({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="BOOST REGULATORS"
      tone="gold"
      title="A boost steps voltage up by switching"
      ariaLabel="How a boost regulator raises voltage. A single 3.7 volt lithium cell, drawn as a battery, is lifted by a boost arrow up to a taller 5 volt rail bar. A boost lets the cell drive a 5 volt rail it could never reach on its own, because the rail is higher than the cell's own voltage."
      caption={caption}
      defaultCaption="A boost lets a single 3.7 V cell drive a 5 V rail it could never reach on its own."
    >
      <style>{CSS}</style>

      <div className="bo">
        {/* desktop / print: cell -> boost -> rail */}
        <svg className="bo-scene" viewBox="0 0 500 208" aria-hidden="true">
          <line className="bo-base" x1="56" y1={yB} x2="446" y2={yB} />
          {/* battery cell (3.7 V) */}
          <text className="bo-lo" x="110" y={yB - 3.7 * k - 24} textAnchor="middle">3.7 V cell</text>
          <rect className="bo-nub" x="102" y={yB - 3.7 * k - 8} width="16" height="8" rx="3" />
          <rect className="bo-cell" x="80" y={yB - 3.7 * k} width="60" height={3.7 * k} rx="7" />
          <rect className="bo-fill" x="88" y={yB - 3.7 * k + 30} width="44" height={3.7 * k - 34} rx="3" />
          <text className="bo-li" x="110" y={yB - 22} textAnchor="middle">Li</text>
          {/* the 5 V rail (taller) */}
          <rect className="bo-rail" x="336" y={yB - 5 * k} width="92" height={5 * k} rx="3" />
          <text className="bo-hi" x="382" y={yB - 5 * k - 12} textAnchor="middle">5 V rail</text>
          {/* the boost lift */}
          <path className="bo-up" fill="none" d={`M150,${yB - 60} C245,${yB - 60} 250,${yB - 5 * k + 12} 328,${yB - 5 * k + 18}`} />
          <path className="bo-up" fill="none" d={`M319,${yB - 5 * k + 10} L330,${yB - 5 * k + 18} L318,${yB - 5 * k + 24}`} />
          <text className="bo-lbl" x="244" y={yB - 5 * k - 2} textAnchor="middle">boost</text>
        </svg>

        {/* phone: compact glyph + text line */}
        <div className="bo-list" aria-hidden="true">
          <svg viewBox="0 0 300 96" className="bo-mini">
            <line className="bo-base" x1="8" y1="90" x2="292" y2="90" />
            <rect className="bo-nub" x="34" y="26" width="12" height="6" rx="2" />
            <rect className="bo-cell" x="20" y="32" width="40" height="58" rx="5" />
            <rect className="bo-fill" x="26" y="52" width="28" height="34" rx="2" />
            <rect className="bo-rail" x="230" y="14" width="56" height="76" rx="3" />
            <path className="bo-up" fill="none" d="M66,66 C150,66 150,22 224,24" />
            <path className="bo-up" fill="none" d="M215,16 L226,24 L214,30" />
          </svg>
          <p className="bo-pnote">
            <b className="bo-b-lo">3.7 V cell</b> <span>&rarr; boost &rarr;</span> <b className="bo-b-hi">5 V rail</b>
          </p>
        </div>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.bo{display:block;}
.bo-scene{display:block;width:100%;height:auto;overflow:visible;}
.bo-base{stroke:var(--color-panel-border,#3a3f50);stroke-width:2;}
.bo-cell{fill:none;stroke:var(--color-panel-border,#3a3f50);stroke-width:2;}
.bo-nub{fill:var(--color-panel-border,#3a3f50);}
.bo-fill{fill:var(--color-command-gold,#c8963e);opacity:.55;}
.bo-rail{fill:var(--color-gold-light,#e8b865);}
.bo-up{stroke:var(--color-gold-light,#e8b865);stroke-width:3.5;stroke-linecap:round;stroke-linejoin:round;}
.bo-li{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;fill:var(--color-deep-space,#08090d);font-size:15px;}
.bo-lo{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;fill:var(--color-text,#e8e8e8);font-size:15px;}
.bo-hi{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;fill:var(--color-gold-light,#e8b865);font-size:18px;}
.bo-lbl{font-family:var(--font-mono,"Space Mono",monospace);fill:var(--color-muted,#aaa);font-size:12px;}

/* phone reflow */
.bo-list{display:none;flex-direction:column;gap:.7rem;align-items:center;}
@media (max-width:520px){ .bo-scene{display:none;} .bo-list{display:flex;} }
.bo-mini{display:block;width:100%;height:auto;overflow:visible;max-width:280px;}
.bo-pnote{margin:0;font-family:var(--font-mono,"Space Mono",monospace);font-size:.9rem;color:var(--color-muted,#aaa);text-align:center;}
.bo-pnote b{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:1.1rem;}
.bo-b-lo{color:var(--color-text,#e8e8e8);}
.bo-b-hi{color:var(--color-gold-light,#e8b865);}

/* Tier-B reveal off the frame's armed/in contract (settled under reduced-motion). */
.dgfrm.armed .bo-rail,.dgfrm.armed .bo-up{opacity:0;}
.dgfrm.armed.in .bo-rail{opacity:1;transition:opacity .55s ease .18s;}
.dgfrm.armed.in .bo-up{opacity:1;transition:opacity .5s ease .1s;}
@media (prefers-reduced-motion:reduce){ .dgfrm .bo-rail,.dgfrm .bo-up{opacity:1!important;} }
`;
