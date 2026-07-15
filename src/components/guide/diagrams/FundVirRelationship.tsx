// Voltage / current / resistance, taught as a crowd at a doorway (v2).
// Fundamentals cluster. Owner-picked V1 ("refined scene").
//
// Teaching point: voltage is the push behind a crowd of charge, resistance is
// how wide the doorway is, and current is the number that actually get through
// per second. Widen the door (lower R) and more flow; narrow it and less.
//
// Landscape desktop/print: crowd on the left, a gold doorway in the middle, a
// blue stream leaving on the right. REFLOWS to three stacked cards on a phone
// (real px, no shrinking) per directive 1. Token-only color (dark literal
// fallbacks for the standalone/exporter render; light comes from the token
// override).
import { DiagramFrame } from "./DiagramFrame";

const CROWD_X = [58, 84, 110, 136];
const CROWD_Y = [78, 104, 130];
const FLOW_DOTS = [
  [320, 104],
  [350, 95],
  [378, 111],
];

export function FundVirRelationship({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="FUNDAMENTALS · V / I / R"
      tone="gold"
      title="Voltage, current, resistance"
      ariaLabel="Voltage, current, and resistance drawn as a crowd at a doorway. On the left, a crowd of charge is pushed forward: that push is the voltage. In the middle, a gold doorway sets how many can pass at once: the width of that doorway is the resistance. On the right, the people who get through per second stream away as the current. A wider door (less resistance) lets more current flow for the same push; a narrower door throttles it."
      caption={caption}
      defaultCaption="Voltage is the push, the doorway is the resistance, and the flow that gets through is the current."
    >
      <style>{CSS}</style>

      <div className="vir">
        {/* desktop / print: the scene */}
        <svg className="vir-scene" viewBox="0 0 520 220" aria-hidden="true">
          {/* push arrow */}
          <line className="vir-wire" x1="26" y1="104" x2="48" y2="104" />
          <path className="vir-wire" fill="none" d="M40,99 L48,104 L40,109" />
          {/* crowd */}
          {CROWD_Y.map((cy) =>
            CROWD_X.map((cx) => (
              <circle key={`${cx}-${cy}`} className="vir-person" cx={cx} cy={cy} r="9" />
            )),
          )}
          <text className="vir-sym-g" x="97" y="56" textAnchor="middle">V</text>
          <text className="vir-word-g" x="97" y="170" textAnchor="middle">PUSH</text>

          {/* doorway (resistance) */}
          <rect className="vir-wall" x="290" y="28" width="10" height="56" />
          <rect className="vir-wall" x="290" y="124" width="10" height="66" />
          <text className="vir-sym-t" x="295" y="20" textAnchor="middle">R</text>
          <text className="vir-word-m" x="295" y="210" textAnchor="middle">DOOR WIDTH</text>

          {/* flow through */}
          {FLOW_DOTS.map(([cx, cy]) => (
            <circle key={`f-${cx}`} className="vir-flowdot" cx={cx} cy={cy} r="7" />
          ))}
          <line className="vir-flow" x1="398" y1="104" x2="470" y2="104" />
          <path className="vir-flow" fill="none" d="M462,99 L470,104 L462,109" />
          <text className="vir-sym-b" x="452" y="56" textAnchor="middle">I</text>
          <text className="vir-word-b" x="452" y="170" textAnchor="middle">FLOW</text>
        </svg>

        {/* phone: three stacked cards */}
        <ul className="vir-list" aria-hidden="true">
          <li>
            <svg viewBox="0 0 64 40" className="vir-mini">
              <line className="vir-wire" x1="4" y1="20" x2="16" y2="20" />
              <path className="vir-wire" fill="none" d="M11,16 L16,20 L11,24" />
              {[24, 40, 56].map((cx) =>
                [12, 28].map((cy) => (
                  <circle key={`${cx}-${cy}`} className="vir-person" cx={cx} cy={cy} r="5" />
                )),
              )}
            </svg>
            <span className="vir-li-sym vir-g">V</span>
            <span className="vir-li-word vir-g">PUSH</span>
            <span className="vir-li-note">the crowd of charge, pushed forward</span>
          </li>
          <li>
            <svg viewBox="0 0 64 40" className="vir-mini">
              <rect className="vir-wall" x="30" y="2" width="6" height="12" />
              <rect className="vir-wall" x="30" y="26" width="6" height="12" />
            </svg>
            <span className="vir-li-sym vir-t">R</span>
            <span className="vir-li-word vir-m">DOOR WIDTH</span>
            <span className="vir-li-note">how wide the doorway opens</span>
          </li>
          <li>
            <svg viewBox="0 0 64 40" className="vir-mini">
              {[10, 26, 42].map((cx, i) => (
                <circle key={cx} className="vir-flowdot" cx={cx} cy={20 - (i % 2 ? 5 : 0)} r="5" />
              ))}
              <line className="vir-flow" x1="46" y1="20" x2="60" y2="20" />
              <path className="vir-flow" fill="none" d="M54,16 L60,20 L54,24" />
            </svg>
            <span className="vir-li-sym vir-b">I</span>
            <span className="vir-li-word vir-b">FLOW</span>
            <span className="vir-li-note">what gets through, per second</span>
          </li>
        </ul>

        <p className="vir-note">A wider door lets more current flow for the same push.</p>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.vir{display:block;}
.vir-scene{display:block;width:100%;height:auto;overflow:visible;}
.vir-person{fill:var(--color-diagram-surface,#1f2438);stroke:var(--color-command-gold,#c8963e);stroke-width:2;}
.vir-wall{fill:var(--color-command-gold,#c8963e);}
.vir-wire{stroke:var(--color-command-gold,#c8963e);stroke-width:3;stroke-linecap:round;stroke-linejoin:round;fill:none;}
.vir-flow{stroke:var(--color-signal-blue,#4a8fff);stroke-width:3;stroke-linecap:round;stroke-linejoin:round;fill:none;}
.vir-flowdot{fill:var(--color-signal-blue,#4a8fff);}
.vir-sym-g,.vir-sym-t,.vir-sym-b{font-family:var(--font-display,"Bebas Neue",sans-serif);font-size:26px;}
.vir-sym-g{fill:var(--color-command-gold,#c8963e);}
.vir-sym-t{fill:var(--color-title,#f1ece0);}
.vir-sym-b{fill:var(--color-signal-blue,#4a8fff);}
.vir-word-g,.vir-word-m,.vir-word-b{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:12px;letter-spacing:.1em;}
.vir-word-g{fill:var(--color-command-gold,#c8963e);}
.vir-word-m{fill:var(--color-muted,#aaa);}
.vir-word-b{fill:var(--color-signal-blue,#4a8fff);}
.vir-note{margin:1rem 0 0;text-align:center;font-family:var(--font-serif,"Lora",serif);
  font-size:clamp(.82rem,2.1vw,.9rem);color:var(--color-muted,#aaa);}

/* phone reflow */
.vir-list{display:none;list-style:none;margin:0;padding:0;flex-direction:column;gap:.5rem;}
@container (max-width:520px){ .vir-scene{display:none;} .vir-list{display:flex;} }
.vir-list li{display:grid;grid-template-columns:64px 2rem 1fr;grid-template-rows:auto auto;
  align-items:center;gap:.15rem .8rem;padding:.6rem .8rem;border-radius:6px;text-align:left;
  }
.vir-mini{grid-row:1 / span 2;width:64px;height:40px;overflow:visible;}
.vir-li-sym{font-family:var(--font-display,"Bebas Neue",sans-serif);font-size:1.5rem;line-height:1;}
.vir-li-word{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.82rem;letter-spacing:.08em;align-self:end;}
.vir-li-note{grid-column:2 / span 2;font-family:var(--font-serif,"Lora",serif);font-size:.82rem;color:var(--color-muted,#aaa);align-self:start;}
.vir-g{color:var(--color-command-gold,#c8963e);}
.vir-t{color:var(--color-title,#f1ece0);}
.vir-b{color:var(--color-signal-blue,#4a8fff);}
.vir-m{color:var(--color-muted,#aaa);}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .vir-flowdot,.dgfrm.armed .vir-flow{opacity:0;}
.dgfrm.armed .vir-person{opacity:0;transform:translateX(-6px);}
.dgfrm.armed.in .vir-person{opacity:1;transform:translateX(0);transition:opacity .5s ease,transform .5s ease;}
.dgfrm.armed.in .vir-flowdot,.dgfrm.armed.in .vir-flow{opacity:1;transition:opacity .5s ease .3s;}
@media (prefers-reduced-motion:reduce){
  .dgfrm .vir-person{opacity:1!important;transform:none!important;}
  .dgfrm .vir-flowdot,.dgfrm .vir-flow{opacity:1!important;}
}
`;
