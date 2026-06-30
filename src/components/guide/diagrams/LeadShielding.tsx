// Shielding + guarding an EEG lead, as a responsive HTML component.
//
// Teaching point: the 50/60 Hz mains electric field couples capacitively to a
// high-impedance electrode lead. A shield around the wire intercepts the field,
// and a unity-gain buffer DRIVES that shield at the lead's own common-mode
// voltage. With no voltage across the wire-to-shield capacitance, no pickup
// current flows through it, so the field is blocked while the signal stays
// unloaded. This driven shield is the right-leg-drive trick applied to the cable.
//
// Layered top-to-bottom (field → driven shield → protected wire) so the spatial
// "the shield sits between the field and the wire" reads at a glance. Header/
// frame/caption from DiagramFrame. Brand palette: gold-dominant shield, Signal
// Blue for the guard rule, Navy Dark bodies. @theme tokens.
import { DiagramFrame } from "./DiagramFrame";

export function LeadShielding({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="EEG NOISE · SHIELDING & GUARDING"
      tone="gold"
      title="Guard the lead against the field"
      ariaLabel="Shielding and guarding an EEG lead. The 50/60 Hz mains electric field couples capacitively to a high-impedance electrode lead. A shield around the wire intercepts the field, and a unity-gain buffer drives that shield at the lead's own common-mode voltage. With no voltage across the wire-to-shield capacitance, no pickup current flows through it, so the field is blocked while the signal stays unloaded. This driven shield is the same active-feedback trick as the right-leg drive, applied to the cable instead of the body."
      caption={caption}
      defaultCaption="A plain grounded shield loads the high-impedance lead; a driven shield blocks the field without loading it."
    >
      <style>{CSS}</style>

      <div className="ls-field">
        <p className="ls-fieldlabel">50/60 Hz mains field</p>
        <p className="ls-arrows" aria-hidden="true">
          <span>↓</span>
          <span>↓</span>
          <span>↓</span>
          <span>↓</span>
          <span>↓</span>
        </p>
      </div>

      <div className="ls-shield">
        <p className="ls-shieldname">Driven shield</p>
        <p className="ls-shieldsub">intercepts the field</p>
      </div>

      <div className="ls-wire">
        <p className="ls-wirename">Inner signal wire</p>
        <p className="ls-wiresub">electrode &rarr; amplifier &middot; high impedance, stays clean</p>
      </div>

      <p className="ls-guard">
        <span aria-hidden="true">↺ </span>a unity buffer holds the shield at the lead&rsquo;s own
        common-mode, so no voltage sits across the wire-to-shield gap and no
        pickup current flows
      </p>

      <p className="ls-takeaway">guarding = a driven shield · the right-leg drive, applied to the cable</p>
    </DiagramFrame>
  );
}

const CSS = `
.ls-field{text-align:center;}
.ls-fieldlabel{margin:0;color:var(--color-muted,#aaa);
  font-family:var(--font-mono,"Space Mono",monospace);letter-spacing:.04em;
  font-size:clamp(.72rem,1.95vw,.82rem);line-height:1.2;}
.ls-arrows{display:flex;justify-content:center;gap:clamp(1.1rem,7vw,2.4rem);margin:.3rem 0 0;}
.ls-arrows span{color:var(--color-command-gold,#c8963e);font-weight:700;
  font-size:clamp(1rem,2.6vw,1.25rem);line-height:1;}

.ls-shield{margin:.5rem 0 0;text-align:center;border-radius:6px;
  padding:clamp(.5rem,1.9vw,.7rem) clamp(.6rem,2.4vw,.9rem);
  background:var(--color-navy-dark,#1f2438);
  box-shadow:inset 0 0 0 2px var(--color-command-gold,#c8963e);}
.ls-shieldname{margin:0;color:#fff;font-weight:700;
  font-size:clamp(.95rem,2.7vw,1.15rem);line-height:1.12;}
.ls-shieldsub{margin:.18rem 0 0;color:var(--color-gold-light,#e8b865);
  font-family:var(--font-mono,"Space Mono",monospace);
  font-size:clamp(.62rem,1.7vw,.72rem);letter-spacing:.03em;line-height:1.2;}

.ls-wire{margin:.45rem 0 0;text-align:center;border-radius:6px;
  padding:clamp(.5rem,1.9vw,.7rem) clamp(.6rem,2.4vw,.9rem);
  background:var(--color-navy-dark,#1f2438);
  box-shadow:inset 0 0 0 1.5px var(--color-panel-border,#3a3f50);}
.ls-wirename{margin:0;color:var(--color-gray-1,#e8e8e8);font-weight:700;
  font-size:clamp(.86rem,2.4vw,1rem);line-height:1.12;}
.ls-wiresub{margin:.18rem 0 0;color:var(--color-muted,#aaa);
  font-family:var(--font-mono,"Space Mono",monospace);
  font-size:clamp(.62rem,1.7vw,.72rem);line-height:1.25;}

.ls-guard{margin:clamp(.9rem,3vw,1.2rem) 0 0;
  padding:clamp(.55rem,2vw,.75rem) clamp(.7rem,2.5vw,.95rem);border-radius:6px;
  background:rgba(74,143,255,.08);box-shadow:inset 0 0 0 1.5px var(--color-signal-blue,#4a8fff);
  color:var(--color-gray-1,#e8e8e8);font-size:clamp(.82rem,2.2vw,.92rem);
  line-height:1.4;text-align:center;}
.ls-guard span{color:var(--color-signal-blue,#4a8fff);font-weight:700;}

.ls-takeaway{margin:.7rem 0 0;text-align:center;color:var(--color-muted,#aaa);
  font-family:var(--font-mono,"Space Mono",monospace);
  font-size:clamp(.7rem,1.9vw,.78rem);letter-spacing:.02em;line-height:1.3;}

.dgfrm.armed .ls-field,.dgfrm.armed .ls-shield,.dgfrm.armed .ls-wire,.dgfrm.armed .ls-guard,.dgfrm.armed .ls-takeaway{opacity:0;transform:translateY(6px);}
.dgfrm.armed.in .ls-field,.dgfrm.armed.in .ls-shield,.dgfrm.armed.in .ls-wire,.dgfrm.armed.in .ls-guard,.dgfrm.armed.in .ls-takeaway{opacity:1;transform:none;transition:opacity .5s ease,transform .5s cubic-bezier(.2,.7,.2,1);}
.dgfrm.armed.in .ls-shield{transition-delay:.08s;}
.dgfrm.armed.in .ls-wire{transition-delay:.16s;}
.dgfrm.armed.in .ls-guard{transition-delay:.26s;}
.dgfrm.armed.in .ls-takeaway{transition-delay:.34s;}
@media (prefers-reduced-motion:reduce){.dgfrm .ls-field,.dgfrm .ls-shield,.dgfrm .ls-wire,.dgfrm .ls-guard,.dgfrm .ls-takeaway{opacity:1!important;transform:none!important;}}
`;
