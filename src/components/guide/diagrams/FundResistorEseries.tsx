// Resistor tolerance: two parts marked 4.7 kΩ, one ±5% and one ±1% (v2).
// Fundamentals cluster. Owner-picked T8 ("±5% vs ±1%, side by side").
//
// Teaching point: the marked value is the centre of a guaranteed band, and the
// tolerance is how wide that band is. A ±5% part can wander five times further
// than a ±1% part with the same 4.7 kΩ marking.
//
// Landscape desktop/print: two number lines sharing one nominal, a wide ±5%
// band over a narrow ±1% band. REFLOWS to two stacked cards on a phone, each
// with a proportional band bar. Token-only color.
import { DiagramFrame } from "./DiagramFrame";

export function FundResistorEseries({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="FUNDAMENTALS · RESISTORS"
      tone="gold"
      title="Resistor tolerance"
      ariaLabel="Resistor tolerance shown as two number lines. Both resistors are marked 4.7 kilohms, but one is a ±5% part and the other a ±1% part. The ±5% part is only guaranteed to fall in a wide band, roughly 4.47 to 4.94 kilohms; the ±1% part is held to a much narrower band, 4.65 to 4.75 kilohms. The marked value is the centre of the band, and the tolerance is how wide that band is: a tighter tolerance costs more and buys a narrower guaranteed range."
      caption={caption}
      defaultCaption="The marking is the centre of a band; tolerance is its width. Same 4.7 kΩ, but ±5% wanders five times further than ±1%."
    >
      <style>{CSS}</style>

      <div className="re">
        {/* desktop / print: two number lines */}
        <svg className="re-scene" viewBox="0 0 520 210" aria-hidden="true">
          <text className="re-nom" x="245" y="40" textAnchor="middle">4.7 kΩ</text>

          {/* ±5% — wide band */}
          <line className="re-axis" x1="60" y1="95" x2="430" y2="95" />
          <rect className="re-band" x="145" y="81" width="200" height="28" rx="3" />
          <line className="re-mark" x1="245" y1="77" x2="245" y2="113" />
          <text className="re-tol" x="490" y="100" textAnchor="end">±5%</text>
          <text className="re-range" x="245" y="132" textAnchor="middle">4.47k – 4.94k</text>

          {/* ±1% — narrow band */}
          <line className="re-axis" x1="60" y1="165" x2="430" y2="165" />
          <rect className="re-band" x="225" y="151" width="40" height="28" rx="3" />
          <line className="re-mark" x1="245" y1="147" x2="245" y2="183" />
          <text className="re-tol" x="490" y="170" textAnchor="end">±1%</text>
          <text className="re-range" x="245" y="202" textAnchor="middle">4.65k – 4.75k</text>
        </svg>

        {/* phone: two stacked cards */}
        <ul className="re-list" aria-hidden="true">
          <li>
            <span className="re-li-tol">±5%</span>
            <div className="re-track">
              <div className="re-fill" style={{ width: "90%" }} />
              <div className="re-nib" />
            </div>
            <span className="re-li-range">4.47k – 4.94k</span>
          </li>
          <li>
            <span className="re-li-tol">±1%</span>
            <div className="re-track">
              <div className="re-fill" style={{ width: "18%" }} />
              <div className="re-nib" />
            </div>
            <span className="re-li-range">4.65k – 4.75k</span>
          </li>
        </ul>
        <p className="re-note">Both marked 4.7 kΩ. Tolerance is how wide the guaranteed band is.</p>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.re{display:block;}
.re-scene{display:block;width:100%;height:auto;overflow:visible;}
.re-axis{stroke:var(--color-panel-border,#3a3f50);stroke-width:1.5;}
.re-band{fill:var(--color-command-gold,#c8963e);opacity:.28;}
.re-mark{stroke:var(--color-command-gold,#c8963e);stroke-width:3;}
.re-nom{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:18px;fill:var(--color-title,#f1ece0);}
.re-tol{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:16px;fill:var(--color-command-gold,#c8963e);}
.re-range{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:11px;letter-spacing:.04em;fill:var(--color-muted,#aaa);}

/* phone reflow */
.re-list{display:none;list-style:none;margin:0;padding:0;flex-direction:column;gap:.6rem;}
@media (max-width:520px){ .re-scene{display:none;} .re-list{display:flex;} }
.re-list li{display:grid;grid-template-columns:3rem 1fr;grid-template-rows:auto auto;align-items:center;gap:.2rem .8rem;
  padding:.7rem .9rem;border-radius:6px;text-align:left;
  background:var(--color-navy-dark,#1f2438);box-shadow:inset 0 0 0 1.5px var(--color-panel-border,#3a3f50);}
.re-li-tol{grid-row:1 / span 2;font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:1.4rem;color:var(--color-command-gold,#c8963e);}
.re-track{position:relative;height:22px;border-radius:4px;background:var(--color-deep-space,#08090d);
  box-shadow:inset 0 0 0 1px var(--color-panel-border,#3a3f50);display:flex;align-items:center;justify-content:center;}
.re-fill{height:22px;border-radius:4px;background:var(--color-command-gold,#c8963e);opacity:.3;}
.re-nib{position:absolute;left:50%;top:2px;bottom:2px;width:3px;transform:translateX(-50%);background:var(--color-command-gold,#c8963e);}
.re-li-range{font-family:var(--font-mono,"Space Mono",monospace);font-size:.8rem;color:var(--color-muted,#aaa);}
.re-note{margin:1rem 0 0;text-align:center;font-family:var(--font-serif,"Lora",serif);font-size:clamp(.82rem,2.1vw,.9rem);color:var(--color-muted,#aaa);}
@media (max-width:520px){ .re-note{display:block;} }
@media (min-width:521px){ .re-note{display:none;} }

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .re-band,.dgfrm.armed .re-fill{transform:scaleX(0);transform-origin:center;}
.dgfrm.armed.in .re-band{transform:scaleX(1);transition:transform .5s ease;}
.dgfrm.armed.in .re-fill{transform:scaleX(1);transition:transform .5s ease;}
@media (prefers-reduced-motion:reduce){
  .dgfrm .re-band{transform:none!important;} .dgfrm .re-fill{transform:none!important;}
}
`;
