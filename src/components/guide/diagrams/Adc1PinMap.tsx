// ADC1-vs-ADC2 pin map as a responsive HTML component.
//
// Why not the source SVG: a fixed-viewBox SVG scales to its container, so on a
// ~360px phone its 24-unit pin numbers render at ~11px and the takeaway text at
// ~9px — unreadable. Rendered as real HTML/CSS the labels are actual CSS px
// (clamped, never below ~14px) and the two 5x2 pin banks reflow without the text
// ever shrinking. It is a pure list/grid diagram, so no inline SVG is needed.
//
// TEACHING DATA (preserved exactly): ADC1 = GPIO 1-10, usable for analog input;
// ADC2 = GPIO 11-20, claimed by the radio so those pins read garbage while Wi-Fi
// is on. Takeaway: for analog reads, stick to ADC1.
//
// Header / frame / caption come from the shared DiagramFrame (site-standard
// Bebas title); this file supplies only the graphic body.
//
// BRAND (onethousanddrones.com/brand): gold-dominant on Deep Space, Navy Dark
// pin bodies, alert red ONLY on the radio-claimed ADC2 bank (a genuine "don't
// use this" state). No other accent hues. All colours via @theme tokens.
import { DiagramFrame } from "./DiagramFrame";

export function Adc1PinMap({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="SCHEMATIC · ADC PINS"
      tone="gold"
      title="Analog input? Use an ADC1 pin."
      ariaLabel="ADC pin map. GPIO 1 to 10 are ADC1 and stay usable for analog input. GPIO 11 to 20 are ADC2 and are claimed by the radio, so they read garbage while Wi-Fi is on. For analog reads, stick to ADC1, GPIO 1 to 10."
      caption={caption}
      defaultCaption="For analog reads, stick to ADC1 (GPIO 1–10)."
    >
      <style>{CSS}</style>
      <div className="apm">
        <div className="apm-bank apm-good">
          <div className="apm-head">
            <span className="apm-tag apm-tag-good">USABLE</span>
            <div className="apm-headtext">
              <span className="apm-bank-name">ADC1</span>
              <span className="apm-bank-range">GPIO 1&ndash;10</span>
            </div>
          </div>
          <div className="apm-grid">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <span key={n} className="apm-pin apm-pin-good">
                {n}
              </span>
            ))}
          </div>
        </div>

        <div className="apm-bank apm-bad">
          <div className="apm-head">
            <span className="apm-tag apm-tag-bad">RADIO-CLAIMED</span>
            <div className="apm-headtext">
              <span className="apm-bank-name apm-bank-name-bad">ADC2</span>
              <span className="apm-bank-range">GPIO 11&ndash;20</span>
            </div>
          </div>
          <div className="apm-grid">
            {[11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((n) => (
              <span key={n} className="apm-pin apm-pin-bad">
                {n}
              </span>
            ))}
          </div>
          <p className="apm-note">
            Wi-Fi borrows ADC2&rsquo;s converter &mdash; these pins read garbage
            while the radio is on.
          </p>
        </div>
      </div>
    </DiagramFrame>
  );
}

// Token-driven (var(--color-*) / var(--font-*) from @theme) with literal
// fallbacks so a standalone render still resolves. Gold-dominant per brand;
// alert red is reserved for the radio-claimed bank only. Unique `.apm-` prefix
// so styles never collide with other diagrams on the same page.
const CSS = `
.apm{font-family:var(--font-mono,"Space Mono",monospace);}
.apm *{box-sizing:border-box;}

.apm-bank{border:1px solid var(--color-panel-border,#3a3f50);border-radius:.5rem;
  padding:clamp(.85rem,3vw,1.1rem);text-align:left;}
.apm-good{border-left:3px solid var(--color-command-gold,#c8963e);}
.apm-bad{border-left:3px solid var(--color-alert-red,#c62828);margin-top:clamp(1rem,3.5vw,1.4rem);}

.apm-head{display:flex;align-items:center;gap:.7rem;margin-bottom:clamp(.7rem,3vw,1rem);}
.apm-tag{flex:none;font-size:.62rem;font-weight:700;letter-spacing:.16em;
  padding:.28rem .5rem;border-radius:3px;line-height:1;}
.apm-tag-good{color:var(--color-deep-space,#08090d);background:var(--color-command-gold,#c8963e);}
.apm-tag-bad{color:#fff;background:var(--color-alert-red,#c62828);}
.apm-headtext{display:flex;align-items:baseline;gap:.55rem;flex-wrap:wrap;}
.apm-bank-name{color:var(--color-command-gold,#c8963e);font-weight:700;
  font-size:clamp(1.05rem,3vw,1.3rem);letter-spacing:.02em;}
.apm-bank-name-bad{color:var(--color-gray-1,#e8e8e8);}
.apm-bank-range{color:var(--color-muted,#aaa);font-size:clamp(.95rem,2.5vw,1.05rem);}

.apm-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:clamp(.4rem,1.6vw,.6rem);}
.apm-pin{display:flex;align-items:center;justify-content:center;
  aspect-ratio:5/3;border-radius:5px;font-weight:700;
  font-size:clamp(1.05rem,3vw,1.3rem);
  background:var(--color-navy-dark,#1f2438);}
.apm-pin-good{color:#fff;border:2px solid var(--color-command-gold,#c8963e);}
.apm-pin-bad{color:var(--color-muted,#aaa);border:1.5px solid rgba(198,40,40,.55);}

.apm-note{margin:clamp(.7rem,3vw,1rem) 0 0;color:var(--color-muted,#aaa);
  font-family:var(--font-serif,"Lora",serif);font-size:clamp(.85rem,2.3vw,.95rem);line-height:1.5;}
`;
