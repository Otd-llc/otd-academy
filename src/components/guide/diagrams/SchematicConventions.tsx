// Schematic-drawing conventions as a responsive HTML component. Header / frame /
// caption come from the shared DiagramFrame (site-standard Bebas title); this
// file supplies only the graphic body (and its own scoped <style>).
//
// Why not the source /guide-diagrams SVG: a fixed-viewBox SVG scales to its
// container, so on a ~360px phone a 780-wide canvas renders at ~0.46x and ANY
// text shrinks below an accessible size. Rendered as real HTML/CSS, every label
// (3V3, IC, in/out, GND, the rules) is actual CSS px (clamped, never below
// ~14px) that does NOT scale with the viewport. Only the wiring graphic — the
// supply rail, IC body, signal arrows, decoupling cap, and ground symbol — is a
// small contained inline <svg>; all text lives in HTML around it. On a phone the
// two columns stack: rules on top, worked example below.
//
// BRAND (onethousanddrones.com/brand): gold-dominant on Deep Space, Navy Dark
// bodies, Signal Blue only as the secondary in/out data callout. All colours via
// @theme tokens with literal fallbacks. Muted text uses --color-muted (#aaa),
// never a dimmer gray, so it stays legible on the dark ground.
import { DiagramFrame } from "./DiagramFrame";

const RULES = [
  "signal flows left → right",
  "supplies up, grounds down",
  "group by sub-circuit",
  "decoupling cap at the pin",
];

export function SchematicConventions({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="SCHEMATIC · CONVENTIONS"
      tone="gold"
      title="Schematic conventions"
      ariaLabel="Schematic-drawing conventions: signal flows left to right, supply symbols (3V3) point up and grounds (GND) point down, parts are grouped by sub-circuit, and a decoupling capacitor sits right at the IC power pin. The worked example shows the 3V3 supply entering the top of an IC, signal in from the left and out to the right, ground leaving the bottom, and the decoupling cap branching off the supply at the pin."
      caption={caption}
      defaultCaption="Read it like a sentence: in left, out right."
    >
      <style>{CSS}</style>

      <div className="scon-body">
        <div className="scon-rules">
          <p className="scon-rules-h">THE RULES</p>
          {RULES.map((r) => (
            <div key={r} className="scon-rule">
              <b aria-hidden="true">&rsaquo;</b>
              <span>{r}</span>
            </div>
          ))}
        </div>

        <div className="scon-ex">
          <div className="scon-stack">
            <div className="scon-supply">
              <b>3V3</b>
            </div>
            <svg className="scon-svg" viewBox="0 0 300 220" aria-hidden="true">
              {/* supply rail down from 3V3 */}
              <line x1="150" y1="6" x2="150" y2="70" stroke="#c8963e" strokeWidth="3" />
              <line x1="120" y1="6" x2="180" y2="6" stroke="#c8963e" strokeWidth="3" />
              {/* branch to decoupling cap, taken right at the pin */}
              <line x1="150" y1="34" x2="240" y2="34" stroke="#c8963e" strokeWidth="3" />
              <line x1="240" y1="34" x2="240" y2="50" stroke="#c8963e" strokeWidth="3" />
              {/* cap plates */}
              <line x1="222" y1="50" x2="258" y2="50" stroke="#e8e8e8" strokeWidth="3" />
              <line x1="222" y1="60" x2="258" y2="60" stroke="#e8e8e8" strokeWidth="3" />
              <line x1="240" y1="60" x2="240" y2="76" stroke="#aaaaaa" strokeWidth="3" />
              {/* cap-to-ground symbol — kept well above the output line (y=105) */}
              <line x1="226" y1="76" x2="254" y2="76" stroke="#aaaaaa" strokeWidth="3" />
              <line x1="231" y1="82" x2="249" y2="82" stroke="#aaaaaa" strokeWidth="3" />
              <line x1="236" y1="88" x2="244" y2="88" stroke="#aaaaaa" strokeWidth="3" />
              {/* IC body (a sub-circuit block) */}
              <rect x="100" y="70" width="100" height="70" rx="4" fill="#1f2438" stroke="#c8963e" strokeWidth="3" />
              <text
                x="150"
                y="113"
                textAnchor="middle"
                fill="#ffffff"
                fontFamily='var(--font-mono,"Space Mono",monospace)'
                fontSize="20"
                fontWeight="700"
              >
                IC
              </text>
              {/* signal in (from the left) */}
              <line x1="30" y1="105" x2="96" y2="105" stroke="#c8963e" strokeWidth="3" />
              <path d="M96,105 L86,100 L86,110 Z" fill="#c8963e" />
              {/* signal out (to the right) */}
              <line x1="200" y1="105" x2="266" y2="105" stroke="#c8963e" strokeWidth="3" />
              <path d="M266,105 L256,100 L256,110 Z" fill="#c8963e" />
              {/* ground rail down from IC */}
              <line x1="150" y1="140" x2="150" y2="178" stroke="#aaaaaa" strokeWidth="3" />
              <line x1="122" y1="178" x2="178" y2="178" stroke="#aaaaaa" strokeWidth="3" />
              <line x1="131" y1="186" x2="169" y2="186" stroke="#aaaaaa" strokeWidth="3" />
              <line x1="140" y1="194" x2="160" y2="194" stroke="#aaaaaa" strokeWidth="3" />
            </svg>
            <div className="scon-iorow">
              <span className="scon-io">in &rarr;</span>
              <span className="scon-io">&rarr; out</span>
            </div>
            <p className="scon-cap-note">
              <b>GND</b> below &middot; <b>C</b> decoupling cap, right at the pin
            </p>
          </div>
        </div>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.scon-body{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);
  gap:clamp(1.1rem,3.5vw,1.8rem);align-items:start;text-align:left;}

/* THE RULES — full readable lines, gold ›, muted body */
.scon-rules{display:flex;flex-direction:column;gap:.7rem;}
.scon-rules-h{margin:0 0 .2rem;color:var(--color-command-gold,#c8963e);font-weight:700;
  font-size:.62rem;letter-spacing:.22em;}
.scon-rule{display:grid;grid-template-columns:auto 1fr;gap:.55rem;align-items:baseline;}
.scon-rule b{color:var(--color-command-gold,#c8963e);font-weight:700;
  font-size:clamp(1.05rem,3vw,1.3rem);line-height:1;}
.scon-rule span{color:var(--color-muted,#aaaaaa);font-size:clamp(.95rem,2.5vw,1.05rem);line-height:1.35;}

/* WORKED EXAMPLE — wiring graphic in a navy body, HTML labels around it */
.scon-ex{background:var(--color-navy-dark,#1f2438);border:1px solid var(--color-panel-border,#3a3f50);
  border-radius:6px;padding:clamp(.8rem,2.5vw,1.1rem);min-width:0;
  display:flex;flex-direction:column;align-items:center;gap:.45rem;}
.scon-stack{display:flex;flex-direction:column;align-items:center;gap:.45rem;
  width:100%;max-width:300px;}
.scon-supply{display:flex;flex-direction:column;align-items:center;}
.scon-supply b{color:var(--color-command-gold,#c8963e);font-weight:700;
  font-size:clamp(1.05rem,3vw,1.25rem);}
.scon-svg{display:block;width:100%;max-width:min(300px,100%);height:auto;}
.scon-iorow{display:flex;justify-content:space-between;width:100%;}
.scon-io{color:var(--color-signal-blue,#4a8fff);font-weight:700;
  font-size:clamp(.95rem,2.5vw,1.05rem);}
.scon-cap-note{margin:0;color:var(--color-muted,#aaaaaa);text-align:center;line-height:1.3;
  font-size:clamp(.85rem,2.3vw,.95rem);}
.scon-cap-note b{color:var(--color-gray-1,#e8e8e8);font-weight:700;}

/* Phone: stack rules above the worked example, both full readable width. */
@media (max-width:520px){
  .scon-body{grid-template-columns:minmax(0,1fr);gap:1.4rem;}
}
`;
