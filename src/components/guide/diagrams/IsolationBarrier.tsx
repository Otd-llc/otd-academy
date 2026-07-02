// EEG electrical isolation as a responsive diagram (v2).
//
// Teaching point: a fault needs a conductive PATH. If the subject-connected
// electronics are isolated from mains (battery, or a rated isolation barrier),
// the conductor is broken and a fault has no complete circuit to drive current
// through the person. This draws that break literally: a mains wire that STOPS
// at the barrier, with the subject side floating and isolated.
//
// v2: SVG schematic on desktop/print (the surface the exporter screenshots,
// ~1.6 landscape) that REFLOWS to a vertical MAINS -> barrier -> you stack on a
// narrow phone (real px, no shrinking SVG text) per directive 1. Token-only
// color via CSS classes (never fill/stroke="#.."), so it re-themes under
// data-theme="light"; red is used ONLY for the mains/fault side (brand: red =
// critical only). In-SVG labels are sized to clear the ~9pt print floor.
import { DiagramFrame } from "./DiagramFrame";

export function IsolationBarrier({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="EEG SAFETY · ISOLATION"
      tone="gold"
      title="A fault needs a path. Don't give it one."
      ariaLabel="EEG electrical isolation, drawn as a broken circuit. On the left, a mains-powered device; its wire runs toward the subject but STOPS at a rated isolation barrier, so the conductor is broken. On the right, the subject side floats, isolated, marked with a safety badge. Because there is no complete conductive path from mains through the person to ground, a fault has nowhere to drive current. Battery-powering the subject side removes the path entirely; a rated isolator is what makes it safe to bridge to plugged-in gear."
      caption={caption}
      defaultCaption="Battery-power the subject side. Add a rated isolator only if you must bridge to plugged-in gear. Never wire anyone up while charging."
    >
      <style>{CSS}</style>

      <div className="iso">
        {/* desktop / print: the broken-circuit schematic */}
        <div className="iso-diagram">
          <svg className="iso-svg" viewBox="0 0 560 176" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {/* mains (left) */}
            <rect className="iso-mains" x="26" y="66" width="116" height="46" rx="5" />
            <text className="iso-nlab" x="84" y="94">MAINS</text>
            {/* mains-side wire, ending short of the barrier */}
            <path className="iso-wire-bad" d="M142,89 H250" />
            <circle className="iso-dot-bad" cx="250" cy="89" r="4.5" />
            {/* the barrier */}
            <line className="iso-barrier" x1="284" y1="30" x2="284" y2="148" />
            <text className="iso-glab" x="284" y="20">BARRIER</text>
            {/* subject-side wire stub, disconnected */}
            <path className="iso-wire-ok" d="M318,89 H360" />
            <circle className="iso-dot-ok" cx="318" cy="89" r="4.5" />
            <text className="iso-broken" x="284" y="166">the path is broken here</text>
            {/* S4 bust + safety badge (subject) */}
            <g transform="translate(386,30) scale(1.12)">
              <ellipse className="iso-fig" cx="50" cy="30" rx="21" ry="24" />
              <path className="iso-fig" d="M41,52 C40,59 17.8,58 4,98 L96,98 C82.2,58 60,59 59,52 Z" />
              <path className="iso-badge" d="M42,72 L58,72 L58,83 C58,90 51,93 50,94 C49,93 42,90 42,83 Z" />
              <path className="iso-check" d="M46,82 l3.5,3.5 l6,-7" />
            </g>
          </svg>
        </div>

        {/* phone: vertical mains -> barrier -> you */}
        <div className="iso-stack" aria-hidden="true">
          <div className="iso-node iso-node-mains">Mains gear<span>plugged in</span></div>
          <div className="iso-break"><span>BARRIER · the path breaks here</span></div>
          <div className="iso-node iso-node-you">You<span>✓ isolated · floating</span></div>
        </div>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.iso-svg{overflow:visible;width:100%;height:auto;display:block;}
.iso-mains{fill:var(--color-deep-space,#08090d);stroke:var(--color-alert-red,#ef5350);stroke-width:2;}
.iso-nlab{fill:var(--color-title,#f1ece0);font-family:var(--font-mono,"Space Mono",monospace);font-size:13px;font-weight:700;text-anchor:middle;}
.iso-glab{fill:var(--color-command-gold,#c8963e);font-family:var(--font-mono,"Space Mono",monospace);font-size:12px;font-weight:700;text-anchor:middle;letter-spacing:.06em;}
.iso-broken{fill:var(--color-muted,#aaa);font-family:var(--font-mono,"Space Mono",monospace);font-size:12px;text-anchor:middle;}
.iso-wire-bad{stroke:var(--color-alert-red,#ef5350);stroke-width:2.6;fill:none;}
.iso-dot-bad{fill:var(--color-alert-red,#ef5350);}
.iso-wire-ok{stroke:var(--color-command-gold,#c8963e);stroke-width:2.6;fill:none;}
.iso-dot-ok{fill:var(--color-command-gold,#c8963e);}
.iso-barrier{stroke:var(--color-command-gold,#c8963e);stroke-width:3;stroke-dasharray:9 8;}
.iso-fig{fill:var(--color-muted,#aaa);}
.iso-badge{fill:var(--color-command-gold,#c8963e);}
.iso-check{fill:none;stroke:var(--color-deep-space,#08090d);stroke-width:2.4;}

/* phone reflow: vertical mains -> barrier -> you */
.iso-stack{display:none;flex-direction:column;align-items:stretch;gap:0;max-width:20rem;margin:0 auto;}
@media (max-width:520px){
  .iso-diagram{display:none;}
  .iso-stack{display:flex;}
}
.iso-node{border-radius:6px;padding:.7rem .85rem;text-align:left;background:var(--color-navy-dark,#1f2438);
  font-family:var(--font-display,"Bebas Neue",sans-serif);font-size:1.3rem;letter-spacing:.02em;color:var(--color-title,#f1ece0);
  display:flex;align-items:baseline;justify-content:space-between;gap:.5rem;}
.iso-node span{font-family:var(--font-mono,"Space Mono",monospace);font-size:.8rem;font-weight:700;letter-spacing:.04em;}
.iso-node-mains{box-shadow:inset 0 0 0 2px var(--color-alert-red,#ef5350);}
.iso-node-mains span{color:var(--color-alert-red,#ef5350);}
.iso-node-you{box-shadow:inset 0 0 0 2px var(--color-command-gold,#c8963e);}
.iso-node-you span{color:var(--color-command-gold,#c8963e);}
.iso-break{text-align:center;padding:.55rem 0;position:relative;}
.iso-break::before{content:"";position:absolute;left:50%;top:0;bottom:0;width:0;border-left:3px dashed var(--color-command-gold,#c8963e);transform:translateX(-50%);}
.iso-break span{position:relative;display:inline-block;background:var(--color-deep-space,#08090d);padding:.15rem .5rem;
  font-family:var(--font-mono,"Space Mono",monospace);font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--color-command-gold,#c8963e);}

/* Tier-B reveal off the frame's armed/in contract; gated so reduced-motion /
   no-JS / exporter shows the final state. */
.dgfrm.armed .iso-node,.dgfrm.armed .iso-break{opacity:0;transform:translateY(5px);}
.dgfrm.armed.in .iso-node,.dgfrm.armed.in .iso-break{opacity:1;transform:none;transition:opacity .5s ease,transform .5s cubic-bezier(.2,.7,.2,1);}
@media (prefers-reduced-motion:reduce){.dgfrm .iso-node,.dgfrm .iso-break{opacity:1!important;transform:none!important;}}
`;
