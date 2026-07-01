// Bring-up sequence as a responsive HTML component (a five-rung ladder).
//
// Why not an SVG: a fixed-viewBox SVG scales to its container, so on a ~360px
// phone a 780-wide canvas renders at ~0.46x and ANY text shrinks below an
// accessible size. This is a list-like diagram, so it is pure HTML/CSS rows:
// the text is real CSS px (clamped, never below ~14px) that does NOT scale down
// with the viewport, and the rungs stack cleanly on a phone.
//
// Header / frame / caption come from the shared DiagramFrame (site-standard
// Bebas title); this file supplies only the graphic body.
//
// BRAND (onethousanddrones.com/brand): gold-dominant on Deep Space, Navy Dark
// bodies, Signal Blue only as the secondary "it's alive" callout on rung 5, and
// Alert Red reserved for the stop rule. All colours via @theme tokens.
import { type CSSProperties } from "react";
import { DiagramFrame } from "./DiagramFrame";

export function BringupLadder({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="BRING-UP SEQUENCE"
      tone="gold"
      title="Bring-up is a ladder"
      ariaLabel="Bring-up is a ladder of five rungs in order: one, no shorts, the meter stays silent; two, the 3.3 V rail, TP1 reads about 3.3 V; three, LED1 lit, the power LED is on; four, the board enumerates, the host sees the S3; five, LED2 blinks, your code blinks it and the board is alive. If any rung fails, stop and fix it before the next. All five rungs clear means log the board BROUGHT_UP."
      caption={caption}
      defaultCaption="All five rungs clear → log the board BROUGHT_UP."
    >
      <style>{CSS}</style>

      <p className="brl-sub">Prove each rung before you trust the next.</p>

      <div className="brl-stop">
        <span className="brl-stop-k">IF ANY RUNG FAILS:</span>
        <span className="brl-stop-v">STOP &amp; fix it before the next.</span>
      </div>

      <div className="brl-rungs">
        {RUNGS.map((r, i) => (
          <div
            key={r.n}
            className={`brl-rung${r.alive ? " last" : ""}`}
            style={{ "--d": `${0.35 + i * 0.1}s` } as CSSProperties}
          >
            <span className="brl-num">{r.n}</span>
            <div className="brl-body">
              <div className="brl-name">{r.name}</div>
              <div className="brl-detail">{r.detail}</div>
            </div>
            {r.alive ? <span className="brl-led" aria-hidden="true" /> : null}
          </div>
        ))}
      </div>
    </DiagramFrame>
  );
}

const RUNGS: { n: number; name: string; detail: string; alive?: boolean }[] = [
  { n: 1, name: "NO SHORTS", detail: "meter stays silent" },
  { n: 2, name: "3.3 V RAIL", detail: "TP1 reads ≈ 3.3 V" },
  { n: 3, name: "LED1 LIT", detail: "the power LED is on" },
  { n: 4, name: "ENUMERATES", detail: "the host sees the S3" },
  { n: 5, name: "LED2 BLINKS", detail: "your code blinks it — alive", alive: true },
];

// Token-driven (var(--color-*) / var(--font-*) from @theme) with literal
// fallbacks so a standalone render still resolves. Gold-dominant per brand.
const CSS = `
.brl-sub{margin:0 0 clamp(1.1rem,4vw,1.5rem);text-align:center;color:var(--color-muted,#aaa);
  font-family:var(--font-serif,"Lora",serif);font-size:clamp(.85rem,2.3vw,.95rem);line-height:1.4;}

.brl-stop{display:flex;align-items:baseline;gap:.55rem;flex-wrap:wrap;
  margin:clamp(1.1rem,4vw,1.5rem) 0;padding:.7rem .85rem;border-radius:6px;text-align:left;
  background:var(--color-navy-dark,#1f2438);border:1px solid var(--color-alert-red,#c62828);}
.brl-stop-k{color:var(--color-alert-red,#c62828);font-weight:700;font-size:clamp(.95rem,2.5vw,1.05rem);letter-spacing:.04em;}
.brl-stop-v{color:var(--color-muted,#aaa);font-size:clamp(.85rem,2.3vw,.95rem);}

.brl-rungs{display:flex;flex-direction:column;gap:.55rem;text-align:left;}
.brl-rung{position:relative;display:grid;grid-template-columns:auto 1fr;gap:.85rem;align-items:center;
  padding:.7rem 1.7rem .7rem .85rem;border-radius:6px;
  background:var(--color-navy-dark,#1f2438);
  border:1px solid var(--color-panel-border,#3a3f50);border-left:3px solid var(--color-command-gold,#c8963e);}
.brl-num{display:flex;align-items:center;justify-content:center;width:2rem;height:2rem;flex:none;
  border-radius:50%;border:2px solid var(--color-command-gold,#c8963e);color:var(--color-command-gold,#c8963e);
  font-weight:700;font-size:clamp(1.05rem,3vw,1.3rem);}
.brl-body{min-width:0;}
.brl-name{color:var(--color-title,#f1ece0);font-weight:700;font-size:clamp(1.05rem,3vw,1.3rem);letter-spacing:.03em;line-height:1.2;}
.brl-detail{margin-top:.18rem;color:var(--color-muted,#aaa);font-size:clamp(.95rem,2.5vw,1.05rem);line-height:1.35;}
.brl-rung.last .brl-detail{color:var(--color-signal-blue,#4a8fff);}

/* Tier-B (docs/diagrams/animation-standards.md): prove each rung before the next
   — the rungs reveal 1→5 in order. Gated behind .armed so a reduced-motion /
   no-JS render shows all five, static. */
.dgfrm.armed .brl-rung{opacity:0;transform:translateX(-10px);}
.dgfrm.armed.in .brl-rung{opacity:1;transform:none;
  transition:opacity .5s cubic-bezier(.2,.7,.2,1),transform .5s cubic-bezier(.2,.7,.2,1);
  transition-delay:var(--d,0s);}

/* The one sanctioned ambient loop: LED2 on the final rung blinks — the board is
   alive. Slow (1.8s), hard on/off like a real indicator, reduced-motion-gated. */
.brl-led{position:absolute;right:.85rem;top:50%;width:.7rem;height:.7rem;margin-top:-.35rem;
  border-radius:50%;background:var(--color-signal-blue,#4a8fff);
  box-shadow:0 0 7px 1px rgba(74,143,255,.7);}
.dgfrm.armed.in .brl-led{animation:brl-blink 1.8s steps(1,end) infinite;animation-delay:1s;}
@keyframes brl-blink{0%,50%{opacity:1;}50.01%,100%{opacity:.18;}}
@media (prefers-reduced-motion:reduce){
  .dgfrm .brl-rung{opacity:1!important;transform:none!important;transition:none!important;}
  .dgfrm .brl-led{animation:none!important;opacity:1;}
}
`;
