// ADC1-vs-ADC2 pin map as a responsive v2 diagram.
//
// Teaching point: ADC1 = GPIO 1-10, usable for analog input; ADC2 = GPIO 11-20,
// claimed by the radio so those pins read garbage while Wi-Fi is on. For analog,
// stick to ADC1.
//
// v2: two labelled pin banks side by side (was a portrait stack) — ADC1 usable
// (gold), ADC2 radio-claimed (red) — reflowing to a stacked column on a phone so
// the pin numbers never shrink. Token-only color; pin chips ride
// --color-diagram-surface so they re-theme on the ivory light field (the old
// navy chips went white-on-ivory).
import { DiagramFrame } from "./DiagramFrame";

const ADC1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const ADC2 = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

export function Adc1PinMap({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="SCHEMATIC · ADC PINS"
      tone="gold"
      title="Analog input? Use an ADC1 pin."
      ariaLabel="ADC pin map. GPIO 1 to 10 are ADC1 and stay usable for analog input. GPIO 11 to 20 are ADC2 and are claimed by the radio, so they read garbage while Wi-Fi is on. For analog reads, stick to ADC1, GPIO 1 to 10."
      caption={caption}
      defaultCaption="For analog reads, stick to ADC1 (GPIO 1 to 10). ADC2 shares its converter with the radio."
    >
      <style>{CSS}</style>
      <div className="apm">
        <div className="apm-bank apm-good">
          <p className="apm-head">
            <span className="apm-mark">✓</span> ADC1 <span className="apm-range">GPIO 1-10</span>
          </p>
          <div className="apm-grid">
            {ADC1.map((n) => (
              <span key={n} className="apm-pin apm-pin-good">{n}</span>
            ))}
          </div>
        </div>

        <div className="apm-bank apm-bad">
          <p className="apm-head apm-head-bad">
            <span className="apm-mark">✗</span> ADC2 <span className="apm-range">GPIO 11-20</span>
          </p>
          <div className="apm-grid">
            {ADC2.map((n) => (
              <span key={n} className="apm-pin apm-pin-bad">{n}</span>
            ))}
          </div>
          <p className="apm-note">
            Wi-Fi borrows ADC2's converter, so these read garbage while the radio is on.
          </p>
        </div>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.apm{display:flex;gap:clamp(1rem,4vw,1.6rem);text-align:left;font-family:var(--font-mono,"Space Mono",monospace);}
@media (max-width:520px){.apm{flex-direction:column;}}
.apm-bank{flex:1 1 0;min-width:0;}

.apm-head{margin:0 0 clamp(.6rem,2.5vw,.85rem);display:flex;align-items:baseline;gap:.45rem;flex-wrap:wrap;
  color:var(--color-command-gold,#c8963e);font-weight:700;font-size:clamp(1.05rem,3vw,1.25rem);letter-spacing:.02em;}
.apm-head-bad{color:var(--color-alert-red,#ef5350);}
.apm-mark{font-size:1.05em;}
.apm-range{color:var(--color-muted,#aaa);font-weight:400;font-size:clamp(.9rem,2.4vw,1rem);}

.apm-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:clamp(.4rem,1.6vw,.55rem);}
.apm-pin{display:flex;align-items:center;justify-content:center;aspect-ratio:5/3;border-radius:5px;
  background:var(--color-diagram-surface,#1f2438);font-family:var(--font-numeral,"Saira Condensed",sans-serif);
  font-weight:700;font-size:clamp(1rem,3vw,1.25rem);}
.apm-pin-good{color:var(--color-title,#f1ece0);border:2px solid var(--color-command-gold,#c8963e);}
.apm-pin-bad{color:var(--color-muted,#aaa);border:1.6px solid var(--color-alert-red,#ef5350);}

.apm-note{margin:clamp(.7rem,2.6vw,.95rem) 0 0;color:var(--color-muted,#aaa);
  font-family:var(--font-serif,"Lora",serif);font-size:clamp(.85rem,2.3vw,.95rem);line-height:1.45;}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .apm-bank{opacity:0;transform:translateY(6px);}
.dgfrm.armed.in .apm-bank{opacity:1;transform:none;transition:opacity .55s ease,transform .55s cubic-bezier(.2,.7,.2,1);}
.dgfrm.armed.in .apm-bad{transition-delay:.12s;}
@media (prefers-reduced-motion:reduce){.dgfrm .apm-bank{opacity:1!important;transform:none!important;transition:none!important;}}
`;
