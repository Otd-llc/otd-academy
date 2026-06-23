// EEG frequency bands as a responsive HTML component.
//
// Teaching point: raw EEG is overlapping rhythms at different speeds, grouped by
// long convention into named bands. A mini-waveform per row makes "frequency"
// concrete (delta is slow and broad; gamma is fast). The sensorimotor mu rhythm
// shares the ~8-12 Hz alpha range but lives over the motor cortex, so a band
// alone doesn't identify a signal. Vertical rows read on a phone.
//
// Header/frame/caption from DiagramFrame. Brand palette: gold-dominant, alpha row
// highlighted (where mu lives), muted associations. @theme tokens.
import { DiagramFrame } from "./DiagramFrame";

function wave(W: number, H: number, cycles: number, amp: number, step = 3): string {
  const mid = H / 2;
  const pts: string[] = [];
  for (let x = 0; x <= W; x += step) pts.push(`${x.toFixed(1)},${(mid - amp * Math.sin((x / W) * cycles * 2 * Math.PI)).toFixed(1)}`);
  return "M" + pts.join(" L");
}
const W = 96, H = 26;

const BANDS = [
  { name: "Delta", hz: "~0.5–4 Hz", with: "Deep (slow-wave) sleep", cyc: 1.5 },
  { name: "Theta", hz: "~4–8 Hz", with: "Drowsiness, deep relaxation, memory", cyc: 3 },
  { name: "Alpha", hz: "~8–12 Hz", with: "Relaxed wakefulness, eyes closed", cyc: 5, hi: true },
  { name: "Beta", hz: "~13–30 Hz", with: "Alert, active concentration", cyc: 9 },
  { name: "Gamma", hz: "~30+ Hz", with: "High-level / integrative processing", cyc: 14 },
];

export function FrequencyBands({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="EEG · FREQUENCY BANDS"
      tone="gold"
      title="One signal, many rhythms"
      ariaLabel="The classic EEG frequency bands, slow to fast: delta (about 0.5 to 4 Hz, deep slow-wave sleep); theta (about 4 to 8 Hz, drowsiness, deep relaxation, memory tasks); alpha (about 8 to 12 Hz, relaxed wakefulness with eyes closed); beta (about 13 to 30 Hz, alert active concentration); and gamma (about 30 Hz and up, high-level integrative processing). The sensorimotor mu rhythm shares the alpha range but lives over the motor cortex, so where a rhythm appears matters as much as its frequency."
      caption={caption}
      defaultCaption="A band is a frequency range, not a readout of what someone is doing. Mu shares alpha's range but means something different."
    >
      <style>{CSS}</style>

      <ul className="fb">
        {BANDS.map((b) => (
          <li className={`fb-row${b.hi ? " fb-row-hi" : ""}`} key={b.name}>
            <svg className="fb-wave" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
              <path d={wave(W, H, b.cyc, 9)} fill="none" vectorEffect="non-scaling-stroke" />
            </svg>
            <div className="fb-meta">
              <p className="fb-name">{b.name} <span className="fb-hz">{b.hz}</span></p>
              <p className="fb-with">{b.with}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="fb-mu">mu rhythm sits in alpha's ~8–12 Hz band, but over the motor cortex</p>
    </DiagramFrame>
  );
}

const CSS = `
.fb{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.4rem;}
.fb-row{display:grid;grid-template-columns:clamp(3.4rem,14vw,4.6rem) 1fr;align-items:center;gap:clamp(.6rem,2.5vw,.9rem);
  padding:clamp(.45rem,1.8vw,.6rem) clamp(.55rem,2vw,.75rem);border-radius:6px;text-align:left;
  background:var(--color-navy-dark,#1f2438);box-shadow:inset 0 0 0 1.5px var(--color-panel-border,#3a3f50);}
.fb-row-hi{box-shadow:inset 0 0 0 2px var(--color-command-gold,#c8963e);}
.fb-wave{width:100%;height:clamp(1.5rem,5vw,1.8rem);}
.fb-wave path{stroke:var(--color-command-gold,#c8963e);stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}
.fb-name{margin:0;color:#fff;font-weight:700;font-size:clamp(.92rem,2.5vw,1.05rem);}
.fb-hz{color:var(--color-command-gold,#c8963e);font-family:var(--font-mono,"Space Mono",monospace);
  font-size:clamp(.7rem,1.9vw,.78rem);font-weight:400;}
.fb-with{margin:.1rem 0 0;color:var(--color-muted,#aaa);font-size:clamp(.8rem,2.1vw,.88rem);line-height:1.35;}
.fb-mu{margin:clamp(.8rem,2.8vw,1.1rem) 0 0;text-align:center;color:var(--color-muted,#aaa);
  font-family:var(--font-mono,"Space Mono",monospace);font-size:clamp(.7rem,1.9vw,.78rem);letter-spacing:.02em;}

.dgfrm.armed .fb-row,.dgfrm.armed .fb-mu{opacity:0;transform:translateY(5px);}
.dgfrm.armed.in .fb-row,.dgfrm.armed.in .fb-mu{opacity:1;transform:none;transition:opacity .45s ease,transform .45s cubic-bezier(.2,.7,.2,1);}
.dgfrm.armed.in .fb-row:nth-child(2){transition-delay:.06s;}
.dgfrm.armed.in .fb-row:nth-child(3){transition-delay:.12s;}
.dgfrm.armed.in .fb-row:nth-child(4){transition-delay:.18s;}
.dgfrm.armed.in .fb-row:nth-child(5){transition-delay:.24s;}
.dgfrm.armed.in .fb-mu{transition-delay:.3s;}
@media (prefers-reduced-motion:reduce){.dgfrm .fb-row,.dgfrm .fb-mu{opacity:1!important;transform:none!important;}}
`;
