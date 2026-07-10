// Regulator choice compare (v2). Power & Batteries cluster. Owner-picked R1
// (visual matrix).
//
// Teaching point (ldo-vs-switching-regulator): choose by the drop, the current,
// and the noise budget. An LDO is lossy but quiet; a switcher (buck/boost) is
// efficient but noisier; and a buck-then-LDO hybrid gets both. Shown as a matrix
// of the three across efficiency (a bar), noise (a waveform: flat = quiet, square
// = switching noise), and when to reach for each, plus the hybrid callout.
//
// Landscape matrix on desktop; reflows to stacked cards on a phone so nothing
// scales under the floor. Token-only color: gold = efficiency, green = quiet,
// blue = switching noise (re-themes in light + print).
import { DiagramFrame } from "./DiagramFrame";

type Reg = { n: string; e: number; quiet: boolean; w: string };
// Cell text is terse (one line each, for a landscape aspect); the full guidance
// lives in the ariaLabel + the caption.
const REGS: Reg[] = [
  { n: "LDO", e: 28, quiet: true, w: "small drop, low current, or a clean rail" },
  { n: "Buck", e: 92, quiet: false, w: "a big drop or high current" },
  { n: "Boost", e: 88, quiet: false, w: "the rail is above the supply" },
];

function Noise({ quiet }: { quiet: boolean }) {
  return quiet ? (
    <svg className="rc-nw" viewBox="0 0 54 16" aria-hidden="true">
      <line className="rc-quiet" x1="2" y1="9" x2="52" y2="9" />
    </svg>
  ) : (
    <svg className="rc-nw" viewBox="0 0 54 16" aria-hidden="true">
      <path className="rc-noisy" fill="none" d="M2,12 L10,12 L10,4 L20,4 L20,12 L30,12 L30,4 L40,4 L40,12 L52,12" />
    </svg>
  );
}

function Eff({ e }: { e: number }) {
  return (
    <span className="rc-eff" aria-hidden="true">
      <span style={{ width: `${e}%` }} />
    </span>
  );
}

export function RegulatorChoice({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="LDO VS SWITCHER"
      tone="gold"
      title="Pick a regulator by drop, current, and noise"
      ariaLabel="A comparison of three regulators. An LDO is inefficient because it burns the drop, but it is very quiet, and it suits a small drop, low current, or a clean analog rail. A buck is highly efficient, over 90 percent, but carries switching noise, and it suits a big drop or high current. A boost is also efficient with switching noise, and is used when the rail sits above the supply. When you need both efficiency and quiet, chain a buck into an LDO: the buck moves the power efficiently and the LDO scrubs the noise off for a clean rail."
      caption={caption}
      defaultCaption="Choose by the drop, the current, and the noise budget; combine a buck and an LDO when you need both."
    >
      <style>{CSS}</style>

      <div className="rc">
        {/* desktop / print: the matrix */}
        <table className="rc-table">
          <thead>
            <tr>
              <th />
              <th>efficiency</th>
              <th>noise</th>
              <th>reach for it when</th>
            </tr>
          </thead>
          <tbody>
            {REGS.map((r) => (
              <tr key={r.n}>
                <td className="rc-rn">{r.n}</td>
                <td><Eff e={r.e} /></td>
                <td><Noise quiet={r.quiet} /></td>
                <td className="rc-when">{r.w}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* phone: stacked cards */}
        <ul className="rc-cards">
          {REGS.map((r) => (
            <li key={r.n}>
              <div className="rc-crow">
                <span className="rc-cn">{r.n}</span>
                <Eff e={r.e} />
                <Noise quiet={r.quiet} />
              </div>
              <div className="rc-cwhen">{r.w}</div>
            </li>
          ))}
        </ul>

        <p className="rc-hyb">
          Need both? <b>buck &rarr; LDO</b>: the buck moves the power efficiently, then a small LDO scrubs the noise off for a clean rail.
        </p>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.rc{display:block;}
.rc-eff{display:inline-block;width:56px;height:9px;border-radius:2px;background:var(--color-panel-border,#3a3f50);position:relative;vertical-align:middle;}
.rc-eff>span{position:absolute;left:0;top:0;height:9px;border-radius:2px;background:var(--color-command-gold,#c8963e);}
.rc-nw{width:54px;height:16px;display:inline-block;vertical-align:middle;overflow:visible;}
.rc-quiet{stroke:var(--color-status-green,#66bb6a);stroke-width:2.5;stroke-linecap:round;}
.rc-noisy{stroke:var(--color-signal-blue,#4a8fff);stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}

/* desktop matrix */
.rc-table{width:100%;border-collapse:collapse;font-family:var(--font-mono,"Space Mono",monospace);}
.rc-table th,.rc-table td{padding:.42rem .5rem;border-bottom:1px solid var(--color-panel-border,#3a3f50);text-align:left;vertical-align:middle;
  font-size:clamp(.8rem,2vw,.86rem);color:var(--color-muted,#aaa);line-height:1.35;}
.rc-table th{color:var(--color-command-gold,#c8963e);font-size:.66rem;text-transform:uppercase;letter-spacing:.09em;font-weight:700;}
.rc-rn{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;color:var(--color-command-gold,#c8963e);font-size:1.05rem;}
.rc-when{color:var(--color-text,#e8e8e8);}
@media (max-width:520px){ .rc-table{display:none;} }

/* phone cards */
.rc-cards{display:none;list-style:none;margin:0;padding:0;flex-direction:column;gap:.55rem;}
@media (max-width:520px){ .rc-cards{display:flex;} }
.rc-cards li{padding:.6rem .8rem;border-radius:6px;text-align:left;
  background:var(--color-navy-dark,#1a1a2e);box-shadow:inset 0 0 0 1.5px var(--color-panel-border,#3a3f50);}
.rc-crow{display:flex;align-items:center;gap:.7rem;}
.rc-cn{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;color:var(--color-command-gold,#c8963e);font-size:1.15rem;min-width:3.4rem;}
.rc-cwhen{margin-top:.35rem;font-family:var(--font-mono,"Space Mono",monospace);font-size:.82rem;color:var(--color-muted,#aaa);line-height:1.4;}

/* hybrid callout */
.rc-hyb{margin:.75rem 0 0;padding:.55rem .8rem;border:1px dashed var(--color-gold-light,#e8b865);border-radius:6px;
  font-family:var(--font-mono,"Space Mono",monospace);font-size:clamp(.78rem,2vw,.84rem);color:var(--color-muted,#aaa);line-height:1.45;text-align:left;}
.rc-hyb b{color:var(--color-gold-light,#e8b865);font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:1.02em;}
`;
