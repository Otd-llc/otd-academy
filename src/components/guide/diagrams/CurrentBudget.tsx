// Current-budget diagram as a responsive HTML component.
//
// Why not an SVG: a fixed-viewBox SVG scales to its container, so on a ~360px
// phone a 780-wide canvas renders at ~0.46x and ANY text shrinks below an
// accessible size. Rendered as real HTML/CSS, the labels are actual CSS px
// (clamped, never below ~14px) that do NOT scale with the viewport; only the two
// budget bars (the graphic) carry the proportions, and their segment WIDTHS hold
// the real 0..600 mA scale (Wi-Fi 500 + rest 50 = 550 vs the 600 mA ceiling).
//
// Header / frame / caption come from the shared DiagramFrame (site-standard Bebas
// title); this file supplies only the graphic body. BRAND
// (onethousanddrones.com/brand): gold-dominant on Deep Space, Navy Dark bodies,
// Signal Blue only as the secondary "rest of board" callout, Alert Red ONLY for
// the hard 600 mA ceiling. All colours via @theme tokens.
import { DiagramFrame } from "./DiagramFrame";

export function CurrentBudget({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="POWER BUDGET"
      tone="gold"
      title="Does it fit under the LDO's 600 mA?"
      ariaLabel="Current budget: the board draws about 550 mA (a 500 mA Wi-Fi transmit peak plus 50 mA for the rest) against the RT9080 LDO's 600 mA ceiling, leaving roughly 50 mA of headroom."
      caption={caption}
      defaultCaption="Thin headroom — but it fits. That's why it's a 600 mA part, not a tiny 150 mA one."
    >
      <style>{CSS}</style>

      <div className="crtbgt-chart">
        {/* Bar 1 — what the board DRAWS (Wi-Fi TX peak 500 + rest 50 = ~550 mA) */}
        <div className="crtbgt-row">
          <p className="crtbgt-rowlabel">What the board draws</p>
          <div className="crtbgt-track">
            <div className="crtbgt-seg crtbgt-wifi" style={{ width: "83.333%" }}>
              <span className="crtbgt-segtext">Wi-Fi TX peak</span>
            </div>
            <div className="crtbgt-seg crtbgt-rest" style={{ width: "8.333%" }} />
          </div>
          <p className="crtbgt-sum">≈ 550&nbsp;mA total</p>
        </div>

        {/* Bar 2 — what the RT9080 SUPPLIES (used ~550 + headroom 50 = 600 ceiling) */}
        <div className="crtbgt-row">
          <p className="crtbgt-rowlabel">What the RT9080 LDO supplies</p>
          <div className="crtbgt-track">
            <div className="crtbgt-seg crtbgt-used" style={{ width: "91.666%" }}>
              <span className="crtbgt-segtext crtbgt-segtext-muted">used ≈ 550&nbsp;mA</span>
            </div>
            <div className="crtbgt-seg crtbgt-headroom" style={{ width: "8.333%" }} />
            <div className="crtbgt-ceiling" />
          </div>
          <p className="crtbgt-sum crtbgt-sum-ceiling">600&nbsp;mA ceiling</p>
        </div>
      </div>

      <ul className="crtbgt-legend">
        <li><span className="crtbgt-sw crtbgt-sw-wifi" />Wi-Fi TX peak <b>≈ 500&nbsp;mA</b></li>
        <li><span className="crtbgt-sw crtbgt-sw-rest" />rest of board <b>≈ 50&nbsp;mA</b></li>
        <li><span className="crtbgt-sw crtbgt-sw-headroom" />headroom <b>≈ 50&nbsp;mA</b></li>
      </ul>
    </DiagramFrame>
  );
}

// Token-driven (var(--color-*) / var(--font-*) from @theme) with literal
// fallbacks so a standalone render still resolves. Unique .crtbgt- prefix so
// styles never collide with other diagrams on the page.
const CSS = `
.crtbgt-chart{margin:0;display:flex;flex-direction:column;gap:clamp(1.1rem,4vw,1.5rem);text-align:left;}
.crtbgt-row{display:flex;flex-direction:column;gap:.5rem;}
.crtbgt-rowlabel{margin:0;color:var(--color-muted,#aaa);font-size:clamp(.85rem,2.3vw,.95rem);letter-spacing:.04em;}
.crtbgt-track{position:relative;display:flex;height:clamp(2.6rem,9vw,3rem);
  background:var(--color-navy-dark,#1f2438);border:1px solid var(--color-panel-border,#3a3f50);border-radius:3px;overflow:hidden;}
.crtbgt-seg{position:relative;display:flex;align-items:center;justify-content:center;min-width:0;}
.crtbgt-wifi{background:var(--color-navy-dark,#1f2438);box-shadow:inset 0 0 0 2px var(--color-command-gold,#c8963e);}
.crtbgt-rest{background:rgba(74,143,255,.18);box-shadow:inset 0 0 0 2px var(--color-signal-blue,#4a8fff);}
.crtbgt-used{background:var(--color-navy-dark,#1f2438);box-shadow:inset 0 0 0 1.5px var(--color-command-gold,#c8963e);}
.crtbgt-headroom{background:var(--color-command-gold,#c8963e);box-shadow:inset 0 0 0 1.5px var(--color-gold-light,#e8b865);}
.crtbgt-segtext{color:#fff;font-weight:700;font-size:clamp(.95rem,2.6vw,1.1rem);white-space:nowrap;padding:0 .3rem;}
.crtbgt-segtext-muted{color:var(--color-muted,#aaa);font-weight:400;font-size:clamp(.85rem,2.3vw,.95rem);}
.crtbgt-ceiling{position:absolute;top:-4px;bottom:-4px;right:0;width:3px;background:var(--color-alert-red,#c62828);}
.crtbgt-sum{margin:0;align-self:flex-end;color:var(--color-gray-1,#e8e8e8);font-size:clamp(.85rem,2.3vw,.95rem);letter-spacing:.03em;}
.crtbgt-sum-ceiling{color:var(--color-alert-red,#c62828);font-weight:700;}

.crtbgt-legend{margin:clamp(1.1rem,4vw,1.5rem) 0 0;padding:clamp(.85rem,3vw,1.1rem) clamp(.9rem,3vw,1.15rem);list-style:none;
  display:flex;flex-wrap:wrap;gap:.55rem clamp(1rem,4vw,1.6rem);
  background:var(--color-navy-dark,#1f2438);border:1px solid var(--color-panel-border,#3a3f50);border-radius:5px;}
.crtbgt-legend li{display:flex;align-items:center;gap:.5rem;color:var(--color-muted,#aaa);font-size:clamp(.85rem,2.3vw,.95rem);}
.crtbgt-legend b{color:var(--color-gray-1,#e8e8e8);font-weight:700;}
.crtbgt-sw{width:.95rem;height:.95rem;border-radius:2px;flex:none;}
.crtbgt-sw-wifi{background:var(--color-navy-dark,#1f2438);box-shadow:inset 0 0 0 2px var(--color-command-gold,#c8963e);}
.crtbgt-sw-rest{background:rgba(74,143,255,.18);box-shadow:inset 0 0 0 2px var(--color-signal-blue,#4a8fff);}
.crtbgt-sw-headroom{background:var(--color-command-gold,#c8963e);box-shadow:inset 0 0 0 2px var(--color-gold-light,#e8b865);}
`;
