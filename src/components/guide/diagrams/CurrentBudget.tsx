// Current-budget diagram as a responsive v2 gauge.
//
// Teaching point: the board draws ~550 mA (a 500 mA Wi-Fi TX peak + ~50 mA for
// the rest) against the RT9080 LDO's 600 mA ceiling, so it fits with ~50 mA of
// headroom. Drawn as a half-circle gauge: the filled arc (gold Wi-Fi + blue
// rest) is the 550 mA draw, the red arc is the last stretch up to the 600 mA
// ceiling, and the needle sits at the fill level.
//
// v2: landscape gauge (was a portrait stacked-bar list). Only the big "550" and
// the arc live in the SVG (they scale legibly); every detail rides an HTML
// legend beneath in real px, so a phone stays readable without shrinking text.
// Token-only color throughout.
import { DiagramFrame } from "./DiagramFrame";

// Gauge geometry (0..600 mA over a half circle). Compact viewBox so the gauge
// sits BESIDE the legend on desktop (keeps the figure landscape, not tall).
const CX = 150;
const CY = 150;
const R = 120;

function pt(v: number, r = R): [number, number] {
  const a = Math.PI * (1 - v / 600);
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)];
}
// A half-circle sub-arc is always < 180°, so the large-arc-flag is always 0.
function arcD(v0: number, v1: number): string {
  const [x0, y0] = pt(v0);
  const [x1, y1] = pt(v1);
  return `M${x0.toFixed(1)},${y0.toFixed(1)} A${R},${R} 0 0 1 ${x1.toFixed(1)},${y1.toFixed(1)}`;
}
const NEEDLE = pt(550, R - 8);

export function CurrentBudget({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="POWER BUDGET"
      tone="gold"
      title="Does it fit under the 600 mA ceiling?"
      ariaLabel="Current budget: the board draws about 550 mA (a 500 mA Wi-Fi transmit peak plus 50 mA for the rest) against the RT9080 LDO's 600 mA ceiling, leaving roughly 50 mA of headroom."
      caption={caption}
      defaultCaption="Thin headroom, but it fits: that's why it's a 600 mA part, not a tiny 150 mA one."
    >
      <style>{CSS}</style>

      <div className="cbgt-wrap">
        <svg className="cbgt-svg" viewBox="0 0 300 178" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          {/* arc: gold 0..500 (Wi-Fi), blue 500..550 (rest) = the 550 draw; red 550..600 = margin to ceiling */}
          <path className="cbgt-arc cbgt-wifi" d={arcD(0, 500)} />
          <path className="cbgt-arc cbgt-rest" d={arcD(500, 550)} />
          <path className="cbgt-arc cbgt-margin" d={arcD(550, 600)} />
          {/* needle at the 550 fill level */}
          <line className="cbgt-needle" x1={CX} y1={CY} x2={NEEDLE[0].toFixed(1)} y2={NEEDLE[1].toFixed(1)} />
          <circle className="cbgt-pivot" cx={CX} cy={CY} r="6" />
          {/* readout */}
          <text className="cbgt-big" x={CX} y={CY - 52} textAnchor="middle">550</text>
          <text className="cbgt-unit" x={CX} y={CY - 32} textAnchor="middle">mA drawn of 600</text>
          {/* endpoint scale */}
          <text className="cbgt-end" x={pt(0)[0]} y={pt(0)[1] + 20} textAnchor="middle">0</text>
          <text className="cbgt-end cbgt-ceil" x={pt(600)[0]} y={pt(600)[1] + 20} textAnchor="middle">600</text>
        </svg>

        <ul className="cbgt-legend">
          <li><span className="cbgt-sw cbgt-sw-wifi" /><span className="cbgt-txt">Wi-Fi TX peak <b>≈ 500&nbsp;mA</b></span></li>
          <li><span className="cbgt-sw cbgt-sw-rest" /><span className="cbgt-txt">rest of board <b>≈ 50&nbsp;mA</b></span></li>
          <li><span className="cbgt-sw cbgt-sw-margin" /><span className="cbgt-txt">headroom <b>≈ 50&nbsp;mA</b>, up to the 600&nbsp;mA ceiling</span></li>
        </ul>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.cbgt-wrap{display:flex;align-items:center;justify-content:center;gap:clamp(.8rem,3vw,1.5rem);}
@media (max-width:520px){.cbgt-wrap{flex-direction:column;gap:1rem;}}
.cbgt-svg{display:block;width:100%;height:auto;overflow:visible;flex:1 1 48%;min-width:0;max-width:270px;}
.cbgt-arc{fill:none;stroke-width:30;stroke-linecap:butt;}
.cbgt-wifi{stroke:var(--color-command-gold,#c8963e);}
.cbgt-rest{stroke:var(--color-signal-blue,#4a8fff);}
.cbgt-margin{stroke:var(--color-alert-red,#ef5350);}
.cbgt-needle{stroke:var(--color-title,#f1ece0);stroke-width:3;stroke-linecap:round;}
.cbgt-pivot{fill:var(--color-title,#f1ece0);}
.cbgt-big{fill:var(--color-text,#e8e8e8);font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:38px;}
.cbgt-unit{fill:var(--color-muted,#aaa);font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:12px;letter-spacing:.02em;}
.cbgt-end{fill:var(--color-muted,#aaa);font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:12px;}
.cbgt-ceil{fill:var(--color-alert-red,#ef5350);font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-size:14px;}

.cbgt-legend{margin:0;padding:clamp(.75rem,2.6vw,1rem) clamp(.85rem,3vw,1.05rem);list-style:none;
  flex:1 1 50%;min-width:0;display:flex;flex-direction:column;gap:.6rem;text-align:left;
  background:var(--color-diagram-surface,#1f2438);border:1px solid var(--color-panel-border,#3a3f50);border-radius:6px;}
@media (max-width:520px){.cbgt-legend{flex-basis:auto;align-self:stretch;}}
.cbgt-legend li{display:flex;align-items:center;gap:.5rem;color:var(--color-muted,#aaa);
  font-family:var(--font-mono,"Space Mono",monospace);font-size:clamp(.8rem,2.2vw,.9rem);line-height:1.35;}
.cbgt-txt{min-width:0;}
.cbgt-legend b{color:var(--color-text,#e8e8e8);font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:700;}
.cbgt-sw{width:.95rem;height:.95rem;border-radius:3px;flex:none;}
.cbgt-sw-wifi{background:var(--color-command-gold,#c8963e);}
.cbgt-sw-rest{background:var(--color-signal-blue,#4a8fff);}
.cbgt-sw-margin{background:var(--color-alert-red,#ef5350);}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .cbgt-svg,.dgfrm.armed .cbgt-legend li{opacity:0;transform:translateY(6px);}
.dgfrm.armed.in .cbgt-svg{opacity:1;transform:none;transition:opacity .55s ease,transform .55s cubic-bezier(.2,.7,.2,1);}
.dgfrm.armed.in .cbgt-legend li{opacity:1;transform:none;transition:opacity .5s ease,transform .5s ease;}
.dgfrm.armed.in .cbgt-legend li:nth-child(2){transition-delay:.1s;}
.dgfrm.armed.in .cbgt-legend li:nth-child(3){transition-delay:.2s;}
@media (prefers-reduced-motion:reduce){
  .dgfrm .cbgt-svg,.dgfrm .cbgt-legend li{opacity:1!important;transform:none!important;transition:none!important;}
}
`;
