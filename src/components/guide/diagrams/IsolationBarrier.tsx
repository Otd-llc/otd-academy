// EEG electrical isolation as a responsive HTML component.
//
// Teaching point: a fault needs a conductive PATH. Battery-power the
// subject-connected electronics and there is no galvanic path to mains, so a
// fault has nowhere to drive current. Bridge to mains-powered gear without a
// rated barrier and line voltage can reach the electrodes and take the path to
// ground through the person. Two rows make the contrast; the danger row is the
// only place red is used (brand: red = critical only).
//
// Header/frame/caption from DiagramFrame. Brand palette: gold-dominant on Deep
// Space, Navy Dark bodies, Alert Red strictly for the hazard path. @theme tokens.
import { DiagramFrame } from "./DiagramFrame";

export function IsolationBarrier({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="EEG SAFETY · ISOLATION"
      tone="gold"
      title="A fault needs a path. Don't give it one."
      ariaLabel="EEG electrical isolation. Top row, the safe case: a battery powers the front-end and the electrodes on the person, with no conductive path to mains, so a fault has nowhere to drive current. Bottom row, the danger: a mains-powered device connected to the electrodes without a rated isolation barrier lets line voltage reach the electrodes and drive fault current through the person's head to ground. A rated galvanic isolation barrier, or simply battery power, removes that path."
      caption={caption}
      defaultCaption="Battery-power the subject side. Add a rated isolator only if you must bridge to plugged-in gear. Never wire anyone up while charging."
    >
      <style>{CSS}</style>

      <div className="iso-row iso-safe">
        <span className="iso-tag iso-tag-safe">SAFE</span>
        <div className="iso-flow">
          <span className="iso-box">Battery</span>
          <span className="iso-arrow">→</span>
          <span className="iso-box">Front-end</span>
          <span className="iso-arrow">→</span>
          <span className="iso-box iso-box-body">You</span>
        </div>
        <p className="iso-note">Floating. No path to mains for a fault to use.</p>
      </div>

      <div className="iso-row iso-danger">
        <span className="iso-tag iso-tag-danger">DANGER</span>
        <div className="iso-flow">
          <span className="iso-box iso-mains">Mains gear</span>
          <span className="iso-arrow iso-arrow-bad">↯</span>
          <span className="iso-barrier" aria-hidden="true">
            <span className="iso-barrier-lbl">isolation barrier</span>
          </span>
          <span className="iso-arrow iso-arrow-bad">↯</span>
          <span className="iso-box iso-box-body">You</span>
        </div>
        <p className="iso-note iso-note-bad">
          No barrier? Line voltage reaches the electrodes and fault current flows
          to ground through your head.
        </p>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.iso-row{padding:clamp(.8rem,2.8vw,1.05rem);border-radius:6px;text-align:left;
  background:var(--color-navy-dark,#1f2438);box-shadow:inset 0 0 0 1.5px var(--color-panel-border,#3a3f50);}
.iso-row + .iso-row{margin-top:clamp(.7rem,2.5vw,1rem);}
.iso-safe{box-shadow:inset 0 0 0 2px var(--color-command-gold,#c8963e);}
.iso-danger{box-shadow:inset 0 0 0 2px var(--color-alert-red,#c62828);}

.iso-tag{display:inline-block;margin-bottom:.55rem;font-family:var(--font-mono,"Space Mono",monospace);
  font-size:clamp(.66rem,1.9vw,.74rem);font-weight:700;text-transform:uppercase;letter-spacing:.16em;}
.iso-tag-safe{color:var(--color-command-gold,#c8963e);}
.iso-tag-danger{color:var(--color-alert-red,#c62828);}

.iso-flow{display:flex;flex-wrap:wrap;align-items:center;gap:.4rem;}
.iso-box{padding:.4rem .6rem;border-radius:5px;background:var(--color-deep-space,#08090d);
  box-shadow:inset 0 0 0 1.5px var(--color-panel-border,#3a3f50);
  color:var(--color-gray-1,#e8e8e8);font-size:clamp(.82rem,2.2vw,.92rem);font-weight:700;white-space:nowrap;}
.iso-box-body{box-shadow:inset 0 0 0 1.5px var(--color-command-gold,#c8963e);color:var(--color-title,#f1ece0);}
.iso-mains{box-shadow:inset 0 0 0 1.5px var(--color-alert-red,#c62828);}
.iso-arrow{color:var(--color-command-gold,#c8963e);font-size:clamp(1rem,2.6vw,1.2rem);font-weight:700;}
.iso-arrow-bad{color:var(--color-alert-red,#c62828);}
.iso-barrier{display:inline-flex;align-items:center;justify-content:center;min-height:1.8rem;padding:0 .55rem;
  border-left:3px dashed var(--color-alert-red,#c62828);border-right:3px dashed var(--color-alert-red,#c62828);}
.iso-barrier-lbl{font-family:var(--font-mono,"Space Mono",monospace);font-size:clamp(.64rem,1.7vw,.72rem);
  text-transform:uppercase;letter-spacing:.1em;color:var(--color-muted,#aaa);}
.iso-note{margin:.6rem 0 0;color:var(--color-muted,#aaa);font-size:clamp(.82rem,2.2vw,.92rem);line-height:1.45;}
.iso-note-bad{color:var(--color-gray-1,#e8e8e8);}

.dgfrm.armed .iso-row{opacity:0;transform:translateY(6px);}
.dgfrm.armed.in .iso-row{opacity:1;transform:none;transition:opacity .5s ease,transform .5s cubic-bezier(.2,.7,.2,1);}
.dgfrm.armed.in .iso-danger{transition-delay:.12s;}
@media (prefers-reduced-motion:reduce){.dgfrm .iso-row{opacity:1!important;transform:none!important;}}
`;
