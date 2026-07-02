// Bring-up sequence as a responsive v2 diagram: a boot-log terminal beside the
// board whose LED2 is blinking (the board is alive).
//
// Teaching point: bring-up is five checks proven in order (no shorts, 3.3 V rail,
// LED1 lit, enumerates, LED2 blinks). Each must pass before the next; a fail
// means stop and fix. All five clear = BROUGHT_UP.
//
// v2: landscape — a console-style log (on-brand Space Mono) on the left, the
// board with a live blinking LED2 on the right; stacks on a phone. Token-only
// color. Was a portrait rung-list. The LED blink is the one sanctioned ambient
// loop (reduced-motion / the exporter renders it steady-on).
import { type CSSProperties } from "react";
import { DiagramFrame } from "./DiagramFrame";

const CHECKS: { n: number; name: string; alive?: boolean }[] = [
  { n: 1, name: "no shorts" },
  { n: 2, name: "3.3 V rail" },
  { n: 3, name: "LED1 lit" },
  { n: 4, name: "enumerates" },
  { n: 5, name: "LED2 blinks", alive: true },
];

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
      <div className="bul">
        <div className="bul-term">
          <div className="bul-line bul-cmd" style={rd(0)}>$ bringup ./board</div>
          {CHECKS.map((c, i) => (
            <div key={c.n} className={`bul-line${c.alive ? " bul-alive" : ""}`} style={rd(0.25 + i * 0.18)}>
              <span className="bul-tag">{c.alive ? "[ALIVE]" : "[ OK ]"}</span>
              <span className="bul-n">{c.n}</span>
              <span className="bul-name">{c.name}</span>
            </div>
          ))}
          <div className="bul-line bul-fail" style={rd(0.25 + CHECKS.length * 0.18)}># fail: stop and fix before the next</div>
        </div>

        <div className="bul-board" style={rd(0.25 + (CHECKS.length + 1) * 0.18)}>
          <div className="bul-pcb">
            <span className="bul-chip" aria-hidden="true" />
            <span className="bul-led" aria-hidden="true" />
          </div>
          <p className="bul-boardlab">LED2 · <b>ALIVE</b></p>
        </div>
      </div>
    </DiagramFrame>
  );
}

const rd = (s: number): CSSProperties => ({ "--d": `${s}s` } as CSSProperties);

const CSS = `
.bul{display:flex;align-items:stretch;gap:clamp(.9rem,3.5vw,1.5rem);text-align:left;}
@media (max-width:520px){.bul{flex-direction:column;}}

.bul-term{flex:1.5 1 0;min-width:0;background:var(--color-diagram-surface,#1f2438);
  border:1px solid var(--color-panel-border,#3a3f50);border-radius:8px;
  padding:clamp(.8rem,2.6vw,1.05rem) clamp(.9rem,3vw,1.2rem);
  font-family:var(--font-mono,"Space Mono",monospace);font-size:clamp(.82rem,2.2vw,.95rem);line-height:1.55;}
.bul-line{display:flex;gap:.55rem;align-items:baseline;white-space:nowrap;}
.bul-cmd{color:var(--color-command-gold,#c8963e);margin-bottom:.2rem;}
.bul-tag{color:var(--color-command-gold,#c8963e);font-weight:700;}
.bul-alive .bul-tag{color:var(--color-signal-blue,#4a8fff);}
.bul-n{color:var(--color-muted,#aaa);}
.bul-name{color:var(--color-title,#f1ece0);}
.bul-alive .bul-name{color:var(--color-signal-blue,#4a8fff);font-weight:700;}
.bul-fail{color:var(--color-alert-red,#ef5350);opacity:.9;margin-top:.25rem;white-space:normal;}

.bul-board{flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:.6rem;background:var(--color-diagram-surface,#1f2438);border:1px solid var(--color-panel-border,#3a3f50);border-radius:8px;
  padding:clamp(1rem,3vw,1.3rem);}
.bul-pcb{position:relative;width:clamp(96px,40%,128px);aspect-ratio:7/5;border-radius:6px;
  background:var(--color-deep-space,#08090d);box-shadow:inset 0 0 0 2px var(--color-command-gold,#c8963e);}
.bul-chip{position:absolute;left:16%;top:26%;width:34%;height:44%;border-radius:3px;
  background:var(--color-panel-border,#3a3f50);box-shadow:inset 0 0 0 1px var(--color-muted,#aaa);}
.bul-led{position:absolute;right:16%;top:50%;width:13px;height:13px;margin-top:-6.5px;border-radius:50%;
  background:var(--color-signal-blue,#4a8fff);box-shadow:0 0 10px 2px rgba(74,143,255,.7);}
.bul-boardlab{margin:0;font-family:var(--font-mono,"Space Mono",monospace);font-size:clamp(.8rem,2.2vw,.9rem);color:var(--color-muted,#aaa);}
.bul-boardlab b{color:var(--color-signal-blue,#4a8fff);font-family:var(--font-display,"Bebas Neue",sans-serif);font-weight:400;letter-spacing:.05em;font-size:1.25em;}

/* Tier-B reveal (docs/diagrams/animation-standards.md): the log prints line by
   line, then the board fades in and LED2 starts to blink. Gated behind .armed so
   reduced-motion / the exporter renders the full, static, LED-on state. */
.dgfrm.armed .bul-line,.dgfrm.armed .bul-board{opacity:0;transform:translateY(4px);}
.dgfrm.armed.in .bul-line,.dgfrm.armed.in .bul-board{opacity:1;transform:none;
  transition:opacity .4s ease,transform .4s ease;transition-delay:var(--d,0s);}
/* LED2 blink — the one sanctioned ambient loop; hard on/off like a real indicator. */
.dgfrm.armed.in .bul-led{animation:bul-blink 1.6s steps(1,end) infinite;animation-delay:1.9s;}
@keyframes bul-blink{0%,55%{opacity:1;}55.01%,100%{opacity:.2;}}
@media (prefers-reduced-motion:reduce){
  .dgfrm .bul-line,.dgfrm .bul-board{opacity:1!important;transform:none!important;transition:none!important;}
  .dgfrm .bul-led{animation:none!important;opacity:1;}
}
`;
