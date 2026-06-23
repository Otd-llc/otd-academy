// Shared-autonomy brain-drone control as a responsive HTML component.
//
// Teaching point (the page's thesis): a non-invasive BCI is a low-bandwidth,
// noisy channel, so you do NOT fly a brain-drone stick-and-rudder. You supply
// sparse, high-level intent (~one command every second or two); the drone's own
// flight controller handles the fast, continuous work (stabilization, altitude,
// obstacle avoidance, hundreds of Hz). Visual feedback closes the loop. The
// diagram shows that division of labour, not a generic block loop.
//
// Two panels side by side, stacking on a phone, with a centre handoff (intent
// down, feedback back). Header/frame/caption from DiagramFrame. Brand palette:
// gold-dominant on Deep Space, Navy Dark bodies; Signal Blue for the feedback
// return only. All colours via @theme.
import { DiagramFrame } from "./DiagramFrame";

export function DroneSharedAutonomy({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="BRAIN-DRONE · SHARED AUTONOMY"
      tone="gold"
      title="You steer. The drone flies."
      ariaLabel="Shared-autonomy brain-drone control. The human supplies sparse, high-level intent at roughly one command every second or two: imagine a movement, the EEG is classified, and it becomes a command like go left or hover. The drone's own flight controller handles the fast, continuous work at hundreds of hertz: holding altitude, staying stable, and avoiding obstacles. The human's intent sets the goal; the drone executes it continuously, and visual feedback from the drone closes the loop so the human can adjust."
      caption={caption}
      defaultCaption="A noisy brain channel carries the intent; the drone's autonomy does the fast flying. That's how you get something usable."
    >
      <style>{CSS}</style>

      <div className="dsa">
        <div className="dsa-panel">
          <p className="dsa-who">You</p>
          <p className="dsa-rate">~1 command / sec</p>
          <ul className="dsa-list">
            <li>imagine the move</li>
            <li>EEG → classify</li>
            <li>"go left", "hover"</li>
          </ul>
        </div>

        <div className="dsa-mid" aria-hidden="true">
          <span className="dsa-flow dsa-flow-go">intent →</span>
          <span className="dsa-flow dsa-flow-back">← you watch</span>
        </div>

        <div className="dsa-panel dsa-panel-drone">
          <p className="dsa-who">The drone</p>
          <p className="dsa-rate">~100s of Hz</p>
          <ul className="dsa-list">
            <li>holds altitude</li>
            <li>stays stable</li>
            <li>avoids obstacles</li>
          </ul>
        </div>
      </div>
    </DiagramFrame>
  );
}

// Unique `dsa-` prefix. Token-driven with literal fallbacks.
const CSS = `
.dsa{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:clamp(.5rem,2vw,.9rem);}
.dsa-panel{padding:clamp(.75rem,2.6vw,1rem);border-radius:6px;text-align:left;
  background:var(--color-navy-dark,#1f2438);box-shadow:inset 0 0 0 1.5px var(--color-panel-border,#3a3f50);}
.dsa-panel-drone{box-shadow:inset 0 0 0 2px var(--color-command-gold,#c8963e);}
.dsa-who{margin:0;color:#fff;font-weight:700;font-size:clamp(1.02rem,3vw,1.2rem);}
.dsa-rate{margin:.1rem 0 .55rem;font-family:var(--font-mono,"Space Mono",monospace);
  font-size:clamp(.72rem,2vw,.8rem);letter-spacing:.03em;color:var(--color-command-gold,#c8963e);}
.dsa-list{margin:0;padding-left:1.05rem;color:var(--color-gray-1,#e8e8e8);
  font-size:clamp(.85rem,2.3vw,.95rem);line-height:1.6;}

.dsa-mid{display:flex;flex-direction:column;gap:.5rem;align-items:center;
  font-family:var(--font-mono,"Space Mono",monospace);font-size:clamp(.7rem,1.9vw,.78rem);
  font-weight:700;letter-spacing:.06em;white-space:nowrap;}
.dsa-flow-go{color:var(--color-command-gold,#c8963e);}
.dsa-flow-back{color:var(--color-signal-blue,#4a8fff);}

@media (max-width:30rem){
  .dsa{grid-template-columns:1fr;}
  .dsa-mid{flex-direction:row;justify-content:center;gap:1.2rem;padding:.2rem 0;}
}

/* Tier-B reveal off the frame's armed/in contract. */
.dsa-panel,.dsa-mid{will-change:opacity,transform;}
.dgfrm.armed .dsa-panel,.dgfrm.armed .dsa-mid{opacity:0;transform:translateY(6px);}
.dgfrm.armed.in .dsa-panel,.dgfrm.armed.in .dsa-mid{opacity:1;transform:none;
  transition:opacity .5s ease,transform .5s cubic-bezier(.2,.7,.2,1);}
.dgfrm.armed.in .dsa-mid{transition-delay:.12s;}
.dgfrm.armed.in .dsa-panel-drone{transition-delay:.2s;}
@media (prefers-reduced-motion:reduce){
  .dgfrm .dsa-panel,.dgfrm .dsa-mid{opacity:1!important;transform:none!important;}
}
`;
