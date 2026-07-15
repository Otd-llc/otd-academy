// The Gerber + drill output set as a responsive diagram (v2).
//
// Teaching point: "export gerbers" produces one flat file per fabrication layer.
// Desktop/print show them as an exploded isometric stack in physical order, front
// on top to back on bottom: F_Silk, F_Mask, F_Cu, B_Cu, B_Mask, B_Silk. A separate
// .drl drill file punches a hole down through every layer. Zip the set and that
// archive IS the board the fab builds.
//
// Layer materials (owner's rule): the two COPPER layers are solid metal, drawn
// fully OPAQUE and a touch thicker; the SILK and MASK layers are thin coatings,
// drawn as translucent films. Copper's edge is shaded (form), not translucent.
//
// v2: landscape isometric spread on desktop/print; on a phone it reflows to stacked
// full-width rows whose labels stay real CSS px (never shrinking under the floor).
// Token-only color via scoped CSS classes (never a fill="#…" presentation attr that
// can't read a var and would break in light). Two intentional FIXED values: the
// pale silkscreen (#d7d0bf, so it reads as white ink on BOTH the deep-space and
// ivory fields — a token would flip to ink-black on ivory) and copper's shaded
// edge (#7a5a22) — both are physical-material colours, the same exception the
// two-layer cross-section uses.
import { type CSSProperties } from "react";
import { DiagramFrame } from "./DiagramFrame";

// Front-to-back = top-to-bottom, exactly as the board stacks (silk outermost,
// the two coppers innermost).
type Kind = "silk" | "mask" | "cu";
const T2B: { name: string; kind: Kind }[] = [
  { name: "F_Silk", kind: "silk" },
  { name: "F_Mask", kind: "mask" },
  { name: "F_Cu", kind: "cu" },
  { name: "B_Cu", kind: "cu" },
  { name: "B_Mask", kind: "mask" },
  { name: "B_Silk", kind: "silk" },
];

// Phone rows carry the full filename + a plain-language gloss.
const ROWS: { name: string; desc: string; kind: Kind }[] = [
  { name: "F_Silkscreen.gbr", desc: "the white labels", kind: "silk" },
  { name: "F_Mask.gbr", desc: "solder mask, open at the pads", kind: "mask" },
  { name: "F_Cu.gbr", desc: "front copper, your traces", kind: "cu" },
  { name: "B_Cu.gbr", desc: "back copper, the ground plane", kind: "cu" },
  { name: "B_Mask.gbr", desc: "solder mask, open at the pads", kind: "mask" },
  { name: "B_Silkscreen.gbr", desc: "the white labels", kind: "silk" },
];

// ── isometric geometry (0..560 landscape space) ────────────────────────────────
const X = 120, Y0 = 48, W = 210, DX = 76, DY = 40, GAP = 26;
const TC = 15, TF = 9; // copper thicker (solid metal); films thin
const topP = (x: number, y: number, w: number) => `M${x},${y} l${DX},-${DY} h${w} l-${DX},${DY} Z`;
const sideP = (x: number, y: number, w: number, h: number) => `M${x + w},${y} l${DX},-${DY} v${h} l-${DX},${DY} Z`;

function slab(y: number, kind: Kind): string {
  const cu = kind === "cu";
  const T = cu ? TC : TF;
  const fill = `gls-${kind}`;
  const edge = cu ? "gls-edge-cu" : "gls-edge-film";
  return (
    (cu ? "" : `<g opacity="0.78">`) +
    `<path class="${fill}" d="${sideP(X, y, W, T)}"/>` +
    `<path class="gls-shade" d="${sideP(X, y, W, T)}"/>` +
    `<rect class="${fill}" x="${X}" y="${y}" width="${W}" height="${T}"/>` +
    `<path class="${fill}" d="${topP(X, y, W)}"/>` +
    `<path class="gls-lit" d="${topP(X, y, W)}"/>` +
    `<rect class="${edge}" x="${X}" y="${y}" width="${W}" height="${T}" fill="none"/>` +
    `<path class="${edge}" d="${topP(X, y, W)}" fill="none"/>` +
    `<path class="${edge}" d="${sideP(X, y, W, T)}" fill="none"/>` +
    (cu ? "" : `</g>`)
  );
}

// Static, module-constant markup (no props / no user input) — safe to inject.
function buildMarkup(): string {
  const ys = T2B.map((_, j) => Y0 + j * GAP);
  const tOf = (j: number) => (T2B[j].kind === "cu" ? TC : TF);
  let g = "";
  // slabs: bottom→top so upper layers overlap lower
  for (let j = T2B.length - 1; j >= 0; j--) g += slab(ys[j], T2B[j].kind);
  // drill: one hole punched through every layer, along a single bit path
  const sx = X + W * 0.58;
  g += `<line class="gls-bit" x1="${sx}" y1="${ys[0] - 6}" x2="${sx}" y2="${ys[5] + TF + 6}"/>`;
  ys.forEach((y, j) => (g += `<ellipse class="gls-hole" cx="${sx}" cy="${y + tOf(j) / 2}" rx="4" ry="3"/>`));
  // .drl file tag: an outlined gold pill above the stack, on a short leader
  const ty = ys[0] - DY / 2, ry = ty - 16, ph = 18, pw = 42;
  g += `<line class="gls-drl-line" x1="${sx}" y1="${ty}" x2="${sx}" y2="${ty - 8}"/>`;
  g += `<rect class="gls-drl-pill" x="${sx - pw / 2}" y="${ry - ph}" width="${pw}" height="${ph}" rx="4"/>`;
  g += `<text class="gls-drl-text" x="${sx}" y="${ry - ph / 2 + 4}" text-anchor="middle">.drl</text>`;
  // layer names, right of each slab
  ys.forEach((y, j) => (g += `<text class="gls-nm" x="${X + W + DX + 12}" y="${y - DY + tOf(j) / 2 + 4}">${T2B[j].name}</text>`));
  return g;
}
const MARKUP = buildMarkup();

export function GerberLayerStack({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="GERBER + DRILL OUTPUT"
      tone="gold"
      title="A Gerber set: one file per layer"
      ariaLabel="A Gerber set drawn as an exploded isometric stack in physical order, front layer on top to back layer on bottom: F_Silk (the white labels), F_Mask (solder mask, open at the pads), F_Cu (front copper, your traces), B_Cu (back copper, the ground plane), B_Mask, and B_Silk. The two copper layers are solid metal; the silk and mask layers are thin films. A separate drill file, .drl, punches a hole straight down through every layer. Zip all of them into one archive; that zip is the board the fab builds."
      caption={caption}
      defaultCaption="Zip every one into a single archive; that zip is the board the fab builds."
    >
      <style>{CSS}</style>

      {/* Desktop / print: exploded isometric stack */}
      <svg className="gls-svg gls-wide" viewBox="0 0 560 250" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <g dangerouslySetInnerHTML={{ __html: MARKUP }} />
      </svg>

      {/* Phone: reflow to stacked full-width rows (labels stay readable px) */}
      <ol className="gls-narrow gls-list">
        {ROWS.map((r, i) => (
          <li
            key={r.name}
            className={`gls-row gls-row-${r.kind}`}
            style={{ "--d": `${0.3 + i * 0.07}s` } as CSSProperties}
          >
            <span className="gls-swatch" aria-hidden="true" />
            <span className="gls-rowbody">
              <span className="gls-rowname">{r.name}</span>
              <span className="gls-rowdesc">{r.desc}</span>
            </span>
          </li>
        ))}
        <li className="gls-note">
          <span className="gls-notetag">.drl</span>a separate <b>drill file</b> punches a hole through every layer
        </li>
      </ol>
    </DiagramFrame>
  );
}

const CSS = `
.gls-svg{display:block;width:100%;height:auto;overflow:visible;}

/* layer fills: mask + copper are tokens (re-theme); silk is a fixed pale material
   (a token would flip to ink-black on the ivory page); shading/lit are fixed. */
.gls-silk{fill:#d7d0bf;}
.gls-mask{fill:var(--color-signal-blue,#4a8fff);}
.gls-cu{fill:var(--color-command-gold,#c8963e);}
.gls-shade{fill:#000000;opacity:.30;}
.gls-lit{fill:#ffffff;opacity:.10;}
.gls-edge-film{stroke:var(--color-panel-border,#3a3f50);stroke-width:1.1;}
.gls-edge-cu{stroke:#7a5a22;stroke-width:1.1;}

/* drill: dark void holes + faint bit path; .drl as an outlined gold file tag */
.gls-hole{fill:var(--color-deep-space,#08090d);}
.gls-bit{stroke:var(--color-deep-space,#08090d);stroke-opacity:.5;stroke-width:2;}
.gls-drl-line{stroke:var(--color-command-gold,#c8963e);stroke-width:1.6;}
.gls-drl-pill{fill:var(--color-deep-space,#08090d);stroke:var(--color-command-gold,#c8963e);stroke-width:1.4;}
.gls-drl-text{fill:var(--color-command-gold,#c8963e);font-family:var(--font-mono,"Space Mono",monospace);font-size:11px;font-weight:700;}
.gls-nm{fill:var(--color-muted,#aaa);font-family:var(--font-mono,"Space Mono",monospace);font-size:11px;font-weight:700;}

/* phone rows (hidden ≥521px) */
.gls-narrow{display:none;}
.gls-list{list-style:none;margin:0;padding:0;text-align:left;}
.gls-row{position:relative;display:flex;align-items:center;gap:.85rem;
  background:var(--color-diagram-surface,#1f2438);border:1px solid var(--color-panel-border,#3a3f50);
  border-radius:5px;padding:.7rem .85rem;overflow:hidden;}
.gls-swatch{flex:0 0 auto;width:10px;align-self:stretch;border-radius:2px;background:var(--color-muted,#aaa);}
.gls-rowbody{display:flex;flex-direction:column;gap:.18rem;min-width:0;}
.gls-rowname{color:var(--color-title,#f1ece0);font-weight:700;font-size:clamp(1.05rem,3vw,1.25rem);letter-spacing:.01em;}
.gls-rowdesc{color:var(--color-muted,#aaa);font-size:clamp(.95rem,2.5vw,1.05rem);line-height:1.35;}
.gls-row-silk .gls-swatch{background:#d7d0bf;}
.gls-row-mask .gls-swatch{background:var(--color-signal-blue,#4a8fff);}
.gls-row-cu{border-color:var(--color-command-gold,#c8963e);}
.gls-row-cu .gls-swatch{background:var(--color-command-gold,#c8963e);}
.gls-row-cu .gls-rowname{color:var(--color-gold-light,#e8b865);}
.gls-note{margin:.5rem 0 0;padding:0 .1rem;list-style:none;text-align:left;
  color:var(--color-muted,#aaa);font-size:clamp(.9rem,2.4vw,1rem);line-height:1.5;}
.gls-note b{color:var(--color-command-gold,#c8963e);font-weight:700;}
.gls-notetag{color:var(--color-command-gold,#c8963e);font-weight:700;font-size:.62rem;letter-spacing:.12em;
  border:1px solid var(--color-command-gold,#c8963e);border-radius:3px;padding:.18rem .4rem;margin-right:.5rem;white-space:nowrap;}

@container (max-width:520px){
  .gls-wide{display:none;}
  .gls-narrow{display:flex;flex-direction:column;gap:5px;}
}

/* Tier-B reveal: the stack fades in; the phone rows settle front to back. Gated
   behind .armed so reduced-motion / the exporter render shows the final state. */
.dgfrm.armed .gls-svg{opacity:0;}
.dgfrm.armed.in .gls-svg{opacity:1;transition:opacity .6s ease;}
.dgfrm.armed .gls-row{opacity:0;transform:translateY(-6px);}
.dgfrm.armed.in .gls-row{opacity:1;transform:none;
  transition:opacity .5s cubic-bezier(.2,.7,.2,1),transform .5s cubic-bezier(.2,.7,.2,1);transition-delay:var(--d,0s);}
@media (prefers-reduced-motion:reduce){
  .dgfrm .gls-svg{opacity:1!important;transition:none!important;}
  .dgfrm .gls-row{opacity:1!important;transform:none!important;transition:none!important;}
}
`;
