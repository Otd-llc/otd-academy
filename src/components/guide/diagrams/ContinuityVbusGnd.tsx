// VBUS-to-GND continuity (short) check as a responsive HTML component. Header /
// frame / caption come from the shared DiagramFrame (site-standard Bebas title);
// this file supplies only the graphic body (and its own scoped <style>).
//
// Why not a single SVG for everything: a fixed-viewBox SVG scales to its
// container, so on a ~360px phone a wide canvas renders small and ANY text
// shrinks below an accessible size. The board itself is a label-free inline SVG
// (the graphic); every reader-facing label is real, clamped CSS px (never below
// ~14px) in HTML around it.
//
// Pure presentational server component (no hooks / animation). BRAND
// (onethousanddrones.com/brand): gold-dominant on Deep Space, Navy Dark bodies,
// white/gray-1 for the GND lead + the OL readout, Alert Red ONLY for the BEEP
// (dead-short) failure state. All colours via @theme tokens.
import { DiagramFrame } from "./DiagramFrame";

export function ContinuityVbusGnd({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="BEFORE POWER · UNPLUGGED · CONTINUITY MODE"
      tone="green"
      title="VBUS-to-GND must not beep"
      ariaLabel="Before any power: with the board unplugged and the meter in continuity mode, touch one probe to the VBUS pad and the other to the GND pad on the top of the board. The meter must read OL with no beep. A beep means a dead short — stop and fix it before plugging in."
      caption={caption}
      defaultCaption="Probe VBUS to GND before any power: it must read OL, not beep."
    >
      <style>{CSS}</style>
      <div className="cvg-stage">
        <div className="cvg-board">
          {/* Top-view board: U1 module on the left, two clearly separated and
              labelled probe pads (VBUS gold / GND white) on the right, each with
              a DMM probe tip resting on it. */}
          <svg
            className="cvg-svg"
            viewBox="0 0 320 200"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            {/* board outline */}
            <rect
              x="4"
              y="40"
              width="312"
              height="152"
              rx="7"
              fill="var(--color-navy-dark,#1f2438)"
              stroke="var(--color-command-gold,#c8963e)"
              strokeWidth="1.6"
            />

            {/* U1 — ESP32-S3-WROOM module (portrait, antenna up) */}
            <rect
              x="26"
              y="66"
              width="62"
              height="108"
              rx="3"
              fill="var(--color-deep-space,#08090d)"
              stroke="var(--color-command-gold,#c8963e)"
              strokeWidth="1.6"
            />
            <rect
              x="38"
              y="48"
              width="38"
              height="18"
              fill="var(--color-navy-dark,#1f2438)"
              stroke="var(--color-command-gold,#c8963e)"
              strokeWidth="1.4"
            />
            <path
              d="M44,58 v-6 h6 v6 h6 v-6 h6 v6 h6 v-6"
              fill="none"
              stroke="#fff"
              strokeWidth="1.3"
            />
            {/* castellated pin stubs down both long edges */}
            <g
              stroke="var(--color-command-gold,#c8963e)"
              strokeWidth="1.3"
              strokeOpacity="0.75"
            >
              <line x1="26" y1="80" x2="20" y2="80" />
              <line x1="26" y1="96" x2="20" y2="96" />
              <line x1="26" y1="112" x2="20" y2="112" />
              <line x1="26" y1="128" x2="20" y2="128" />
              <line x1="26" y1="144" x2="20" y2="144" />
              <line x1="26" y1="160" x2="20" y2="160" />
              <line x1="88" y1="80" x2="94" y2="80" />
              <line x1="88" y1="96" x2="94" y2="96" />
              <line x1="88" y1="112" x2="94" y2="112" />
              <line x1="88" y1="128" x2="94" y2="128" />
              <line x1="88" y1="144" x2="94" y2="144" />
              <line x1="88" y1="160" x2="94" y2="160" />
            </g>
            <text
              x="57"
              y="126"
              textAnchor="middle"
              fill="#fff"
              fontSize="17"
              fontWeight="700"
              fontFamily="var(--font-mono,monospace)"
            >
              U1
            </text>

            {/* ── VBUS pad (gold) ── */}
            <circle
              cx="186"
              cy="120"
              r="11"
              fill="var(--color-deep-space,#08090d)"
              stroke="var(--color-command-gold,#c8963e)"
              strokeWidth="3"
            />
            <circle
              cx="186"
              cy="120"
              r="3.4"
              fill="var(--color-command-gold,#c8963e)"
            />
            {/* DMM probe tip resting on the VBUS pad (gold lead) */}
            <line
              x1="186"
              y1="120"
              x2="158"
              y2="62"
              stroke="var(--color-command-gold,#c8963e)"
              strokeWidth="3.4"
              strokeLinecap="round"
            />
            <circle cx="186" cy="120" r="3.4" fill="var(--color-command-gold,#c8963e)" />

            {/* ── GND pad (white) ── */}
            <circle
              cx="270"
              cy="120"
              r="11"
              fill="var(--color-deep-space,#08090d)"
              stroke="var(--color-gray-1,#e8e8e8)"
              strokeWidth="3"
            />
            <circle
              cx="270"
              cy="120"
              r="3.4"
              fill="var(--color-gray-1,#e8e8e8)"
            />
            {/* DMM probe tip resting on the GND pad (white lead) */}
            <line
              x1="270"
              y1="120"
              x2="298"
              y2="62"
              stroke="var(--color-gray-1,#e8e8e8)"
              strokeWidth="3.4"
              strokeLinecap="round"
            />
            <circle cx="270" cy="120" r="3.4" fill="var(--color-gray-1,#e8e8e8)" />
          </svg>

          {/* On-graphic pad legend so each pad is unambiguous at any width. */}
          <div className="cvg-pads">
            <span className="cvg-pad cvg-pad-vbus">VBUS pad</span>
            <span className="cvg-pad cvg-pad-gnd">GND pad</span>
          </div>
        </div>

        <div className="cvg-probes">
          <div className="cvg-probe cvg-vbus">
            <span className="cvg-dot" />
            <span className="cvg-pname">VBUS</span>
            <span className="cvg-ploc">red probe → VBUS pad</span>
          </div>
          <div className="cvg-probe cvg-gnd">
            <span className="cvg-dot" />
            <span className="cvg-pname">GND</span>
            <span className="cvg-ploc">black probe → GND pad</span>
          </div>
        </div>

        <div className="cvg-meter">
          <div className="cvg-meter-read">
            <span className="cvg-ol">OL</span>
          </div>
          <div className="cvg-meter-mode">DMM · continuity (beep) mode · no beep</div>
        </div>
      </div>

      <div className="cvg-verdicts">
        <div className="cvg-verdict cvg-good">
          <span className="cvg-vtag">OL · NO BEEP</span>
          <span className="cvg-vtext">
            Open circuit. VBUS and GND aren&apos;t connected — exactly what you
            want.
          </span>
        </div>
        <div className="cvg-verdict cvg-bad">
          <span className="cvg-vtag">BEEP</span>
          <span className="cvg-vtext">
            Dead short. Stop — don&apos;t plug in. Find and fix it first.
          </span>
        </div>
      </div>
    </DiagramFrame>
  );
}

// Token-driven (var(--color-*) / var(--font-*) from @theme) with literal
// fallbacks so a standalone render still resolves. Gold-dominant per brand.
const CSS = `
.cvg-stage,.cvg-stage *{box-sizing:border-box;}
.cvg-stage{
  display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);
  grid-template-areas:"board probes" "meter meter";
  gap:clamp(.9rem,3vw,1.3rem);align-items:center;
  font-family:var(--font-mono,"Space Mono",monospace);color:var(--color-muted,#aaaaaa);
  text-align:left;}
.cvg-board{grid-area:board;}
.cvg-svg{display:block;width:100%;height:auto;}
.cvg-pads{margin-top:.55rem;display:flex;justify-content:space-around;gap:.5rem;}
.cvg-pad{font-weight:700;font-size:clamp(.8rem,2.3vw,.92rem);letter-spacing:.03em;}
.cvg-pad-vbus{color:var(--color-command-gold,#c8963e);}
.cvg-pad-gnd{color:var(--color-gray-1,#e8e8e8);}

.cvg-probes{grid-area:probes;display:flex;flex-direction:column;gap:.7rem;}
.cvg-probe{display:grid;grid-template-columns:auto 1fr;column-gap:.55rem;row-gap:.05rem;
  align-items:center;background:var(--color-navy-dark,#1f2438);
  border:1px solid var(--color-panel-border,#3a3f50);border-radius:6px;padding:.55rem .7rem;}
.cvg-dot{grid-row:1 / span 2;width:14px;height:14px;border-radius:50%;
  background:var(--color-deep-space,#08090d);}
.cvg-vbus .cvg-dot{border:3px solid var(--color-command-gold,#c8963e);}
.cvg-gnd .cvg-dot{border:3px solid var(--color-gray-1,#e8e8e8);}
.cvg-pname{font-weight:700;font-size:clamp(1.05rem,3vw,1.3rem);letter-spacing:.04em;}
.cvg-vbus .cvg-pname{color:var(--color-command-gold,#c8963e);}
.cvg-gnd .cvg-pname{color:var(--color-gray-1,#e8e8e8);}
.cvg-ploc{grid-column:2;color:var(--color-muted,#aaaaaa);font-size:clamp(.85rem,2.3vw,.95rem);}

.cvg-meter{grid-area:meter;display:flex;flex-direction:column;align-items:center;
  background:var(--color-navy-dark,#1f2438);border:1px solid var(--color-command-gold,#c8963e);
  border-radius:8px;padding:.7rem 1rem .8rem;}
.cvg-meter-read{width:100%;max-width:15rem;text-align:right;
  background:var(--color-deep-space,#08090d);border:1px solid var(--color-panel-border,#3a3f50);
  border-radius:4px;padding:.35rem .9rem;}
.cvg-ol{color:var(--color-gray-1,#e8e8e8);font-weight:700;font-size:clamp(1.8rem,7vw,2.4rem);
  letter-spacing:.06em;}
.cvg-meter-mode{margin-top:.5rem;color:var(--color-muted,#aaaaaa);text-align:center;
  font-size:clamp(.85rem,2.3vw,.95rem);}

.cvg-verdicts{margin-top:clamp(1rem,3.5vw,1.4rem);display:grid;gap:.7rem;text-align:left;}
.cvg-verdict{display:grid;grid-template-columns:auto 1fr;column-gap:.75rem;align-items:start;
  border:1px solid var(--color-panel-border,#3a3f50);border-radius:6px;padding:.6rem .75rem;
  background:var(--color-navy-dark,#1f2438);}
.cvg-vtag{font-weight:700;font-size:clamp(.85rem,2.3vw,.95rem);letter-spacing:.04em;
  white-space:nowrap;padding:.18rem .5rem;border-radius:4px;align-self:start;
  font-family:var(--font-mono,"Space Mono",monospace);}
.cvg-good{border-left:3px solid var(--color-command-gold,#c8963e);}
.cvg-good .cvg-vtag{color:var(--color-command-gold,#c8963e);border:1px solid var(--color-command-gold,#c8963e);}
.cvg-bad{border-left:3px solid var(--color-alert-red,#c62828);}
.cvg-bad .cvg-vtag{color:#fff;background:var(--color-alert-red,#c62828);}
.cvg-vtext{color:var(--color-gray-1,#e8e8e8);font-size:clamp(.95rem,2.5vw,1.05rem);line-height:1.45;
  font-family:var(--font-serif,"Lora",serif);}

@media (max-width:520px){
  .cvg-stage{grid-template-columns:1fr;grid-template-areas:"board" "probes" "meter";
    gap:1rem;}
  .cvg-board{max-width:20rem;margin-inline:auto;width:100%;}
  .cvg-meter-read{max-width:none;}
}
`;
