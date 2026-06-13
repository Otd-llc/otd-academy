// Decoupling-cap PLACEMENT as a responsive HTML component.
//
// Why not the source /guide-diagrams SVG: a fixed-viewBox SVG scales to its
// container, so on a ~360px phone a 780-wide canvas renders at ~0.46x and ANY
// text shrinks below an accessible size. Rendered as real HTML/CSS, every label
// is actual CSS px (clamped, never below ~14px) that does NOT scale with the
// viewport; only the loop graphic (IC body + power/ground rails + the cap
// closing the loop) is drawn with CSS boxes, and its WIDTH carries the
// small-loop-vs-big-loop story. On a phone the case rows stack (graphic on top,
// annotation below) instead of cramming two columns.
//
// Header / frame / caption come from the shared DiagramFrame (site-standard
// Bebas title); this file supplies only the graphic body.
//
// BRAND (onethousanddrones.com/brand): gold-dominant on Deep Space, Navy Dark
// bodies, alert red ONLY for the "must-not" far-placement case; no blue needed
// here. All colours via @theme tokens with literal fallbacks.
import { DiagramFrame } from "./DiagramFrame";

export function DecouplingPlacement({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="LAYOUT · DECOUPLING"
      tone="gold"
      title="Placement decides whether it works"
      ariaLabel="Decoupling capacitor placement decides whether it works. Case one, the cap right at the IC pin, makes a small current loop: a short path with low inductance, so the cap dumps current fast. Case two, the same cap placed far from the pin, makes a big loop: a long path whose trace inductance chokes the fast current. Same cap and same schematic — placement is everything."
      caption={caption}
      defaultCaption="Same cap, same schematic — placement is everything."
    >
      <style>{CSS}</style>
      <div className="dcpl">
        <div className="dcpl-case dcpl-good">
          <div className="dcpl-graphic">
            <div className="dcpl-ic">IC</div>
            <div className="dcpl-loop dcpl-loop-sm">
              <span className="dcpl-pwr" />
              <span className="dcpl-cap" />
              <span className="dcpl-gnd" />
              <span className="dcpl-looplabel">small loop</span>
            </div>
          </div>
          <div className="dcpl-notes">
            <p className="dcpl-verdict dcpl-v-good">
              <span className="dcpl-mark">✓</span> cap right at the pin
            </p>
            <p className="dcpl-body">
              Short path, low inductance &mdash; the cap dumps current fast.
            </p>
          </div>
        </div>

        <div className="dcpl-divider" />

        <div className="dcpl-case dcpl-bad">
          <div className="dcpl-graphic">
            <div className="dcpl-ic">IC</div>
            <div className="dcpl-loop dcpl-loop-lg">
              <span className="dcpl-pwr" />
              <span className="dcpl-cap" />
              <span className="dcpl-gnd" />
              <span className="dcpl-looplabel">big loop</span>
            </div>
          </div>
          <div className="dcpl-notes">
            <p className="dcpl-verdict dcpl-v-bad">
              <span className="dcpl-mark">✗</span> cap far from the pin
            </p>
            <p className="dcpl-body">
              Long path, trace inductance &mdash; chokes the fast current.
            </p>
          </div>
        </div>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.dcpl{text-align:left;}
.dcpl-case{display:flex;align-items:center;gap:clamp(1rem,3.5vw,1.75rem);}
.dcpl-graphic{flex:0 0 auto;display:flex;align-items:stretch;}

/* IC body */
.dcpl-ic{flex:0 0 auto;width:46px;height:96px;display:flex;align-items:center;justify-content:center;
  background:var(--color-navy-dark,#1f2438);border:2.5px solid var(--color-command-gold,#c8963e);
  border-radius:3px;color:#fff;font-weight:700;font-size:clamp(1.05rem,3vw,1.3rem);z-index:2;}

/* the current loop: power rail top, ground rail bottom, cap closing on the right */
.dcpl-loop{position:relative;height:96px;}
.dcpl-loop-sm{width:104px;background:rgba(200,150,62,.14);}
.dcpl-loop-lg{width:196px;background:rgba(198,40,40,.18);}
.dcpl-pwr,.dcpl-gnd{position:absolute;left:0;right:14px;height:2.5px;}
.dcpl-pwr{top:14px;background:var(--color-command-gold,#c8963e);}
.dcpl-gnd{bottom:14px;background:var(--color-muted,#aaa);}
/* cap = the vertical return on the right with a capacitor gap */
.dcpl-cap{position:absolute;right:12px;top:14px;bottom:14px;width:2px;background:var(--color-muted,#aaa);}
.dcpl-cap::before,.dcpl-cap::after{content:"";position:absolute;left:-7px;width:16px;height:2px;background:var(--color-muted,#aaa);}
.dcpl-cap::before{top:calc(50% - 4px);}
.dcpl-cap::after{top:calc(50% + 4px);}
.dcpl-looplabel{position:absolute;top:0;bottom:0;left:0;right:24px;display:flex;align-items:center;justify-content:center;
  font-weight:700;font-size:clamp(.85rem,2.3vw,.95rem);text-align:center;line-height:1.2;}
.dcpl-good .dcpl-looplabel{color:var(--color-command-gold,#c8963e);}
.dcpl-bad .dcpl-looplabel{color:var(--color-alert-red,#c62828);}

.dcpl-notes{flex:1 1 auto;min-width:0;}
.dcpl-verdict{margin:0 0 .4rem;font-weight:700;font-size:clamp(1.05rem,3vw,1.3rem);
  display:flex;align-items:baseline;gap:.5ch;line-height:1.25;}
.dcpl-mark{font-size:1.05em;}
.dcpl-v-good{color:var(--color-command-gold,#c8963e);}
.dcpl-v-bad{color:var(--color-alert-red,#c62828);}
.dcpl-body{margin:0;color:var(--color-muted,#aaa);font-family:var(--font-serif,"Lora",serif);
  font-size:clamp(.95rem,2.5vw,1.05rem);line-height:1.5;}

.dcpl-divider{height:1px;background:var(--color-panel-border,#3a3f50);
  margin:clamp(1.1rem,3.5vw,1.6rem) 0;}

@media (max-width:520px){
  .dcpl-case{flex-direction:column;align-items:stretch;gap:clamp(.8rem,4vw,1.1rem);}
  .dcpl-graphic{justify-content:center;}
  .dcpl-notes{text-align:center;}
  .dcpl-verdict{justify-content:center;}
}
`;
