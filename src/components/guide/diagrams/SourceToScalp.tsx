// What EEG measures, source to scalp, as a responsive diagram (v2).
//
// Teaching point: EEG is not brain imaging. When populations of neurons fire
// together their tiny voltages sum into a field that SPREADS and attenuates as
// it crosses the skull and scalp, reaching an electrode as a few microvolts over
// time. Great timing (millisecond), poor place (a wide, blurred footprint).
//
// v2 landscape reflow: the old version was a vertical spine (portrait, which
// gapped the field-guide PDF). This is a layered cross-section (cortex / skull /
// scalp) with the field radiating from a focal source in widening, fading
// wavefronts up to a wide footprint under the scalp electrode -- blur (spread) +
// attenuation (fade) made visible. On a narrow phone it REFLOWS to the four-stage
// vertical list (real px, no shrinking SVG text) per directive 1. Token-only
// color via CSS classes (never a fill/stroke="#.." attribute) so it re-themes
// under data-theme="light"; in-SVG labels are sized to clear the ~9pt print floor.
import { DiagramFrame } from "./DiagramFrame";

// `name`/`sub` = full (phone list); `shortName`/`short` = the compact desktop
// caption row. No value is dropped: the full text lives in the list + aria-label.
const STAGES = [
  { name: "Neuron populations", sub: "fire together, in sync", shortName: "Neurons fire", short: "in sync" },
  { name: "Voltages sum", sub: "into one tiny field", shortName: "Voltages sum", short: "one field" },
  { name: "Through skull + scalp", sub: "blurred and attenuated", shortName: "Skull + scalp", short: "blur, attenuate" },
  { name: "At the electrode", sub: "a few µV, over time", shortName: "Electrode", short: "a few µV" },
];

export function SourceToScalp({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="WHAT IS EEG"
      tone="gold"
      title="From firing neurons to a few microvolts"
      ariaLabel="What EEG measures, from source to scalp, drawn as a cross-section of the head. When large populations of neurons fire together in sync, their tiny voltages sum into a single field; that field spreads and is attenuated as it radiates up through the skull and scalp; and it reaches a scalp electrode as a wide, blurred footprint of just a few microvolts varying over time. The result is excellent timing (millisecond by millisecond) but poor spatial resolution, because the signal is smeared on the way out."
      caption={caption}
      defaultCaption="Great timing, poor place. EEG reads electrical rhythm over time, not a picture of where in the brain it came from."
    >
      <style>{CSS}</style>

      <div className="sts">
        {/* desktop / print: layered cross-section + spreading field */}
        <div className="sts-diagram">
          <svg className="sts-svg" viewBox="0 0 560 150" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <rect className="sts-lyr-scalp" x="0" y="20" width="560" height="26" />
            <rect className="sts-lyr-skull" x="0" y="46" width="560" height="30" />
            <rect className="sts-lyr-cortex" x="0" y="76" width="560" height="64" />
            <line className="sts-lyrline" x1="0" y1="20" x2="560" y2="20" />
            <line className="sts-lyrline" x1="0" y1="46" x2="560" y2="46" />
            <line className="sts-lyrline" x1="0" y1="76" x2="560" y2="76" />
            {/* blur envelope: focal source -> wide footprint at the scalp */}
            <polygon className="sts-cone" points="280,128 374,46 186,46" />
            {/* field wavefronts propagating up, widening + fading */}
            <path className="sts-wf" d="M252,104 Q280,92 308,104" opacity="0.9" />
            <path className="sts-wf" d="M230,82 Q280,69 330,82" opacity="0.6" />
            <path className="sts-wf" d="M208,60 Q280,47 352,60" opacity="0.4" />
            <path className="sts-wf" d="M190,46 Q280,34 370,46" opacity="0.24" />
            <line className="sts-ctr" x1="280" y1="124" x2="280" y2="22" />
            {/* source burst (neurons firing together) */}
            <circle className="sts-src" cx="280" cy="128" r="6" />
            <circle className="sts-src" cx="262" cy="135" r="2.5" />
            <circle className="sts-src" cx="298" cy="135" r="2.5" />
            <circle className="sts-src" cx="271" cy="121" r="2.5" />
            <circle className="sts-src" cx="289" cy="121" r="2.5" />
            {/* electrode on the scalp */}
            <rect className="sts-elec" x="264" y="13" width="32" height="8" rx="2" />
            <text className="sts-glab" x="280" y="7" textAnchor="middle">electrode</text>
            {/* labels */}
            <text className="sts-slab" x="548" y="37" textAnchor="end">SCALP</text>
            <text className="sts-slab" x="548" y="65" textAnchor="end">SKULL</text>
            <text className="sts-slab" x="548" y="112" textAnchor="end">CORTEX</text>
            <text className="sts-foot" x="12" y="37" textAnchor="start">wide, blurred footprint</text>
            <text className="sts-foot sts-foot-gold" x="12" y="140" textAnchor="start">source: focal, strong</text>
          </svg>
          <div className="sts-cap4">
            {STAGES.map((s) => (
              <div key={s.name} className="sts-c4">
                <p className="sts-c4n">{s.shortName}</p>
                <p className="sts-c4s">{s.short}</p>
              </div>
            ))}
          </div>
        </div>

        {/* phone: the four-stage vertical spine */}
        <ol className="sts-list" aria-hidden="true">
          {STAGES.map((s) => (
            <li className="sts-row" key={s.name}>
              <span className="sts-dot" />
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
      </div>
    </DiagramFrame>
  );
}

// Token-driven with DARK literal fallbacks so a standalone / exporter render
// resolves; light values come only from the token override under data-theme.
const CSS = `
.sts-svg{overflow:visible;width:100%;height:auto;display:block;}
.sts-lyr-scalp{fill:color-mix(in srgb,var(--color-command-gold,#c8963e) 8%,transparent);}
.sts-lyr-skull{fill:color-mix(in srgb,var(--color-panel-border,#3a3f50) 45%,transparent);}
.sts-lyr-cortex{fill:color-mix(in srgb,var(--color-signal-blue,#4a8fff) 10%,transparent);}
.sts-lyrline{stroke:var(--color-panel-border,#3a3f50);stroke-width:1;}
.sts-cone{fill:color-mix(in srgb,var(--color-command-gold,#c8963e) 9%,transparent);stroke:none;}
.sts-wf{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2.4;stroke-linecap:round;}
.sts-ctr{stroke:var(--color-command-gold,#c8963e);stroke-width:2;stroke-dasharray:2 3;opacity:.65;fill:none;}
.sts-src{fill:var(--color-gold-light,#e8b865);}
.sts-elec{fill:var(--color-command-gold,#c8963e);}
.sts-lead{stroke:var(--color-command-gold,#c8963e);stroke-width:2;}
.sts-glab{fill:var(--color-title,#f1ece0);font-family:var(--font-display,"Bebas Neue",sans-serif);font-size:16px;letter-spacing:.02em;}
.sts-slab{fill:var(--color-muted,#aaa);font-family:var(--font-mono,"Space Mono",monospace);font-size:13px;font-weight:700;letter-spacing:.1em;}
.sts-foot{fill:var(--color-muted,#aaa);font-family:var(--font-mono,"Space Mono",monospace);font-size:13px;letter-spacing:.02em;}
.sts-foot-gold{fill:var(--color-gold-light,#e8b865);}

.sts-cap4{display:grid;grid-template-columns:repeat(4,1fr);gap:.4rem;margin-top:.35rem;text-align:center;}
.sts-c4n{margin:0;font-family:var(--font-display,"Bebas Neue",sans-serif);font-size:clamp(1rem,2.5vw,1.15rem);letter-spacing:.02em;line-height:1.03;color:var(--color-title,#f1ece0);}
.sts-c4s{margin:.1rem 0 0;font-family:var(--font-serif,"Lora",serif);font-size:clamp(.78rem,2vw,.85rem);line-height:1.25;color:var(--color-muted,#aaa);}

/* phone reflow: the vertical spine */
.sts-list{display:none;list-style:none;margin:0;padding:0;}
@container (max-width:520px){
  .sts-diagram{display:none;}
  .sts-list{display:block;}
}
.sts-row{position:relative;display:grid;grid-template-columns:auto 1fr;gap:.9rem;padding:.7rem 0;text-align:left;}
.sts-row::before{content:"";position:absolute;left:.5rem;top:0;bottom:0;width:2px;background:var(--color-command-gold,#c8963e);opacity:.35;}
.sts-row:first-child::before{top:50%;}
.sts-row:last-child::before{bottom:50%;}
.sts-dot{position:relative;z-index:1;align-self:start;margin-top:.2rem;width:1.05rem;height:1.05rem;border-radius:999px;
  background:var(--color-deep-space,#08090d);box-shadow:inset 0 0 0 2px var(--color-command-gold,#c8963e);}
.sts-name{margin:0;color:var(--color-title,#f1ece0);font-family:var(--font-display,"Bebas Neue",sans-serif);font-size:1.2rem;letter-spacing:.02em;}
.sts-sub{margin:.12rem 0 0;color:var(--color-muted,#aaa);font-family:var(--font-serif,"Lora",serif);font-size:.95rem;line-height:1.35;}

.sts-tags{margin:.7rem 0 0;display:flex;flex-wrap:wrap;justify-content:center;gap:.5rem .9rem;}
.sts-tag{font-family:var(--font-mono,"Space Mono",monospace);font-size:clamp(.72rem,2vw,.8rem);font-weight:700;
  padding:.24rem .6rem;border-radius:4px;color:var(--color-command-gold,#c8963e);box-shadow:inset 0 0 0 1px var(--color-command-gold,#c8963e);}
.sts-tag-muted{color:var(--color-muted,#aaa);box-shadow:inset 0 0 0 1px var(--color-panel-border,#3a3f50);}

/* Tier-B reveal off the frame's armed/in contract; gated so reduced-motion /
   no-JS / exporter shows the final state. */
.dgfrm.armed .sts-cap4,.dgfrm.armed .sts-row,.dgfrm.armed .sts-tags{opacity:0;transform:translateY(5px);}
.dgfrm.armed.in .sts-cap4,.dgfrm.armed.in .sts-row,.dgfrm.armed.in .sts-tags{opacity:1;transform:none;transition:opacity .5s ease,transform .5s cubic-bezier(.2,.7,.2,1);}
@media (prefers-reduced-motion:reduce){
  .dgfrm .sts-cap4,.dgfrm .sts-row,.dgfrm .sts-tags{opacity:1!important;transform:none!important;}
}
`;
