// Shielding + guarding an EEG lead, as a responsive diagram (v2).
//
// Teaching point: the 50/60 Hz mains E-field couples capacitively to a high-Z
// electrode lead. A shield intercepts it, but HOW you terminate the shield
// matters. A plain GROUNDED shield ties the wire-to-shield capacitance to ground
// and LOADS the high-impedance lead, so the microvolt signal droops. A DRIVEN
// shield is held by a unity buffer at the lead's own common-mode: no voltage sits
// across the wire-to-shield gap, so no pickup current flows AND no load is placed
// on the lead. Guarding = the right-leg drive, applied to the cable.
//
// v2: two coax cross-sections side by side (grounded vs driven) on desktop/print
// (~1.5 landscape), reflowing to two stacked rows on a narrow phone (real px) per
// directive 1. Token-only color via CSS classes. The GROUNDED shield is drawn
// MUTED (passive), the DRIVEN shield GOLD (active); blue marks the guard buffer.
// Red is NOT used (loading is a performance loss, not a hazard).
import { DiagramFrame } from "./DiagramFrame";

export function LeadShielding({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="EEG NOISE · SHIELDING & GUARDING"
      tone="gold"
      title="Guard the lead against the field"
      ariaLabel="Shielding and guarding an EEG lead, shown as two coaxial cross-sections. On the left, a plain grounded shield: the shield is tied to ground, so the wire-to-shield capacitance loads the high-impedance lead and the microvolt signal droops. On the right, a driven shield: a unity-gain buffer holds the shield at the lead's own common-mode voltage, so no voltage sits across the wire-to-shield gap, no pickup current flows, and no load is placed on the lead, so the signal stays clean. A driven shield is the same active-feedback trick as the right-leg drive, applied to the cable instead of the body."
      caption={caption}
      defaultCaption="A plain grounded shield loads the high-impedance lead; a driven shield blocks the field without loading it."
    >
      <style>{CSS}</style>

      <div className="lsh">
        {/* desktop / print: two coax cross-sections */}
        <div className="lsh-diagram">
          <svg className="lsh-svg" viewBox="0 0 560 200" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {/* ── GROUNDED (left, passive = muted) ── */}
            <text className="lsh-h lsh-h-mut" x="140" y="18" textAnchor="middle">GROUNDED SHIELD</text>
            <circle className="lsh-ring-mut" cx="140" cy="96" r="48" />
            <circle className="lsh-diel" cx="140" cy="96" r="31" />
            <circle className="lsh-wire-mut" cx="140" cy="96" r="10" />
            {/* ground connection */}
            <line className="lsh-lead-mut" x1="140" y1="144" x2="140" y2="160" />
            <g className="lsh-gnd">
              <line x1="126" y1="160" x2="154" y2="160" />
              <line x1="131" y1="166" x2="149" y2="166" />
              <line x1="136" y1="172" x2="144" y2="172" />
            </g>
            <text className="lsh-f lsh-f-mut" x="140" y="196" textAnchor="middle">loads the lead · signal droops</text>

            <line className="lsh-div" x1="280" y1="14" x2="280" y2="186" />

            {/* ── DRIVEN (right, active = gold) ── */}
            <text className="lsh-h lsh-h-gold" x="420" y="18" textAnchor="middle">DRIVEN SHIELD</text>
            <circle className="lsh-ring-gold" cx="420" cy="96" r="48" />
            <circle className="lsh-diel" cx="420" cy="96" r="31" />
            <circle className="lsh-wire-gold" cx="420" cy="96" r="10" />
            {/* unity buffer holding the shield at the lead's common-mode */}
            <path className="lsh-tri" d="M486,74 L516,90 L486,106 Z" />
            <text className="lsh-x" x="495" y="94" textAnchor="middle">×1</text>
            <path className="lsh-fb" d="M486,90 H470 V118 H420" />
            <path className="lsh-fb" d="M516,90 H532 V60 H420 V50" />
            <text className="lsh-f lsh-f-gold" x="416" y="196" textAnchor="middle">blocks the field · no load</text>
          </svg>
        </div>

        {/* phone: two stacked rows */}
        <div className="lsh-rows" aria-hidden="true">
          <div className="lsh-row lsh-row-mut">
            <p className="lsh-rk">Grounded shield</p>
            <p className="lsh-rt">Ties the wire-to-shield capacitance to ground. It <b>loads</b> the high-Z lead, so the µV signal <b>droops</b>.</p>
          </div>
          <div className="lsh-row lsh-row-gold">
            <p className="lsh-rk">Driven shield</p>
            <p className="lsh-rt">A ×1 buffer holds the shield at the lead's own common-mode. <b>No ΔV</b> across the gap → <b>no pickup, no load</b>. Signal stays clean.</p>
          </div>
        </div>

        <p className="lsh-take">guarding = a driven shield · the right-leg drive, applied to the cable</p>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.lsh-svg{overflow:visible;width:100%;height:auto;display:block;}
.lsh-ring-mut{fill:none;stroke:var(--color-muted,#aaa);stroke-width:5;}
.lsh-ring-gold{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:6;}
.lsh-diel{fill:none;stroke:var(--color-panel-border,#3a3f50);stroke-width:9;opacity:.45;}
.lsh-wire-mut{fill:var(--color-muted,#aaa);}
.lsh-wire-gold{fill:var(--color-gold-light,#e8b865);}
.lsh-lead-mut{stroke:var(--color-muted,#aaa);stroke-width:2;}
.lsh-gnd line{stroke:var(--color-muted,#aaa);stroke-width:2;}
.lsh-div{stroke:var(--color-panel-border,#3a3f50);stroke-width:1;}
.lsh-tri{fill:var(--color-deep-space,#08090d);stroke:var(--color-signal-blue,#4a8fff);stroke-width:2;}
.lsh-x{fill:var(--color-signal-blue,#4a8fff);font-family:var(--font-mono,"Space Mono",monospace);font-size:11px;font-weight:700;}
.lsh-fb{fill:none;stroke:var(--color-signal-blue,#4a8fff);stroke-width:2;}
.lsh-h{font-family:var(--font-mono,"Space Mono",monospace);font-size:13px;font-weight:700;letter-spacing:.06em;}
.lsh-h-mut{fill:var(--color-muted,#aaa);}
.lsh-h-gold{fill:var(--color-command-gold,#c8963e);}
.lsh-f{font-family:var(--font-mono,"Space Mono",monospace);font-size:13px;}
.lsh-f-mut{fill:var(--color-muted,#aaa);}
.lsh-f-gold{fill:var(--color-command-gold,#c8963e);}

/* phone reflow: two stacked rows */
.lsh-rows{display:none;flex-direction:column;gap:.6rem;text-align:left;}
@media (max-width:520px){
  .lsh-diagram{display:none;}
  .lsh-rows{display:flex;}
}
.lsh-row{border-radius:6px;padding:.75rem .85rem;background:var(--color-navy-dark,#1f2438);}
.lsh-row-mut{box-shadow:inset 0 0 0 1.5px var(--color-panel-border,#3a3f50);}
.lsh-row-gold{box-shadow:inset 0 0 0 2px var(--color-command-gold,#c8963e);}
.lsh-rk{margin:0 0 .2rem;font-family:var(--font-display,"Bebas Neue",sans-serif);font-size:1.2rem;letter-spacing:.02em;}
.lsh-row-mut .lsh-rk{color:var(--color-muted,#aaa);}
.lsh-row-gold .lsh-rk{color:var(--color-command-gold,#c8963e);}
.lsh-rt{margin:0;font-family:var(--font-serif,"Lora",serif);font-size:.92rem;line-height:1.4;color:var(--color-text,#e8e8e8);}
.lsh-rt b{color:var(--color-title,#f1ece0);}

.lsh-take{margin:clamp(.9rem,3vw,1.15rem) 0 0;text-align:center;color:var(--color-muted,#aaa);
  font-family:var(--font-mono,"Space Mono",monospace);font-size:clamp(.72rem,1.9vw,.8rem);letter-spacing:.02em;line-height:1.3;}

/* Tier-B reveal off the frame's armed/in contract; gated so reduced-motion /
   no-JS / exporter shows the final state. */
.dgfrm.armed .lsh-row,.dgfrm.armed .lsh-take{opacity:0;transform:translateY(5px);}
.dgfrm.armed.in .lsh-row,.dgfrm.armed.in .lsh-take{opacity:1;transform:none;transition:opacity .5s ease,transform .5s cubic-bezier(.2,.7,.2,1);}
@media (prefers-reduced-motion:reduce){.dgfrm .lsh-row,.dgfrm .lsh-take{opacity:1!important;transform:none!important;}}
`;
