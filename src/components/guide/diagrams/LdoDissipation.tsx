// LDO dissipation (v2). Power & Batteries cluster. Owner-picked L8 (flow + big
// heat readout).
//
// Teaching point (linear-regulators-ldo): an LDO passes the full load current
// while dropping the voltage difference across itself, and that dropped voltage
// times the current leaves as heat. The lesson's worked example: drop 1.7 V (5 V
// in to 3.3 V out) at 0.2 A -> 0.34 W, all of it heat. Gold = the through-path,
// blue = the current, red = the heat.
//
// Landscape flow; reflows on a phone to a compact flow + an HTML heat readout.
// Token-only color (re-themes in light + print).
import { DiagramFrame } from "./DiagramFrame";

// a rising wavy heat plume from (cx, baseY) up by h (from the vetted glyph set)
function heatWave(cx: number, baseY: number, h: number): string {
  let d = `M${cx},${baseY}`;
  for (let i = 0; i < 4; i++) {
    const y = baseY - (i * h) / 4 - h / 8;
    d += ` Q${cx + (i % 2 ? 7 : -7)},${y} ${cx},${y - h / 8}`;
  }
  return d;
}

export function LdoDissipation({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="LINEAR REGULATORS"
      tone="gold"
      title="An LDO burns the voltage it drops as heat"
      ariaLabel="A linear regulator dropping voltage as heat. A 5 volt input flows through an LDO block that outputs 3.3 volts at the same current, with red plumes of heat rising from it. The 1.7 volt difference it drops, times the 0.2 amp load current, is 0.34 watts, all dissipated as heat."
      caption={caption}
      defaultCaption="The LDO passes the current but drops 1.7 V; that drop times the current is 0.34 W, all of it heat."
    >
      <style>{CSS}</style>

      <div className="ld">
        {/* desktop / print: the flow + heat + readout */}
        <svg className="ld-scene" viewBox="0 0 500 206" aria-hidden="true">
          {/* heat rising off the regulator */}
          <path className="ld-heat" d={heatWave(226, 62, 42)} />
          <path className="ld-heat" d={heatWave(250, 62, 52)} />
          <path className="ld-heat" d={heatWave(274, 62, 42)} />
          {/* the LDO block */}
          <rect className="ld-blk" x="200" y="70" width="100" height="58" rx="6" />
          <text className="ld-blkt" x="250" y="106" textAnchor="middle">LDO</text>
          {/* current in / out */}
          <line className="ld-flow" x1="60" y1="99" x2="192" y2="99" />
          <path className="ld-flow" fill="none" d="M187,94 L200,99 L187,104" />
          <line className="ld-flow" x1="300" y1="99" x2="432" y2="99" />
          <path className="ld-flow" fill="none" d="M427,94 L440,99 L427,104" />
          <text className="ld-v" x="112" y="90" textAnchor="middle">5 V</text>
          <text className="ld-sub" x="112" y="118" textAnchor="middle">in</text>
          <text className="ld-v" x="388" y="90" textAnchor="middle">3.3 V</text>
          <text className="ld-sub" x="388" y="118" textAnchor="middle">out</text>
          {/* the heat readout */}
          <text className="ld-calc" x="250" y="162" textAnchor="middle">1.7 V dropped x 0.2 A</text>
          <text className="ld-big" x="250" y="194" textAnchor="middle">= 0.34 W heat</text>
        </svg>

        {/* phone: compact flow + readout */}
        <div className="ld-list" aria-hidden="true">
          <svg viewBox="0 0 300 96" className="ld-mini">
            <path className="ld-heat" d={heatWave(136, 30, 22)} />
            <path className="ld-heat" d={heatWave(150, 30, 28)} />
            <path className="ld-heat" d={heatWave(164, 30, 22)} />
            <rect className="ld-blk" x="118" y="38" width="64" height="34" rx="5" />
            <text className="ld-blkt" x="150" y="61" textAnchor="middle" style={{ fontSize: "16px" }}>LDO</text>
            <line className="ld-flow" x1="14" y1="55" x2="110" y2="55" />
            <path className="ld-flow" fill="none" d="M105,50 L118,55 L105,60" />
            <line className="ld-flow" x1="182" y1="55" x2="286" y2="55" />
            <path className="ld-flow" fill="none" d="M281,50 L294,55 L281,60" />
            <text className="ld-v" x="52" y="46" textAnchor="middle" style={{ fontSize: "14px" }}>5 V</text>
            <text className="ld-v" x="240" y="46" textAnchor="middle" style={{ fontSize: "14px" }}>3.3 V</text>
          </svg>
          <p className="ld-pnote">
            <span>1.7 V drop x 0.2 A =</span> <b>0.34 W</b> <span>heat</span>
          </p>
        </div>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.ld{display:block;}
.ld-scene{display:block;width:100%;height:auto;overflow:visible;}
.ld-heat{fill:none;stroke:var(--color-alert-red,#ef5350);stroke-width:2.5;stroke-linecap:round;opacity:.9;}
.ld-blk{fill:var(--color-diagram-surface,#1f2438);stroke:var(--color-panel-border,#3a3f50);stroke-width:2;}
.ld-blkt{font-family:var(--font-display,"Bebas Neue",sans-serif);fill:var(--color-title,#f1ece0);font-size:22px;letter-spacing:.03em;}
.ld-flow{fill:none;stroke:var(--color-signal-blue,#4a8fff);stroke-width:3;stroke-linecap:round;stroke-linejoin:round;}
.ld-v{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;fill:var(--color-text,#e8e8e8);font-size:17px;}
.ld-sub{font-family:var(--font-mono,"Space Mono",monospace);fill:var(--color-muted,#aaa);font-size:12px;}
.ld-calc{font-family:var(--font-mono,"Space Mono",monospace);fill:var(--color-muted,#aaa);font-size:12px;}
.ld-big{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;fill:var(--color-alert-red,#ef5350);font-size:26px;}

/* phone reflow */
.ld-list{display:none;flex-direction:column;gap:.6rem;align-items:center;}
@container (max-width:520px){ .ld-scene{display:none;} .ld-list{display:flex;} }
.ld-mini{display:block;width:100%;height:auto;overflow:visible;}
.ld-pnote{margin:0;font-family:var(--font-mono,"Space Mono",monospace);font-size:.9rem;color:var(--color-muted,#aaa);}
.ld-pnote b{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:1.4rem;color:var(--color-alert-red,#ef5350);}

/* Tier-B reveal off the frame's armed/in contract (settled under reduced-motion). */
.dgfrm.armed .ld-heat{opacity:0;}
.dgfrm.armed.in .ld-heat{opacity:.9;transition:opacity .5s ease .2s;}
@media (prefers-reduced-motion:reduce){ .dgfrm .ld-heat{opacity:.9!important;} }
`;
