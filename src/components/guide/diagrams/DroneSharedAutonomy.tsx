// Shared-autonomy brain-drone control as a responsive diagram (v2).
//
// Teaching point (the page's thesis): a non-invasive BCI is a low-bandwidth,
// noisy channel, so you do NOT fly a brain-drone stick-and-rudder. You supply
// sparse, high-level intent (~one command every second or two); the drone's own
// flight controller handles the fast, continuous work (stabilization, altitude,
// obstacle avoidance, hundreds of Hz). A live video feed closes the loop.
//
// v2: an FPV cockpit scene on desktop/print (~1.5 landscape) — a headset pilot
// (YOU) sends a sparse intent lane to a banking quad (DRONE), whose camera streams
// a live feed onto the pilot's attitude-display tablet. Reflows to two stacked
// cards (you send / the drone flies + you watch) on a narrow phone (directive 1).
// Token-only color via CSS classes; blue = the video-feedback return path.
import { DiagramFrame } from "./DiagramFrame";

function wavePath(x0: number, x1: number, cy: number, a: number, cyc: number, step = 2): string {
  const pts: string[] = [];
  for (let x = x0; x <= x1; x += step) {
    const t = (x - x0) / (x1 - x0);
    pts.push(`${x},${(cy - a * Math.sin(t * cyc * 2 * Math.PI)).toFixed(1)}`);
  }
  return "M" + pts.join(" L");
}

const FEED = wavePath(230, 470, 128, 6, 11, 3); // drone camera -> pilot screen
const PKTS = [185, 250, 315, 380]; // sparse intent commands

export function DroneSharedAutonomy({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="BRAIN-DRONE · SHARED AUTONOMY"
      tone="gold"
      title="You steer. The drone flies."
      ariaLabel="Shared-autonomy brain-drone control, drawn as a loop. The pilot, wearing a video headset, supplies sparse high-level intent at roughly one command every second or two: imagine a movement, the EEG is classified, and it becomes a command like go left or hover. The drone's own flight controller handles the fast, continuous work at hundreds of hertz, holding altitude, staying stable, and avoiding obstacles on its own. A live video feed streams back from the drone's camera to the pilot's screen, closing the loop so the human can watch and adjust. The human sets the goal; the drone executes it continuously."
      caption={caption}
      defaultCaption="A noisy brain channel carries the intent; the drone's autonomy does the fast flying. That's how you get something usable."
    >
      <style>{CSS}</style>

      <div className="dsa">
        {/* desktop / print: FPV cockpit scene */}
        <div className="dsa-scene">
          <svg className="dsa-svg" viewBox="0 0 560 205" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {/* YOU — headset pilot */}
            <g transform="translate(6,44) scale(0.8)">
              <ellipse className="dsa-hu" cx="50" cy="30" rx="21" ry="24" />
              <path className="dsa-hu" d="M41,52 C40,59 17.8,58 4,98 L96,98 C82.2,58 60,59 59,52 Z" />
            </g>
            <g transform="translate(46,68) scale(0.92)">
              <rect className="dsa-gog" x="-26" y="-10" width="52" height="20" rx="10" />
              <rect className="dsa-lens" x="-20" y="-5" width="40" height="10" rx="5" />
              <path className="dsa-gog dsa-nofill" d="M-26,-5 L-34,-8 M26,-5 L34,-8" />
            </g>
            <text className="dsa-nlab" x="46" y="150" textAnchor="middle">YOU</text>

            {/* intent lane — sparse commands out */}
            <text className="dsa-glab" x="150" y="40">intent → ~1/sec</text>
            <line className="dsa-axis" x1="150" y1="56" x2="405" y2="56" />
            {PKTS.map((x) => (
              <rect key={x} className="dsa-pkt" x={x - 7} y="49" width="14" height="14" rx="3" />
            ))}
            <line className="dsa-flowg" x1="404" y1="56" x2="416" y2="56" />
            <path className="dsa-flowg" d="M416,56 L407,51 M416,56 L407,61" />

            {/* pilot's tablet — live attitude/FPV feed */}
            <rect className="dsa-mon" x="116" y="98" width="96" height="54" rx="11" />
            <rect className="dsa-scr" x="119" y="101" width="90" height="48" rx="2" />
            <g transform="rotate(-12 164 125)">
              <rect className="dsa-ground" x="119" y="125" width="90" height="24" />
              <line className="dsa-hz" x1="119" y1="125" x2="209" y2="125" />
              <line className="dsa-hz" x1="151" y1="114" x2="177" y2="114" />
              <line className="dsa-hz" x1="151" y1="136" x2="177" y2="136" />
            </g>
            <line className="dsa-cross" x1="153" y1="125" x2="161" y2="125" />
            <line className="dsa-cross" x1="167" y1="125" x2="175" y2="125" />
            <circle className="dsa-rec" cx="125" cy="107" r="2.6" />
            <circle className="dsa-stand" cx="203" cy="125" r="2.4" />
            <text className="dsa-hud" x="118" y="168">ALT 12m · HDG 040</text>

            {/* DRONE — banking quad, props blurred */}
            <g transform="translate(486,92) scale(1.15) rotate(-16)">
              <rect className="dsa-body" x="-20" y="-8" width="40" height="16" rx="8" />
              <line className="dsa-arm" x1="-16" y1="-6" x2="-30" y2="-20" />
              <line className="dsa-arm" x1="16" y1="-6" x2="30" y2="-20" />
              <ellipse className="dsa-blur" cx="-30" cy="-20" rx="18" ry="5" />
              <ellipse className="dsa-blur" cx="30" cy="-20" rx="18" ry="5" />
              <circle className="dsa-dot" cx="-30" cy="-20" r="2.2" />
              <circle className="dsa-dot" cx="30" cy="-20" r="2.2" />
              <line className="dsa-arm" x1="-12" y1="8" x2="-14" y2="18" />
              <line className="dsa-arm" x1="12" y1="8" x2="14" y2="18" />
              <line className="dsa-arm" x1="-20" y1="18" x2="20" y2="18" />
              <circle className="dsa-dot" cx="18" cy="4" r="3" />
            </g>
            <text className="dsa-nlab" x="486" y="170" textAnchor="middle">DRONE</text>

            {/* live video feed — drone camera back to the screen */}
            <path className="dsa-bluew" d={FEED} />
            <line className="dsa-flowb" x1="230" y1="128" x2="214" y2="128" />
            <path className="dsa-flowb" d="M214,128 L223,123 M214,128 L223,133" />
            <text className="dsa-blab" x="330" y="192" textAnchor="middle">← live video · you watch</text>
          </svg>
        </div>

        {/* phone: two stacked cards */}
        <div className="dsa-cards" aria-hidden="true">
          <div className="dsa-card">
            <div className="dsa-crow">
              <svg className="dsa-mini" viewBox="0 0 92 96" preserveAspectRatio="xMidYMid meet">
                <g transform="translate(-4,0)">
                  <ellipse className="dsa-hu" cx="50" cy="30" rx="21" ry="24" />
                  <path className="dsa-hu" d="M41,52 C40,59 17.8,58 4,98 L96,98 C82.2,58 60,59 59,52 Z" />
                </g>
                <g transform="translate(46,38)">
                  <rect className="dsa-gog" x="-24" y="-9" width="48" height="18" rx="9" />
                  <rect className="dsa-lens" x="-18" y="-4.5" width="36" height="9" rx="4.5" />
                </g>
              </svg>
              <div>
                <p className="dsa-ck">You send the goal</p>
                <p className="dsa-ct"><b>~1 command / sec.</b> Imagine the move, the EEG is classified, it becomes "go left" or "hover".</p>
              </div>
            </div>
          </div>
          <div className="dsa-card dsa-card-drone">
            <div className="dsa-crow">
              <svg className="dsa-mini" viewBox="0 0 84 84" preserveAspectRatio="xMidYMid meet">
                <g transform="translate(42,44) scale(0.92) rotate(-16)">
                  <rect className="dsa-body" x="-20" y="-8" width="40" height="16" rx="8" />
                  <line className="dsa-arm" x1="-16" y1="-6" x2="-30" y2="-20" />
                  <line className="dsa-arm" x1="16" y1="-6" x2="30" y2="-20" />
                  <ellipse className="dsa-blur" cx="-30" cy="-20" rx="18" ry="5" />
                  <ellipse className="dsa-blur" cx="30" cy="-20" rx="18" ry="5" />
                  <circle className="dsa-dot" cx="-30" cy="-20" r="2.2" />
                  <circle className="dsa-dot" cx="30" cy="-20" r="2.2" />
                  <line className="dsa-arm" x1="-12" y1="8" x2="-14" y2="18" />
                  <line className="dsa-arm" x1="12" y1="8" x2="14" y2="18" />
                  <line className="dsa-arm" x1="-20" y1="18" x2="20" y2="18" />
                  <circle className="dsa-dot" cx="18" cy="4" r="3" />
                </g>
              </svg>
              <div>
                <p className="dsa-ck">The drone flies, you watch</p>
                <p className="dsa-ct">It holds altitude, stays stable, and dodges obstacles on its own at <b>~100s of Hz</b>. A live video feed streams back to your screen.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.dsa-svg,.dsa-mini{overflow:visible;width:100%;height:auto;display:block;}
.dsa-nofill{fill:none;}
.dsa-hu{fill:var(--color-diagram-surface,#1f2438);stroke:var(--color-command-gold,#c8963e);stroke-width:2.4;stroke-linejoin:round;}
.dsa-arm{stroke:var(--color-command-gold,#c8963e);stroke-width:2.4;stroke-linecap:round;fill:none;}
.dsa-body{fill:var(--color-diagram-surface,#1f2438);stroke:var(--color-command-gold,#c8963e);stroke-width:2.4;}
.dsa-blur{fill:var(--color-gold-light,#e8b865);opacity:.3;}
.dsa-dot{fill:var(--color-command-gold,#c8963e);}
.dsa-bluew{fill:none;stroke:var(--color-signal-blue,#4a8fff);stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round;}
.dsa-axis{stroke:var(--color-panel-border,#3a3f50);stroke-width:1.5;}
.dsa-flowg{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2.2;}
.dsa-flowb{fill:none;stroke:var(--color-signal-blue,#4a8fff);stroke-width:2.2;}
.dsa-pkt{fill:var(--color-diagram-surface,#1f2438);stroke:var(--color-command-gold,#c8963e);stroke-width:1.8;}
.dsa-mon{fill:var(--color-diagram-surface,#1f2438);stroke:var(--color-signal-blue,#4a8fff);stroke-width:2.2;}
.dsa-stand{fill:var(--color-signal-blue,#4a8fff);}
.dsa-scr{fill:var(--color-signal-blue,#4a8fff);opacity:.16;}
.dsa-hz{fill:none;stroke:var(--color-gold-light,#e8b865);stroke-width:1.5;}
.dsa-ground{fill:var(--color-command-gold,#c8963e);opacity:.14;}
.dsa-cross{fill:none;stroke:var(--color-title,#f1ece0);stroke-width:1.4;}
.dsa-rec{fill:var(--color-alert-red,#ef5350);}
.dsa-gog{fill:var(--color-diagram-surface,#1f2438);stroke:var(--color-signal-blue,#4a8fff);stroke-width:2.2;stroke-linecap:round;}
.dsa-lens{fill:var(--color-signal-blue,#4a8fff);opacity:.5;stroke:var(--color-signal-blue,#4a8fff);stroke-width:1;}
.dsa-nlab{fill:var(--color-title,#f1ece0);font-family:var(--font-mono,"Space Mono",monospace);font-size:13px;font-weight:700;}
.dsa-glab{fill:var(--color-command-gold,#c8963e);font-family:var(--font-mono,"Space Mono",monospace);font-size:12px;font-weight:700;}
.dsa-blab{fill:var(--color-signal-blue,#4a8fff);font-family:var(--font-mono,"Space Mono",monospace);font-size:12px;font-weight:700;}
.dsa-hud{fill:var(--color-gold-light,#e8b865);font-family:var(--font-mono,"Space Mono",monospace);font-size:8px;font-weight:700;}

/* phone reflow: two stacked cards */
.dsa-cards{display:none;flex-direction:column;gap:.7rem;text-align:left;}
@media (max-width:520px){
  .dsa-scene{display:none;}
  .dsa-cards{display:flex;}
}
.dsa-card{border-radius:6px;padding:.7rem .8rem;background:var(--color-navy-dark,#1f2438);box-shadow:inset 0 0 0 1.5px var(--color-panel-border,#3a3f50);}
.dsa-card-drone{box-shadow:inset 0 0 0 2px var(--color-command-gold,#c8963e);}
.dsa-crow{display:flex;align-items:center;gap:.7rem;}
.dsa-mini{flex:0 0 68px;width:68px;height:68px;}
.dsa-ck{margin:0 0 .25rem;font-family:var(--font-display,"Bebas Neue",sans-serif);font-size:1.2rem;letter-spacing:.02em;color:var(--color-title,#f1ece0);}
.dsa-card-drone .dsa-ck{color:var(--color-command-gold,#c8963e);}
.dsa-ct{margin:0;font-family:var(--font-serif,"Lora",serif);font-size:.88rem;line-height:1.4;color:var(--color-text,#e8e8e8);}
.dsa-ct b{color:var(--color-title,#f1ece0);font-weight:700;}

/* Tier-B reveal off the frame's armed/in contract. */
.dgfrm.armed .dsa-card{opacity:0;transform:translateY(5px);}
.dgfrm.armed.in .dsa-card{opacity:1;transform:none;transition:opacity .5s ease,transform .5s cubic-bezier(.2,.7,.2,1);}
.dgfrm.armed.in .dsa-card-drone{transition-delay:.12s;}
@media (prefers-reduced-motion:reduce){.dgfrm .dsa-card{opacity:1!important;transform:none!important;}}
`;
