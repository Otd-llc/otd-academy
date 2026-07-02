// EEG classification pipeline as a responsive diagram (v2).
//
// Teaching point: turning a noisy EEG window into one of a few commands is a
// chain — epoch, bandpass, extract features (or spatially filter), classify. Two
// eras share the feature+classifier stage: the classic hand-engineered CSP + LDA,
// and the end-to-end learned EEGNet.
//
// v2: the signal is drawn transforming at each numbered stage (noisy window ->
// bandpassed wave -> feature scatter -> the classifier's decision line), a
// horizontal chain on desktop/print (~1.6 landscape) that reflows to a vertical
// stack of stage rows on a narrow phone (directive 1). Token-only color via CSS
// classes; the two learned/hand-engineered stages (features, classify) are gold.
import { DiagramFrame } from "./DiagramFrame";

function noisyPath(x0: number, x1: number, cy: number, amp: number): string {
  const p: string[] = [];
  for (let x = x0; x <= x1; x += 2) {
    const t = (x - x0) / (x1 - x0);
    const y = cy - amp * (Math.sin(t * 7 * 2 * Math.PI) * 0.5 + Math.sin(t * 17 * 2 * Math.PI + 1) * 0.3 + Math.sin(t * 31 * 2 * Math.PI) * 0.22);
    p.push(`${x},${y.toFixed(1)}`);
  }
  return "M" + p.join(" L");
}
function cleanPath(x0: number, x1: number, cy: number, amp: number): string {
  const p: string[] = [];
  for (let x = x0; x <= x1; x += 2) {
    const t = (x - x0) / (x1 - x0);
    p.push(`${x},${(cy - amp * Math.sin(t * 4 * 2 * Math.PI)).toFixed(1)}`);
  }
  return "M" + p.join(" L");
}

const SA = [[0.24, 0.28], [0.38, 0.46], [0.20, 0.58]];
const SB = [[0.66, 0.42], [0.82, 0.60], [0.70, 0.80]];

type Kind = "noisy" | "clean" | "scatter" | "scatterline";

// stage viz drawn into a box at (x,y,w,h)
function Viz({ kind, x, y, w, h }: { kind: Kind; x: number; y: number; w: number; h: number }) {
  if (kind === "noisy") return <path className="clp-noisy" d={noisyPath(x + 7, x + w - 7, y + h / 2, h * 0.32)} />;
  if (kind === "clean") return <path className="clp-clean" d={cleanPath(x + 7, x + w - 7, y + h / 2, h * 0.28)} />;
  const ix = x + 7, iy = y + 6, iw = w - 14, ih = h - 12;
  return (
    <>
      {SA.map((p, i) => <circle key={`a${i}`} className="clp-dotA" cx={(ix + p[0] * iw).toFixed(1)} cy={(iy + p[1] * ih).toFixed(1)} r="3" />)}
      {SB.map((p, i) => <circle key={`b${i}`} className="clp-dotB" cx={(ix + p[0] * iw).toFixed(1)} cy={(iy + p[1] * ih).toFixed(1)} r="3" />)}
      {kind === "scatterline" && <line className="clp-bound" x1={ix + 0.1 * iw} y1={iy + 0.88 * ih} x2={ix + 0.9 * iw} y2={iy + 0.14 * ih} />}
    </>
  );
}

const STAGES: { name: string; sub: string; kind: Kind; hi?: boolean }[] = [
  { name: "window", sub: "raw · noisy", kind: "noisy" },
  { name: "bandpass", sub: "task band", kind: "clean" },
  { name: "features", sub: "CSP / filter", kind: "scatter", hi: true },
  { name: "classify", sub: "to a class", kind: "scatterline", hi: true },
];

const BX = [14, 140, 266, 392]; // box left edges
const BY = 48, BW = 84, BH = 46;

function Arrow({ x0, y0, x1, y1 }: { x0: number; y0: number; x1: number; y1: number }) {
  const a = Math.atan2(y1 - y0, x1 - x0), L = 8;
  return (
    <g className="clp-flow">
      <line x1={x0} y1={y0} x2={x1} y2={y1} />
      <path d={`M${x1},${y1} L${(x1 - L * Math.cos(a - 0.5)).toFixed(1)},${(y1 - L * Math.sin(a - 0.5)).toFixed(1)} M${x1},${y1} L${(x1 - L * Math.cos(a + 0.5)).toFixed(1)},${(y1 - L * Math.sin(a + 0.5)).toFixed(1)}`} />
    </g>
  );
}

export function ClassificationPipeline({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="EEG · CLASSIFICATION"
      tone="gold"
      title="From a noisy window to one command"
      ariaLabel="The EEG classification pipeline: cut the signal into an epoch (window), bandpass-filter to the task's frequencies, extract features or spatially filter, then a classifier outputs a class, which becomes one of a few commands. Two approaches share the feature-and-classifier stage: the classic hand-engineered Common Spatial Patterns plus a linear LDA classifier, and the end-to-end learned EEGNet convolutional network."
      caption={caption}
      defaultCaption="Same chain, two eras. Start with CSP + LDA, a fast, low-data, interpretable baseline; reach for EEGNet with more data or more classes."
    >
      <style>{CSS}</style>

      <div className="clp">
        {/* desktop / print: numbered signal-transform chain */}
        <div className="clp-scene">
          <svg className="clp-svg" viewBox="0 0 560 175" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {STAGES.map((s, i) => {
              const x = BX[i];
              return (
                <g key={s.name}>
                  <rect className={s.hi ? "clp-box-hi" : "clp-box"} x={x} y={BY} width={BW} height={BH} rx="5" />
                  <Viz kind={s.kind} x={x} y={BY} w={BW} h={BH} />
                  <circle className="clp-badge" cx={x + 2} cy={BY + 2} r="10" />
                  <text className="clp-badgen" x={x + 2} y={BY + 6} textAnchor="middle">{i + 1}</text>
                  <text className="clp-name" x={x + BW / 2} y={BY + BH + 16} textAnchor="middle">{s.name}</text>
                </g>
              );
            })}
            <Arrow x0={98} y0={71} x1={116} y1={71} />
            <Arrow x0={224} y0={71} x1={242} y1={71} />
            <Arrow x0={350} y0={71} x1={368} y1={71} />
            <Arrow x0={476} y0={71} x1={494} y1={71} />
            <rect className="clp-tok" x="492" y="57" width="64" height="28" rx="14" />
            <text className="clp-toktxt" x="524" y="75" textAnchor="middle">cmd</text>
            <text className="clp-glab" x="280" y="150" textAnchor="middle">→ CSP+LDA or EEGNet at stages 3-4</text>
          </svg>
        </div>

        {/* phone: vertical stage stack */}
        <ol className="clp-cards" aria-hidden="true">
          {STAGES.map((s, i) => (
            <li className={`clp-row${s.hi ? " clp-row-hi" : ""}`} key={s.name}>
              <span className="clp-rbadge">{i + 1}</span>
              <svg className="clp-thumb" viewBox="0 0 72 42" preserveAspectRatio="xMidYMid meet">
                <Viz kind={s.kind} x={0} y={0} w={72} h={42} />
              </svg>
              <span className="clp-rtext"><b>{s.name}</b> · {s.sub}</span>
            </li>
          ))}
          <li className="clp-foot">→ one of a few commands · CSP+LDA or EEGNet</li>
        </ol>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.clp-svg{overflow:visible;width:100%;height:auto;display:block;}
.clp-box{fill:var(--color-navy-dark,#1f2438);stroke:var(--color-panel-border,#3a3f50);stroke-width:1.6;}
.clp-box-hi{fill:var(--color-navy-dark,#1f2438);stroke:var(--color-command-gold,#c8963e);stroke-width:2;}
.clp-noisy{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;opacity:.92;}
.clp-clean{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2.1;stroke-linecap:round;stroke-linejoin:round;}
.clp-dotA{fill:var(--color-command-gold,#c8963e);}
.clp-dotB{fill:var(--color-signal-blue,#4a8fff);}
.clp-bound{stroke:var(--color-title,#f1ece0);stroke-width:1.8;}
.clp-flow line,.clp-flow path{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2.2;}
.clp-tok{fill:var(--color-navy-dark,#1f2438);stroke:var(--color-command-gold,#c8963e);stroke-width:2.2;}
.clp-badge{fill:var(--color-command-gold,#c8963e);}
.clp-badgen{fill:var(--color-deep-space,#08090d);font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-size:13px;font-weight:800;}
.clp-name{fill:var(--color-title,#f1ece0);font-family:var(--font-mono,"Space Mono",monospace);font-size:12px;font-weight:700;}
.clp-toktxt{fill:var(--color-command-gold,#c8963e);font-family:var(--font-mono,"Space Mono",monospace);font-size:11px;font-weight:700;}
.clp-glab{fill:var(--color-command-gold,#c8963e);font-family:var(--font-mono,"Space Mono",monospace);font-size:11px;font-weight:700;}

/* phone reflow: vertical stage stack */
.clp-cards{display:none;list-style:none;margin:0;padding:0;flex-direction:column;gap:.5rem;text-align:left;}
@media (max-width:520px){
  .clp-scene{display:none;}
  .clp-cards{display:flex;}
}
.clp-row{display:flex;align-items:center;gap:.65rem;border-radius:6px;padding:.5rem .7rem;
  background:var(--color-navy-dark,#1f2438);box-shadow:inset 0 0 0 1.5px var(--color-panel-border,#3a3f50);}
.clp-row-hi{box-shadow:inset 0 0 0 2px var(--color-command-gold,#c8963e);}
.clp-rbadge{flex:0 0 auto;display:grid;place-items:center;width:22px;height:22px;border-radius:50%;
  background:var(--color-command-gold,#c8963e);color:var(--color-deep-space,#08090d);
  font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:.95rem;}
.clp-thumb{flex:0 0 64px;width:64px;height:38px;}
.clp-rtext{font-family:var(--font-mono,"Space Mono",monospace);font-size:.86rem;color:var(--color-muted,#aaa);}
.clp-rtext b{color:var(--color-title,#f1ece0);}
.clp-foot{margin-top:.15rem;font-family:var(--font-mono,"Space Mono",monospace);font-size:.82rem;font-weight:700;
  color:var(--color-command-gold,#c8963e);text-align:center;}

/* Tier-B reveal off the frame's armed/in contract. */
.dgfrm.armed .clp-row{opacity:0;transform:translateY(5px);}
.dgfrm.armed.in .clp-row{opacity:1;transform:none;transition:opacity .5s ease,transform .5s cubic-bezier(.2,.7,.2,1);}
.dgfrm.armed.in .clp-row:nth-child(2){transition-delay:.06s;}
.dgfrm.armed.in .clp-row:nth-child(3){transition-delay:.12s;}
.dgfrm.armed.in .clp-row:nth-child(4){transition-delay:.18s;}
@media (prefers-reduced-motion:reduce){.dgfrm .clp-row{opacity:1!important;transform:none!important;}}
`;
