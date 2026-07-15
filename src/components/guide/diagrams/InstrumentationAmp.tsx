// Differential measurement (the instrumentation amp) as a responsive diagram (v2).
//
// Teaching point: each electrode carries the tiny microvolt brain signal riding
// on a LARGE common-mode interference (mains hum) that is the same on both inputs.
// An instrumentation amp outputs the gained DIFFERENCE of its two inputs, so the
// shared common-mode subtracts away and only the signal difference survives,
// amplified and clean. How completely the common part is rejected is the CMRR
// (~100-110 dB in good EEG amps).
//
// v2: a differential schematic on desktop/print (~1.5 landscape) — two inputs,
// each a gold signal on a shared blue common-mode wobble, wired to the +/- pins
// of the amp, with a clean amplified output — reflowing to two stacked cards on a
// narrow phone (real px) per directive 1. Token-only color via CSS classes; blue
// marks the common-mode that gets rejected.
import { DiagramFrame } from "./DiagramFrame";

function path(x0: number, x1: number, cy: number, a: number, cyc: number, ph = 0, step = 2): string {
  const pts: string[] = [];
  for (let x = x0; x <= x1; x += step) {
    const t = (x - x0) / (x1 - x0);
    pts.push(`${x},${(cy - a * Math.sin(t * cyc * 2 * Math.PI + ph)).toFixed(1)}`);
  }
  return "M" + pts.join(" L");
}

// desktop input waves (blue common-mode wobble + gold signal) and clean output
const IN_TOP_CM = path(40, 150, 64, 12, 1.5);
const IN_TOP_SIG = path(40, 150, 64, 5, 4);
const IN_BOT_CM = path(40, 150, 116, 12, 1.5);
const IN_BOT_SIG = path(40, 150, 116, 5, 4, 2.2);
const OUT = path(370, 520, 90, 20, 3);
// phone card waves
const P_IN_CM = path(16, 244, 34, 10, 1.5);
const P_IN_SIG = path(16, 244, 34, 5, 4);
const P_OUT = path(16, 244, 46, 16, 3);

export function InstrumentationAmp({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="BIOPOTENTIAL AFE · DIFFERENTIAL"
      tone="gold"
      title="Keep the difference, reject the rest"
      ariaLabel="An instrumentation amplifier measuring the difference between two electrodes. Each input carries the tiny microvolt brain signal riding on a large common-mode interference, the mains hum, drawn as a slow wobble that is the same on both inputs. Because the amplifier outputs the gained difference of its two inputs, that shared common-mode subtracts away and only the signal difference survives, amplified and clean. How completely the common part is rejected is the common-mode rejection ratio, around 100 to 110 decibels in good EEG amplifiers; unequal electrode impedance, not the chip, is what usually defeats it."
      caption={caption}
      defaultCaption="CMRR is how well the amp throws away what's common. Unequal electrode impedance is what defeats it, not the chip."
    >
      <style>{CSS}</style>

      <div className="iamp">
        {/* desktop / print: differential schematic */}
        <div className="iamp-diagram">
          <svg className="iamp-svg" viewBox="0 0 560 176" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <text className="iamp-cmlab" x="40" y="28" textAnchor="start">blue wobble = common-mode (rejected)</text>
            {/* + input */}
            <path className="iamp-cm" d={IN_TOP_CM} />
            <path className="iamp-sig" d={IN_TOP_SIG} />
            <path className="iamp-wire" d="M150,64 H250" />
            <text className="iamp-pin" x="240" y="60" textAnchor="middle">+</text>
            {/* − input */}
            <path className="iamp-cm" d={IN_BOT_CM} />
            <path className="iamp-sig" d={IN_BOT_SIG} />
            <path className="iamp-wire" d="M150,116 H250" />
            <text className="iamp-pin" x="240" y="124" textAnchor="middle">−</text>
            {/* amp */}
            <path className="iamp-tri" d="M250,48 L250,132 L352,90 Z" />
            <text className="iamp-g" x="288" y="94" textAnchor="middle">×G</text>
            {/* output */}
            <path className="iamp-wire" d="M352,90 H370" />
            <path className="iamp-out" d={OUT} />
            <text className="iamp-olab" x="445" y="150" textAnchor="middle">clean · amplified</text>
          </svg>
        </div>

        {/* phone: two stacked cards */}
        <div className="iamp-cards" aria-hidden="true">
          <div className="iamp-card iamp-card-in">
            <p className="iamp-ck">Both inputs</p>
            <svg className="iamp-svg-s" viewBox="0 0 260 68" preserveAspectRatio="xMidYMid meet">
              <path className="iamp-cm" d={P_IN_CM} />
              <path className="iamp-sig" d={P_IN_SIG} />
            </svg>
            <p className="iamp-ct">Your µV signal rides on a large common-mode hum (blue) that is the same on both electrodes.</p>
          </div>
          <div className="iamp-card iamp-card-out">
            <p className="iamp-ck">The amp's output</p>
            <svg className="iamp-svg-s" viewBox="0 0 260 68" preserveAspectRatio="xMidYMid meet"><path className="iamp-out" d={P_OUT} /></svg>
            <p className="iamp-ct">It amplifies the difference, so the shared hum cancels and only your signal is left. CMRR ~100 to 110 dB says how well.</p>
          </div>
        </div>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.iamp-svg,.iamp-svg-s{overflow:visible;width:100%;height:auto;display:block;}
.iamp-cm{fill:none;stroke:var(--color-signal-blue,#4a8fff);stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;}
.iamp-sig{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;}
.iamp-wire{stroke:var(--color-command-gold,#c8963e);stroke-width:2;fill:none;}
.iamp-tri{fill:var(--color-deep-space,#08090d);stroke:var(--color-command-gold,#c8963e);stroke-width:2.5;stroke-linejoin:round;}
.iamp-g{fill:var(--color-title,#f1ece0);font-family:var(--font-mono,"Space Mono",monospace);font-size:13px;font-weight:700;}
.iamp-out{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;}
.iamp-pin{fill:var(--color-command-gold,#c8963e);font-family:var(--font-mono,"Space Mono",monospace);font-size:18px;font-weight:700;}
.iamp-cmlab{fill:var(--color-signal-blue,#4a8fff);font-family:var(--font-mono,"Space Mono",monospace);font-size:12px;font-weight:700;letter-spacing:.02em;}
.iamp-olab{fill:var(--color-command-gold,#c8963e);font-family:var(--font-mono,"Space Mono",monospace);font-size:13px;font-weight:700;}

/* phone reflow: two stacked cards */
.iamp-cards{display:none;flex-direction:column;gap:.7rem;text-align:left;}
@container (max-width:520px){
  .iamp-diagram{display:none;}
  .iamp-cards{display:flex;}
}
.iamp-card{border-radius:6px;padding:.75rem .85rem;}
.iamp-card-out{box-shadow:inset 0 0 0 2px var(--color-command-gold,#c8963e);}
.iamp-ck{margin:0 0 .3rem;font-family:var(--font-display,"Bebas Neue",sans-serif);font-size:1.2rem;letter-spacing:.02em;color:var(--color-title,#f1ece0);}
.iamp-card-out .iamp-ck{color:var(--color-command-gold,#c8963e);}
.iamp-svg-s{height:52px;margin:.15rem 0 .45rem;}
.iamp-ct{margin:0;font-family:var(--font-serif,"Lora",serif);font-size:.9rem;line-height:1.4;color:var(--color-text,#e8e8e8);}

/* Tier-B reveal off the frame's armed/in contract. */
.dgfrm.armed .iamp-card{opacity:0;transform:translateY(5px);}
.dgfrm.armed.in .iamp-card{opacity:1;transform:none;transition:opacity .5s ease,transform .5s cubic-bezier(.2,.7,.2,1);}
@media (prefers-reduced-motion:reduce){.dgfrm .iamp-card{opacity:1!important;transform:none!important;}}
`;
