// Buck (step-down) topology (v2). Power & Batteries cluster. Owner-picked B3
// (block-simplified + waveforms).
//
// Teaching point (buck-converters): a buck steps a voltage down by switching, not
// burning. A switch chops the input into pulses; an inductor-capacitor (L-C)
// filter smooths those pulses into a steady lower voltage. Shown as a two-block
// flow (SWITCH -> L+C) with the chopped square wave and the smoothed flat line
// beneath. Gold = the through-path, gold-light = the waveforms.
//
// Landscape flow; reflows on a phone to two labelled waveform rows. Token-only
// color (re-themes in light + print).
import { DiagramFrame } from "./DiagramFrame";

// a pulse train (duty ~0.55), yHi = top (smaller y), yLo = bottom
function square(x0: number, x1: number, yHi: number, yLo: number, n: number): string {
  const w = (x1 - x0) / n;
  let d = `M${x0},${yHi}`;
  for (let i = 0; i < n; i++) {
    const x = x0 + i * w;
    d += ` L${(x + w * 0.55).toFixed(1)},${yHi} L${(x + w * 0.55).toFixed(1)},${yLo} L${(x + w).toFixed(1)},${yLo} L${(x + w).toFixed(1)},${yHi}`;
  }
  return d;
}

export function BuckTopology({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="BUCK REGULATORS"
      tone="gold"
      title="A buck steps voltage down by switching"
      ariaLabel="How a buck regulator steps voltage down. A 12 volt input feeds a switch, then an inductor-capacitor filter, then out at 3.3 volts. Beneath, the switch turns the input into a chopped square wave of pulses, and the L-C filter smooths those pulses into a steady lower voltage."
      caption={caption}
      defaultCaption="Chop the input with a switch, then let an L-C filter smooth the pulses into a steady lower rail."
    >
      <style>{CSS}</style>

      <div className="bk">
        {/* desktop / print: block flow + waveforms */}
        <svg className="bk-scene" viewBox="0 0 500 206" aria-hidden="true">
          {/* flow */}
          <text className="bk-v" x="22" y="66" textAnchor="start">12 V</text>
          <line className="bk-w" x1="22" y1="80" x2="64" y2="80" />
          <rect className="bk-blk" x="64" y="56" width="104" height="48" rx="6" />
          <text className="bk-part" x="116" y="86" textAnchor="middle">SWITCH</text>
          <line className="bk-w" x1="168" y1="80" x2="226" y2="80" />
          <rect className="bk-blk" x="226" y="56" width="116" height="48" rx="6" />
          <text className="bk-part" x="284" y="86" textAnchor="middle">L + C</text>
          <line className="bk-w" x1="342" y1="80" x2="400" y2="80" />
          <text className="bk-v" x="404" y="66" textAnchor="start">3.3 V</text>
          {/* waveforms beneath */}
          <path className="bk-wave" fill="none" d={square(120, 220, 138, 164, 3)} />
          <text className="bk-lbl" x="170" y="184" textAnchor="middle">chopped</text>
          <line className="bk-wave" x1="298" y1="150" x2="400" y2="150" />
          <text className="bk-lbl" x="349" y="184" textAnchor="middle">smoothed</text>
        </svg>

        {/* phone: two labelled waveform rows */}
        <ul className="bk-list" aria-hidden="true">
          <li>
            <svg viewBox="0 0 80 40" className="bk-mini">
              <path className="bk-wave" fill="none" d={square(6, 74, 10, 30, 3)} />
            </svg>
            <span className="bk-li-lbl">SWITCH</span>
            <span className="bk-li-note">chops the 12 V input into pulses</span>
          </li>
          <li>
            <svg viewBox="0 0 80 40" className="bk-mini">
              <line className="bk-wave" x1="6" y1="20" x2="74" y2="20" />
            </svg>
            <span className="bk-li-lbl">L + C</span>
            <span className="bk-li-note">smooths the pulses to a steady 3.3 V</span>
          </li>
        </ul>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.bk{display:block;}
.bk-scene{display:block;width:100%;height:auto;overflow:visible;}
.bk-w{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2.5;stroke-linecap:round;}
.bk-blk{fill:var(--color-navy-dark,#1a1a2e);stroke:var(--color-command-gold,#c8963e);stroke-width:2;}
.bk-part{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;fill:var(--color-command-gold,#c8963e);font-size:14px;letter-spacing:.02em;}
.bk-v{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;fill:var(--color-text,#e8e8e8);font-size:15px;}
.bk-wave{fill:none;stroke:var(--color-gold-light,#e8b865);stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;}
.bk-lbl{font-family:var(--font-mono,"Space Mono",monospace);fill:var(--color-muted,#aaa);font-size:12px;}

/* phone reflow */
.bk-list{display:none;list-style:none;margin:0;padding:0;flex-direction:column;gap:.6rem;}
@media (max-width:520px){ .bk-scene{display:none;} .bk-list{display:flex;} }
.bk-list li{display:grid;grid-template-columns:80px auto 1fr;grid-template-rows:auto auto;align-items:center;gap:0 .8rem;
  padding:.6rem .8rem;border-radius:6px;text-align:left;
  background:var(--color-navy-dark,#1a1a2e);box-shadow:inset 0 0 0 1.5px var(--color-panel-border,#3a3f50);}
.bk-mini{grid-row:1 / span 2;width:80px;height:40px;overflow:visible;}
.bk-li-lbl{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:1.1rem;color:var(--color-command-gold,#c8963e);align-self:end;}
.bk-li-note{grid-column:2 / span 2;font-family:var(--font-serif,"Lora",serif);font-size:.84rem;color:var(--color-muted,#aaa);align-self:start;}

/* Tier-B reveal off the frame's armed/in contract (settled under reduced-motion). */
.dgfrm.armed .bk-wave{opacity:0;}
.dgfrm.armed.in .bk-wave{opacity:1;transition:opacity .6s ease .18s;}
@media (prefers-reduced-motion:reduce){ .dgfrm .bk-wave{opacity:1!important;} }
`;
