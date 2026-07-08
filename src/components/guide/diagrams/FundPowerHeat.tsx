// Power and heat: a resistor turns the power it drops into heat (v2).
// Fundamentals cluster. Owner-picked P1 ("resistor heats up").
//
// Teaching point: the power a resistor dissipates (P = I squared times R) does
// not vanish, it leaves as heat, and that heat is what a part's power rating
// limits. Current in, heat out, the part warms.
//
// Landscape desktop/print: current through a resistor, heat rising off it, a
// thermometer reading warm. REFLOWS to two stacked cards on a phone so the
// labels never scale under the floor. Token-only color; the lone exponent is an
// SVG superscript (no diagram uses KaTeX and the render route omits its fonts).
import { DiagramFrame } from "./DiagramFrame";

// resistor zigzag body, y-centred at 140, x 150..290
const RES = "150,140 161.7,131 185,149 208.3,131 231.7,149 255,131 278.3,149 290,140";

// a rising wavy heat plume from (cx, baseY) up by h
function heatWave(cx: number, baseY: number, h: number): string {
  let d = `M${cx},${baseY}`;
  for (let i = 0; i < 4; i++) {
    const y = baseY - (i * h) / 4 - h / 8;
    d += ` Q${cx + (i % 2 ? 7 : -7)},${y} ${cx},${y - h / 8}`;
  }
  return d;
}

export function FundPowerHeat({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="FUNDAMENTALS · POWER"
      tone="gold"
      title="Power and heat"
      ariaLabel="A resistor turning power into heat. Current flows through a resistor; the power it dissipates, P equals I squared times R, leaves as heat, drawn as wavy plumes rising off the resistor, and a thermometer beside it reads warm. That heat is what a part's power rating limits: stay under the rating and it runs cool, exceed it and the part overheats."
      caption={caption}
      defaultCaption="Power dissipated becomes heat (P = I²R). A part's power rating is the limit on how much it can shed."
    >
      <style>{CSS}</style>

      <div className="ph">
        {/* desktop / print: the scene */}
        <svg className="ph-scene" viewBox="0 0 520 220" aria-hidden="true">
          {/* current through the resistor */}
          <line className="ph-wire" x1="50" y1="140" x2="150" y2="140" />
          <polyline className="ph-wire" points={RES} fill="none" />
          <line className="ph-wire" x1="290" y1="140" x2="360" y2="140" />
          <line className="ph-flow" x1="80" y1="140" x2="132" y2="140" />
          <path className="ph-flow" fill="none" d="M124,135 L132,140 L124,145" />
          <text className="ph-i" x="103" y="124" textAnchor="middle">I</text>

          {/* heat rising */}
          <path className="ph-heat" d={heatWave(192, 124, 54)} />
          <path className="ph-heat" d={heatWave(215, 124, 66)} />
          <path className="ph-heat" d={heatWave(238, 124, 54)} />

          {/* the power dissipated */}
          <text className="ph-eq" x="215" y="60" textAnchor="middle">
            <tspan className="ph-g">P</tspan> = I<tspan className="ph-sup" dy="-9">2</tspan>
            <tspan dy="9">R</tspan>
          </text>

          {/* thermometer */}
          <rect className="ph-glass" x="424" y="104" width="12" height="52" rx="6" />
          <circle className="ph-glass" cx="430" cy="168" r="12" />
          <circle className="ph-merc" cx="430" cy="168" r="8" />
          <rect className="ph-merc" x="427" y="126" width="6" height="42" rx="3" />
          <text className="ph-lbl" x="430" y="200" textAnchor="middle">HEAT</text>
        </svg>

        {/* phone: two stacked cards */}
        <ul className="ph-list" aria-hidden="true">
          <li>
            <svg viewBox="0 0 90 44" className="ph-mini">
              <line className="ph-wire" x1="4" y1="30" x2="24" y2="30" />
              <polyline className="ph-wire" points="24,30 30,23 40,37 50,23 60,37 66,30 84,30" fill="none" />
              <path className="ph-heat" d={heatWave(38, 20, 16)} />
              <path className="ph-heat" d={heatWave(52, 20, 16)} />
            </svg>
            <span className="ph-li-eq">
              P = I<sup>2</sup>R
            </span>
            <span className="ph-li-note">the power dropped leaves as heat</span>
          </li>
          <li>
            <svg viewBox="0 0 90 44" className="ph-mini">
              <rect className="ph-glass" x="40" y="4" width="9" height="26" rx="4.5" />
              <circle className="ph-glass" cx="44.5" cy="34" r="8" />
              <circle className="ph-merc" cx="44.5" cy="34" r="5" />
              <rect className="ph-merc" x="42" y="16" width="5" height="18" rx="2.5" />
            </svg>
            <span className="ph-li-eq ph-li-heat">HEAT</span>
            <span className="ph-li-note">the part warms; its rating caps the watts</span>
          </li>
        </ul>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.ph{display:block;}
.ph-scene{display:block;width:100%;height:auto;overflow:visible;}
.ph-wire{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:3;stroke-linecap:round;stroke-linejoin:round;}
.ph-flow{fill:none;stroke:var(--color-signal-blue,#4a8fff);stroke-width:3;stroke-linecap:round;stroke-linejoin:round;}
.ph-heat{fill:none;stroke:var(--color-alert-red,#ef5350);stroke-width:2.5;stroke-linecap:round;opacity:.9;}
.ph-glass{fill:var(--color-navy-dark,#1f2438);stroke:var(--color-panel-border,#3a3f50);stroke-width:1.5;}
.ph-merc{fill:var(--color-alert-red,#ef5350);}
.ph-i{font-family:var(--font-display,"Bebas Neue",sans-serif);font-size:22px;fill:var(--color-signal-blue,#4a8fff);}
.ph-eq{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:26px;fill:var(--color-title,#f1ece0);}
.ph-eq .ph-g{fill:var(--color-command-gold,#c8963e);}
.ph-eq .ph-sup{font-size:16px;}
.ph-lbl{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:12px;letter-spacing:.12em;fill:var(--color-muted,#aaa);}

/* phone reflow */
.ph-list{display:none;list-style:none;margin:0;padding:0;flex-direction:column;gap:.5rem;}
@media (max-width:520px){ .ph-scene{display:none;} .ph-list{display:flex;} }
.ph-list li{display:grid;grid-template-columns:90px auto 1fr;grid-template-rows:auto auto;align-items:center;gap:.15rem .8rem;
  padding:.6rem .8rem;border-radius:6px;text-align:left;
  background:var(--color-navy-dark,#1f2438);box-shadow:inset 0 0 0 1.5px var(--color-panel-border,#3a3f50);}
.ph-mini{grid-row:1 / span 2;width:90px;height:44px;overflow:visible;}
.ph-li-eq{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:1.2rem;color:var(--color-title,#f1ece0);align-self:end;}
.ph-li-heat{color:var(--color-alert-red,#ef5350);letter-spacing:.08em;}
.ph-li-note{grid-column:2 / span 2;font-family:var(--font-serif,"Lora",serif);font-size:.82rem;color:var(--color-muted,#aaa);align-self:start;}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .ph-heat,.dgfrm.armed .ph-merc{opacity:0;}
.dgfrm.armed.in .ph-heat{opacity:.9;transition:opacity .5s ease .2s;}
.dgfrm.armed.in .ph-merc{opacity:1;transition:opacity .6s ease;}
@media (prefers-reduced-motion:reduce){
  .dgfrm .ph-heat{opacity:.9!important;} .dgfrm .ph-merc{opacity:1!important;}
}
`;
