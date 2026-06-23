// The driven-right-leg / bias loop as a responsive HTML component.
//
// Teaching point: the RLD is active negative feedback against mains hum. It
// senses the body's common-mode voltage (the average of the inputs), inverts and
// amplifies it, and drives that opposing signal back into the body through a bias
// electrode, nulling the hum at its source. A large series resistor in the drive
// path keeps the current tiny, so noise rejection and safety are solved together.
//
// Four stages forward, then a return path back to the body. Header/frame/caption
// from DiagramFrame. Brand palette: gold-dominant, Signal Blue for the return
// path, Navy Dark bodies. @theme tokens.
import { DiagramFrame } from "./DiagramFrame";

const STAGES = [
  { name: "Body", sub: "picks up hum" },
  { name: "Sense", sub: "the average" },
  { name: "Invert", sub: "the opposite" },
  { name: "Bias drive", sub: "back into body" },
];

export function RightLegDrive({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="EEG NOISE · RIGHT-LEG DRIVE"
      tone="gold"
      title="Cancel the hum at the source"
      ariaLabel="The driven-right-leg or bias loop is active negative feedback against mains hum. It senses the body's common-mode voltage (the average of the amplifier inputs), inverts and amplifies it, and drives that opposing signal back into the body through a bias electrode, nulling the hum where it enters. A large series resistor in the drive path limits the current to a safe level, so noise rejection and patient safety are designed together."
      caption={caption}
      defaultCaption="Active feedback beats passive grounding by tens of dB. A big series resistor keeps the drive current safe."
    >
      <style>{CSS}</style>

      <ol className="rld-flow">
        {STAGES.map((s, i) => (
          <li className="rld-cell" key={s.name}>
            <div className="rld-node">
              <p className="rld-name">{s.name}</p>
              <p className="rld-sub">{s.sub}</p>
            </div>
            {i < STAGES.length - 1 ? <span className="rld-arrow" aria-hidden="true">→</span> : null}
          </li>
        ))}
      </ol>

      <p className="rld-return">
        <span aria-hidden="true">↩ </span>the opposing voltage nulls the common-mode hum back at the body
      </p>

      <p className="rld-safety">series resistor limits the drive current · safety + noise, together</p>
    </DiagramFrame>
  );
}

const CSS = `
.rld-flow{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;align-items:stretch;justify-content:center;gap:.22rem;}
.rld-cell{display:flex;align-items:center;gap:.22rem;}
.rld-node{display:flex;flex-direction:column;justify-content:center;min-width:clamp(3.9rem,14vw,4.7rem);
  padding:clamp(.45rem,1.6vw,.62rem) clamp(.35rem,1.3vw,.5rem);text-align:center;border-radius:6px;
  background:var(--color-navy-dark,#1f2438);box-shadow:inset 0 0 0 1.5px var(--color-command-gold,#c8963e);}
.rld-name{margin:0;color:#fff;font-weight:700;font-size:clamp(.74rem,1.95vw,.86rem);line-height:1.12;}
.rld-sub{margin:.15rem 0 0;color:var(--color-muted,#aaa);
  font-family:var(--font-mono,"Space Mono",monospace);font-size:clamp(.58rem,1.55vw,.66rem);line-height:1.2;}
.rld-arrow{color:var(--color-command-gold,#c8963e);font-size:clamp(.82rem,2.1vw,1rem);font-weight:700;}
@media (max-width:30rem){.rld-flow{flex-direction:column;align-items:stretch;}.rld-cell{flex-direction:column;}.rld-node{min-width:0;}.rld-arrow{transform:rotate(90deg);}}

.rld-return{margin:clamp(.9rem,3vw,1.2rem) 0 0;padding:clamp(.55rem,2vw,.75rem) clamp(.7rem,2.5vw,.95rem);
  border-radius:6px;background:rgba(74,143,255,.08);box-shadow:inset 0 0 0 1.5px var(--color-signal-blue,#4a8fff);
  color:var(--color-gray-1,#e8e8e8);font-size:clamp(.82rem,2.2vw,.92rem);line-height:1.4;text-align:center;}
.rld-return span{color:var(--color-signal-blue,#4a8fff);font-weight:700;}
.rld-safety{margin:.7rem 0 0;text-align:center;color:var(--color-muted,#aaa);
  font-family:var(--font-mono,"Space Mono",monospace);font-size:clamp(.7rem,1.9vw,.78rem);letter-spacing:.02em;}

.dgfrm.armed .rld-cell,.dgfrm.armed .rld-return,.dgfrm.armed .rld-safety{opacity:0;transform:translateY(6px);}
.dgfrm.armed.in .rld-cell,.dgfrm.armed.in .rld-return,.dgfrm.armed.in .rld-safety{opacity:1;transform:none;transition:opacity .5s ease,transform .5s cubic-bezier(.2,.7,.2,1);}
.dgfrm.armed.in .rld-cell:nth-child(2){transition-delay:.07s;}
.dgfrm.armed.in .rld-cell:nth-child(3){transition-delay:.14s;}
.dgfrm.armed.in .rld-cell:nth-child(4){transition-delay:.21s;}
.dgfrm.armed.in .rld-return{transition-delay:.3s;}
.dgfrm.armed.in .rld-safety{transition-delay:.38s;}
@media (prefers-reduced-motion:reduce){.dgfrm .rld-cell,.dgfrm .rld-return,.dgfrm .rld-safety{opacity:1!important;transform:none!important;}}
`;
