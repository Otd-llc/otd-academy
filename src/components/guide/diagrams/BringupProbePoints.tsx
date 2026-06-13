// Bring-up "rail probe points" as a responsive HTML component.
//
// Why not the source /guide-diagrams SVG: a fixed-viewBox 780-wide SVG scales to
// its container, so on a ~360px phone its text renders at ~0.46x — well below an
// accessible size, with no font size that survives. Rendered as real HTML/CSS the
// labels are actual CSS px (clamped, never below ~14px) that do NOT shrink with
// the viewport; only the small board graphic is an inline <svg> (no text inside
// it). On a phone the two-column stage stacks: graphic on top, the TP1/TP2 rows
// and the meter readout below as full-width readable blocks. Header / frame /
// caption come from the shared DiagramFrame (site-standard Bebas title); this
// file supplies only the graphic body.
//
// BRAND (onethousanddrones.com/brand): gold-dominant on Deep Space, Navy Dark
// bodies, white headline/glyphs, muted (#aaa) labels. Alert Red is reserved for
// the 3V3 rail / red lead (the one "live" thing you must not mis-probe); GND uses
// muted gray for the black lead. All colours via @theme tokens with hex
// fallbacks so a standalone render still resolves.
import { DiagramFrame } from "./DiagramFrame";
import { WroomU1 } from "./WroomU1";

export function BringupProbePoints({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="BRING-UP · RAILS FIRST"
      tone="gold"
      title="Probe the 3.3 V rail before trusting anything downstream"
      ariaLabel="Bring-up: with the board powered, probe 3.3 V at TP1 with the red lead and ground at TP2 with the black lead; the multimeter in DC volts reads 3.30 V."
      caption={caption}
      defaultCaption="A steady 3.30 V means the rail is good — now you can trust everything it feeds."
    >
      <style>{CSS}</style>

      <div className="bpp-stage">
        <div className="bpp-board">
          <svg className="bpp-svg" viewBox="0 0 320 150" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <rect x="2" y="28" width="316" height="118" rx="8" fill="var(--color-navy-dark,#1f2438)" stroke="var(--color-command-gold,#c8963e)" strokeWidth="2" />
            {/* U1 — square WROOM body, antenna tab overhanging the board's top edge */}
            <WroomU1 x={26} y={6} scale={0.78} />
            <circle cx="170" cy="75" r="11" fill="var(--color-deep-space,#08090d)" stroke="var(--color-alert-red,#c62828)" strokeWidth="3" />
            <circle cx="170" cy="75" r="3.5" fill="none" stroke="var(--color-alert-red,#c62828)" strokeWidth="1.4" />
            <circle cx="262" cy="75" r="11" fill="var(--color-deep-space,#08090d)" stroke="var(--color-muted,#aaa)" strokeWidth="3" />
            <circle cx="262" cy="75" r="3.5" fill="none" stroke="var(--color-muted,#aaa)" strokeWidth="1.4" />
          </svg>
          <span className="bpp-pin bpp-pin1">TP1</span>
          <span className="bpp-pin bpp-pin2">TP2</span>
        </div>

        <div className="bpp-rows">
          <div className="bpp-row bpp-row--red">
            <span className="bpp-dot bpp-dot--red" />
            <div className="bpp-rowtext">
              <p className="bpp-rowtp">TP1 {"·"} 3V3</p>
              <p className="bpp-rowdesc">red lead {"—"} the 3.3 V rail</p>
            </div>
          </div>
          <div className="bpp-row bpp-row--gnd">
            <span className="bpp-dot bpp-dot--gnd" />
            <div className="bpp-rowtext">
              <p className="bpp-rowtp">TP2 {"·"} GND</p>
              <p className="bpp-rowdesc">black lead {"—"} ground reference</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bpp-meter">
        <div className="bpp-readout">
          <span className="bpp-value">3.30</span>
          <span className="bpp-unit">V</span>
        </div>
        <p className="bpp-mode">DMM {"·"} DC volts</p>
      </div>
    </DiagramFrame>
  );
}

// Token-driven (var(--color-*) / var(--font-*) from @theme) with literal
// fallbacks. Unique .bpp- prefix so styles never collide with other diagrams.
const CSS = `
.bpp-stage{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:clamp(1rem,3vw,1.6rem);align-items:center;text-align:left;}

.bpp-board{position:relative;min-width:0;}
.bpp-svg{display:block;width:100%;height:auto;}
.bpp-pin{position:absolute;top:18%;transform:translateX(-50%);font-size:.62rem;font-weight:700;letter-spacing:.12em;padding:1px 5px;border-radius:3px;}
.bpp-pin1{left:53%;color:var(--color-alert-red,#c62828);border:1px solid var(--color-alert-red,#c62828);}
.bpp-pin2{left:82%;color:var(--color-muted,#aaa);border:1px solid var(--color-panel-border,#3a3f50);}

.bpp-rows{display:flex;flex-direction:column;gap:.7rem;min-width:0;}
.bpp-row{display:flex;align-items:center;gap:.7rem;background:var(--color-navy-dark,#1f2438);border:1px solid var(--color-panel-border,#3a3f50);border-left-width:3px;border-radius:5px;padding:.65rem .8rem;}
.bpp-row--red{border-left-color:var(--color-alert-red,#c62828);}
.bpp-row--gnd{border-left-color:var(--color-muted,#aaa);}
.bpp-dot{flex:none;width:14px;height:14px;border-radius:50%;}
.bpp-dot--red{background:var(--color-alert-red,#c62828);}
.bpp-dot--gnd{background:var(--color-muted,#aaa);}
.bpp-rowtext{min-width:0;}
.bpp-rowtp{margin:0;color:#fff;font-weight:700;font-size:clamp(1.05rem,3vw,1.3rem);letter-spacing:.02em;}
.bpp-rowdesc{margin:.18rem 0 0;color:var(--color-muted,#aaa);font-family:var(--font-serif,"Lora",serif);font-size:clamp(.85rem,2.3vw,.95rem);line-height:1.35;}

.bpp-meter{margin:clamp(1.1rem,3.5vw,1.5rem) 0 0;background:var(--color-navy-dark,#1f2438);border:1px solid var(--color-panel-border,#3a3f50);border-radius:6px;padding:.9rem 1rem;display:flex;align-items:center;justify-content:space-between;gap:.8rem 1rem;flex-wrap:wrap;}
.bpp-readout{background:var(--color-deep-space,#08090d);border:1px solid var(--color-panel-border,#3a3f50);border-radius:4px;padding:.3rem .9rem;display:flex;align-items:baseline;gap:.3rem;}
.bpp-value{color:#fff;font-weight:700;font-size:clamp(1.8rem,7vw,2.6rem);line-height:1;letter-spacing:.02em;}
.bpp-unit{color:var(--color-gray-1,#e8e8e8);font-size:clamp(1rem,3vw,1.3rem);font-weight:700;}
.bpp-mode{margin:0;color:var(--color-muted,#aaa);font-size:clamp(.85rem,2.3vw,.95rem);letter-spacing:.06em;}

@media (max-width:520px){
  .bpp-stage{grid-template-columns:1fr;gap:1.1rem;}
  .bpp-board{max-width:300px;margin-inline:auto;width:100%;}
}
`;
