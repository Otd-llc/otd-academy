// Differential measurement (the instrumentation amp) as a responsive component.
//
// Teaching point: each electrode carries the tiny brain signal PLUS a big
// common-mode interference. An instrumentation amplifier outputs the gained
// DIFFERENCE of its two inputs: whatever is common to both (the mains hum)
// subtracts away, and the difference (the µV signal) survives and is amplified.
// How well the common part cancels is the CMRR.
//
// Two inputs into one amp into one output, with the cancel/keep key below.
// Header/frame/caption from DiagramFrame. Brand palette: gold-dominant, Signal
// Blue for the rejected common-mode, Navy Dark bodies. @theme tokens.
import { DiagramFrame } from "./DiagramFrame";

export function InstrumentationAmp({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="BIOPOTENTIAL AFE · DIFFERENTIAL"
      tone="gold"
      title="Keep the difference, reject the rest"
      ariaLabel="An instrumentation amplifier measures the difference between two electrodes. Each input carries the tiny microvolt brain signal plus a large common-mode interference (mains hum). The amplifier outputs the gain times the difference of the two inputs, so the common-mode part that is the same on both inputs subtracts away and the difference (the brain signal) survives and is amplified. The common-mode rejection ratio, around 100 to 110 decibels in good EEG amplifiers, measures how well the common part is cancelled."
      caption={caption}
      defaultCaption="CMRR is how well the amp throws away what's common. Unequal electrode impedance is what defeats it, not the chip."
    >
      <style>{CSS}</style>

      <div className="iamp">
        <div className="iamp-ins">
          <div className="iamp-in">
            <span className="iamp-pin">+ input</span>
            <span className="iamp-val">signal <i>+ hum</i></span>
          </div>
          <div className="iamp-in">
            <span className="iamp-pin">− input</span>
            <span className="iamp-val">signal <i>+ hum</i></span>
          </div>
        </div>

        <span className="iamp-arrow" aria-hidden="true">→</span>
        <div className="iamp-amp">
          <p className="iamp-amp-t">In-amp</p>
          <p className="iamp-amp-s">× gain</p>
        </div>
        <span className="iamp-arrow" aria-hidden="true">→</span>

        <div className="iamp-out">
          <span className="iamp-pin">output</span>
          <span className="iamp-val">gain × (in⁺ − in⁻)</span>
        </div>
      </div>

      <p className="iamp-key">
        <b className="iamp-keep">difference kept</b> = your µV signal ·
        <b className="iamp-rej"> common hum cancels</b>
      </p>
      <p className="iamp-cmrr">CMRR ~100–110 dB = how hard the common part is rejected</p>
    </DiagramFrame>
  );
}

const CSS = `
.iamp{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:clamp(.4rem,1.8vw,.7rem);}
.iamp-ins{display:flex;flex-direction:column;gap:.4rem;}
.iamp-in,.iamp-out{display:flex;flex-direction:column;padding:.45rem .6rem;border-radius:5px;
  background:var(--color-navy-dark,#1f2438);box-shadow:inset 0 0 0 1.5px var(--color-panel-border,#3a3f50);text-align:left;}
.iamp-out{box-shadow:inset 0 0 0 2px var(--color-command-gold,#c8963e);}
.iamp-pin{font-family:var(--font-mono,"Space Mono",monospace);font-size:clamp(.64rem,1.7vw,.72rem);
  text-transform:uppercase;letter-spacing:.1em;color:var(--color-muted,#aaa);}
.iamp-val{color:var(--color-gray-1,#e8e8e8);font-size:clamp(.82rem,2.2vw,.95rem);font-weight:700;white-space:nowrap;}
.iamp-val i{color:var(--color-signal-blue,#4a8fff);font-style:italic;font-weight:700;}
.iamp-amp{display:flex;flex-direction:column;justify-content:center;align-items:center;
  width:clamp(3.4rem,13vw,4.2rem);height:clamp(3.4rem,13vw,4.2rem);border-radius:8px;
  background:var(--color-deep-space,#08090d);box-shadow:inset 0 0 0 2px var(--color-command-gold,#c8963e);}
.iamp-amp-t{margin:0;color:#fff;font-weight:700;font-size:clamp(.78rem,2vw,.9rem);}
.iamp-amp-s{margin:.1rem 0 0;color:var(--color-command-gold,#c8963e);
  font-family:var(--font-mono,"Space Mono",monospace);font-size:clamp(.64rem,1.7vw,.72rem);}
.iamp-arrow{color:var(--color-command-gold,#c8963e);font-size:clamp(1rem,2.6vw,1.25rem);font-weight:700;}

.iamp-key{margin:clamp(.95rem,3vw,1.25rem) 0 0;text-align:center;color:var(--color-muted,#aaa);
  font-size:clamp(.82rem,2.2vw,.92rem);line-height:1.5;}
.iamp-keep{color:var(--color-command-gold,#c8963e);}
.iamp-rej{color:var(--color-signal-blue,#4a8fff);}
.iamp-cmrr{margin:.55rem 0 0;text-align:center;color:var(--color-muted,#aaa);
  font-family:var(--font-mono,"Space Mono",monospace);font-size:clamp(.7rem,1.9vw,.78rem);letter-spacing:.02em;}

.dgfrm.armed .iamp,.dgfrm.armed .iamp-key,.dgfrm.armed .iamp-cmrr{opacity:0;transform:translateY(6px);}
.dgfrm.armed.in .iamp,.dgfrm.armed.in .iamp-key,.dgfrm.armed.in .iamp-cmrr{opacity:1;transform:none;transition:opacity .5s ease,transform .5s cubic-bezier(.2,.7,.2,1);}
.dgfrm.armed.in .iamp-key{transition-delay:.14s;}
.dgfrm.armed.in .iamp-cmrr{transition-delay:.22s;}
@media (prefers-reduced-motion:reduce){.dgfrm .iamp,.dgfrm .iamp-key,.dgfrm .iamp-cmrr{opacity:1!important;transform:none!important;}}
`;
