// Part-number anatomy as a responsive v2 diagram.
//
// Teaching point: a manufacturer part number is a spec sheet squeezed into a
// string. RC0805FR-075K1L decodes to RC (family) · 0805 (package) · F
// (tolerance) · 5K1 (value); R-07 and the trailing L are packaging/ordering
// codes you ignore.
//
// v2: the six segments are laid out left to right as EXPLODED colored tiles
// (decoded = a solid brand-hue tile with its label + value beneath; skipped =
// a dashed "ignore" tile) — a landscape row on desktop/print that reflows to a
// stacked list on a phone (labels stay real px, never shrunk). Was a portrait
// custom-framed client component; now on the shared DiagramFrame, token-only
// color (tile fills are brand hues, glyphs ride --color-deep-space so they
// invert with the theme).
import { type CSSProperties } from "react";
import { DiagramFrame } from "./diagrams/DiagramFrame";

type Seg = { t: string; kind: "dec" | "skip"; color?: string; label: string; value?: string };

const SEGMENTS: Seg[] = [
  { t: "RC", kind: "dec", color: "var(--color-muted,#aaaaaa)", label: "FAMILY", value: "Yageo thick-film" },
  { t: "0805", kind: "dec", color: "var(--color-command-gold,#c8963e)", label: "PACKAGE", value: "2.0 × 1.25 mm" },
  { t: "F", kind: "dec", color: "var(--color-signal-blue,#4a8fff)", label: "TOLERANCE", value: "±1%" },
  { t: "R-07", kind: "skip", label: "ignore" },
  { t: "5K1", kind: "dec", color: "var(--color-gold-light,#e8b865)", label: "VALUE", value: "5.1 kΩ" },
  { t: "L", kind: "skip", label: "ignore" },
];

export function MpnAnatomyDiagram({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="DECODE · PART-NUMBER ANATOMY"
      tone="gold"
      title="A part number is a spec sheet in a string"
      ariaLabel="Decoding the part number RC0805FR-075K1L. RC is the Yageo thick-film resistor family; 0805 is the package size 2.0 by 1.25 mm; F is the tolerance plus or minus 1 percent; 5K1 is the value 5.1 kilohm, an E24 step not a round 5.0. R-07 and the trailing L are packaging and ordering codes you can ignore."
      caption={caption}
      defaultCaption="R-07 is packaging and L is an ordering suffix; real codes, just not yours to pick."
    >
      <style>{CSS}</style>
      <div className="mpna-row">
        {SEGMENTS.map((s, i) => (
          <div
            key={s.t}
            className={`mpna-col mpna-${s.kind}`}
            style={{ "--c": s.color ?? "var(--color-muted,#aaa)", "--d": `${0.3 + i * 0.08}s` } as CSSProperties}
          >
            <span className="mpna-chip">{s.t}</span>
            <span className="mpna-lbl">{s.label}</span>
            {s.value ? <span className="mpna-val">{s.value}</span> : null}
          </div>
        ))}
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.mpna-row{display:flex;justify-content:center;align-items:flex-start;gap:clamp(.35rem,1.6vw,.75rem);}
.mpna-col{display:flex;flex-direction:column;align-items:center;text-align:center;min-width:0;}

.mpna-chip{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;line-height:1;
  font-size:clamp(1.1rem,4.4vw,1.7rem);padding:.3rem .55rem;border-radius:6px;letter-spacing:.01em;}
.mpna-dec .mpna-chip{background:var(--c,#c8963e);color:var(--color-deep-space,#08090d);}
.mpna-skip .mpna-chip{color:var(--color-muted,#aaa);opacity:.6;
  border:1.5px dashed var(--color-panel-border,#3a3f50);text-decoration:line-through;text-decoration-thickness:.06em;}

.mpna-lbl{margin-top:.55rem;font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;
  font-size:9.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--c,#aaa);}
.mpna-skip .mpna-lbl{color:var(--color-muted,#aaa);opacity:.7;}
.mpna-val{margin-top:.18rem;font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:700;
  font-size:clamp(.82rem,2.3vw,.95rem);color:var(--color-text,#e8e8e8);}

/* phone: stack the segments into rows (chip left, label + value right) */
@media (max-width:520px){
  .mpna-row{flex-direction:column;align-items:stretch;gap:.5rem;}
  .mpna-col{flex-direction:row;align-items:center;gap:.85rem;text-align:left;}
  .mpna-chip{flex:0 0 auto;min-width:66px;text-align:center;}
  .mpna-lbl{margin-top:0;flex:0 0 auto;min-width:88px;}
  .mpna-val{margin-top:0;}
  .mpna-skip .mpna-lbl{flex:1 1 auto;}
}

/* Tier-B reveal (docs/diagrams/animation-standards.md): tiles settle in reading
   order; gated behind .armed so reduced-motion / no-JS shows the full row. */
.dgfrm.armed .mpna-col{opacity:0;transform:translateY(8px);}
.dgfrm.armed.in .mpna-col{opacity:1;transform:none;
  transition:opacity .5s cubic-bezier(.2,.7,.2,1),transform .5s cubic-bezier(.2,.7,.2,1);transition-delay:var(--d,0s);}
@media (prefers-reduced-motion:reduce){
  .dgfrm .mpna-col{opacity:1!important;transform:none!important;transition:none!important;}
}
`;
