// The 10-20 system's midline spacing as a responsive HTML component.
//
// Teaching point: the name "10-20" is literal. Walking the midline from the
// nasion (front) to the inion (back), the electrodes sit at 10%, then 20%, 20%,
// 20%, 20%, then 10% of that measured distance. Proportional spacing means the
// same name lands on the same brain region across different head sizes. Cz, the
// vertex, is the midpoint. Vertical so it reads on a phone.
//
// Header/frame/caption from DiagramFrame. Brand palette: gold-dominant, Cz
// highlighted, muted % labels. @theme tokens.
import { DiagramFrame } from "./DiagramFrame";

type Item = { kind: "cap" | "node"; name: string; note?: string; hi?: boolean } | { kind: "seg"; pct: string };

const CHAIN: Item[] = [
  { kind: "cap", name: "Nasion", note: "front landmark" },
  { kind: "seg", pct: "10%" },
  { kind: "node", name: "Fpz" },
  { kind: "seg", pct: "20%" },
  { kind: "node", name: "Fz" },
  { kind: "seg", pct: "20%" },
  { kind: "node", name: "Cz", note: "vertex", hi: true },
  { kind: "seg", pct: "20%" },
  { kind: "node", name: "Pz" },
  { kind: "seg", pct: "20%" },
  { kind: "node", name: "Oz" },
  { kind: "seg", pct: "10%" },
  { kind: "cap", name: "Inion", note: "back landmark" },
];

export function TenTwentyMidline({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="EEG ELECTRODES · 10-20"
      tone="gold"
      title="Why it's called the 10-20 system"
      ariaLabel="The 10-20 system's midline spacing. Measuring from the nasion at the front of the head to the inion at the back, the midline electrodes are placed at 10 percent (Fpz), then 20 percent (Fz), 20 percent (Cz, the vertex), 20 percent (Pz), 20 percent (Oz), then 10 percent to the inion. Those 10 and 20 percent steps give the system its name, and because they are proportional, the same electrode name lands on the same brain region across different head sizes."
      caption={caption}
      defaultCaption="Proportional spacing, not fixed centimetres, so the same name means the same brain region on any head."
    >
      <style>{CSS}</style>

      <div className="tt">
        {CHAIN.map((it, i) =>
          it.kind === "seg" ? (
            <div className="tt-seg" key={i}>
              <span className="tt-line" aria-hidden="true" />
              <span className="tt-pct">{it.pct}</span>
              <span className="tt-line" aria-hidden="true" />
            </div>
          ) : it.kind === "cap" ? (
            <div className="tt-cap" key={i}>
              {it.name}
              <span className="tt-note"> · {it.note}</span>
            </div>
          ) : (
            <div className={`tt-node${it.hi ? " tt-node-hi" : ""}`} key={i}>
              <span className="tt-dot" aria-hidden="true" />
              <span className="tt-name">{it.name}</span>
              {it.note ? <span className="tt-note"> · {it.note}</span> : null}
            </div>
          ),
        )}
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.tt{display:flex;flex-direction:column;align-items:center;}
.tt-cap{padding:.4rem .8rem;border-radius:999px;background:var(--color-deep-space,#08090d);
  box-shadow:inset 0 0 0 1.5px var(--color-command-gold,#c8963e);color:var(--color-command-gold,#c8963e);
  font-family:var(--font-mono,"Space Mono",monospace);font-size:clamp(.72rem,2vw,.82rem);font-weight:700;
  text-transform:uppercase;letter-spacing:.08em;}
.tt-seg{display:flex;flex-direction:column;align-items:center;gap:.15rem;}
.tt-line{width:2px;height:clamp(.7rem,2.4vw,1rem);background:var(--color-command-gold,#c8963e);opacity:.4;}
.tt-pct{font-family:var(--font-mono,"Space Mono",monospace);font-size:clamp(.68rem,1.9vw,.76rem);
  color:var(--color-muted,#aaa);letter-spacing:.04em;}
.tt-node{display:flex;align-items:center;gap:.5rem;padding:.18rem 0;}
.tt-dot{width:clamp(.7rem,2.4vw,.85rem);height:clamp(.7rem,2.4vw,.85rem);border-radius:999px;flex:none;
  background:var(--color-deep-space,#08090d);box-shadow:inset 0 0 0 2px var(--color-command-gold,#c8963e);}
.tt-node-hi .tt-dot{background:var(--color-command-gold,#c8963e);}
.tt-name{color:var(--color-title,#f1ece0);font-weight:700;font-size:clamp(.95rem,2.6vw,1.1rem);}
.tt-node-hi .tt-name{color:var(--color-command-gold,#c8963e);}
.tt-note{color:var(--color-muted,#aaa);font-family:var(--font-mono,"Space Mono",monospace);
  font-size:clamp(.66rem,1.8vw,.74rem);letter-spacing:.02em;}

.dgfrm.armed .tt > *{opacity:0;transform:translateY(5px);}
.dgfrm.armed.in .tt > *{opacity:1;transform:none;transition:opacity .45s ease,transform .45s cubic-bezier(.2,.7,.2,1);}
.dgfrm.armed.in .tt > *:nth-child(3){transition-delay:.05s;}
.dgfrm.armed.in .tt > *:nth-child(5){transition-delay:.1s;}
.dgfrm.armed.in .tt > *:nth-child(7){transition-delay:.15s;}
.dgfrm.armed.in .tt > *:nth-child(9){transition-delay:.2s;}
.dgfrm.armed.in .tt > *:nth-child(11){transition-delay:.25s;}
.dgfrm.armed.in .tt > *:nth-child(13){transition-delay:.3s;}
@media (prefers-reduced-motion:reduce){.dgfrm .tt > *{opacity:1!important;transform:none!important;}}
`;
