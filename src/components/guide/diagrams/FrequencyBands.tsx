// EEG frequency bands as a responsive diagram (v2).
//
// Teaching point: raw EEG is one signal made of overlapping rhythms at different
// speeds, grouped by long convention into named bands (delta slow -> gamma fast).
// The sensorimotor mu rhythm shares the ~8-12 Hz alpha range but lives over the
// motor cortex, so a band alone doesn't identify a signal.
//
// v2 landscape reflow: the old version stacked five rows (portrait ~0.87, which
// gapped the field-guide PDF). This draws ONE continuous signal that chirps slow
// -> fast across the width, with the five bands as shaded zones behind it (the
// alpha zone tinted, its slice of the wave emphasised, "mu lives here"). It makes
// the title literal: one signal, carved into many rhythms.
//
// Because a wave carrying labels can't be pure CSS, the plot is an SVG + HTML
// zones/labels on desktop/print (the surface the exporter screenshots, ~1.4
// landscape) and REFLOWS to the proven vertical band list on a narrow phone (real
// px, no shrinking wave text) per directive 1. Token-only color (SVG stroke via
// CSS class, never a fill/stroke="#.." attribute), so it re-themes under
// data-theme="light".
import { DiagramFrame } from "./DiagramFrame";

// Chirp: cycles accumulate faster to the right (delta -> gamma), with a gentle
// 1/f-ish amplitude taper so it reads like real EEG (slow = big, fast = small).
function chirp(W: number, H: number, c0: number, c1: number, amp: number, x0 = 0, x1 = W, step = 2): string {
  const mid = H / 2;
  const pts: string[] = [];
  for (let x = x0; x <= x1; x += step) {
    const t = x / W;
    const a = amp * (0.5 + 0.5 * (1 - t));
    const ph = 2 * Math.PI * (c0 * t + (c1 - c0) * t * t * t);
    pts.push(`${x.toFixed(1)},${(mid - a * Math.sin(ph)).toFixed(1)}`);
  }
  return "M" + pts.join(" L");
}
// Mini per-band waveform for the phone list.
function wave(W: number, H: number, cycles: number, amp: number, step = 3): string {
  const mid = H / 2;
  const pts: string[] = [];
  for (let x = 0; x <= W; x += step) pts.push(`${x.toFixed(1)},${(mid - amp * Math.sin((x / W) * cycles * 2 * Math.PI)).toFixed(1)}`);
  return "M" + pts.join(" L");
}

const CHIRP_W = 600, CHIRP_H = 60;
const CHIRP_BASE = chirp(CHIRP_W, CHIRP_H, 2, 34, 25);
const CHIRP_ALPHA = chirp(CHIRP_W, CHIRP_H, 2, 34, 25, 240, 360); // the alpha slice (40-60%)

// `with` = the full association (phone list + the aria-label carry it); `short`
// = the abbreviation the narrow 5-column desktop grid uses so the landscape
// figure stays wide. No data is dropped: the full text lives in the list + alt.
const BANDS = [
  { name: "Delta", hz: "0.5–4", with: "Deep (slow-wave) sleep", short: "deep sleep", cyc: 1.5 },
  { name: "Theta", hz: "4–8", with: "Drowsiness, deep relaxation, memory", short: "drowsy, memory", cyc: 3 },
  { name: "Alpha", hz: "8–12", with: "Relaxed wakefulness, eyes closed", short: "relaxed, eyes closed", cyc: 5, hi: true },
  { name: "Beta", hz: "13–30", with: "Alert, active concentration", short: "alert, focused", cyc: 9 },
  { name: "Gamma", hz: "30+", with: "High-level / integrative processing", short: "integrative", cyc: 14 },
];
const MW = 96, MH = 26;

export function FrequencyBands({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="EEG · FREQUENCY BANDS"
      tone="gold"
      title="One signal, many rhythms"
      ariaLabel="The classic EEG frequency bands, drawn as one continuous signal that speeds up from slow to fast: delta (about 0.5 to 4 Hz, deep slow-wave sleep); theta (about 4 to 8 Hz, drowsiness, deep relaxation, memory tasks); alpha (about 8 to 12 Hz, relaxed wakefulness with eyes closed); beta (about 13 to 30 Hz, alert active concentration); and gamma (about 30 Hz and up, high-level integrative processing). The sensorimotor mu rhythm shares the alpha range but lives over the motor cortex, so where a rhythm appears matters as much as its frequency."
      caption={caption}
      defaultCaption="A band is a frequency range, not a readout of what someone is doing. Mu shares alpha's range but means something different."
    >
      <style>{CSS}</style>

      <div className="fb">
        {/* desktop / print: one continuous signal carved into band zones */}
        <div className="fb-plot">
          <div className="fb-relwrap">
            <div className="fb-zones" aria-hidden="true">
              {BANDS.map((b) => (
                <span key={b.name} className={`fb-zone${b.hi ? " hi" : ""}`} />
              ))}
            </div>
            <svg className="fb-wave" viewBox={`0 0 ${CHIRP_W} ${CHIRP_H}`} preserveAspectRatio="none" aria-hidden="true">
              <path className="fb-wpath" d={CHIRP_BASE} />
              <path className="fb-wpath-hi" d={CHIRP_ALPHA} />
            </svg>
          </div>
          <div className="fb-brk" aria-hidden="true">
            <span className="fb-brkbar" />
            <span className="fb-brklab">mu lives here</span>
          </div>
          <div className="fb-labels">
            {BANDS.map((b) => (
              <div key={b.name} className={`fb-lab${b.hi ? " hi" : ""}`}>
                <p className="fb-name">{b.name}</p>
                <p className="fb-hz">{b.hz}<span> Hz</span></p>
                <p className="fb-with">{b.short}</p>
              </div>
            ))}
          </div>
        </div>

        {/* phone: the vertical band list (each rhythm on its own row) */}
        <ul className="fb-list" aria-hidden="true">
          {BANDS.map((b) => (
            <li className={`fb-row${b.hi ? " fb-row-hi" : ""}`} key={b.name}>
              <svg className="fb-mwave" viewBox={`0 0 ${MW} ${MH}`} preserveAspectRatio="none">
                <path className="fb-wpath" d={wave(MW, MH, b.cyc, 9)} />
              </svg>
              <div className="fb-meta">
                <p className="fb-name">{b.name} <span className="fb-rowhz">{b.hz} Hz</span></p>
                <p className="fb-with">{b.with}</p>
              </div>
            </li>
          ))}
        </ul>

        <p className="fb-mu">mu rhythm sits in alpha's 8–12 Hz band, but over the motor cortex</p>
      </div>
    </DiagramFrame>
  );
}

// Token-driven with DARK literal fallbacks so a standalone / exporter render
// resolves; light values come only from the token override under data-theme.
const CSS = `
.fb-wpath{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}
.fb-wpath-hi{fill:none;stroke:var(--color-gold-light,#e8b865);stroke-width:2.8;stroke-linecap:round;stroke-linejoin:round;}
.fb-mu{margin:clamp(.8rem,2.8vw,1.1rem) 0 0;text-align:center;color:var(--color-muted,#aaa);
  font-family:var(--font-mono,"Space Mono",monospace);font-size:clamp(.72rem,1.9vw,.8rem);letter-spacing:.02em;}

/* ── desktop / print: continuous signal + shaded band zones ──────────────── */
.fb-plot{display:block;}
.fb-relwrap{position:relative;}
.fb-zones{position:absolute;inset:0;display:grid;grid-template-columns:repeat(5,1fr);z-index:0;}
.fb-zone{border-right:1px solid color-mix(in srgb,var(--color-panel-border,#3a3f50) 60%,transparent);}
.fb-zone:last-child{border-right:none;}
.fb-zone.hi{background:color-mix(in srgb,var(--color-command-gold,#c8963e) 9%,transparent);}
.fb-wave{position:relative;z-index:1;width:100%;height:clamp(52px,10vw,62px);display:block;}
.fb-brk{position:relative;height:17px;margin-top:1px;}
.fb-brkbar{position:absolute;left:40%;width:20%;top:0;height:7px;border:2px solid var(--color-command-gold,#c8963e);border-bottom:none;}
.fb-brklab{position:absolute;left:50%;top:8px;transform:translateX(-50%);white-space:nowrap;
  font-family:var(--font-mono,"Space Mono",monospace);font-size:.66rem;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:var(--color-command-gold,#c8963e);}
.fb-labels{display:grid;grid-template-columns:repeat(5,1fr);margin-top:.55rem;}
.fb-lab{text-align:center;padding:0 .3rem;}
.fb-lab .fb-name{margin:0;font-family:var(--font-display,"Bebas Neue",sans-serif);font-size:clamp(1.05rem,2.8vw,1.2rem);letter-spacing:.02em;line-height:1;color:var(--color-title,#f1ece0);}
.fb-lab.hi .fb-name{color:var(--color-command-gold,#c8963e);}
.fb-hz{margin:.12rem 0 .2rem;font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:clamp(1rem,2.5vw,1.1rem);line-height:.9;color:var(--color-command-gold,#c8963e);font-variant-numeric:tabular-nums;}
.fb-hz span{font-family:var(--font-mono,"Space Mono",monospace);font-size:.6rem;font-weight:700;color:var(--color-muted,#aaa);margin-left:2px;letter-spacing:.04em;}
.fb-lab .fb-with{margin:0;font-family:var(--font-serif,"Lora",serif);font-size:clamp(.8rem,2.1vw,.9rem);line-height:1.3;color:var(--color-text,#e8e8e8);}

/* ── phone reflow: the vertical band list ────────────────────────────────── */
.fb-list{display:none;list-style:none;margin:0;padding:0;flex-direction:column;gap:.4rem;}
@media (max-width:520px){
  .fb-plot{display:none;}
  .fb-list{display:flex;}
}
.fb-row{display:grid;grid-template-columns:clamp(3.4rem,14vw,4.6rem) 1fr;align-items:center;gap:.9rem;
  padding:.6rem .75rem;border-radius:6px;text-align:left;
  background:var(--color-navy-dark,#1f2438);box-shadow:inset 0 0 0 1.5px var(--color-panel-border,#3a3f50);}
.fb-row-hi{box-shadow:inset 0 0 0 2px var(--color-command-gold,#c8963e);}
.fb-mwave{width:100%;height:1.7rem;}
.fb-row .fb-name{margin:0;color:var(--color-title,#f1ece0);font-family:var(--font-display,"Bebas Neue",sans-serif);
  font-size:1.15rem;letter-spacing:.02em;}
.fb-rowhz{color:var(--color-command-gold,#c8963e);font-family:var(--font-numeral,"Saira Condensed",sans-serif);
  font-weight:800;font-size:1rem;font-variant-numeric:tabular-nums;}
.fb-row .fb-with{margin:.1rem 0 0;color:var(--color-muted,#aaa);font-family:var(--font-serif,"Lora",serif);
  font-size:.9rem;line-height:1.35;}

/* Tier-B reveal off the frame's armed/in contract; gated behind .armed so
   reduced-motion / no-JS / exporter shows the final state. */
.dgfrm.armed .fb-wave,.dgfrm.armed .fb-brk,.dgfrm.armed .fb-lab,.dgfrm.armed .fb-row,.dgfrm.armed .fb-mu{opacity:0;}
.dgfrm.armed.in .fb-wave,.dgfrm.armed.in .fb-brk,.dgfrm.armed.in .fb-lab,.dgfrm.armed.in .fb-row,.dgfrm.armed.in .fb-mu{opacity:1;
  transition:opacity .5s ease;}
.dgfrm.armed.in .fb-lab:nth-child(2){transition-delay:.05s;}
.dgfrm.armed.in .fb-lab:nth-child(3){transition-delay:.1s;}
.dgfrm.armed.in .fb-lab:nth-child(4){transition-delay:.15s;}
.dgfrm.armed.in .fb-lab:nth-child(5){transition-delay:.2s;}
@media (prefers-reduced-motion:reduce){
  .dgfrm .fb-wave,.dgfrm .fb-brk,.dgfrm .fb-lab,.dgfrm .fb-row,.dgfrm .fb-mu{opacity:1!important;}
}
`;
