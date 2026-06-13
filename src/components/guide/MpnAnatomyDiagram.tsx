"use client";

// Part-number anatomy — responsive, scroll-triggered "decode" reveal.
// Real HTML/CSS (not a scaled SVG) so text stays accessible at any width and the
// cards reflow 4→2→1 col. Header matches the site standard (Space-Mono eyebrow +
// Bebas/var(--font-display) title in --color-gray-1). Each decoded segment + its
// card carries a distinct BRAND hue (muted / gold / blue / gold-light) so the
// glyph→card binding reads at a glance — gold stays dominant, blue secondary.
import { type CSSProperties, useEffect, useRef, useState } from "react";

// glyph → brand accent (no off-palette hues; gold dominant, blue secondary).
const COLOR: Record<string, string> = {
  RC: "var(--color-muted,#aaaaaa)",
  "0805": "var(--color-command-gold,#c8963e)",
  F: "var(--color-signal-blue,#4a8fff)",
  "5K1": "var(--color-gold-light,#e8b865)",
};

const SEGMENTS: { t: string; kind: "dec" | "skip" }[] = [
  { t: "RC", kind: "dec" },
  { t: "0805", kind: "dec" },
  { t: "F", kind: "dec" },
  { t: "R-07", kind: "skip" },
  { t: "5K1", kind: "dec" },
  { t: "L", kind: "skip" },
];

const CARDS: { glyph: string; label: string; value: string; sub: string }[] = [
  { glyph: "RC", label: "FAMILY", value: "Yageo thick-film", sub: "resistor maker" },
  { glyph: "0805", label: "PACKAGE", value: "2.0 × 1.25 mm", sub: "metric 2012" },
  { glyph: "F", label: "TOLERANCE", value: "±1%", sub: "1 part in 100" },
  { glyph: "5K1", label: "VALUE", value: "5.1 kΩ", sub: "E24 step · not 5.0" },
];

const d = (s: number): CSSProperties => ({ "--d": `${s}s` } as CSSProperties);

export function MpnAnatomyDiagram({ caption }: { caption?: string }) {
  const ref = useRef<HTMLElement>(null);
  const [armed, setArmed] = useState(false);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setArmed(true);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setInView(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <figure
      ref={ref}
      className={`mpna${armed ? " armed" : ""}${inView ? " in" : ""}`}
      role="img"
      aria-label="Decoding the part number RC0805FR-075K1L. RC is the Yageo thick-film resistor family; 0805 is the package size 2.0 by 1.25 mm; F is the tolerance plus or minus 1 percent; 5K1 is the value 5.1 kilohm, an E24 step not a round 5.0. R-07 and the trailing L are packaging and ordering codes you can ignore."
    >
      <style>{CSS}</style>
      <span className="mpna-tick mpna-tl" />
      <span className="mpna-tick mpna-tr" />
      <span className="mpna-tick mpna-bl" />
      <span className="mpna-tick mpna-br" />

      <div className="mpna-head">
        <p className="mpna-anim mpna-eyebrow" style={d(0)}>
          <span aria-hidden="true">▸ </span>DECODE · PART-NUMBER ANATOMY
        </p>
        <h3 className="mpna-anim mpna-title" style={d(0.1)}>
          A part number is a spec sheet squeezed into a string
        </h3>
      </div>

      <p className="mpna-mpn" aria-hidden="true">
        {SEGMENTS.map((s, i) => (
          <span
            key={i}
            className={`mpna-anim mpna-seg mpna-${s.kind}`}
            style={{ ...(s.kind === "dec" ? { color: COLOR[s.t] } : {}), ...d(0.3 + i * 0.06) }}
          >
            {s.t}
          </span>
        ))}
      </p>

      <div className="mpna-grid">
        {CARDS.map((c, i) => (
          <div
            key={c.glyph}
            className="mpna-anim mpna-card"
            style={{ "--c": COLOR[c.glyph], ...d(0.8 + i * 0.12) } as CSSProperties}
          >
            <span className="mpna-glyph">{c.glyph}</span>
            <span className="mpna-rule" />
            <span className="mpna-label">{c.label}</span>
            <span className="mpna-value">{c.value}</span>
            <span className="mpna-sub">{c.sub}</span>
          </div>
        ))}
      </div>

      <figcaption className="mpna-anim mpna-foot" style={d(1.3)}>
        {caption || "R-07 is packaging, L is an ordering suffix — real codes, just not yours to pick."}
      </figcaption>
    </figure>
  );
}

const CSS = `
.mpna{position:relative;overflow:hidden;max-width:36rem;margin-inline:auto;
  border:1px solid var(--color-panel-border,#3a3f50);border-radius:.5rem;
  background:var(--color-deep-space,#08090d);color:var(--color-muted,#aaa);
  font-family:var(--font-mono,"Space Mono",monospace);
  padding:clamp(1.25rem,4vw,2rem) clamp(1rem,3vw,1.75rem);}
.mpna-tick{position:absolute;width:12px;height:12px;border:0 solid var(--color-panel-border,#3a3f50);pointer-events:none;}
.mpna-tl{top:10px;left:10px;border-top-width:1.4px;border-left-width:1.4px;}
.mpna-tr{top:10px;right:10px;border-top-width:1.4px;border-right-width:1.4px;}
.mpna-bl{bottom:10px;left:10px;border-bottom-width:1.4px;border-left-width:1.4px;}
.mpna-br{bottom:10px;right:10px;border-bottom-width:1.4px;border-right-width:1.4px;}

.mpna-head{text-align:center;}
.mpna-eyebrow{margin:0 0 .55rem;color:var(--color-command-gold,#c8963e);font-size:10px;
  font-weight:700;text-transform:uppercase;letter-spacing:.24em;}
.mpna-title{margin:0;font-family:var(--font-display,"Bebas Neue",sans-serif);font-weight:400;
  font-size:clamp(1.55rem,4.8vw,2rem);line-height:1.02;letter-spacing:.035em;
  color:var(--color-gray-1,#e8e8e8);}

.mpna-mpn{margin:clamp(1.2rem,4.5vw,1.7rem) 0;text-align:center;font-weight:700;line-height:1;
  font-size:clamp(1.15rem,6.4vw,2.6rem);letter-spacing:-.005em;white-space:nowrap;}
.mpna-seg{display:inline-block;}
.mpna-dec{border-bottom:.14em solid currentColor;padding-bottom:.06em;}
.mpna-skip{color:var(--color-muted,#aaa);opacity:.55;text-decoration:line-through;text-decoration-thickness:.06em;}

.mpna-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:clamp(.55rem,2vw,1rem);}
@media (max-width:760px){.mpna-grid{grid-template-columns:repeat(2,1fr);}}
@media (max-width:430px){.mpna-grid{grid-template-columns:1fr;}}

.mpna-card{display:flex;flex-direction:column;align-items:center;text-align:center;
  background:var(--color-navy-dark,#1f2438);border:1px solid var(--color-panel-border,#3a3f50);
  border-top:3px solid var(--c,#c8963e);border-radius:5px;padding:.9rem .6rem .95rem;}
.mpna-glyph{color:var(--c,#fff);font-weight:700;font-size:clamp(1.1rem,3.6vw,1.45rem);letter-spacing:.04em;}
.mpna-rule{width:72%;height:1px;background:var(--color-panel-border,#3a3f50);margin:.55rem 0;}
.mpna-label{color:var(--color-muted,#aaa);font-size:10px;font-weight:700;letter-spacing:.2em;}
.mpna-value{color:var(--color-gray-1,#e8e8e8);font-size:clamp(.85rem,2.4vw,.95rem);letter-spacing:.03em;margin-top:.34rem;}
.mpna-sub{color:var(--color-muted,#aaa);font-size:9.5px;letter-spacing:.05em;margin-top:.3rem;}

.mpna-foot{margin:clamp(1.15rem,3.5vw,1.6rem) 0 0;text-align:center;color:var(--color-muted,#aaa);
  font-family:var(--font-serif,"Lora",serif);font-size:clamp(.8rem,2vw,.9rem);line-height:1.5;}

.mpna.armed .mpna-anim{opacity:0;transform:translateY(8px);}
.mpna.armed.in .mpna-anim{opacity:1;transform:none;
  transition:opacity .55s cubic-bezier(.2,.7,.2,1),transform .55s cubic-bezier(.2,.7,.2,1);
  transition-delay:var(--d,0s);}
@media (prefers-reduced-motion:reduce){
  .mpna .mpna-anim{opacity:1!important;transform:none!important;transition:none!important;}
}
`;
