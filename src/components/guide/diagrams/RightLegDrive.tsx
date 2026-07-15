// The right-leg-drive (bias) loop's effect, as a responsive diagram (v2).
//
// Teaching point: the RLD is active negative feedback against mains hum. It
// senses the body's common-mode voltage, inverts and amplifies it, and drives
// the opposing signal back into the body through a bias electrode (behind a large
// series resistor for safety), nulling the hum at its source. This shows the
// PAYOFF as one trace: a microvolt EEG rhythm buried under 50/60 Hz ripple, then
// the moment the loop switches on, the ripple vanishes and the rhythm is clean.
// (The sense/invert/drive mechanism lives in the lesson prose + the caption.)
//
// v2: one continuous trace on desktop/print (~1.5 landscape) that goes from noisy
// (red, before) to clean (gold, after) at the "RLD on" line, reflowing to two
// stacked cards on a narrow phone (real px) per directive 1. Token-only color via
// CSS classes; red marks the hum-swamped "before" (a genuine failure state).
import { DiagramFrame } from "./DiagramFrame";

// A slow EEG rhythm running the whole width; a fast mains ripple present only on
// the "before" half, phased to vanish at the switch point so the trace is
// continuous (noisy red meets clean gold at the same value).
function signal(x: number, x0: number, x1: number, cy: number, a: number, cyc: number): number {
  return cy - a * Math.sin(((x - x0) / (x1 - x0)) * cyc * 2 * Math.PI);
}
function tracePath(x0: number, x1: number, cy: number, sigA: number, sigC: number, humA: number, humC: number, fullX0: number, fullX1: number): string {
  const pts: string[] = [];
  for (let x = x0; x <= x1; x += 1.5) {
    const s = signal(x, fullX0, fullX1, cy, sigA, sigC);
    const h = humA ? humA * Math.sin(((x - x0) / (x1 - x0)) * humC * 2 * Math.PI) : 0;
    pts.push(`${x},${(s + h).toFixed(1)}`);
  }
  return "M" + pts.join(" L");
}

// desktop: one trace, noisy [40..290] then clean [290..520]; hum vanishes at 290.
const D_NOISY = tracePath(40, 290, 80, 10, 3.6, 16, 26, 40, 520);
const D_CLEAN = tracePath(290, 520, 80, 10, 3.6, 0, 0, 40, 520);
// phone cards
const P_NOISY = tracePath(16, 244, 46, 8, 2.4, 14, 16, 16, 244);
const P_CLEAN = tracePath(16, 244, 46, 8, 2.4, 0, 0, 16, 244);

export function RightLegDrive({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="EEG NOISE · RIGHT-LEG DRIVE"
      tone="gold"
      title="Cancel the hum at the source"
      ariaLabel="The effect of the right-leg-drive loop, shown as one EEG trace over time. On the left, before the loop is active, a slow microvolt EEG rhythm is buried under a large 50/60 Hz mains ripple. When the right-leg drive switches on, the loop senses the body's common-mode voltage, inverts it, and drives an opposing signal back into the body through a bias electrode, so the ripple vanishes and the clean rhythm remains. A large series resistor in the drive path keeps the current safe."
      caption={caption}
      defaultCaption="Active feedback beats passive grounding by tens of dB. A big series resistor keeps the drive current safe."
    >
      <style>{CSS}</style>

      <div className="rld">
        {/* desktop / print: one trace, noisy -> clean at RLD-on */}
        <div className="rld-diagram">
          <svg className="rld-svg" viewBox="0 0 560 158" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <path className="rld-noisy" d={D_NOISY} />
            <path className="rld-clean" d={D_CLEAN} />
            <line className="rld-on" x1="290" y1="18" x2="290" y2="130" />
            <text className="rld-onlab" x="290" y="12" textAnchor="middle">RLD on</text>
            <text className="rld-flab rld-flab-bad" x="150" y="150" textAnchor="middle">hum swamps the µV signal</text>
            <text className="rld-flab rld-flab-ok" x="415" y="150" textAnchor="middle">hum nulled · clean</text>
          </svg>
        </div>

        {/* phone: two stacked cards */}
        <div className="rld-cards" aria-hidden="true">
          <div className="rld-card rld-card-bad">
            <p className="rld-ck">Before</p>
            <svg className="rld-svg-s" viewBox="0 0 260 92" preserveAspectRatio="xMidYMid meet"><path className="rld-noisy" d={P_NOISY} /></svg>
            <p className="rld-ct">A microvolt EEG rhythm is buried under 50/60 Hz mains ripple.</p>
          </div>
          <div className="rld-card rld-card-ok">
            <p className="rld-ck">After the RLD switches on</p>
            <svg className="rld-svg-s" viewBox="0 0 260 92" preserveAspectRatio="xMidYMid meet"><path className="rld-clean" d={P_CLEAN} /></svg>
            <p className="rld-ct">The loop drives an opposing signal into the body, so the hum vanishes and the rhythm is clean.</p>
          </div>
        </div>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.rld-svg,.rld-svg-s{overflow:visible;width:100%;height:auto;display:block;}
.rld-noisy{fill:none;stroke:var(--color-alert-red,#ef5350);stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round;}
.rld-clean{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;}
.rld-on{stroke:var(--color-command-gold,#c8963e);stroke-width:2;stroke-dasharray:4 4;}
.rld-onlab{fill:var(--color-command-gold,#c8963e);font-family:var(--font-mono,"Space Mono",monospace);font-size:12px;font-weight:700;letter-spacing:.06em;}
.rld-flab{font-family:var(--font-mono,"Space Mono",monospace);font-size:13px;font-weight:700;}
.rld-flab-bad{fill:var(--color-alert-red,#ef5350);}
.rld-flab-ok{fill:var(--color-command-gold,#c8963e);}

/* phone reflow: two stacked cards */
.rld-cards{display:none;flex-direction:column;gap:.7rem;text-align:left;}
@container (max-width:520px){
  .rld-diagram{display:none;}
  .rld-cards{display:flex;}
}
.rld-card{border-radius:6px;padding:.75rem .85rem;}
.rld-card-bad{box-shadow:inset 0 0 0 1.5px var(--color-alert-red,#ef5350);}
.rld-card-ok{box-shadow:inset 0 0 0 2px var(--color-command-gold,#c8963e);}
.rld-ck{margin:0 0 .3rem;font-family:var(--font-display,"Bebas Neue",sans-serif);font-size:1.2rem;letter-spacing:.02em;}
.rld-card-bad .rld-ck{color:var(--color-alert-red,#ef5350);}
.rld-card-ok .rld-ck{color:var(--color-command-gold,#c8963e);}
.rld-svg-s{height:64px;margin:.15rem 0 .45rem;}
.rld-ct{margin:0;font-family:var(--font-serif,"Lora",serif);font-size:.9rem;line-height:1.4;color:var(--color-text,#e8e8e8);}

/* Tier-B reveal off the frame's armed/in contract. */
.dgfrm.armed .rld-card{opacity:0;transform:translateY(5px);}
.dgfrm.armed.in .rld-card{opacity:1;transform:none;transition:opacity .5s ease,transform .5s cubic-bezier(.2,.7,.2,1);}
@media (prefers-reduced-motion:reduce){.dgfrm .rld-card{opacity:1!important;transform:none!important;}}
`;
