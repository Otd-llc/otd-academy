// The five-stage EEG BCI signal chain as a responsive HTML component.
//
// The pipeline is a real ordered sequence (brain -> command), so the stages are
// numbered 01..05 — numbering carries true information here, not decoration. A
// gold spine threads the nodes top-to-bottom; each stage names what it does and
// the hard part. Labels are real CSS px (clamped) so they stay legible on a
// ~360px phone; the layout is vertical, so it never crowds.
//
// Header/frame/caption from the shared DiagramFrame (Bebas title). Brand palette
// (onethousanddrones.com/brand): gold-dominant on Deep Space, Navy Dark bodies,
// muted labels. All colours via @theme tokens.
import { DiagramFrame } from "./DiagramFrame";

type Stage = { n: string; name: string; what: string; hard: string };

const STAGES: Stage[] = [
  { n: "01", name: "Electrodes", what: "Pick up microvolt scalp voltages", hard: "contact impedance + placement" },
  { n: "02", name: "Analog front-end", what: "Amplify, reject common-mode noise", hard: "noise floor + mains rejection" },
  { n: "03", name: "ADC", what: "Digitize every channel at once", hard: "resolution + simultaneous sampling" },
  { n: "04", name: "Signal processing", what: "Filter, extract features", hard: "signal vs artifact" },
  { n: "05", name: "Classifier", what: "Map features to an intent", hard: "low, noisy bandwidth" },
];

export function EegBciPipeline({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="EEG BCI · SIGNAL CHAIN"
      tone="gold"
      title="From brain to command, in five stages"
      ariaLabel="The five-stage EEG brain-computer interface signal chain. The brain's activity flows through: 1, electrodes that pick up microvolt scalp voltages (hard part: contact impedance and placement); 2, an analog front-end that amplifies the signal and rejects common-mode noise (noise floor and mains rejection); 3, an analog-to-digital converter that digitizes every channel simultaneously (resolution and simultaneous sampling); 4, signal processing that filters the data and extracts features (separating signal from artifact); 5, a classifier that maps features to an intent (low, noisy bandwidth). The intent becomes a command."
      caption={caption}
      defaultCaption="Master every stage and the loop closes. Skimp on one, usually noise, and nothing downstream can recover it."
    >
      <style>{CSS}</style>

      <div className="eegp">
        <p className="eegp-cap eegp-cap-top">Brain activity</p>

        <ol className="eegp-list">
          {STAGES.map((s) => (
            <li key={s.n} className="eegp-row">
              <span className="eegp-node" aria-hidden="true">{s.n}</span>
              <div className="eegp-body">
                <p className="eegp-name">{s.name}</p>
                <p className="eegp-what">{s.what}</p>
                <p className="eegp-hard">hard part: {s.hard}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="eegp-cap eegp-cap-end">Command</p>
      </div>
    </DiagramFrame>
  );
}

// Unique `eegp-` prefix. Token-driven with literal fallbacks so a standalone /
// exporter render resolves. The spine is a left border on the list; each node
// sits on it.
const CSS = `
.eegp{text-align:left;}
.eegp-cap{margin:0 auto;width:max-content;font-family:var(--font-mono,"Space Mono",monospace);
  font-size:clamp(.72rem,2vw,.8rem);font-weight:700;text-transform:uppercase;letter-spacing:.18em;
  color:var(--color-command-gold,#c8963e);padding:.4rem .7rem;border:1px solid var(--color-command-gold,#c8963e);border-radius:999px;}
.eegp-cap-top{margin-bottom:.2rem;}
.eegp-cap-end{margin-top:.2rem;}

.eegp-list{list-style:none;margin:0;padding:0;}
.eegp-row{position:relative;display:grid;grid-template-columns:auto 1fr;gap:clamp(.8rem,3vw,1.1rem);
  padding:clamp(.7rem,2.5vw,.95rem) 0;}
/* the gold spine: a line down the node column, drawn behind the nodes */
.eegp-row::before{content:"";position:absolute;left:calc(clamp(1.5rem,5vw,1.9rem) / 2);top:0;bottom:0;
  width:2px;background:var(--color-command-gold,#c8963e);opacity:.35;}
.eegp-row:first-child::before{top:50%;}
.eegp-row:last-child::before{bottom:50%;}

.eegp-node{position:relative;z-index:1;display:grid;place-items:center;align-self:start;
  width:clamp(1.5rem,5vw,1.9rem);height:clamp(1.5rem,5vw,1.9rem);border-radius:999px;
  background:var(--color-deep-space,#08090d);box-shadow:inset 0 0 0 2px var(--color-command-gold,#c8963e);
  font-family:var(--font-mono,"Space Mono",monospace);font-size:clamp(.7rem,2vw,.78rem);font-weight:700;
  color:var(--color-command-gold,#c8963e);}

.eegp-body{padding-top:.05rem;}
.eegp-name{margin:0;color:#fff;font-weight:700;font-size:clamp(1.02rem,3vw,1.2rem);letter-spacing:.01em;}
.eegp-what{margin:.15rem 0 0;color:var(--color-gray-1,#e8e8e8);font-size:clamp(.9rem,2.4vw,1rem);line-height:1.4;}
.eegp-hard{margin:.2rem 0 0;color:var(--color-muted,#aaa);
  font-family:var(--font-mono,"Space Mono",monospace);font-size:clamp(.72rem,2vw,.8rem);letter-spacing:.02em;}

/* Tier-B reveal off the frame's armed/in contract (animation-standards.md): the
   spine and nodes settle in reading order. Gated behind .armed so a reduced-motion
   / no-JS / exporter render shows the final state. */
.dgfrm.armed .eegp-row{opacity:0;transform:translateY(6px);}
.dgfrm.armed.in .eegp-row{opacity:1;transform:none;
  transition:opacity .5s ease,transform .5s cubic-bezier(.2,.7,.2,1);}
.dgfrm.armed.in .eegp-row:nth-child(2){transition-delay:.06s;}
.dgfrm.armed.in .eegp-row:nth-child(3){transition-delay:.12s;}
.dgfrm.armed.in .eegp-row:nth-child(4){transition-delay:.18s;}
.dgfrm.armed.in .eegp-row:nth-child(5){transition-delay:.24s;}
@media (prefers-reduced-motion:reduce){
  .dgfrm .eegp-row{opacity:1!important;transform:none!important;}
}
`;
