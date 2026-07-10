// Battery-runtime formula (v2). Power & Batteries cluster. Owner-picked Ru3
// (the formula worked to hours).
//
// Teaching point (battery-runtime): runtime is the usable capacity divided by the
// average draw. t = Q x usable / I_avg, worked with real numbers: a 2000 mAh cell
// at 80 percent usable, over a 100 mA average draw, lasts about 16 hours. The
// formula is set in HTML/CSS, not KaTeX (the diagram-render route omits KaTeX
// fonts, per FundPowerHeat); the diagram bakes to a raster so the multiplication
// glyph is safe. Token-only color: the result in gold, the rest on the palette.
//
// Landscape; the centered stack reflows without shrinking (clamped px). Bookends
// the power-budget diagram (both worked calculations).
import { DiagramFrame } from "./DiagramFrame";

export function PowerRuntime({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="BATTERY RUNTIME"
      tone="gold"
      title="How long the battery lasts"
      ariaLabel="The battery-runtime formula. Runtime t equals the battery capacity Q times the usable fraction, divided by the average current draw I-average. Worked with real numbers: 2000 milliamp-hours times 0.8 usable, divided by 100 milliamps of average draw, equals about 16 hours."
      caption={caption}
      defaultCaption="Runtime is usable capacity over the average draw: known values in, hours out."
    >
      <style>{CSS}</style>

      <div className="rt">
        <div className="rt-formula">
          <span className="rt-t">t</span> = Q &times; usable / I<sub>avg</sub>
        </div>
        <div className="rt-values">2000 mAh &times; 0.8 usable / 100 mA</div>
        <div className="rt-result">
          = 16<span className="rt-unit">hours</span>
        </div>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.rt{display:flex;flex-direction:column;align-items:center;gap:clamp(.7rem,2.6vw,1.15rem);padding:clamp(.4rem,2vw,1rem) 0;}
.rt-formula{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;
  font-size:clamp(1.4rem,5vw,2rem);letter-spacing:.02em;color:var(--color-title,#f1ece0);line-height:1.1;}
.rt-formula .rt-t{color:var(--color-command-gold,#c8963e);}
.rt-formula sub{font-size:.5em;font-weight:700;color:var(--color-muted,#aaa);}
.rt-values{font-family:var(--font-mono,"Space Mono",monospace);font-size:clamp(.85rem,2.6vw,1rem);
  color:var(--color-muted,#aaa);letter-spacing:.01em;}
.rt-result{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;
  font-size:clamp(2.2rem,7vw,3rem);color:var(--color-gold-light,#e8b865);line-height:1;
  display:inline-flex;align-items:baseline;gap:.4rem;}
.rt-result .rt-unit{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;
  font-size:clamp(.9rem,2.6vw,1.1rem);color:var(--color-muted,#aaa);letter-spacing:.02em;}

/* Tier-B reveal off the frame's armed/in contract (settled under reduced-motion). */
.dgfrm.armed .rt-result{opacity:0;transform:translateY(6px);}
.dgfrm.armed.in .rt-result{opacity:1;transform:none;transition:opacity .55s ease .2s,transform .55s cubic-bezier(.2,.7,.2,1) .2s;}
@media (prefers-reduced-motion:reduce){ .dgfrm .rt-result{opacity:1!important;transform:none!important;} }
`;
