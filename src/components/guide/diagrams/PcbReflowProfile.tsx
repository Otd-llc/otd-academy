// Reflow temperature profile: temp-vs-time curve (diagram-standards v2).
//
// Teaching point (lesson 10): the reflow heat follows four stages — a preheat
// ramp, a soak, a reflow spike above the solder's melting point, and a
// controlled cool-down. Lead-free SAC305 melts around 217-219 C and peaks near
// 245-255 C, held only briefly (CompuPhase). The band above the 217 C line and
// the reflow window are highlighted as the zone where the solder is molten.
//
// One inline SVG. Every color is a CSS class reading a token (gradient stops
// included, via `stop-color` in a class so they re-theme — a presentation
// attribute can't read a var), so dark, light, and the `--light` print raster
// all flip. Data numbers are in Saira. Header + caption from DiagramFrame.
import { DiagramFrame } from "./DiagramFrame";

// Plot geometry: x 40..420, y 18 (255 C) .. 170 (25 C). Melt line 217 C -> y45.
const CURVE =
  "M40 170 C 92 152 122 112 154 88 C 190 80 214 74 249 69 C 276 60 296 34 314 23 C 342 32 382 118 420 147";
const MELT_Y = 45;
const BANDS = [
  ["preheat", 97],
  ["soak", 201],
  ["reflow", 297],
  ["cool-down", 382],
] as const;

export function PcbReflowProfile({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="PCB · REFLOW"
      tone="gold"
      title="The reflow temperature profile"
      ariaLabel="A reflow temperature-versus-time curve for lead-free soldering. Temperature ramps up through a preheat stage, holds through a soak, spikes through the reflow stage to a peak near 245 to 255 C, then falls through a controlled cool-down. A dashed line marks the 217 C melting point; the band above it and the reflow window are highlighted as the zone where the solder is molten."
      caption={caption}
      defaultCaption="Preheat, soak, a reflow spike above the 217 C melting point, then a controlled cool-down. Lead-free SAC305 peaks near 245 to 255 C, held only briefly."
    >
      <style>{CSS}</style>
      <div className="rf">
        <svg className="rf-svg" viewBox="0 0 440 200" aria-hidden="true">
          <defs>
            <linearGradient id="rf-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" className="rf-g0" />
              <stop offset="1" className="rf-g1" />
            </linearGradient>
          </defs>

          {/* molten zones: temperature above the melt line, and the reflow time window */}
          <rect x="40" y="18" width="380" height={MELT_Y - 18} className="rf-hot" />
          <rect x="249" y="18" width="96" height="152" className="rf-window" />
          <text x="297" y="13" textAnchor="middle" className="rf-molten">solder molten</text>

          {/* axes */}
          <line x1="40" y1="170" x2="420" y2="170" className="rf-axis" />
          <line x1="40" y1="18" x2="40" y2="170" className="rf-axis" />
          <text x="34" y="27" textAnchor="end" className="rf-num">255</text>
          <text x="34" y="49" textAnchor="end" className="rf-num">217</text>
          <text x="34" y="173" textAnchor="end" className="rf-num">25</text>
          <text x="230" y="193" textAnchor="middle" className="rf-ax-lbl">TIME &#8594;</text>
          <text x="16" y="95" textAnchor="middle" className="rf-ax-lbl" transform="rotate(-90 16 95)">&#176;C</text>

          {/* area under the curve */}
          <path d={`${CURVE} L420 170 L40 170 Z`} className="rf-area" />

          {/* melt line + a roomy label placed left, clear of the peak */}
          <line x1="40" y1={MELT_Y} x2="420" y2={MELT_Y} className="rf-melt" />
          <text x="50" y="37" className="rf-melt-lbl">melting point 217 &#176;C</text>

          {/* the profile */}
          <path d={CURVE} className="rf-curve" />

          {/* stage labels */}
          {BANDS.map(([name, x]) => (
            <text key={name} x={x} y="164" textAnchor="middle" className="rf-stage">{name}</text>
          ))}
        </svg>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.rf{max-width:36rem;margin-inline:auto;}
.rf-svg{display:block;width:100%;height:auto;overflow:visible;}
.rf-hot{fill:var(--color-alert-red,#ef5350);opacity:.12;}
.rf-window{fill:var(--color-command-gold,#c8963e);opacity:.1;}
.rf-molten{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:700;font-size:13px;fill:var(--color-command-gold,#c8963e);}
.rf-axis{stroke:var(--color-panel-border,#3a3f50);stroke-width:1.3;}
.rf-num{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:700;font-size:13px;fill:var(--color-muted,#aaaaaa);}
.rf-ax-lbl{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:700;font-size:13px;letter-spacing:.5px;fill:var(--color-muted,#aaaaaa);}
.rf-g0{stop-color:var(--color-command-gold,#c8963e);stop-opacity:.4;}
.rf-g1{stop-color:var(--color-command-gold,#c8963e);stop-opacity:0;}
.rf-area{fill:url(#rf-fill);}
.rf-melt{stroke:var(--color-alert-red,#ef5350);stroke-width:1.5;stroke-dasharray:5 4;}
.rf-melt-lbl{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:700;font-size:15px;fill:var(--color-alert-red,#ef5350);}
.rf-curve{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:3.4;stroke-linejoin:round;stroke-linecap:round;}
.rf-stage{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:700;font-size:14px;fill:var(--color-title,#f1ece0);}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .rf-svg{opacity:0;transform:translateY(6px);}
.dgfrm.armed.in .rf-svg{opacity:1;transform:none;transition:opacity .6s ease,transform .6s cubic-bezier(.2,.7,.2,1);}
@media (prefers-reduced-motion:reduce){
  .dgfrm .rf-svg{opacity:1!important;transform:none!important;transition:none!important;}
}
`;
