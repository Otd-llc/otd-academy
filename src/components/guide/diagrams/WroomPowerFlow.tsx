// USB-C 5 V → 3.3 V power drop, drawn as two reservoirs split by the regulator (v2).
//
// Teaching point: the LDO takes the 5 V rail down to a clean 3.3 V. That is drawn
// literally as two water reservoirs at different levels — a FULL 5 V pool on the
// left, a LOWER 3.3 V pool on the right — with U2, the RT9080 in its real 5-lead
// TSOT-23-5 package, standing between them as the thing that sets the drop. The
// package is drawn flow-aligned: VIN / GND / EN face the 5 V pool, VOUT / NC face
// the 3.3 V pool, pin-1 dot on VIN.
//
// v2: landscape (was a tall vertical HTML spine). Token-only colour via scoped CSS
// classes (never a fill="#…" presentation attr, which can't read a var and would
// go white-on-ivory in light). On a phone the labelled SVG would shrink its text
// under the ~14px floor, so it reflows to a stacked in → U2 → out card column.
import { DiagramFrame } from "./DiagramFrame";

// Static, module-constant SVG markup (no props / no user input) — safe to inject.
// Rotated (flow-aligned) RT9080 TSOT-23-5: body 30×48, 3 leads LEFT (VIN/GND/EN,
// facing the 5 V pool), 2 leads RIGHT (VOUT/NC, facing 3.3 V), pin-1 dot on VIN.
function buildMarkup() {
  const lead = (x1: number, y1: number, x2: number, y2: number) =>
    `<line class="wpf-lead" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;

  // U2 chip, drawn in its own translate+scale group so the reveal never fights it.
  const chip =
    `<g class="wpf-chip" transform="translate(272,70) scale(1.75)">` +
    lead(0, 8, -9, 8) + lead(0, 24, -9, 24) + lead(0, 40, -9, 40) + // VIN / GND / EN
    lead(30, 14, 39, 14) + lead(30, 34, 39, 34) +                    // VOUT / NC
    `<rect class="wpf-body" x="0" y="0" width="30" height="48" rx="3.5"/>` +
    `<circle class="wpf-pin1" cx="7" cy="8" r="2.4"/>` +
    `<text class="wpf-u2" x="15" y="29" text-anchor="middle">U2</text>` +
    `</g>`;

  const inPool =
    `<g class="wpf-g-in">` +
    `<rect class="wpf-water" x="30" y="80" width="205" height="115"/>` +
    `<line class="wpf-waterline" x1="30" y1="80" x2="235" y2="80"/>` +
    `<text class="wpf-vlabel" x="70" y="71">5 V</text>` +
    `</g>`;

  const outPool =
    `<g class="wpf-g-out">` +
    `<rect class="wpf-water" x="362" y="130" width="168" height="65"/>` +
    `<line class="wpf-waterline" x1="362" y1="130" x2="530" y2="130"/>` +
    `<text class="wpf-vlabel" x="452" y="121">3.3 V</text>` +
    `</g>`;

  return (
    inPool +
    `<g class="wpf-g-chip">` + chip +
    `<text class="wpf-part" x="298" y="213" text-anchor="middle">RT9080</text></g>` +
    outPool
  );
}
const MARKUP = buildMarkup();

export function WroomPowerFlow({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="SCHEMATIC · POWER FLOW"
      tone="gold"
      title="Power flow: USB-C to the WROOM"
      ariaLabel="The board's power drop, drawn as two reservoirs. On the left, a full 5 volt pool that comes in from USB-C. In the middle stands U2, the RT9080 low-dropout regulator, in its real 5-lead package: VIN, ground and enable face the 5 volt pool; VOUT and the unused pin face the right. On the right, a lower 3.3 volt pool. The lower water level is the voltage the regulator gives up, dropping the 5 volt rail down to a clean 3.3 volts for the WROOM."
      caption={caption}
      defaultCaption="5 V comes in; the LDO drops it to a clean 3.3 V for the WROOM."
    >
      <style>{CSS}</style>

      <div className="wpf-fig">
        <svg className="wpf-svg" viewBox="0 0 560 230" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <g dangerouslySetInnerHTML={{ __html: MARKUP }} />
        </svg>

        {/* Phone reflow: the labelled SVG would shrink its text under the floor, so
            below 520px it stacks as an in → U2 → out card column. */}
        <div className="wpf-stack" aria-hidden="true">
          <div className="wpf-row wpf-in">
            <span className="wpf-rv">5 V</span>
            <span className="wpf-rt">in, from USB-C</span>
          </div>
          <span className="wpf-down">▼</span>
          <div className="wpf-node">
            <span className="wpf-nref">U2</span>
            <span className="wpf-nname">RT9080 LDO</span>
          </div>
          <span className="wpf-down">▼</span>
          <div className="wpf-row wpf-out">
            <span className="wpf-rv">3.3 V</span>
            <span className="wpf-rt">clean, to the WROOM</span>
          </div>
        </div>
      </div>
    </DiagramFrame>
  );
}

// Token-driven (var(--color-*) / var(--font-*)) with literal fallbacks so a
// standalone render still resolves. Gold-dominant per brand; unique .wpf- prefix.
const CSS = `
.wpf-fig{width:100%;}
.wpf-svg{display:block;width:100%;height:auto;overflow:visible;}
.wpf-stack{display:none;}

/* ── SVG paint: token-only, via classes (no fill="#…" presentation attrs) ── */
.wpf-water{fill:var(--color-command-gold,#c8963e);fill-opacity:.22;}
.wpf-waterline{stroke:var(--color-command-gold,#c8963e);stroke-width:2.5;}
.wpf-lead{stroke:var(--color-command-gold,#c8963e);stroke-width:2.6;stroke-linecap:round;}
.wpf-body{fill:var(--color-diagram-surface,#1f2438);stroke:var(--color-command-gold,#c8963e);stroke-width:2.2;}
.wpf-pin1{fill:var(--color-gold-light,#e8b865);}
.wpf-u2{fill:var(--color-title,#f1ece0);font-family:var(--font-mono,"Space Mono",monospace);font-size:13px;font-weight:700;}
.wpf-vlabel{fill:var(--color-command-gold,#c8963e);font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-size:16px;font-weight:700;}
.wpf-part{fill:var(--color-muted,#aaa);font-family:var(--font-mono,"Space Mono",monospace);font-size:9px;}

/* ── phone stack (< 520px) ── */
@media (max-width:520px){
  .wpf-svg{display:none;}
  .wpf-stack{display:flex;flex-direction:column;align-items:center;gap:.55rem;}
}
.wpf-row{width:100%;max-width:20rem;box-sizing:border-box;display:flex;align-items:baseline;justify-content:center;gap:.5rem;
  border-radius:8px;padding:.7rem .8rem;border:1.5px solid var(--color-command-gold,#c8963e);
  background:color-mix(in srgb,var(--color-command-gold,#c8963e) 18%,transparent);}
.wpf-rv{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:700;font-size:1.5rem;line-height:1;color:var(--color-command-gold,#c8963e);}
.wpf-rt{font-family:var(--font-serif,"Lora",serif);font-size:.9rem;color:var(--color-muted,#aaa);}
.wpf-node{width:100%;max-width:20rem;box-sizing:border-box;text-align:center;border-radius:8px;padding:.7rem .8rem;
  background:var(--color-diagram-surface,#1f2438);border:2px solid var(--color-command-gold,#c8963e);}
.wpf-nref{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:1.25rem;color:var(--color-title,#f1ece0);}
.wpf-nname{display:block;margin-top:.15rem;font-family:var(--font-mono,"Space Mono",monospace);font-size:.85rem;color:var(--color-muted,#aaa);letter-spacing:.05em;}
.wpf-down{color:var(--color-command-gold,#c8963e);font-size:1.1rem;line-height:1;}

/* Tier-B reveal: power flows in → chip → out (opacity only, so the chip's own
   transform is never clobbered). Final state under reduced-motion. */
.dgfrm.armed .wpf-g-in,.dgfrm.armed .wpf-g-chip,.dgfrm.armed .wpf-g-out{opacity:0;}
.dgfrm.armed.in .wpf-g-in{opacity:1;transition:opacity .5s ease;}
.dgfrm.armed.in .wpf-g-chip{opacity:1;transition:opacity .5s ease .16s;}
.dgfrm.armed.in .wpf-g-out{opacity:1;transition:opacity .5s ease .32s;}
@media (prefers-reduced-motion:reduce){
  .dgfrm .wpf-g-in,.dgfrm .wpf-g-chip,.dgfrm .wpf-g-out{opacity:1!important;transition:none!important;}
}
`;
