// 2-layer board stackup (edge-on) as a responsive HTML component.
//
// Why not an SVG: a fixed-viewBox SVG scales to its container, so on a ~360px
// phone a 780-wide canvas renders at ~0.46x and ANY text shrinks below an
// accessible size. Rendered as real HTML/CSS, every label is actual CSS px
// (clamped, never below ~14px, body ≥15px) that do NOT scale with the viewport;
// only the layer slabs (the graphic) are CSS boxes. On wide screens the graphic
// sits beside the layer key; on phones (≤520px) it stacks — graphic on top, the
// key in full-width readable blocks below.
//
// Header / frame / caption come from the shared DiagramFrame (site-standard
// Bebas title); this file supplies only the graphic body.
//
// BRAND (onethousanddrones.com/brand): gold-dominant on Deep Space, Navy Dark
// bodies, Signal Blue only as the secondary accent (the one signal trace). All
// colours via @theme tokens with literal fallbacks so a standalone render still
// resolves.
import { DiagramFrame } from "./DiagramFrame";

export function TwoLayerCrossSection({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="STACKUP · EDGE-ON"
      tone="gold"
      title="A 2-layer board, edge-on"
      ariaLabel="Edge-on cross-section of a two-layer board. The part sits on the top copper, which carries the signal traces and the parts. Below it is the FR4 core, the insulator. Below that is the bottom copper, one continuous ground plane that is the return path. Plated vias tie the top and bottom layers together through the core."
      caption={caption}
      defaultCaption="Top: signals + parts. Bottom: one solid ground plane every signal returns through."
    >
      <style>{CSS}</style>
      <div className="xsec-stage">
        {/* the cross-section graphic */}
        <div className="xsec-graphic">
          <div className="xsec-stack" aria-hidden="true">
            <div className="xsec-part">part</div>
            <div className="xsec-layer xsec-cu xsec-top">
              <span className="xsec-trace" />
            </div>
            <div className="xsec-layer xsec-core">
              <span className="xsec-core-tag">FR4</span>
            </div>
            <div className="xsec-layer xsec-cu xsec-bot" />
            <span className="xsec-via" />
          </div>
          <p className="xsec-legend" aria-hidden="true">
            <span className="xsec-dot xsec-dot-blue" />signal trace&nbsp;&nbsp;
            <span className="xsec-dot xsec-dot-gold" />via
          </p>
        </div>

        {/* layer key, beside the stack on wide screens, stacked below on phones */}
        <div className="xsec-key">
          <div className="xsec-row">
            <span className="xsec-swatch xsec-sw-cu" />
            <div className="xsec-rowtext">
              <p className="xsec-rowname">Top copper</p>
              <p className="xsec-rowbody">Signal traces and the parts ride up here.</p>
            </div>
          </div>
          <div className="xsec-row">
            <span className="xsec-swatch xsec-sw-core" />
            <div className="xsec-rowtext">
              <p className="xsec-rowname xsec-muted">FR4 core</p>
              <p className="xsec-rowbody">The insulator that separates the two copper layers.</p>
            </div>
          </div>
          <div className="xsec-row">
            <span className="xsec-swatch xsec-sw-cu" />
            <div className="xsec-rowtext">
              <p className="xsec-rowname">Bottom copper</p>
              <p className="xsec-rowbody">One continuous ground plane — the return path every signal flows back through.</p>
            </div>
          </div>
          <div className="xsec-row">
            <span className="xsec-swatch xsec-sw-via" />
            <div className="xsec-rowtext">
              <p className="xsec-rowname">Via</p>
              <p className="xsec-rowbody">A plated hole that ties the top and bottom layers together through the core.</p>
            </div>
          </div>
        </div>
      </div>
    </DiagramFrame>
  );
}

// Token-driven (var(--color-*) / var(--font-*) from @theme) with literal
// fallbacks so a standalone render still resolves. Gold-dominant per brand.
const CSS = `
.xsec-stage{display:flex;align-items:center;gap:clamp(1.25rem,4vw,2rem);text-align:left;}

/* ---- graphic ---- */
.xsec-graphic{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;
  width:clamp(170px,36%,220px);}
.xsec-stack{position:relative;width:100%;}
.xsec-legend{margin:.7rem 0 0;display:flex;align-items:center;justify-content:center;
  color:var(--color-muted,#aaa);font-size:.62rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;}
.xsec-dot{display:inline-block;width:14px;height:6px;border-radius:3px;margin-right:.35rem;vertical-align:middle;}
.xsec-dot-blue{background:var(--color-signal-blue,#4a8fff);}
.xsec-dot-gold{background:var(--color-command-gold,#c8963e);}
.xsec-part{width:46%;margin:0 auto;box-sizing:border-box;height:42px;
  display:flex;align-items:center;justify-content:center;
  background:var(--color-navy-dark,#1f2438);border:2.5px solid var(--color-command-gold,#c8963e);
  border-bottom:none;border-radius:4px 4px 0 0;
  color:#fff;font-weight:700;font-size:clamp(.95rem,2.5vw,1.05rem);}
.xsec-layer{position:relative;display:flex;align-items:center;justify-content:center;box-sizing:border-box;}
.xsec-cu{height:30px;background:var(--color-command-gold,#c8963e);}
.xsec-core{height:84px;background:var(--color-navy-dark,#1f2438);
  border-top:1px solid var(--color-panel-border,#3a3f50);
  border-bottom:1px solid var(--color-panel-border,#3a3f50);}
.xsec-core-tag{color:var(--color-muted,#aaa);font-size:.62rem;font-weight:700;letter-spacing:.18em;}
.xsec-trace{position:absolute;top:-7px;left:50%;transform:translateX(-50%);width:38px;height:5px;border-radius:3px;
  background:var(--color-signal-blue,#4a8fff);}
/* a single solid plated via tying top copper -> bottom copper through the core
   (one filled gold column, so its centre never reads as the navy FR4 core). */
.xsec-via{position:absolute;width:12px;left:61%;border-radius:3px;
  background:var(--color-command-gold,#c8963e);top:42px;bottom:0;}

/* ---- key ---- */
.xsec-key{flex:1 1 auto;display:flex;flex-direction:column;gap:clamp(.75rem,2.5vw,1rem);}
.xsec-row{display:flex;align-items:flex-start;gap:.7rem;}
.xsec-swatch{flex:0 0 auto;width:14px;height:14px;margin-top:3px;border-radius:3px;}
.xsec-sw-cu{background:var(--color-command-gold,#c8963e);}
.xsec-sw-core{background:var(--color-navy-dark,#1f2438);border:1px solid var(--color-panel-border,#3a3f50);}
.xsec-sw-via{background:var(--color-command-gold,#c8963e);border-radius:2px;width:7px;margin-left:3.5px;margin-right:3.5px;}
.xsec-rowtext{min-width:0;}
.xsec-rowname{margin:0;color:#fff;font-weight:700;font-size:clamp(1.05rem,3vw,1.2rem);line-height:1.2;}
.xsec-rowname.xsec-muted{color:var(--color-muted,#aaa);}
.xsec-rowbody{margin:.2rem 0 0;color:var(--color-muted,#aaa);
  font-family:var(--font-serif,"Lora",serif);font-size:clamp(.95rem,2.5vw,1.05rem);line-height:1.45;}

/* stack on phones */
@media (max-width:520px){
  .xsec-stage{flex-direction:column;gap:clamp(1.25rem,5vw,1.6rem);}
  .xsec-graphic{width:min(230px,72%);}
  .xsec-key{width:100%;}
}
`;
