// What EEG measures, source to scalp, as a responsive HTML component.
//
// Teaching point: EEG is not brain imaging. When large populations of neurons
// fire together, their tiny voltages sum into a field that is blurred and
// attenuated crossing the skull and scalp, reaching an electrode as a few
// microvolts that vary over time. Great timing (millisecond), poor place
// (blurred). A vertical flow with a gold spine, mobile-friendly.
//
// Header/frame/caption from DiagramFrame. Brand palette: gold-dominant, muted
// detail, white stage names. @theme tokens.
import { DiagramFrame } from "./DiagramFrame";

const STAGES = [
  { name: "Neuron populations", sub: "fire together, in sync" },
  { name: "Voltages sum", sub: "into one tiny field" },
  { name: "Through skull + scalp", sub: "blurred and attenuated" },
  { name: "At the electrode", sub: "a few µV, over time" },
];

export function SourceToScalp({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="WHAT IS EEG"
      tone="gold"
      title="From firing neurons to a few microvolts"
      ariaLabel="What EEG measures, from source to scalp: when large populations of neurons fire together in sync, their tiny voltages sum into a single field; that field is blurred and attenuated as it crosses the skull and scalp; and it reaches a scalp electrode as a signal of just a few microvolts varying over time. The result is excellent timing (millisecond by millisecond) but poor spatial resolution, because the signal is smeared on the way out."
      caption={caption}
      defaultCaption="Great timing, poor place. EEG reads electrical rhythm over time, not a picture of where in the brain it came from."
    >
      <style>{CSS}</style>

      <ol className="sts">
        {STAGES.map((s, i) => (
          <li className="sts-row" key={s.name}>
            <span className="sts-dot" aria-hidden="true" />
            <div className="sts-body">
              <p className="sts-name">{s.name}</p>
              <p className="sts-sub">{s.sub}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="sts-tags">
        <span className="sts-tag">timing: millisecond</span>
        <span className="sts-tag sts-tag-muted">place: blurred</span>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.sts{list-style:none;margin:0;padding:0;}
.sts-row{position:relative;display:grid;grid-template-columns:auto 1fr;gap:clamp(.75rem,3vw,1rem);
  padding:clamp(.55rem,2.2vw,.8rem) 0;text-align:left;}
.sts-row::before{content:"";position:absolute;left:calc(clamp(.9rem,3vw,1.05rem) / 2 - 1px);top:0;bottom:0;
  width:2px;background:var(--color-command-gold,#c8963e);opacity:.35;}
.sts-row:first-child::before{top:50%;}
.sts-row:last-child::before{bottom:50%;}
.sts-dot{position:relative;z-index:1;align-self:start;margin-top:.2rem;
  width:clamp(.9rem,3vw,1.05rem);height:clamp(.9rem,3vw,1.05rem);border-radius:999px;
  background:var(--color-deep-space,#08090d);box-shadow:inset 0 0 0 2px var(--color-command-gold,#c8963e);}
.sts-name{margin:0;color:var(--color-title,#f1ece0);font-weight:700;font-size:clamp(1rem,2.8vw,1.15rem);}
.sts-sub{margin:.12rem 0 0;color:var(--color-muted,#aaa);font-size:clamp(.85rem,2.3vw,.95rem);line-height:1.35;}

.sts-tags{margin:clamp(.9rem,3vw,1.2rem) 0 0;display:flex;flex-wrap:wrap;justify-content:center;gap:.5rem .9rem;}
.sts-tag{font-family:var(--font-mono,"Space Mono",monospace);font-size:clamp(.72rem,2vw,.8rem);font-weight:700;
  padding:.22rem .55rem;border-radius:4px;color:var(--color-command-gold,#c8963e);
  box-shadow:inset 0 0 0 1px var(--color-command-gold,#c8963e);}
.sts-tag-muted{color:var(--color-muted,#aaa);box-shadow:inset 0 0 0 1px var(--color-panel-border,#3a3f50);}

.dgfrm.armed .sts-row,.dgfrm.armed .sts-tags{opacity:0;transform:translateY(5px);}
.dgfrm.armed.in .sts-row,.dgfrm.armed.in .sts-tags{opacity:1;transform:none;transition:opacity .45s ease,transform .45s cubic-bezier(.2,.7,.2,1);}
.dgfrm.armed.in .sts-row:nth-child(2){transition-delay:.07s;}
.dgfrm.armed.in .sts-row:nth-child(3){transition-delay:.14s;}
.dgfrm.armed.in .sts-row:nth-child(4){transition-delay:.21s;}
.dgfrm.armed.in .sts-tags{transition-delay:.28s;}
@media (prefers-reduced-motion:reduce){.dgfrm .sts-row,.dgfrm .sts-tags{opacity:1!important;transform:none!important;}}
`;
