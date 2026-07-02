// The five-stage EEG BCI signal chain as a responsive HTML component (v2).
//
// The pipeline is a real ordered sequence (brain -> command), so the stages are
// numbered 01..05 and read LEFT-TO-RIGHT on a gold "wire": each solid Saira
// numeral is a bead on the spine, with an arrowhead at the output end. Numbering
// carries true information here, not decoration.
//
// v2 landscape reflow: the old version stacked the five stages top-to-bottom
// (portrait ~0.66), which gapped the field-guide PDF page and shrank its own
// baked text. This lays the stages out as a horizontal rail (~1.5 landscape on
// the 36rem desktop render the exporter screenshots) and STACKS them into a
// vertical spine only on a narrow phone — print stays landscape, phone stays
// legible. All text is real clamped px with a ~14px floor.
//
// Token-only color with DARK-value fallbacks (belt-and-braces for a standalone
// render); every color flips under :root[data-theme="light"] via globals.css.
// Four faces: Saira (--font-numeral) for the stage numbers, Bebas (via the name)
// for the stage name, Lora (--font-serif) for what it does, Space Mono for the
// IN/OUT chrome. Header/frame/caption from the shared DiagramFrame.
import { DiagramFrame } from "./DiagramFrame";

type Stage = { n: string; name: string; what: string };

const STAGES: Stage[] = [
  { n: "01", name: "Electrodes", what: "Pick up microvolt scalp voltages" },
  { n: "02", name: "Analog front-end", what: "Amplify, reject common-mode noise" },
  { n: "03", name: "ADC", what: "Digitize every channel at once" },
  { n: "04", name: "Signal processing", what: "Filter, extract features" },
  { n: "05", name: "Classifier", what: "Map features to an intent" },
];

export function EegBciPipeline({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="EEG BCI · SIGNAL CHAIN"
      tone="gold"
      title="From brain to command, in five stages"
      ariaLabel="The five-stage EEG brain-computer interface signal chain, read left to right on a single wire from brain activity to a command. Stage 1, electrodes, pick up microvolt scalp voltages. Stage 2, an analog front-end amplifies the signal and rejects common-mode noise. Stage 3, an analog-to-digital converter digitizes every channel at once. Stage 4, signal processing filters the data and extracts features. Stage 5, a classifier maps those features to an intent, which becomes the command."
      caption={caption}
      defaultCaption="Master every stage and the loop closes. Skimp on one, usually noise, and nothing downstream can recover it."
    >
      <style>{CSS}</style>

      <div className="eegp">
        <div className="eegp-ends">
          <span className="eegp-chip">IN · <span>brain activity</span></span>
          <span className="eegp-chip eegp-chip-out">OUT · <span>command</span></span>
        </div>

        <ol className="eegp-rail">
          {STAGES.map((s) => (
            <li key={s.n} className="eegp-cell">
              <span className="eegp-num" aria-hidden="true">{s.n}</span>
              <p className="eegp-name">{s.name}</p>
              <p className="eegp-what">{s.what}</p>
            </li>
          ))}
        </ol>
      </div>
    </DiagramFrame>
  );
}

// Unique `eegp-` prefix. Token-driven with DARK literal fallbacks so a standalone
// / exporter render still resolves; the light values come only from the token
// override, never a literal. The horizontal gold spine is drawn on the rail
// (::before) with an arrowhead (::after); each solid numeral carries a deep-space
// background so it masks the wire behind it (a bead on the line). On a narrow
// phone the rail becomes a single stacked column threaded by a vertical spine.
const CSS = `
.eegp{text-align:left;}

.eegp-ends{display:flex;justify-content:space-between;align-items:center;gap:.75rem;margin-bottom:.2rem;}
.eegp-chip{font-family:var(--font-mono,"Space Mono",monospace);font-size:.72rem;font-weight:700;
  text-transform:uppercase;letter-spacing:.14em;color:var(--color-command-gold,#c8963e);}
.eegp-chip span{color:var(--color-muted,#aaa);}

.eegp-rail{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(5,1fr);
  position:relative;}
/* the gold wire + output arrowhead, drawn behind the numeral beads */
.eegp-rail::before{content:"";position:absolute;left:0;right:14px;top:19px;height:2px;
  background:var(--color-command-gold,#c8963e);opacity:.55;z-index:0;}
.eegp-rail::after{content:"";position:absolute;right:-2px;top:14px;
  border-left:9px solid var(--color-command-gold,#c8963e);
  border-top:6px solid transparent;border-bottom:6px solid transparent;opacity:.85;z-index:0;}

.eegp-cell{position:relative;padding:0 .28rem;}
.eegp-num{position:relative;z-index:1;display:inline-block;
  font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-variant-numeric:tabular-nums;
  font-size:clamp(2.2rem,7vw,3rem);line-height:.8;letter-spacing:.01em;
  color:var(--color-command-gold,#c8963e);padding-right:.4rem;background:var(--color-deep-space,#08090d);}
.eegp-name{margin:.35rem 0 0;min-height:2em;font-family:var(--font-display,"Bebas Neue",sans-serif);font-weight:400;
  font-size:clamp(1.05rem,2.8vw,1.2rem);line-height:1.02;letter-spacing:.02em;color:var(--color-title,#f1ece0);}
.eegp-what{margin:.25rem 0 0;font-family:var(--font-serif,"Lora",serif);
  font-size:clamp(.95rem,2.4vw,1rem);line-height:1.32;color:var(--color-text,#e8e8e8);}

/* Narrow phone: stack into a single column threaded by a vertical gold spine;
   each numeral becomes a bead on that spine. (Print/desktop stays landscape;
   this only affects the web on small screens.) */
@media (max-width:520px){
  .eegp-rail{grid-template-columns:1fr;}
  .eegp-rail::before{left:1.1rem;right:auto;top:.4rem;bottom:.4rem;width:2px;height:auto;}
  .eegp-rail::after{display:none;}
  .eegp-cell{padding:.6rem 0 .6rem 2.7rem;}
  .eegp-num{position:absolute;left:1.1rem;top:.55rem;transform:translateX(-52%);
    font-size:1.7rem;padding:.1rem .18rem;}
  .eegp-name{min-height:0;margin-top:0;}
}

/* Tier-B reveal off the frame's armed/in contract (animation-standards.md): the
   stages settle left-to-right in reading order. Gated behind .armed so a
   reduced-motion / no-JS / exporter render shows the final state. */
.dgfrm.armed .eegp-cell{opacity:0;transform:translateY(6px);}
.dgfrm.armed.in .eegp-cell{opacity:1;transform:none;
  transition:opacity .5s ease,transform .5s cubic-bezier(.2,.7,.2,1);}
.dgfrm.armed.in .eegp-cell:nth-child(2){transition-delay:.06s;}
.dgfrm.armed.in .eegp-cell:nth-child(3){transition-delay:.12s;}
.dgfrm.armed.in .eegp-cell:nth-child(4){transition-delay:.18s;}
.dgfrm.armed.in .eegp-cell:nth-child(5){transition-delay:.24s;}
@media (prefers-reduced-motion:reduce){
  .dgfrm .eegp-cell{opacity:1!important;transform:none!important;}
}
`;
