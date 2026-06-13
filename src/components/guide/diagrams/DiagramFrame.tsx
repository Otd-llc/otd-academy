// Shared frame for guide-diagram components so every diagram uses the SAME,
// site-standard header — never a one-off. Matches the section-header treatment
// from ModeBandBlock / the guide cards: a gold/blue/green Space-Mono eyebrow
// (uppercase, tracked) over a Bebas Neue (var(--font-display)) title in
// --color-gray-1, inside the capped 36rem frame, with a Lora caption footer.
// Individual diagrams supply ONLY their graphic body (and its own scoped <style>).
import { type ReactNode } from "react";

const TONE: Record<string, string> = {
  gold: "var(--color-command-gold,#c8963e)",
  blue: "var(--color-signal-blue,#4a8fff)",
  green: "var(--color-status-green,#66bb6a)",
};

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
  return (
    <figure className="dgfrm" role="img" aria-label={ariaLabel}>
      <style>{FRAME_CSS}</style>
      <p className="dgfrm-eyebrow" style={{ color: TONE[tone] }}>
        <span aria-hidden="true">▸ </span>
        {eyebrow}
      </p>
      <h3 className="dgfrm-title">{title}</h3>
      <div className="dgfrm-body">{children}</div>
      {foot ? <figcaption className="dgfrm-foot">{foot}</figcaption> : null}
    </figure>
  );
}

const FRAME_CSS = `
.dgfrm{max-width:36rem;margin-inline:auto;border:1px solid var(--color-panel-border,#3a3f50);
  border-radius:.5rem;background:var(--color-deep-space,#08090d);
  font-family:var(--font-mono,"Space Mono",monospace);
  padding:clamp(1.25rem,4vw,2rem) clamp(1rem,3vw,1.75rem);text-align:center;}
.dgfrm-eyebrow{margin:0 0 .55rem;font-size:10px;font-weight:700;text-transform:uppercase;
  letter-spacing:.24em;line-height:1.5;}
.dgfrm-title{margin:0;font-family:var(--font-display,"Bebas Neue",sans-serif);font-weight:400;
  font-size:clamp(1.55rem,4.8vw,2rem);line-height:1.02;letter-spacing:.035em;
  color:var(--color-gray-1,#e8e8e8);}
.dgfrm-body{margin-top:clamp(1.15rem,4vw,1.7rem);}
.dgfrm-foot{margin:clamp(1.15rem,3.5vw,1.6rem) 0 0;color:var(--color-muted,#aaa);
  font-family:var(--font-serif,"Lora",serif);font-size:clamp(.8rem,2vw,.9rem);line-height:1.5;}
`;
