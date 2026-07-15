// Contralateral mu-rhythm ERD as a responsive diagram (v2).
//
// Teaching point: when you imagine moving one hand, the mu rhythm over the
// OPPOSITE hemisphere drops in amplitude (event-related desynchronization). Here
// the scenario is "imagine the LEFT hand", so C4 (right sensorimotor) goes quiet
// while C3 (left sensorimotor) keeps idling at full amplitude. Read which side
// dropped and you know which hand was imagined.
//
// v2: two oscilloscope screens side by side — C3 idling loud (gold), C4
// desynchronized flat (the ERD side, blue-framed) — landscape on desktop/print,
// stacking on a narrow phone (directive 1). Token-only color via CSS classes; the
// drop reads from amplitude alone, so both traces stay gold and the frame colour
// carries the "which one quieted" signal.
import { DiagramFrame } from "./DiagramFrame";

function sine(x0: number, x1: number, cy: number, amp: number, cycles: number, step = 2): string {
  const pts: string[] = [];
  for (let x = x0; x <= x1; x += step) {
    const t = (x - x0) / (x1 - x0);
    pts.push(`${x},${(cy - amp * Math.sin(t * cycles * 2 * Math.PI)).toFixed(1)}`);
  }
  return "M" + pts.join(" L");
}

const LOUD = sine(8, 232, 42, 30, 7); // mu idling — full ~10 Hz amplitude
const QUIET = sine(8, 232, 42, 4.5, 7); // desynchronized — flattened (ERD)

function Scope({ d }: { d: string }) {
  return (
    <svg className="muerd-scope-svg" viewBox="0 0 240 84" preserveAspectRatio="none" aria-hidden="true">
      <line className="muerd-base" x1="8" y1="42" x2="232" y2="42" />
      <path className="muerd-trace" d={d} vectorEffect="non-scaling-stroke" />
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

      <p className="muerd-scenario">Scenario: imagining the <b>left</b> hand</p>

      <div className="muerd-grid">
        {/* C3 — left hemisphere, SAME side as the imagined hand: idles loud */}
        <div className="muerd-chan">
          <p className="muerd-site"><b>C3</b> <span>left sensorimotor</span></p>
          <div className="muerd-scope muerd-scope-c3"><Scope d={LOUD} /></div>
          <p className="muerd-tag muerd-tag-hi">mu power: HIGH · idling</p>
        </div>

        {/* C4 — right hemisphere, OPPOSITE the imagined left hand: desynchronizes */}
        <div className="muerd-chan">
          <p className="muerd-site"><b>C4</b> <span>right sensorimotor</span></p>
          <div className="muerd-scope muerd-scope-c4"><Scope d={QUIET} /></div>
          <p className="muerd-tag muerd-tag-erd">mu power: DROPPED · ERD</p>
        </div>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.muerd-scenario{margin:0 0 clamp(1rem,3.5vw,1.4rem);color:var(--color-muted,#aaa);
  font-size:clamp(.85rem,2.3vw,.95rem);letter-spacing:.03em;}
.muerd-scenario b{color:var(--color-title,#f1ece0);font-weight:700;}

.muerd-grid{display:grid;grid-template-columns:1fr 1fr;gap:clamp(.8rem,2.6vw,1.15rem);text-align:left;}
@container (max-width:520px){.muerd-grid{grid-template-columns:1fr;}}

.muerd-chan{display:flex;flex-direction:column;gap:.5rem;}
.muerd-site{margin:0;color:var(--color-muted,#aaa);font-family:var(--font-mono,"Space Mono",monospace);
  font-size:clamp(.78rem,2.1vw,.88rem);}
.muerd-site b{color:var(--color-title,#f1ece0);font-size:clamp(1.1rem,3.1vw,1.3rem);letter-spacing:.02em;margin-right:.35rem;}

/* the oscilloscope screen */
.muerd-scope{border-radius:7px;padding:.35rem .5rem;
  background:color-mix(in srgb,var(--color-command-gold,#c8963e) 5%,var(--color-diagram-surface,#1f2438));}
.muerd-scope-c3{box-shadow:inset 0 0 0 2px var(--color-command-gold,#c8963e);}
.muerd-scope-c4{box-shadow:inset 0 0 0 2px var(--color-signal-blue,#4a8fff);
  background:color-mix(in srgb,var(--color-signal-blue,#4a8fff) 6%,var(--color-diagram-surface,#1f2438));}
.muerd-scope-svg{display:block;width:100%;height:clamp(3.2rem,12vw,4rem);overflow:hidden;}
.muerd-base{stroke:var(--color-panel-border,#3a3f50);stroke-width:1;}
.muerd-trace{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}

.muerd-tag{margin:0;align-self:flex-start;font-family:var(--font-mono,"Space Mono",monospace);
  font-size:clamp(.72rem,2vw,.8rem);font-weight:700;letter-spacing:.03em;padding:.22rem .5rem;border-radius:3px;}
.muerd-tag-hi{color:var(--color-command-gold,#c8963e);box-shadow:inset 0 0 0 1px var(--color-command-gold,#c8963e);}
.muerd-tag-erd{color:var(--color-signal-blue,#4a8fff);box-shadow:inset 0 0 0 1px var(--color-signal-blue,#4a8fff);}

/* Tier-B reveal off the frame's armed/in contract: the C4 trace collapses in. */
.dgfrm.armed .muerd-scope-c4 .muerd-trace{transform:scaleY(6.5);transform-origin:center;}
.dgfrm.armed.in .muerd-scope-c4 .muerd-trace{transform:scaleY(1);
  transition:transform .7s cubic-bezier(.2,.7,.2,1);transition-delay:.35s;}
.dgfrm.armed .muerd-chan{opacity:0;transform:translateY(5px);}
.dgfrm.armed.in .muerd-chan{opacity:1;transform:none;transition:opacity .5s ease,transform .5s cubic-bezier(.2,.7,.2,1);}
.dgfrm.armed.in .muerd-chan:nth-child(2){transition-delay:.1s;}
@media (prefers-reduced-motion:reduce){
  .dgfrm .muerd-chan{opacity:1!important;transform:none!important;}
  .dgfrm .muerd-scope-c4 .muerd-trace{transform:none!important;}
}
`;
