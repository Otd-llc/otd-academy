// The Gerber + drill output set as a responsive diagram (v2).
//
// Teaching point: "export gerbers" produces one flat file per fabrication layer.
// Desktop/print show them as a landscape spread of sheets, front to back
// (F_Silkscreen, F_Mask, F_Cu, B_Cu, B_Mask, B_Silkscreen); a separate .drl
// drill file pierces the two copper layers. Zip the set and that archive IS the
// board the fab builds.
//
// v2: token-only color (the old version used presentation-attribute hex + a
// literal `#fff` silk swatch, so it could not re-theme in light mode). Landscape
// SVG spread on desktop/print; on a phone it reflows to stacked full-width rows
// whose labels stay real CSS px (never shrinking under the ~14px floor) rather
// than scaling the whole spread down to unreadable.
//
// BRAND: gold-dominant on Deep Space. Copper = gold, mask = Signal Blue, silk =
// Title (ivory on dark, ink on light), the drill pierce = Signal Blue. Every
// colour via @theme tokens with literal fallbacks.
import { type CSSProperties } from "react";
import { DiagramFrame } from "./DiagramFrame";

type Sheet = { name: string; kind: "silk" | "mask" | "cu"; drill?: boolean };

// Front-to-back, exactly as the fab stacks them.
const SHEETS: Sheet[] = [
  { name: "F_Silk", kind: "silk" },
  { name: "F_Mask", kind: "mask" },
  { name: "F_Cu", kind: "cu", drill: true },
  { name: "B_Cu", kind: "cu", drill: true },
  { name: "B_Mask", kind: "mask" },
  { name: "B_Silk", kind: "silk" },
];

// Phone rows carry the full filename + a plain-language gloss.
const ROWS: { name: string; desc: string; kind: Sheet["kind"]; drill?: boolean }[] = [
  { name: "F_Silkscreen.gbr", desc: "the white labels", kind: "silk" },
  { name: "F_Mask.gbr", desc: "solder mask, open at the pads", kind: "mask" },
  { name: "F_Cu.gbr", desc: "front copper, your traces", kind: "cu", drill: true },
  { name: "B_Cu.gbr", desc: "back copper, ground plane", kind: "cu", drill: true },
  { name: "B_Mask.gbr", desc: "solder mask, open at the pads", kind: "mask" },
  { name: "B_Silkscreen.gbr", desc: "the white labels", kind: "silk" },
];

// Spread geometry (0..560 landscape space).
const X0 = 40;
const OX = 82; // step between sheet left edges
const DW = 102; // sheet width
const H = 46; // sheet height (a real rectangle, not a skewed slab)
const Y0 = 96; // sheet top

export function GerberLayerStack({ caption }: { caption?: string }) {
  // Front sheet draws on top: render right-to-back so F_Silk (leftmost, front)
  // overlaps the sheet behind it. Names/drill draw after, so nothing occludes.
  const order = SHEETS.map((_, i) => i).reverse();

  return (
    <DiagramFrame
      eyebrow="GERBER + DRILL OUTPUT"
      tone="gold"
      title="A Gerber set: one file per layer"
      ariaLabel="A Gerber set is one flat file per layer, spread front to back: F_Silk (the white labels), F_Mask (solder mask, open at the pads), F_Cu (front copper, your traces), B_Cu (back copper, ground plane), B_Mask, and B_Silk. A separate drill file, .drl, pierces the two copper layers. Zip every file into a single archive; that zip is the board the fab builds."
      caption={caption}
      defaultCaption="Zip every one into a single archive; that zip is the board the fab builds."
    >
      <style>{CSS}</style>

      {/* Desktop / print: landscape spread of flat rectangular sheets */}
      <svg
        className="gerb-svg gerb-wide"
        viewBox="0 0 560 230"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        {order.map((i) => {
          const s = SHEETS[i];
          const x = X0 + i * OX;
          return (
            <rect
              key={`sh-${s.name}`}
              className={`gerb-sheet gerb-${s.kind}`}
              x={x}
              y={Y0}
              width={DW}
              height={H}
              rx="2"
              style={{ "--d": `${0.32 + (SHEETS.length - 1 - i) * 0.07}s` } as CSSProperties}
            />
          );
        })}
        {SHEETS.map((s, i) => {
          const x = X0 + i * OX;
          return (
            <g key={`nm-${s.name}`}>
              {s.drill ? (
                <line
                  className="gerb-drill"
                  x1={x + DW * 0.42}
                  y1={Y0 + 5}
                  x2={x + DW * 0.42}
                  y2={Y0 + H - 5}
                />
              ) : null}
              <text className="gerb-nm" x={x + DW / 2} y={Y0 + H + 22}>
                {s.name}
              </text>
            </g>
          );
        })}
        <text className="gerb-cap" x="280" y={Y0 + H + 48}>
          6 flat files, front → back · .drl pierces the copper
        </text>
      </svg>

      {/* Phone: reflow to stacked full-width rows (labels stay readable px) */}
      <ol className="gerb-narrow gerb-list">
        {ROWS.map((r, i) => (
          <li
            key={r.name}
            className={`gerb-row gerb-row-${r.kind}`}
            style={{ "--d": `${0.32 + i * 0.07}s` } as CSSProperties}
          >
            <span className="gerb-swatch" aria-hidden="true" />
            <span className="gerb-rowbody">
              <span className="gerb-rowname">{r.name}</span>
              <span className="gerb-rowdesc">{r.desc}</span>
            </span>
            {r.drill ? <span className="gerb-rowdrill" aria-hidden="true" /> : null}
          </li>
        ))}
        <li className="gerb-note">
          <span className="gerb-notetag">.drl</span>a separate <b>drill file</b> pierces the copper
        </li>
      </ol>
    </DiagramFrame>
  );
}

const CSS = `
.gerb-svg{display:block;width:100%;height:auto;overflow:visible;}
.gerb-sheet{stroke:var(--color-panel-border,#3a3f50);stroke-width:1;opacity:.92;}
.gerb-silk{fill:var(--color-title,#f1ece0);}
.gerb-mask{fill:var(--color-signal-blue,#4a8fff);}
.gerb-cu{fill:var(--color-command-gold,#c8963e);}
.gerb-drill{fill:none;stroke:var(--color-signal-blue,#4a8fff);stroke-width:2;stroke-linecap:round;}
.gerb-nm{fill:var(--color-title,#f1ece0);font-family:var(--font-mono,"Space Mono",monospace);
  font-size:12px;font-weight:700;text-anchor:middle;}
.gerb-cap{fill:var(--color-command-gold,#c8963e);font-family:var(--font-mono,"Space Mono",monospace);
  font-size:12px;font-weight:700;text-anchor:middle;}

/* phone rows (hidden ≥521px) */
.gerb-narrow{display:none;}
.gerb-list{list-style:none;margin:0;padding:0;text-align:left;}
.gerb-row{position:relative;display:flex;align-items:center;gap:.85rem;
  background:var(--color-navy-dark,#1f2438);border:1px solid var(--color-panel-border,#3a3f50);
  border-radius:5px;padding:.7rem .85rem;overflow:hidden;}
.gerb-swatch{flex:0 0 auto;width:10px;align-self:stretch;border-radius:2px;background:var(--color-muted,#aaa);}
.gerb-rowbody{display:flex;flex-direction:column;gap:.18rem;min-width:0;}
.gerb-rowname{color:var(--color-title,#f1ece0);font-weight:700;font-size:clamp(1.05rem,3vw,1.25rem);letter-spacing:.01em;}
.gerb-rowdesc{color:var(--color-muted,#aaa);font-size:clamp(.95rem,2.5vw,1.05rem);line-height:1.35;}
.gerb-row-silk .gerb-swatch{background:var(--color-title,#f1ece0);}
.gerb-row-mask .gerb-swatch{background:var(--color-signal-blue,#4a8fff);}
.gerb-row-cu{border-color:var(--color-command-gold,#c8963e);}
.gerb-row-cu .gerb-swatch{background:var(--color-command-gold,#c8963e);}
.gerb-row-cu .gerb-rowname{color:var(--color-gold-light,#e8b865);}
.gerb-rowdrill{position:absolute;right:14px;top:50%;width:13px;height:13px;margin-top:-6.5px;
  border-radius:50%;background:var(--color-deep-space,#08090d);border:2px solid var(--color-signal-blue,#4a8fff);}
.gerb-note{margin:.5rem 0 0;padding:0 .1rem;list-style:none;text-align:left;
  color:var(--color-muted,#aaa);font-size:clamp(.9rem,2.4vw,1rem);line-height:1.5;}
.gerb-note b{color:var(--color-signal-blue,#4a8fff);font-weight:700;}
.gerb-notetag{color:var(--color-signal-blue,#4a8fff);font-weight:700;font-size:.62rem;letter-spacing:.12em;
  border:1px solid var(--color-signal-blue,#4a8fff);border-radius:3px;padding:.18rem .4rem;margin-right:.5rem;white-space:nowrap;}

@media (max-width:520px){
  .gerb-wide{display:none;}
  .gerb-narrow{display:flex;flex-direction:column;gap:5px;}
}

/* Tier-B reveal (docs/diagrams/animation-standards.md): sheets settle in front
   to back; gated behind .armed so reduced-motion / no-JS shows the full static
   spread. The exporter forces reduced-motion, so the raster is the final state. */
.dgfrm.armed .gerb-sheet,.dgfrm.armed .gerb-row{opacity:0;}
.dgfrm.armed .gerb-sheet{transform:translateY(-6px);transform-box:fill-box;}
.dgfrm.armed .gerb-row{transform:translateY(-6px);}
.dgfrm.armed.in .gerb-sheet{opacity:.92;transform:none;
  transition:opacity .5s cubic-bezier(.2,.7,.2,1),transform .5s cubic-bezier(.2,.7,.2,1);transition-delay:var(--d,0s);}
.dgfrm.armed.in .gerb-row{opacity:1;transform:none;
  transition:opacity .5s cubic-bezier(.2,.7,.2,1),transform .5s cubic-bezier(.2,.7,.2,1);transition-delay:var(--d,0s);}
@media (prefers-reduced-motion:reduce){
  .dgfrm .gerb-sheet{opacity:.92!important;transform:none!important;transition:none!important;}
  .dgfrm .gerb-row{opacity:1!important;transform:none!important;transition:none!important;}
}
`;
