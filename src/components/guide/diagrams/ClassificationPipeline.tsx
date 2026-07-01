// EEG classification pipeline as a responsive HTML component.
//
// Teaching point: turning a noisy EEG window into one of a few commands is a
// chain — epoch, bandpass, extract features (or spatially filter), classify. Two
// eras sit side by side at the feature+classifier stage: the classic
// hand-engineered CSP + LDA, and the end-to-end learned EEGNet. The chain is
// horizontal on wide screens and stacks on a phone.
//
// Header/frame/caption from DiagramFrame. Brand palette: gold-dominant, the
// learn/build stage highlighted, Signal Blue for the EEGNet path label.
import { DiagramFrame } from "./DiagramFrame";

const CHAIN = [
  { k: "win", name: "EEG window", sub: "epoch" },
  { k: "bp", name: "Bandpass", sub: "task band" },
  { k: "feat", name: "Features", sub: "or filter", hi: true },
  { k: "clf", name: "Classifier", sub: "to a class", hi: true },
];

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

      <ol className="clp">
        {CHAIN.map((n, i) => (
          <li className="clp-cell" key={n.k}>
            <div className={`clp-node${n.hi ? " clp-node-hi" : ""}`}>
              <p className="clp-name">{n.name}</p>
              <p className="clp-sub">{n.sub}</p>
            </div>
            {i < CHAIN.length - 1 ? <span className="clp-arrow" aria-hidden="true">→</span> : null}
          </li>
        ))}
      </ol>

      <p className="clp-out"><span aria-hidden="true">→ </span>a command (one of a few)</p>

      <div className="clp-eras">
        <span className="clp-era clp-era-classic">classic: CSP + LDA</span>
        <span className="clp-era clp-era-deep">learned: EEGNet</span>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.clp{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;align-items:stretch;justify-content:center;gap:.22rem;}
.clp-cell{display:flex;align-items:center;gap:.22rem;}
.clp-node{display:flex;flex-direction:column;justify-content:center;min-width:clamp(3.9rem,14vw,4.8rem);
  padding:clamp(.45rem,1.6vw,.62rem) clamp(.35rem,1.3vw,.5rem);text-align:center;border-radius:6px;
  background:var(--color-navy-dark,#1f2438);box-shadow:inset 0 0 0 1.5px var(--color-panel-border,#3a3f50);}
.clp-node-hi{box-shadow:inset 0 0 0 2px var(--color-command-gold,#c8963e);}
.clp-name{margin:0;color:var(--color-title,#f1ece0);font-weight:700;font-size:clamp(.76rem,2vw,.88rem);line-height:1.12;}
.clp-sub{margin:.12rem 0 0;color:var(--color-muted,#aaa);
  font-family:var(--font-mono,"Space Mono",monospace);font-size:clamp(.6rem,1.6vw,.68rem);line-height:1.2;}
.clp-arrow{color:var(--color-command-gold,#c8963e);font-size:clamp(.82rem,2.1vw,1rem);font-weight:700;}
@media (max-width:30rem){.clp{flex-direction:column;align-items:stretch;}.clp-cell{flex-direction:column;}.clp-node{min-width:0;}.clp-arrow{transform:rotate(90deg);}}

.clp-out{margin:clamp(.7rem,2.4vw,.95rem) 0 0;text-align:center;color:var(--color-gray-1,#e8e8e8);
  font-family:var(--font-mono,"Space Mono",monospace);font-size:clamp(.78rem,2.1vw,.86rem);letter-spacing:.02em;}
.clp-out span{color:var(--color-command-gold,#c8963e);font-weight:700;}
.clp-eras{margin:clamp(.95rem,3vw,1.25rem) 0 0;display:flex;flex-wrap:wrap;justify-content:center;gap:.5rem .9rem;}
.clp-era{font-family:var(--font-mono,"Space Mono",monospace);font-size:clamp(.72rem,2vw,.8rem);font-weight:700;
  padding:.22rem .55rem;border-radius:4px;letter-spacing:.02em;}
.clp-era-classic{color:var(--color-command-gold,#c8963e);box-shadow:inset 0 0 0 1px var(--color-command-gold,#c8963e);}
.clp-era-deep{color:var(--color-signal-blue,#4a8fff);box-shadow:inset 0 0 0 1px var(--color-signal-blue,#4a8fff);}

.dgfrm.armed .clp-cell,.dgfrm.armed .clp-eras{opacity:0;transform:translateY(6px);}
.dgfrm.armed.in .clp-cell,.dgfrm.armed.in .clp-eras{opacity:1;transform:none;transition:opacity .5s ease,transform .5s cubic-bezier(.2,.7,.2,1);}
.dgfrm.armed.in .clp-cell:nth-child(2){transition-delay:.06s;}
.dgfrm.armed.in .clp-cell:nth-child(3){transition-delay:.12s;}
.dgfrm.armed.in .clp-cell:nth-child(4){transition-delay:.18s;}
.dgfrm.armed.in .clp-cell:nth-child(5){transition-delay:.24s;}
.dgfrm.armed.in .clp-eras{transition-delay:.32s;}
@media (prefers-reduced-motion:reduce){.dgfrm .clp-cell,.dgfrm .clp-eras{opacity:1!important;transform:none!important;}}
`;
