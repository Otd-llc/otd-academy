// The Gerber + drill output set as a responsive HTML component.
//
// Why not the source SVG: a fixed-viewBox SVG scales to its container, so on a
// ~360px phone its text shrinks below an accessible size. This list-like diagram
// (one row per fabrication file) is pure HTML/CSS rows whose labels are real CSS
// px (clamped, never below ~14px) that do NOT scale with the viewport, and which
// stack cleanly into full-width readable blocks on a phone.
//
// Header / frame / caption come from the shared DiagramFrame (site-standard Bebas
// title); this file supplies only the graphic body and its scoped CSS.
//
// BRAND (onethousanddrones.com/brand): gold-dominant on Deep Space, Navy Dark
// bodies, Signal Blue only as the secondary data accent (mask layers + the drill
// pierce markers). Copper layers carry the gold emphasis; Edge_Cuts is the gold
// dashed outline. All colours via @theme tokens with literal fallbacks.
import { DiagramFrame } from "./DiagramFrame";

type Row = {
  name: string;
  desc: string;
  kind: "silk" | "mask" | "cu" | "edge";
  drill?: boolean;
};

// Front-to-back, exactly as the fab stacks them — preserve order and values.
const ROWS: Row[] = [
  { name: "F_Silkscreen.gbr", desc: "the white labels", kind: "silk" },
  { name: "F_Mask.gbr", desc: "mask — gaps at the pads", kind: "mask" },
  { name: "F_Cu.gbr", desc: "front copper — your traces", kind: "cu", drill: true },
  { name: "B_Cu.gbr", desc: "back copper — ground plane", kind: "cu", drill: true },
  { name: "B_Mask.gbr", desc: "mask — gaps at the pads", kind: "mask" },
  { name: "B_Silkscreen.gbr", desc: "the white labels", kind: "silk" },
  { name: "Edge_Cuts.gbr", desc: "where the fab cuts the board", kind: "edge" },
];

export function GerberLayerStack({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="GERBER + DRILL OUTPUT"
      tone="gold"
      title="A Gerber set: one flat file per layer"
      ariaLabel="A Gerber set: one flat file per layer. Front to back — F_Silkscreen.gbr (the white labels), F_Mask.gbr (mask, gaps at the pads), F_Cu.gbr (front copper, your traces), B_Cu.gbr (back copper, ground plane), B_Mask.gbr (mask, gaps at the pads), B_Silkscreen.gbr (the white labels), and Edge_Cuts.gbr (where the fab cuts the board). A separate drill file, .drl, pierces the copper layers. Zip every one into a single archive — that zip is the board the fab builds."
      caption={caption}
      defaultCaption="Zip every one of these into a single archive — that zip is the board the fab builds."
    >
      <style>{CSS}</style>
      <ol className="glstk-stack">
        {ROWS.map((r) => (
          <li key={r.name} className={`glstk-row glstk-${r.kind}`}>
            <span className="glstk-swatch" aria-hidden="true" />
            <span className="glstk-body">
              <span className="glstk-name">{r.name}</span>
              <span className="glstk-desc">{r.desc}</span>
            </span>
            {r.drill ? <span className="glstk-drill" aria-hidden="true" /> : null}
          </li>
        ))}
      </ol>

      <p className="glstk-drillnote">
        <span className="glstk-drilltag">.drl</span>a separate{" "}
        <b>drill file</b> pierces the copper layers
      </p>
    </DiagramFrame>
  );
}

// Token-driven (var(--color-*) / var(--font-*) from @theme) with literal
// fallbacks so a standalone render still resolves. Gold-dominant per brand.
const CSS = `
.glstk-stack{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:5px;text-align:left;}
.glstk-row{position:relative;display:flex;align-items:center;gap:.85rem;
  background:var(--color-navy-dark,#1f2438);border:1px solid var(--color-panel-border,#3a3f50);
  border-radius:5px;padding:.7rem .85rem;overflow:hidden;}
.glstk-swatch{flex:0 0 auto;width:10px;align-self:stretch;border-radius:2px;
  background:var(--color-muted,#aaa);}
.glstk-body{display:flex;flex-direction:column;gap:.18rem;min-width:0;}
.glstk-name{color:#fff;font-weight:700;font-size:clamp(1.05rem,3vw,1.3rem);letter-spacing:.01em;}
.glstk-desc{color:var(--color-muted,#aaa);font-size:clamp(.95rem,2.5vw,1.05rem);line-height:1.35;}

/* layer-type swatches */
.glstk-silk .glstk-swatch{background:#fff;}
.glstk-mask .glstk-swatch{background:var(--color-signal-blue,#4a8fff);}
.glstk-cu{border-color:var(--color-command-gold,#c8963e);}
.glstk-cu .glstk-swatch{background:var(--color-command-gold,#c8963e);}
.glstk-cu .glstk-name{color:var(--color-gold-light,#e8b865);}
.glstk-cu .glstk-desc{color:var(--color-gray-1,#e8e8e8);}
.glstk-edge{background:transparent;border-style:dashed;border-color:var(--color-command-gold,#c8963e);}
.glstk-edge .glstk-swatch{background:transparent;border:1.5px dashed var(--color-command-gold,#c8963e);}
.glstk-edge .glstk-name{color:var(--color-gold-light,#e8b865);}

/* drill pierce marker, right edge of the two copper rows */
.glstk-drill{position:absolute;right:14px;top:50%;width:13px;height:13px;margin-top:-6.5px;
  border-radius:50%;background:var(--color-deep-space,#08090d);
  border:2px solid var(--color-signal-blue,#4a8fff);}

.glstk-drillnote{margin:clamp(.9rem,3vw,1.2rem) 0 0;text-align:left;
  color:var(--color-muted,#aaa);font-size:clamp(.95rem,2.5vw,1.05rem);line-height:1.5;}
.glstk-drillnote b{color:var(--color-signal-blue,#4a8fff);font-weight:700;}
.glstk-drilltag{color:var(--color-signal-blue,#4a8fff);font-weight:700;font-size:.62rem;
  letter-spacing:.12em;border:1px solid var(--color-signal-blue,#4a8fff);border-radius:3px;
  padding:.18rem .4rem;margin-right:.5rem;white-space:nowrap;}
`;
