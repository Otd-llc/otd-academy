// One ADS1299 channel's signal path as a responsive HTML component.
//
// Teaching point: each of the 8 channels is its own low-noise chain — a
// programmable-gain amplifier into its OWN 24-bit delta-sigma ADC (so all
// channels sample at the same instant) — and a shared bias-drive loop cancels
// mains hum before it reaches the converters. The chain is horizontal on wide
// screens and stacks vertically on a phone; labels are real CSS px (clamped).
//
// Header/frame/caption from DiagramFrame (Bebas title). Brand palette
// (onethousanddrones.com/brand): gold-dominant on Deep Space, Navy Dark bodies,
// Signal Blue only for the secondary bias-loop note. All colours via @theme.
import { DiagramFrame } from "./DiagramFrame";

type Node = { k: string; name: string; sub: string };

const CHAIN: Node[] = [
  { k: "in", name: "Electrode", sub: "µV input" },
  { k: "pga", name: "PGA", sub: "gain 1–24×" },
  { k: "adc", name: "24-bit ΔΣ ADC", sub: "one per channel" },
  { k: "spi", name: "SPI out", sub: "to the host" },
];

export function Ads1299Channel({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="ADS1299 · ONE CHANNEL"
      tone="gold"
      title="A low-noise chain, eight times over"
      ariaLabel="The signal path of one ADS1299 channel: a microvolt electrode input feeds a programmable-gain amplifier (gain 1 to 24 times), which feeds that channel's own dedicated 24-bit delta-sigma ADC, whose output goes out over SPI to the host. All eight channels are identical and sample at the same instant. Separately, an on-chip bias-drive amplifier senses the body's common-mode voltage and drives a correction back through a bias electrode, cancelling 50/60 Hz mains hum before it reaches the converters."
      caption={caption}
      defaultCaption="Eight identical chains sample at the same instant. The bias-drive loop is what kills the 50/60 Hz hum."
    >
      <style>{CSS}</style>

      <div className="a99-chain">
        {CHAIN.map((n, i) => (
          <div className="a99-cell" key={n.k}>
            <div className={`a99-node a99-node-${n.k}`}>
              <p className="a99-name">{n.name}</p>
              <p className="a99-sub">{n.sub}</p>
            </div>
            {i < CHAIN.length - 1 ? (
              <span className="a99-arrow" aria-hidden="true">→</span>
            ) : null}
          </div>
        ))}
      </div>

      <p className="a99-times">× 8 channels · simultaneous sampling</p>

      <div className="a99-bias">
        <span className="a99-bias-tag">BIAS-DRIVE LOOP</span>
        <p className="a99-bias-txt">
          Senses the body's common-mode and drives a correction back through a
          bias electrode, cancelling 50/60 Hz hum before the ADC.
        </p>
      </div>
    </DiagramFrame>
  );
}

// Unique `a99-` prefix. Token-driven with literal fallbacks.
const CSS = `
.a99-chain{display:flex;flex-wrap:wrap;align-items:stretch;justify-content:center;gap:.25rem;}
.a99-cell{display:flex;align-items:center;gap:.25rem;}
.a99-node{display:flex;flex-direction:column;justify-content:center;min-width:clamp(4.2rem,16vw,5.1rem);
  padding:clamp(.5rem,1.8vw,.7rem) clamp(.4rem,1.6vw,.6rem);text-align:center;border-radius:6px;
  background:var(--color-navy-dark,#1f2438);box-shadow:inset 0 0 0 1.5px var(--color-panel-border,#3a3f50);}
.a99-node-pga,.a99-node-adc{box-shadow:inset 0 0 0 2px var(--color-command-gold,#c8963e);}
.a99-name{margin:0;color:var(--color-title,#f1ece0);font-weight:700;font-size:clamp(.82rem,2.2vw,.95rem);line-height:1.1;}
.a99-sub{margin:.15rem 0 0;color:var(--color-muted,#aaa);
  font-family:var(--font-mono,"Space Mono",monospace);font-size:clamp(.64rem,1.7vw,.72rem);}
.a99-arrow{color:var(--color-command-gold,#c8963e);font-size:clamp(.9rem,2.4vw,1.1rem);font-weight:700;}
@media (max-width:30rem){
  .a99-chain{flex-direction:column;align-items:stretch;}
  .a99-cell{flex-direction:column;}
  .a99-node{min-width:0;}
  .a99-arrow{transform:rotate(90deg);}
}

.a99-times{margin:clamp(.9rem,3vw,1.2rem) 0 0;text-align:center;color:var(--color-gray-1,#e8e8e8);
  font-family:var(--font-mono,"Space Mono",monospace);font-size:clamp(.78rem,2.1vw,.86rem);letter-spacing:.04em;}

.a99-bias{margin-top:clamp(1rem,3.5vw,1.4rem);padding:clamp(.7rem,2.5vw,.95rem);border-radius:6px;
  background:rgba(74,143,255,.08);box-shadow:inset 0 0 0 1.5px var(--color-signal-blue,#4a8fff);text-align:left;}
.a99-bias-tag{display:inline-block;margin-bottom:.35rem;font-family:var(--font-mono,"Space Mono",monospace);
  font-size:clamp(.66rem,1.9vw,.74rem);font-weight:700;text-transform:uppercase;letter-spacing:.16em;
  color:var(--color-signal-blue,#4a8fff);}
.a99-bias-txt{margin:0;color:var(--color-gray-1,#e8e8e8);font-size:clamp(.85rem,2.3vw,.95rem);line-height:1.45;}

/* Tier-B reveal off the frame's armed/in contract. */
.dgfrm.armed .a99-cell,.dgfrm.armed .a99-times,.dgfrm.armed .a99-bias{opacity:0;transform:translateY(6px);}
.dgfrm.armed.in .a99-cell,.dgfrm.armed.in .a99-times,.dgfrm.armed.in .a99-bias{opacity:1;transform:none;
  transition:opacity .5s ease,transform .5s cubic-bezier(.2,.7,.2,1);}
.dgfrm.armed.in .a99-cell:nth-child(2){transition-delay:.07s;}
.dgfrm.armed.in .a99-cell:nth-child(3){transition-delay:.14s;}
.dgfrm.armed.in .a99-cell:nth-child(4){transition-delay:.21s;}
.dgfrm.armed.in .a99-times{transition-delay:.28s;}
.dgfrm.armed.in .a99-bias{transition-delay:.35s;}
@media (prefers-reduced-motion:reduce){
  .dgfrm .a99-cell,.dgfrm .a99-times,.dgfrm .a99-bias{opacity:1!important;transform:none!important;}
}
`;
