// The metric prefix ladder, drawn as a bench slider (v2). Fundamentals cluster.
//
// Teaching point: a prefix scales a unit by a power of ten, and each named stop
// on the ladder (pico -> mega) is a factor of a thousand from the last. Reading
// the prefix on a real part value (100 nF, 4.7 uF, 5.1 kOhm) places it on the
// scale. Owner-picked "range slider" direction.
//
// Landscape desktop/print: a horizontal slider track with a stop per prefix
// (name / tick / symbol / factor), the handle on the base unit, example values
// pinned under their stop. REFLOWS to a vertical named list on a phone (real px,
// no shrinking) per directive 1. Token-only color (dark literal fallbacks for the
// standalone/exporter render; light comes from the token override).
import { DiagramFrame } from "./DiagramFrame";

const STOPS = [
  { name: "pico", sym: "p", fac: "10⁻¹²" },
  { name: "nano", sym: "n", fac: "10⁻⁹", ex: "100 nF" },
  { name: "micro", sym: "µ", fac: "10⁻⁶", ex: "4.7 µF" },
  { name: "milli", sym: "m", fac: "10⁻³" },
  { name: "unit", sym: "1", fac: "10⁰", unit: true },
  { name: "kilo", sym: "k", fac: "10³", ex: "5.1 kΩ" },
  { name: "mega", sym: "M", fac: "10⁶" },
];

export function FundPrefixLadder({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="FUNDAMENTALS · UNITS"
      tone="gold"
      title="The prefix ladder"
      ariaLabel="The metric prefix ladder shown as a slider, each stop a factor of a thousand from the last: pico (p, ten to the minus twelve); nano (n, ten to the minus nine, as in a 100 nF capacitor); micro (the Greek mu, ten to the minus six, as in a 4.7 microfarad capacitor); milli (m, ten to the minus three); the base unit (ten to the zero); kilo (k, ten to the third, as in a 5.1 kilohm resistor); and mega (M, ten to the sixth). Reading the prefix on a part value places it on this scale."
      caption={caption}
      defaultCaption="Each stop is a factor of a thousand. Read the prefix to place a value on the scale."
    >
      <style>{CSS}</style>

      <div className="pl">
        {/* desktop / print: the slider */}
        <div className="pl-scale" aria-hidden="true">
          <div className="pl-row pl-names">
            {STOPS.map((s) => (
              <span key={s.name} className={s.unit ? "pl-unit" : ""}>{s.name}</span>
            ))}
          </div>
          <div className="pl-rail">
            <span className="pl-line" />
            <span className="pl-fill" />
            <span className="pl-handle" />
            <div className="pl-ticks">
              {STOPS.map((s) => (
                <i key={s.name} className={s.unit ? "h" : ""} />
              ))}
            </div>
          </div>
          <div className="pl-row pl-syms">
            {STOPS.map((s) => (
              <span key={s.name} className={s.unit ? "pl-unit" : ""}>{s.sym}</span>
            ))}
          </div>
          <div className="pl-row pl-facs">
            {STOPS.map((s) => (
              <span key={s.name}>{s.fac}</span>
            ))}
          </div>
          <div className="pl-row pl-exs">
            {STOPS.map((s) => (
              <span key={s.name}>{s.ex ?? ""}</span>
            ))}
          </div>
        </div>

        {/* phone: vertical named list */}
        <ul className="pl-list" aria-hidden="true">
          {STOPS.map((s) => (
            <li key={s.name} className={s.unit ? "pl-li-unit" : ""}>
              <span className="pl-li-sym">{s.sym}</span>
              <span className="pl-li-name">{s.name}</span>
              <span className="pl-li-fac">{s.fac}</span>
              <span className="pl-li-ex">{s.ex ?? ""}</span>
            </li>
          ))}
        </ul>

        <p className="pl-note">Slide either way from the unit; each stop is a factor of a thousand.</p>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.pl{--pl-unit:64.3%;}
.pl-scale{display:block;}
.pl-row{display:grid;grid-template-columns:repeat(7,1fr);align-items:baseline;}
.pl-row span{text-align:center;}
.pl-names span{font-family:var(--font-mono,"Space Mono",monospace);font-size:clamp(.72rem,1.9vw,.82rem);
  text-transform:uppercase;letter-spacing:.08em;color:var(--color-muted,#aaa);padding-bottom:.35rem;}
.pl-names .pl-unit{color:var(--color-command-gold,#c8963e);font-weight:700;}
.pl-rail{position:relative;height:26px;}
.pl-line{position:absolute;left:0;right:0;top:50%;height:4px;transform:translateY(-50%);border-radius:2px;
  background:var(--color-panel-border,#3a3f50);}
.pl-fill{position:absolute;left:0;width:var(--pl-unit);top:50%;height:4px;transform:translateY(-50%);border-radius:2px;
  background:var(--color-command-gold,#c8963e);}
.pl-handle{position:absolute;left:var(--pl-unit);top:50%;width:17px;height:17px;border-radius:50%;
  transform:translate(-50%,-50%);background:var(--color-command-gold,#c8963e);z-index:2;
  box-shadow:0 0 0 3px var(--color-deep-space,#08090d);}
.pl-ticks{position:relative;display:grid;grid-template-columns:repeat(7,1fr);height:100%;z-index:1;}
.pl-ticks i{justify-self:center;align-self:center;width:2px;height:15px;background:var(--color-command-gold,#c8963e);}
.pl-ticks i.h{opacity:0;}
/* Mono, NOT Bebas: prefix-symbol case is load-bearing (m=milli vs M=mega, a
   factor of 10^9). An all-caps display face renders both as "M". */
.pl-syms span{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;
  font-size:clamp(1.05rem,2.8vw,1.35rem);line-height:1;color:var(--color-title,#f1ece0);padding-top:.5rem;}
.pl-syms .pl-unit{color:var(--color-command-gold,#c8963e);}
.pl-facs span{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;
  font-size:clamp(.85rem,2.2vw,.98rem);color:var(--color-muted,#aaa);font-variant-numeric:tabular-nums;padding-top:.2rem;}
.pl-exs span{font-family:var(--font-mono,"Space Mono",monospace);font-size:clamp(.8rem,2.1vw,.92rem);
  color:var(--color-command-gold,#c8963e);padding-top:.5rem;min-height:1.1em;}
.pl-note{margin:1rem 0 0;text-align:center;font-family:var(--font-serif,"Lora",serif);
  font-size:clamp(.82rem,2.1vw,.9rem);color:var(--color-muted,#aaa);}

/* phone reflow */
.pl-list{display:none;list-style:none;margin:0;padding:0;flex-direction:column;gap:.35rem;}
@container (max-width:520px){ .pl-scale{display:none;} .pl-list{display:flex;} }
.pl-list li{display:grid;grid-template-columns:2.2rem auto auto 1fr;align-items:center;gap:.7rem;
  padding:.5rem .8rem;border-radius:6px;text-align:left;
  }
.pl-list li.pl-li-unit{box-shadow:inset 0 0 0 2px var(--color-command-gold,#c8963e);}
.pl-li-sym{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:1.25rem;line-height:1;color:var(--color-title,#f1ece0);}
.pl-li-unit .pl-li-sym{color:var(--color-command-gold,#c8963e);}
.pl-li-name{font-family:var(--font-mono,"Space Mono",monospace);font-size:.9rem;text-transform:uppercase;
  letter-spacing:.06em;color:var(--color-text,#e8e8e8);}
.pl-li-fac{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:.95rem;
  color:var(--color-muted,#aaa);font-variant-numeric:tabular-nums;}
.pl-li-ex{font-family:var(--font-mono,"Space Mono",monospace);font-size:.82rem;color:var(--color-command-gold,#c8963e);white-space:nowrap;justify-self:end;}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .pl-fill{transform:translateY(-50%) scaleX(0);transform-origin:left;}
.dgfrm.armed .pl-handle,.dgfrm.armed .pl-syms span,.dgfrm.armed .pl-exs span,.dgfrm.armed .pl-list li{opacity:0;}
.dgfrm.armed.in .pl-fill{transform:translateY(-50%) scaleX(1);transition:transform .6s ease;}
.dgfrm.armed.in .pl-handle,.dgfrm.armed.in .pl-syms span,.dgfrm.armed.in .pl-exs span,.dgfrm.armed.in .pl-list li{
  opacity:1;transition:opacity .5s ease .25s;}
@media (prefers-reduced-motion:reduce){
  .dgfrm .pl-fill{transform:translateY(-50%) scaleX(1)!important;}
  .dgfrm .pl-handle,.dgfrm .pl-syms span,.dgfrm .pl-exs span,.dgfrm .pl-list li{opacity:1!important;}
}
`;
