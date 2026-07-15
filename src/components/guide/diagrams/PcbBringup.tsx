// Board bring-up: the fixed-order checklist (diagram-standards v2).
//
// Teaching point (lesson 11): bring a fresh board up in one fixed order —
// inspect it, cold-continuity-check it for shorts, confirm polarity, then apply
// first power through a current limit and verify the rails. The three cold
// checks come before power ever touches the board; the power step is the only
// one highlighted, to mark that it comes last.
//
// A vertical numbered checklist. Each row = a numbered disc, a glyph, a title,
// and a note. Glyphs stroke `currentColor`, so the row's color class (gold-light
// for the cold checks, gold for the power step) drives them and both themes flip.
// Rows are HTML, so on a phone the notes wrap instead of shrinking. Header +
// caption from the DiagramFrame.
import { DiagramFrame } from "./DiagramFrame";
import type { ReactNode } from "react";

export function PcbBringup({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="PCB · BRING-UP"
      tone="gold"
      title="First power, in a fixed order"
      ariaLabel="The board bring-up sequence as an ordered checklist. Step one, inspect the unpowered board under magnification for bridges and missing or lifted parts. Step two, a cold continuity check for shorts between the rails that must never touch: ground to 5V, ground to 3.3V, and 5V to 3.3V. Step three, confirm polarity on the diodes, electrolytic capacitors, and every chip's pin 1 against the silkscreen. Step four, the only powered step, apply first power from a current-limited supply, watch the current, and verify each rail. The three cold checks come before power ever touches the board."
      caption={caption}
      defaultCaption="Bring-up in a fixed order: inspect, cold continuity check for shorts, confirm orientation, then first power on a current limit and verify the rails."
    >
      <style>{CSS}</style>
      <ol className="bu">
        {STEPS.map((s, i) => (
          <li key={s.title} className={`bu-row${s.live ? " live" : ""}`}>
            <span className="bu-n">{i + 1}</span>
            <svg className="bu-ico" viewBox="0 0 46 44" aria-hidden="true">{s.glyph}</svg>
            <span className="bu-body">
              <span className="bu-title">{s.title}</span>
              <span className="bu-note">{s.note}</span>
            </span>
          </li>
        ))}
      </ol>
    </DiagramFrame>
  );
}

const MAG = (
  <>
    <circle cx="18" cy="18" r="11" fill="none" stroke="currentColor" strokeWidth="2.4" />
    <line x1="26" y1="26" x2="35" y2="35" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
  </>
);
const METER = (
  <>
    <rect x="6" y="12" width="26" height="20" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
    <line x1="10" y1="22" x2="20" y2="22" stroke="currentColor" strokeWidth="2" />
    <path d="M30 14 A6 6 0 0 1 30 30" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="M33 10 A11 11 0 0 1 33 34" fill="none" stroke="currentColor" strokeWidth="1.6" />
  </>
);
const POL = (
  <>
    <path d="M10 10 L10 34 L30 22 Z" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
    <line x1="30" y1="10" x2="30" y2="34" stroke="currentColor" strokeWidth="2.4" />
    <text x="2" y="15" fill="currentColor" fontFamily="Space Mono, monospace" fontSize="12" fontWeight="700">+</text>
  </>
);
const PSU = (
  <>
    <rect x="6" y="9" width="30" height="26" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
    <circle cx="16" cy="20" r="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <line x1="16" y1="20" x2="19" y2="16" stroke="currentColor" strokeWidth="1.6" />
    <text x="24" y="25" fill="currentColor" fontFamily="Saira Condensed, sans-serif" fontSize="12" fontWeight="700">A</text>
  </>
);

const STEPS: { title: string; note: string; glyph: ReactNode; live?: boolean }[] = [
  { title: "Inspect", note: "for bridges and lifted parts", glyph: MAG },
  { title: "Cold check", note: "GND-5V, GND-3V3, 5V-3V3 must not beep", glyph: METER },
  { title: "Confirm polarity", note: "diodes, caps, pin 1 vs silkscreen", glyph: POL },
  { title: "Power, current-limited", note: "low limit, watch current, verify rails", glyph: PSU, live: true },
];

const CSS = `
.bu{max-width:33rem;margin-inline:auto;list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:.25rem;text-align:left;}
.bu-row{display:flex;gap:.7rem;align-items:center;padding:.35rem .65rem;border-radius:7px;border:1px solid transparent;}
.bu-row.live{border-color:var(--color-command-gold,#c8963e);}
.bu-n{flex:0 0 27px;height:27px;border-radius:50%;border:2px solid var(--color-panel-border,#3a3f50);
  display:flex;align-items:center;justify-content:center;
  font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:700;
  font-size:clamp(.9rem,2.5vw,1rem);color:var(--color-title,#f1ece0);}
.bu-row.live .bu-n{border-color:var(--color-command-gold,#c8963e);color:var(--color-command-gold,#c8963e);}
.bu-ico{flex:0 0 27px;width:27px;height:auto;margin-top:1px;color:var(--color-gold-light,#e8b865);}
.bu-row.live .bu-ico{color:var(--color-command-gold,#c8963e);}
.bu-body{display:flex;flex-direction:column;min-width:0;flex:1 1 auto;text-align:left;}
.bu-title{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;
  font-size:clamp(.85rem,2.4vw,.98rem);color:var(--color-title,#f1ece0);}
.bu-note{font-family:var(--font-mono,"Space Mono",monospace);
  font-size:clamp(.74rem,2vw,.82rem);line-height:1.36;color:var(--color-muted,#aaaaaa);margin-top:1px;}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .bu-row{opacity:0;transform:translateY(6px);}
.dgfrm.armed.in .bu-row{opacity:1;transform:none;transition:opacity .5s ease,transform .5s cubic-bezier(.2,.7,.2,1);}
.dgfrm.armed.in .bu-row:nth-child(2){transition-delay:.08s;}
.dgfrm.armed.in .bu-row:nth-child(3){transition-delay:.16s;}
.dgfrm.armed.in .bu-row:nth-child(4){transition-delay:.24s;}
@media (prefers-reduced-motion:reduce){
  .dgfrm .bu-row{opacity:1!important;transform:none!important;transition:none!important;}
}
`;
