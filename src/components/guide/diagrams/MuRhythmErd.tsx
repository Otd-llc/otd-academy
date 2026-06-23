// Contralateral mu-rhythm ERD as a responsive HTML component.
//
// Teaching point: when you imagine moving one hand, the mu rhythm over the
// OPPOSITE hemisphere drops in amplitude (event-related desynchronization). Here
// the scenario is "imagine the LEFT hand", so C4 (right sensorimotor) goes quiet
// while C3 (left sensorimotor) keeps idling at full amplitude. Read which side
// dropped and you know which hand was imagined.
//
// Why not a flat SVG: the channel LABELS and power chips must stay accessible on
// a ~360px phone, so they're real HTML px (clamped) that don't scale with the
// viewport. Only the two EEG traces are decorative SVG (pure graphic, no text).
// Header / frame / caption come from the shared DiagramFrame (Bebas title); brand
// palette (onethousanddrones.com/brand): gold-dominant on Deep Space, Navy Dark
// bodies, Signal Blue as the secondary "at rest" accent. All colours via @theme.
import { DiagramFrame } from "./DiagramFrame";

// Deterministic, SSR-safe sine polyline over [0,W]. `amp` = peak deviation from
// the mid-line; a loud (idling) rhythm has large amp, a desynchronized one is
// nearly flat. No randomness — same output on server, client, and the exporter.
function sinePath(W: number, H: number, amp: number, cycles: number, step = 3): string {
  const mid = H / 2;
  const pts: string[] = [];
  for (let x = 0; x <= W; x += step) {
    const y = mid - amp * Math.sin((x / W) * cycles * 2 * Math.PI);
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return "M" + pts.join(" L");
}

const W = 300;
const H = 54;
const LOUD = sinePath(W, H, 21, 8); // mu rhythm idling — full ~10 Hz amplitude
const QUIET = sinePath(W, H, 3, 8); // desynchronized — flattened (ERD)

function Trace({ d, tone }: { d: string; tone: "loud" | "quiet" }) {
  return (
    <svg
      className={`muerd-trace muerd-trace-${tone}`}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} fill="none" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function MuRhythmErd({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="MOTOR IMAGERY · ERD"
      tone="gold"
      title="Which side goes quiet?"
      ariaLabel="Contralateral mu-rhythm desynchronization: when a person imagines moving their left hand, the mu rhythm over the right sensorimotor cortex (electrode C4) drops in amplitude in an event-related desynchronization, while the left-hemisphere rhythm at electrode C3 keeps idling at full amplitude. Detecting which side quieted reveals which hand was imagined."
      caption={caption}
      defaultCaption="The hemisphere opposite the imagined hand goes quiet. Read which side dropped, and you know which hand."
    >
      <style>{CSS}</style>

      <p className="muerd-scenario">
        Scenario: imagining the <b>left</b> hand
      </p>

      <div className="muerd-grid">
        {/* C3 — left hemisphere, SAME side as the imagined hand: stays idling */}
        <div className="muerd-chan">
          <div className="muerd-meta">
            <p className="muerd-site">C3</p>
            <p className="muerd-where">left sensorimotor</p>
          </div>
          <Trace d={LOUD} tone="loud" />
          <p className="muerd-chip muerd-chip-rest">mu power: HIGH · idling</p>
        </div>

        {/* C4 — right hemisphere, OPPOSITE the imagined left hand: desynchronizes */}
        <div className="muerd-chan muerd-chan-active">
          <div className="muerd-meta">
            <p className="muerd-site">C4</p>
            <p className="muerd-where">right sensorimotor</p>
          </div>
          <Trace d={QUIET} tone="quiet" />
          <p className="muerd-chip muerd-chip-erd">mu power: DROPPED · ERD</p>
        </div>
      </div>
    </DiagramFrame>
  );
}

// Unique `muerd-` prefix so styles never collide with other diagrams on a page.
// Token-driven with literal fallbacks so a standalone/exporter render resolves.
const CSS = `
.muerd-scenario{margin:0 0 clamp(1rem,3.5vw,1.4rem);color:var(--color-muted,#aaa);
  font-size:clamp(.85rem,2.3vw,.95rem);letter-spacing:.04em;}
.muerd-scenario b{color:var(--color-gray-1,#e8e8e8);font-weight:700;}

.muerd-grid{display:grid;grid-template-columns:1fr 1fr;gap:clamp(.7rem,2.5vw,1rem);text-align:left;}
@media (max-width:30rem){.muerd-grid{grid-template-columns:1fr;}}

.muerd-chan{display:flex;flex-direction:column;gap:.55rem;
  background:var(--color-navy-dark,#1f2438);border:1px solid var(--color-panel-border,#3a3f50);
  border-radius:6px;padding:clamp(.7rem,2.5vw,.95rem);}
.muerd-chan-active{box-shadow:inset 0 0 0 2px var(--color-command-gold,#c8963e);}

.muerd-meta{display:flex;align-items:baseline;gap:.5rem;}
.muerd-site{margin:0;color:#fff;font-weight:700;font-size:clamp(1.1rem,3.2vw,1.35rem);letter-spacing:.02em;}
.muerd-where{margin:0;color:var(--color-muted,#aaa);font-size:clamp(.78rem,2.1vw,.88rem);}

.muerd-trace{display:block;width:100%;height:clamp(2.4rem,9vw,3rem);}
.muerd-trace path{stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}
/* Both traces are gold (the mu rhythm); the DROP reads from amplitude alone, so
   gold stays dominant and the flattened C4 wave is the whole story. The quiet
   trace is dimmed to underline "gone quiet". Blue is reserved for the secondary
   at-rest "idling" chip only. */
.muerd-trace-loud path{stroke:var(--color-command-gold,#c8963e);}
.muerd-trace-quiet path{stroke:var(--color-command-gold,#c8963e);opacity:.55;}

.muerd-chip{margin:0;align-self:flex-start;font-size:clamp(.72rem,2vw,.8rem);font-weight:700;
  letter-spacing:.04em;padding:.22rem .5rem;border-radius:3px;}
.muerd-chip-rest{color:var(--color-signal-blue,#4a8fff);
  box-shadow:inset 0 0 0 1px var(--color-signal-blue,#4a8fff);}
.muerd-chip-erd{color:var(--color-command-gold,#c8963e);
  box-shadow:inset 0 0 0 1px var(--color-command-gold,#c8963e);}

/* Tier-B reveal off the frame's armed/in contract (animation-standards.md): the
   C4 trace starts at full idling amplitude and collapses to the flat ERD state,
   so the drop itself is what animates. Gated behind .armed, so a reduced-motion /
   no-JS / exporter render shows the final flattened state — never mid-animation. */
.dgfrm.armed .muerd-trace-quiet path{transform:scaleY(7);transform-origin:center;}
.dgfrm.armed.in .muerd-trace-quiet path{transform:scaleY(1);
  transition:transform .7s cubic-bezier(.2,.7,.2,1);transition-delay:.35s;}
@media (prefers-reduced-motion:reduce){
  .dgfrm .muerd-trace-quiet path{transform:none!important;}
}
`;
