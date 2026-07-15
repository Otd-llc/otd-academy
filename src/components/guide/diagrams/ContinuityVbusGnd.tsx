// VBUS-to-GND continuity (short) check as a responsive v2 diagram: a multimeter
// reading OL beside the two verdicts.
//
// Teaching point: before any power, with the board unplugged and the meter in
// continuity mode, probe VBUS to GND. It must read OL with no beep (open). A
// beep means a dead short: stop and fix it before plugging in.
//
// v2: landscape — the meter (hero, reading OL, no-beep icon) on the left, the
// two outcomes on the right; stacks on a phone. Token-only color; alert red is
// reserved for the BEEP (dead-short) failure.
import { DiagramFrame } from "./DiagramFrame";

export function ContinuityVbusGnd({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="BEFORE POWER · UNPLUGGED · CONTINUITY MODE"
      tone="green"
      title="VBUS-to-GND must not beep"
      ariaLabel="Before any power: with the board unplugged and the meter in continuity mode, touch one probe to the VBUS pad and the other to the GND pad. The meter must read OL with no beep, meaning open. A beep means a dead short; stop and fix it before plugging in."
      caption={caption}
      defaultCaption="Probe VBUS to GND before any power: it must read OL, not beep."
    >
      <style>{CSS}</style>
      <div className="cvg">
        <div className="cvg-meter">
          <div className="cvg-lcd"><span className="cvg-ol">OL</span></div>
          <div className="cvg-mode">
            <svg className="cvg-spk" viewBox="0 0 40 32" aria-hidden="true">
              <path d="M4,12 h6 l8,-7 v22 l-8,-7 h-6 Z" />
              <line x1="22" y1="8" x2="36" y2="24" />
            </svg>
            continuity mode · no beep
          </div>
        </div>

        <div className="cvg-verdicts">
          <div className="cvg-v cvg-ok">
            <span className="cvg-tag">OL · NO BEEP</span>
            <span className="cvg-vtext">Open circuit. VBUS and GND aren&apos;t connected, exactly what you want.</span>
          </div>
          <div className="cvg-v cvg-bad">
            <span className="cvg-tag">BEEP</span>
            <span className="cvg-vtext">Dead short. Stop, don&apos;t plug in. Find and fix it first.</span>
          </div>
        </div>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.cvg{display:flex;align-items:center;gap:clamp(1rem,4vw,1.8rem);text-align:left;font-family:var(--font-mono,"Space Mono",monospace);}
@container (max-width:520px){.cvg{flex-direction:column;}}

.cvg-meter{flex:0 0 auto;display:flex;flex-direction:column;gap:.55rem;align-items:center;
  background:var(--color-diagram-surface,#1f2438);border:1.5px solid var(--color-command-gold,#c8963e);
  border-radius:10px;padding:clamp(.85rem,3vw,1.1rem);}
@container (max-width:520px){.cvg-meter{align-self:stretch;}}
.cvg-lcd{background:var(--color-deep-space,#08090d);border:1px solid var(--color-panel-border,#3a3f50);
  border-radius:5px;padding:.3rem 1.4rem;text-align:right;min-width:9rem;}
.cvg-ol{color:var(--color-text,#e8e8e8);font-family:var(--font-numeral,"Saira Condensed",sans-serif);
  font-weight:700;font-size:clamp(2.2rem,8vw,3rem);letter-spacing:.06em;}
.cvg-mode{display:flex;align-items:center;gap:.45rem;color:var(--color-muted,#aaa);font-size:clamp(.78rem,2.1vw,.88rem);}
.cvg-spk{width:26px;height:auto;flex:none;}
.cvg-spk path{fill:var(--color-command-gold,#c8963e);}
.cvg-spk line{stroke:var(--color-command-gold,#c8963e);stroke-width:2.4;}

.cvg-verdicts{flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:.65rem;}
.cvg-v{display:flex;flex-direction:column;align-items:flex-start;gap:.35rem;border-radius:6px;padding:.65rem .85rem;
  background:var(--color-diagram-surface,#1f2438);}
.cvg-ok{box-shadow:inset 0 0 0 1px var(--color-panel-border,#3a3f50),inset 3px 0 0 var(--color-command-gold,#c8963e);}
.cvg-bad{box-shadow:inset 0 0 0 1px var(--color-panel-border,#3a3f50),inset 3px 0 0 var(--color-alert-red,#ef5350);}
.cvg-tag{flex:none;font-weight:700;font-size:.66rem;letter-spacing:.08em;padding:.2rem .5rem;border-radius:4px;white-space:nowrap;}
.cvg-ok .cvg-tag{color:var(--color-command-gold,#c8963e);box-shadow:inset 0 0 0 1px var(--color-command-gold,#c8963e);}
.cvg-bad .cvg-tag{color:var(--color-title,#f1ece0);background:var(--color-alert-red,#ef5350);}
.cvg-vtext{min-width:0;color:var(--color-text,#e8e8e8);font-family:var(--font-serif,"Lora",serif);
  font-size:clamp(.9rem,2.4vw,1rem);line-height:1.4;}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .cvg-meter,.dgfrm.armed .cvg-v{opacity:0;transform:translateY(6px);}
.dgfrm.armed.in .cvg-meter{opacity:1;transform:none;transition:opacity .55s ease,transform .55s cubic-bezier(.2,.7,.2,1);}
.dgfrm.armed.in .cvg-v{opacity:1;transform:none;transition:opacity .5s ease,transform .5s ease;}
.dgfrm.armed.in .cvg-ok{transition-delay:.12s;}
.dgfrm.armed.in .cvg-bad{transition-delay:.22s;}
@media (prefers-reduced-motion:reduce){.dgfrm .cvg-meter,.dgfrm .cvg-v{opacity:1!important;transform:none!important;transition:none!important;}}
`;
