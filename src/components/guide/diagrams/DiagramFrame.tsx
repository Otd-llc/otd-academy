"use client";

// Shared frame for guide-diagram components so every diagram uses the SAME,
// site-standard header — never a one-off. Matches the section-header treatment
// from ModeBandBlock / the guide cards: a gold/blue/green Space-Mono eyebrow
// (uppercase, tracked) over a Bebas Neue (var(--font-display)) title in
// --color-gray-1, inside the capped 36rem frame, with a Lora caption footer.
// Individual diagrams supply ONLY their graphic body (and its own scoped <style>).
//
// MOTION (see docs/diagrams/animation-standards.md): the frame owns the Tier-A
// entrance reveal — eyebrow → title → body → foot fade+rise in reading order on
// scroll-in, via the shared useScrollReveal primitive. The root carries the
// `armed`/`in` contract so a Tier-B diagram can drive its own internal motion in
// pure CSS off the SAME state (e.g. `.dgfrm.armed.in .my-bar{…}`) — no extra
// observer, no client child needed. Reduced motion / no-JS → final state, static.
import { type CSSProperties, type ReactNode } from "react";
import { useScrollReveal } from "./useScrollReveal";
import { useDiagramChrome } from "./DiagramChrome";

const TONE: Record<string, string> = {
  gold: "var(--color-command-gold,#c8963e)",
  blue: "var(--color-signal-blue,#4a8fff)",
  green: "var(--color-status-green,#66bb6a)",
};

// stagger (seconds) — eyebrow → title → body → foot. Settles well under the
// ~1.8s sequence cap (foot: 0.3 + 0.55 = 0.85s).
const d = (s: number): CSSProperties => ({ "--d": `${s}s` } as CSSProperties);

export function DiagramFrame({
  eyebrow,
  tone = "gold",
  title,
  ariaLabel,
  caption,
  defaultCaption,
  children,
}: {
  eyebrow: string;
  tone?: "gold" | "blue" | "green";
  title: string;
  ariaLabel: string;
  caption?: string;
  defaultCaption?: string;
  children: ReactNode;
}) {
  const foot = caption || defaultCaption;
  // In the reading view GuideBlocks provides `bare` + a figure number; the title/
  // eyebrow/caption echo the prose, so we drop them and show only the graphic + a
  // "Fig N" corner. The standalone export renders with the default (full) context.
  const { bare, fig } = useDiagramChrome();
  const { ref, armed, inView } = useScrollReveal<HTMLElement>();
  return (
    <figure
      ref={ref}
      className={`dgfrm${bare ? " dgfrm-bare" : ""}${armed ? " armed" : ""}${inView ? " in" : ""}`}
      role="img"
      aria-label={ariaLabel}
    >
      <style>{FRAME_CSS}</style>
      {bare ? null : (
        <>
          <p className="dgfrm-anim dgfrm-eyebrow" style={{ color: TONE[tone], ...d(0) }}>
            <span aria-hidden="true">▸ </span>
            {eyebrow}
          </p>
          <h3 className="dgfrm-anim dgfrm-title" style={d(0.1)}>{title}</h3>
        </>
      )}
      <div className="dgfrm-anim dgfrm-body" style={d(bare ? 0 : 0.2)}>{children}</div>
      {bare ? (
        fig != null ? <figcaption className="dgfrm-fig">Fig {fig}</figcaption> : null
      ) : foot ? (
        <figcaption className="dgfrm-anim dgfrm-foot" style={d(0.3)}>{foot}</figcaption>
      ) : null}
    </figure>
  );
}

const FRAME_CSS = `
.dgfrm{max-width:36rem;margin-inline:auto;border:1px solid var(--color-panel-border,#3a3f50);
  border-radius:.5rem;background:var(--color-deep-space,#08090d);
  font-family:var(--font-mono,"Space Mono",monospace);
  padding:clamp(1.25rem,4vw,2rem) clamp(1rem,3vw,1.75rem);text-align:center;
  /* Query container: diagrams switch scene<->portrait off the FRAME width, not the
     viewport, so a diagram in the narrow follower-card rail reflows to its portrait
     (mobile) form and reads large instead of a squeezed landscape. */
  container-type:inline-size;}
.dgfrm-eyebrow{margin:0 0 .55rem;font-size:10px;font-weight:700;text-transform:uppercase;
  letter-spacing:.24em;line-height:1.5;}
.dgfrm-title{margin:0;font-family:var(--font-display,"Bebas Neue",sans-serif);font-weight:400;
  font-size:clamp(1.55rem,4.8vw,2rem);line-height:1.02;letter-spacing:.035em;
  color:var(--color-gray-1,#e8e8e8);}
.dgfrm-body{margin-top:clamp(1.15rem,4vw,1.7rem);}
.dgfrm-foot{margin:clamp(1.15rem,3.5vw,1.6rem) 0 0;color:var(--color-muted,#aaa);
  font-family:var(--font-serif,"Lora",serif);font-size:clamp(.8rem,2vw,.9rem);line-height:1.5;}

/* Bare in-lesson mode (owner-picked V3, 2026-07-14): just the graphic in the frame +
   a "Fig N" corner label; the title/eyebrow/caption are dropped (the prose says it). */
.dgfrm-bare{position:relative;padding:clamp(1rem,3vw,1.5rem);}
.dgfrm-bare .dgfrm-body{margin-top:0;}
/* Top-right, not bottom (owner directive 2026-07-15): a frame-breaking foreground
   element runs off the BOTTOM edge of a scene diagram and collides with the label. */
.dgfrm-fig{position:absolute;top:.55rem;right:.85rem;margin:0;
  font-family:var(--font-mono,"Space Mono",monospace);font-size:10px;font-weight:700;
  text-transform:uppercase;letter-spacing:.18em;color:var(--color-command-gold,#c8963e);}

/* Tier-A entrance reveal. Hidden state is gated behind .armed (set by JS), so an
   SSR / no-JS render shows the diagram fully visible — never blank. */
.dgfrm.armed .dgfrm-anim{opacity:0;transform:translateY(8px);}
.dgfrm.armed.in .dgfrm-anim{opacity:1;transform:none;
  transition:opacity .55s cubic-bezier(.2,.7,.2,1),transform .55s cubic-bezier(.2,.7,.2,1);
  transition-delay:var(--d,0s);}
@media (prefers-reduced-motion:reduce){
  .dgfrm .dgfrm-anim{opacity:1!important;transform:none!important;transition:none!important;}
}
`;
