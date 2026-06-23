// The brain-computer interface loop as a responsive HTML component.
//
// Teaching point: every BCI is the same loop — MEASURE the brain signal, DECODE
// it into an intent, issue a COMMAND, and a DEVICE acts; then FEEDBACK closes the
// loop, because the user gets better at producing clean, classifiable states by
// seeing the result. The feedback return is what makes a BCI as much skill as
// hardware, so it is drawn as a distinct path, not just another forward box.
//
// Header/frame/caption from DiagramFrame. Brand palette: gold-dominant forward
// chain, Signal Blue feedback return. @theme tokens.
import { DiagramFrame } from "./DiagramFrame";

const STAGES = [
  { name: "Measure", sub: "the brain signal" },
  { name: "Decode", sub: "into an intent" },
  { name: "Command", sub: "issue it" },
  { name: "Device", sub: "acts" },
];

export function BciLoop({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="WHAT IS A BCI"
      tone="gold"
      title="Measure, decode, command, repeat"
      ariaLabel="Every brain-computer interface is the same loop: measure the brain signal, decode it into an intent, issue a command, and a device acts on it. Then feedback closes the loop: the user sees the result and adapts, getting better at producing clean, classifiable brain states. That feedback return is why a BCI is as much a learned skill as it is hardware."
      caption={caption}
      defaultCaption="The feedback return is the point: users learn to produce cleaner brain states by seeing the result. A BCI is skill plus hardware."
    >
      <style>{CSS}</style>

      <ol className="bci">
        {STAGES.map((s, i) => (
          <li className="bci-cell" key={s.name}>
            <div className="bci-node">
              <p className="bci-name">{s.name}</p>
              <p className="bci-sub">{s.sub}</p>
            </div>
            {i < STAGES.length - 1 ? <span className="bci-arrow" aria-hidden="true">→</span> : null}
          </li>
        ))}
      </ol>

      <p className="bci-fb">
        <span aria-hidden="true">↩ </span>feedback: you see the result and adapt, producing cleaner brain states
      </p>
    </DiagramFrame>
  );
}

const CSS = `
.bci{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;align-items:stretch;justify-content:center;gap:.25rem;}
.bci-cell{display:flex;align-items:center;gap:.25rem;}
.bci-node{display:flex;flex-direction:column;justify-content:center;min-width:clamp(4.2rem,16vw,5rem);
  padding:clamp(.5rem,1.8vw,.7rem) clamp(.4rem,1.5vw,.55rem);text-align:center;border-radius:6px;
  background:var(--color-navy-dark,#1f2438);box-shadow:inset 0 0 0 1.5px var(--color-command-gold,#c8963e);}
.bci-name{margin:0;color:#fff;font-weight:700;font-size:clamp(.82rem,2.2vw,.95rem);line-height:1.12;}
.bci-sub{margin:.12rem 0 0;color:var(--color-muted,#aaa);
  font-family:var(--font-mono,"Space Mono",monospace);font-size:clamp(.62rem,1.7vw,.7rem);line-height:1.2;}
.bci-arrow{color:var(--color-command-gold,#c8963e);font-size:clamp(.85rem,2.2vw,1.05rem);font-weight:700;}
@media (max-width:30rem){.bci{flex-direction:column;align-items:stretch;}.bci-cell{flex-direction:column;}.bci-node{min-width:0;}.bci-arrow{transform:rotate(90deg);}}

.bci-fb{margin:clamp(.9rem,3vw,1.2rem) 0 0;padding:clamp(.55rem,2vw,.75rem) clamp(.7rem,2.5vw,.95rem);
  border-radius:6px;background:rgba(74,143,255,.08);box-shadow:inset 0 0 0 1.5px var(--color-signal-blue,#4a8fff);
  color:var(--color-gray-1,#e8e8e8);font-size:clamp(.82rem,2.2vw,.92rem);line-height:1.4;text-align:center;}
.bci-fb span{color:var(--color-signal-blue,#4a8fff);font-weight:700;}

.dgfrm.armed .bci-cell,.dgfrm.armed .bci-fb{opacity:0;transform:translateY(6px);}
.dgfrm.armed.in .bci-cell,.dgfrm.armed.in .bci-fb{opacity:1;transform:none;transition:opacity .5s ease,transform .5s cubic-bezier(.2,.7,.2,1);}
.dgfrm.armed.in .bci-cell:nth-child(2){transition-delay:.07s;}
.dgfrm.armed.in .bci-cell:nth-child(3){transition-delay:.14s;}
.dgfrm.armed.in .bci-cell:nth-child(4){transition-delay:.21s;}
.dgfrm.armed.in .bci-fb{transition-delay:.3s;}
@media (prefers-reduced-motion:reduce){.dgfrm .bci-cell,.dgfrm .bci-fb{opacity:1!important;transform:none!important;}}
`;
