// Why the ADS1299 samples every channel at the same instant, as a responsive
// diagram (v2).
//
// Teaching point: a cheap system multiplexes ONE ADC across its channels, so it
// visits them in turn and each is sampled at a slightly different time. The set
// of "simultaneous" readings is really skewed, and a snapshot built from them is
// SHEARED. The ADS1299 gives every channel its own 24-bit converter, so all
// eight latch at the same instant and the snapshot is faithful. (The low-noise
// PGA-per-channel and the bias-drive loop are covered in the lesson prose.)
//
// v2: two plots of the same waveform side by side on desktop/print (~1.5
// landscape) — muxed samples land OFF the wave (red, sheared), the ADS1299's
// land ON it (gold, faithful) — reflowing to two stacked cards on a narrow phone
// (real px) per directive 1. Token-only color via CSS classes; red marks the
// wrong/skewed case (a genuine failure mode).
import { DiagramFrame } from "./DiagramFrame";

// Sample the reference sine over [x0,x1]; the "muxed" dots read the wave at a
// skewed time (skewPx>0) so they fall off it, the "aligned" dots read it in place.
function sine(x: number, x0: number, x1: number, cy: number, amp: number, cycles: number): number {
  return cy - amp * Math.sin(((x - x0) / (x1 - x0)) * cycles * 2 * Math.PI);
}
function panel(x0: number, x1: number, cy: number, amp: number, cycles: number, n: number, skewPx: number) {
  const pts: string[] = [];
  for (let x = x0; x <= x1; x += 3) pts.push(`${x},${sine(x, x0, x1, cy, amp, cycles).toFixed(1)}`);
  const dots: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const dx = x0 + ((i + 0.5) * (x1 - x0)) / n;
    dots.push({ x: dx, y: sine(dx + skewPx, x0, x1, cy, amp, cycles) });
  }
  return { wave: "M" + pts.join(" L"), dots };
}

const MUX = panel(40, 250, 110, 30, 2, 8, 20); // skewed → sheared
const ALN = panel(330, 520, 110, 30, 2, 8, 0); // aligned → faithful
const MUX_S = panel(20, 240, 52, 20, 2, 8, 18); // phone card (muxed)
const ALN_S = panel(20, 240, 52, 20, 2, 8, 0); // phone card (aligned)

function Plot({ p, cls }: { p: ReturnType<typeof panel>; cls: string }) {
  return (
    <>
      <path className="a99-wave" d={p.wave} />
      {p.dots.map((d, i) => (
        <circle key={i} className={cls} cx={d.x} cy={d.y} r="6" />
      ))}
    </>
  );
}

export function Ads1299Channel({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="ADS1299 · SIMULTANEOUS SAMPLING"
      tone="gold"
      title="One ADC per channel"
      ariaLabel="Why the ADS1299 samples all channels at the same instant, shown as two plots of the same waveform. On the left, a shared multiplexed ADC visits each channel in turn, so its samples are taken at skewed times and fall off the true waveform, giving a sheared, distorted snapshot. On the right, the ADS1299 gives every channel its own 24-bit converter, so all eight samples are taken at the same instant and land faithfully on the waveform."
      caption={caption}
      defaultCaption="A shared, multiplexed ADC visits channels in turn and skews them in time. The ADS1299 gives every channel its own converter, so all eight latch at the same instant."
    >
      <style>{CSS}</style>

      <div className="a99">
        {/* desktop / print: the two plots side by side */}
        <div className="a99-diagram">
          <svg className="a99-svg" viewBox="0 0 560 210" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <text className="a99-h a99-h-bad" x="145" y="24" textAnchor="middle">MUXED → sheared</text>
            <text className="a99-h a99-h-ok" x="425" y="24" textAnchor="middle">ALIGNED → faithful</text>
            <line className="a99-div" x1="290" y1="34" x2="290" y2="196" />
            <Plot p={MUX} cls="a99-dot-bad" />
            <Plot p={ALN} cls="a99-dot-ok" />
            <text className="a99-f a99-f-bad" x="145" y="190" textAnchor="middle">sampled at skewed times</text>
            <text className="a99-f a99-f-ok" x="425" y="190" textAnchor="middle">all at the same instant</text>
          </svg>
        </div>

        {/* phone: two stacked cards */}
        <div className="a99-cards" aria-hidden="true">
          <div className="a99-card a99-card-bad">
            <p className="a99-ck">Muxed → sheared</p>
            <svg className="a99-svg-s" viewBox="0 0 260 96" preserveAspectRatio="xMidYMid meet"><Plot p={MUX_S} cls="a99-dot-bad" /></svg>
            <p className="a99-ct">One shared ADC visits each channel in turn, so its samples land off the true wave.</p>
          </div>
          <div className="a99-card a99-card-ok">
            <p className="a99-ck">Aligned → faithful</p>
            <svg className="a99-svg-s" viewBox="0 0 260 96" preserveAspectRatio="xMidYMid meet"><Plot p={ALN_S} cls="a99-dot-ok" /></svg>
            <p className="a99-ct">The ADS1299 samples all 8 at the same instant, so every point lands on the wave.</p>
          </div>
        </div>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.a99-svg,.a99-svg-s{overflow:visible;width:100%;height:auto;display:block;}
.a99-wave{fill:none;stroke:var(--color-panel-border,#3a3f50);stroke-width:1.6;opacity:.7;}
.a99-dot-bad{fill:var(--color-alert-red,#ef5350);}
.a99-dot-ok{fill:var(--color-command-gold,#c8963e);}
.a99-div{stroke:var(--color-panel-border,#3a3f50);stroke-width:1;}
.a99-h{font-family:var(--font-mono,"Space Mono",monospace);font-size:13px;font-weight:700;letter-spacing:.04em;}
.a99-h-bad{fill:var(--color-alert-red,#ef5350);}
.a99-h-ok{fill:var(--color-command-gold,#c8963e);}
.a99-f{font-family:var(--font-mono,"Space Mono",monospace);font-size:13px;}
.a99-f-bad{fill:var(--color-alert-red,#ef5350);}
.a99-f-ok{fill:var(--color-command-gold,#c8963e);}

/* phone reflow: two stacked cards */
.a99-cards{display:none;flex-direction:column;gap:.7rem;text-align:left;}
@media (max-width:520px){
  .a99-diagram{display:none;}
  .a99-cards{display:flex;}
}
.a99-card{border-radius:6px;padding:.75rem .85rem;background:var(--color-navy-dark,#1f2438);}
.a99-card-bad{box-shadow:inset 0 0 0 1.5px var(--color-alert-red,#ef5350);}
.a99-card-ok{box-shadow:inset 0 0 0 2px var(--color-command-gold,#c8963e);}
.a99-ck{margin:0 0 .35rem;font-family:var(--font-display,"Bebas Neue",sans-serif);font-size:1.2rem;letter-spacing:.02em;}
.a99-card-bad .a99-ck{color:var(--color-alert-red,#ef5350);}
.a99-card-ok .a99-ck{color:var(--color-command-gold,#c8963e);}
.a99-svg-s{height:70px;margin:.2rem 0 .45rem;}
.a99-ct{margin:0;font-family:var(--font-serif,"Lora",serif);font-size:.9rem;line-height:1.4;color:var(--color-text,#e8e8e8);}

/* Tier-B reveal off the frame's armed/in contract. */
.dgfrm.armed .a99-card{opacity:0;transform:translateY(5px);}
.dgfrm.armed.in .a99-card{opacity:1;transform:none;transition:opacity .5s ease,transform .5s cubic-bezier(.2,.7,.2,1);}
@media (prefers-reduced-motion:reduce){.dgfrm .a99-card{opacity:1!important;transform:none!important;}}
`;
