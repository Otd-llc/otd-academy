// HASL-vs-ENIG surface-finish comparison as a responsive diagram (v2).
//
// Teaching point: under the WROOM's fine-pitch pads, HASL's uneven solder domes
// hold the module up on the tall ones, so a shorter dome never reaches its pad —
// the module sits over an open air GAP where no joint forms. ENIG's flat gold
// plating is even, so the module sits level and every pad makes contact.
//
// v2: two token-colored cross-sections side by side on desktop/print (was a
// portrait stack), stacking on a narrow phone (directive 1). The HASL side shows
// the tilt + an open gap (red-ringed, labelled in clear space); the ENIG side
// shows even fillets with blue full-contact ticks. Token-only color — the old
// version used presentation-attribute hex and could not re-theme in light mode.
import { DiagramFrame } from "./DiagramFrame";

const PADS = [33, 116, 199]; // pad left-x in the 0..280 cross-section space
const PADY = 118;

export function HaslVsEnig({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="SURFACE FINISH · WROOM PADS"
      tone="gold"
      title="Why ENIG under the WROOM"
      ariaLabel="Two cross-sections under the WROOM module's fine-pitch pads. With HASL the solder is domed at uneven heights, so the module tilts and one pad never makes contact, leaving a gap where no joint forms. With ENIG the finish is flat, so the module sits level and every pad meets it."
      caption={caption}
      defaultCaption="HASL's bumps miss joints you can't see; fine pitch needs ENIG."
    >
      <style>{CSS}</style>

      <div className="hve">
        {/* HASL — uneven domes, module tilts, one pad floats */}
        <div className="hve-card hve-card-bad">
          <p className="hve-top"><span className="hve-name">HASL</span><span className="hve-tag hve-tag-bad">fine-pitch fails</span></p>
          <svg className="hve-svg" viewBox="0 0 280 158" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {/* FR-4 slab */}
            <rect className="hve-fr4" x="17" y={PADY + 8} width="246" height="22" rx="2" />
            {/* pads */}
            {PADS.map((x) => <rect key={x} className="hve-pad" x={x} y={PADY} width="48" height="8" />)}
            {/* uneven solder domes (46, 30, 10 tall) */}
            {[46, 30, 10].map((h, i) => (
              <path key={i} className="hve-solder" d={`M${PADS[i]},${PADY} q24,${-h * 2} 48,0 z`} />
            ))}
            {/* module: rests on the tall left dome, tilts gently down-right, stays above the short right dome */}
            <path className="hve-mod" d="M23,72 L253,84 L253,70 L23,58 Z" />
            {/* the open air gap under the lifted right pad */}
            <rect className="hve-gapfill" x="201" y="82" width="44" height="26" />
            <ellipse className="hve-gapmark" cx="223" cy="95" rx="30" ry="21" />
            <path className="hve-lead" d="M223,74 L223,30" />
            <text className="hve-glabel" x="223" y="24" textAnchor="middle">GAP · no joint</text>
          </svg>
          <p className="hve-note hve-note-bad">One pad floats over the gap, so no joint forms.</p>
        </div>

        {/* ENIG — flat plating, module level, every pad meets */}
        <div className="hve-card hve-card-good">
          <p className="hve-top"><span className="hve-name">ENIG</span><span className="hve-tag hve-tag-good">fine-pitch ok</span></p>
          <svg className="hve-svg" viewBox="0 0 280 158" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <rect className="hve-fr4" x="17" y={PADY + 8} width="246" height="22" rx="2" />
            {PADS.map((x) => <rect key={x} className="hve-pad" x={x} y={PADY} width="48" height="8" />)}
            {/* even flat fillets */}
            {PADS.map((x) => <rect key={x} className="hve-solderG" x={x} y={PADY - 34} width="48" height="34" />)}
            {/* level module */}
            <rect className="hve-mod" x="19" y="68" width="242" height="16" />
            {/* blue full-contact ticks */}
            {PADS.map((x) => <line key={x} className="hve-contact" x1={x + 24} y1={PADY - 34} x2={x + 24} y2={PADY} />)}
          </svg>
          <p className="hve-note hve-note-good">The module sits level, so <b>every pad meets</b> its joint.</p>
        </div>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.hve{display:grid;grid-template-columns:1fr 1fr;gap:clamp(.9rem,3vw,1.4rem);text-align:left;}
@container (max-width:520px){.hve{grid-template-columns:1fr;}}

.hve-card{border-radius:6px;padding:clamp(.75rem,2.6vw,1rem);}
.hve-card-bad{box-shadow:inset 0 0 0 1.5px var(--color-panel-border,#3a3f50),inset 0 3px 0 var(--color-alert-red,#ef5350);}
.hve-card-good{box-shadow:inset 0 0 0 1.5px var(--color-panel-border,#3a3f50),inset 0 3px 0 var(--color-command-gold,#c8963e);}

.hve-top{display:flex;align-items:baseline;gap:.55rem;flex-wrap:wrap;margin:0 0 .1rem;}
.hve-name{color:var(--color-title,#f1ece0);font-family:var(--font-display,"Bebas Neue",sans-serif);
  font-size:clamp(1.25rem,3.6vw,1.55rem);letter-spacing:.04em;line-height:1;}
.hve-tag{font-family:var(--font-mono,"Space Mono",monospace);font-size:.62rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;}
.hve-tag-bad{color:var(--color-alert-red,#ef5350);}
.hve-tag-good{color:var(--color-command-gold,#c8963e);}
.hve-finish{margin:0 0 .5rem;color:var(--color-muted,#aaa);font-family:var(--font-mono,"Space Mono",monospace);
  font-size:clamp(.72rem,1.9vw,.8rem);}

.hve-svg{display:block;width:100%;height:auto;overflow:visible;}
.hve-mod{fill:var(--color-diagram-surface,#1f2438);stroke:var(--color-command-gold,#c8963e);stroke-width:2.5;stroke-linejoin:round;}
.hve-fr4{fill:var(--color-diagram-surface,#1f2438);stroke:var(--color-command-gold,#c8963e);stroke-width:1.6;}
.hve-pad{fill:var(--color-command-gold,#c8963e);}
.hve-solder{fill:var(--color-muted,#aaa);opacity:.55;}
.hve-solderG{fill:var(--color-gold-light,#e8b865);opacity:.5;}
.hve-contact{fill:none;stroke:var(--color-signal-blue,#4a8fff);stroke-width:2;}
.hve-gapfill{fill:var(--color-alert-red,#ef5350);opacity:.15;}
.hve-gapmark{fill:none;stroke:var(--color-alert-red,#ef5350);stroke-width:2;stroke-dasharray:4 3;}
.hve-lead{fill:none;stroke:var(--color-alert-red,#ef5350);stroke-width:1.6;}
.hve-glabel{fill:var(--color-alert-red,#ef5350);font-family:var(--font-mono,"Space Mono",monospace);font-size:12px;font-weight:700;}

.hve-note{margin:.7rem 0 0;font-family:var(--font-serif,"Lora",serif);
  font-size:clamp(.85rem,2.2vw,.95rem);line-height:1.4;color:var(--color-text,#e8e8e8);}
.hve-note-good b{color:var(--color-signal-blue,#4a8fff);font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;}

/* Tier-B reveal off the frame's armed/in contract. */
.dgfrm.armed .hve-card{opacity:0;transform:translateY(6px);}
.dgfrm.armed.in .hve-card{opacity:1;transform:none;transition:opacity .5s ease,transform .5s cubic-bezier(.2,.7,.2,1);}
.dgfrm.armed.in .hve-card-good{transition-delay:.12s;}
@media (prefers-reduced-motion:reduce){.dgfrm .hve-card{opacity:1!important;transform:none!important;}}
`;
