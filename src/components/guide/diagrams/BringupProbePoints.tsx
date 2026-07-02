// Bring-up "rail probe points" as a responsive v2 diagram: a multimeter reading
// 3.30 V beside the two probe points.
//
// Teaching point: with the board powered, probe 3.3 V at TP1 with the red lead
// and ground at TP2 with the black lead; a steady 3.30 V in DC-volts mode means
// the rail is good.
//
// v2: landscape — the meter (hero, reading 3.30 V) on the left, the two probe
// points on the right; stacks on a phone. Token-only color; alert red marks the
// live 3V3 rail / red lead, muted gray the GND / black lead.
import { DiagramFrame } from "./DiagramFrame";

export function BringupProbePoints({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="BRING-UP · RAILS FIRST"
      tone="gold"
      title="Probe the 3.3 V rail first"
      ariaLabel="Bring-up: with the board powered, probe 3.3 V at TP1 with the red lead and ground at TP2 with the black lead; the multimeter in DC volts reads 3.30 V."
      caption={caption}
      defaultCaption="A steady 3.30 V means the rail is good; now you can trust everything it feeds."
    >
      <style>{CSS}</style>
      <div className="bpp">
        <div className="bpp-meter">
          <div className="bpp-lcd">
            <span className="bpp-value">3.30</span>
            <span className="bpp-unit">V</span>
          </div>
          <div className="bpp-mode">DMM · DC volts</div>
        </div>

        <div className="bpp-rows">
          <div className="bpp-row bpp-row--red">
            <span className="bpp-dot bpp-dot--red" aria-hidden="true" />
            <span className="bpp-tp">TP1 · 3V3</span>
            <span className="bpp-lead">red lead</span>
          </div>
          <div className="bpp-row bpp-row--gnd">
            <span className="bpp-dot bpp-dot--gnd" aria-hidden="true" />
            <span className="bpp-tp">TP2 · GND</span>
            <span className="bpp-lead">black lead</span>
          </div>
          <p className="bpp-verdict">✓ steady 3.30 V, the rail is good</p>
        </div>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.bpp{display:flex;align-items:center;gap:clamp(1rem,4vw,1.9rem);text-align:left;font-family:var(--font-mono,"Space Mono",monospace);}
@media (max-width:520px){.bpp{flex-direction:column;}}

.bpp-meter{flex:0 0 auto;display:flex;flex-direction:column;gap:.55rem;align-items:center;
  background:var(--color-diagram-surface,#1f2438);border:1.5px solid var(--color-command-gold,#c8963e);
  border-radius:10px;padding:clamp(.85rem,3vw,1.15rem);}
@media (max-width:520px){.bpp-meter{align-self:stretch;}}
.bpp-lcd{background:var(--color-deep-space,#08090d);border:1px solid var(--color-panel-border,#3a3f50);
  border-radius:5px;padding:.3rem 1.1rem;display:flex;align-items:baseline;gap:.3rem;min-width:8rem;justify-content:flex-end;}
.bpp-value{color:var(--color-title,#f1ece0);font-family:var(--font-numeral,"Saira Condensed",sans-serif);
  font-weight:700;font-size:clamp(2.2rem,8vw,3rem);line-height:1;letter-spacing:.02em;}
.bpp-unit{color:var(--color-text,#e8e8e8);font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:700;font-size:clamp(1.1rem,3.5vw,1.4rem);}
.bpp-mode{color:var(--color-muted,#aaa);font-size:clamp(.78rem,2.1vw,.88rem);letter-spacing:.06em;}

.bpp-rows{flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:.6rem;}
.bpp-row{display:flex;align-items:center;gap:.65rem;border-radius:6px;padding:.6rem .8rem;
  background:var(--color-diagram-surface,#1f2438);}
.bpp-row--red{box-shadow:inset 0 0 0 1px var(--color-panel-border,#3a3f50),inset 3px 0 0 var(--color-alert-red,#ef5350);}
.bpp-row--gnd{box-shadow:inset 0 0 0 1px var(--color-panel-border,#3a3f50),inset 3px 0 0 var(--color-muted,#aaa);}
.bpp-dot{flex:none;width:14px;height:14px;border-radius:50%;}
.bpp-dot--red{background:var(--color-alert-red,#ef5350);}
.bpp-dot--gnd{background:var(--color-muted,#aaa);}
.bpp-tp{font-weight:700;font-size:clamp(1.05rem,2.9vw,1.25rem);color:var(--color-title,#f1ece0);letter-spacing:.02em;}
.bpp-lead{margin-left:auto;color:var(--color-muted,#aaa);font-size:clamp(.82rem,2.2vw,.92rem);}
.bpp-verdict{margin:.15rem 0 0;color:var(--color-command-gold,#c8963e);font-weight:700;font-size:clamp(.85rem,2.3vw,.95rem);}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .bpp-meter,.dgfrm.armed .bpp-row,.dgfrm.armed .bpp-verdict{opacity:0;transform:translateY(6px);}
.dgfrm.armed.in .bpp-meter{opacity:1;transform:none;transition:opacity .55s ease,transform .55s cubic-bezier(.2,.7,.2,1);}
.dgfrm.armed.in .bpp-row,.dgfrm.armed.in .bpp-verdict{opacity:1;transform:none;transition:opacity .5s ease,transform .5s ease;}
.dgfrm.armed.in .bpp-row--gnd{transition-delay:.1s;}
.dgfrm.armed.in .bpp-verdict{transition-delay:.2s;}
@media (prefers-reduced-motion:reduce){.dgfrm .bpp-meter,.dgfrm .bpp-row,.dgfrm .bpp-verdict{opacity:1!important;transform:none!important;transition:none!important;}}
`;
