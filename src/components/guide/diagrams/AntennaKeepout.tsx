// WROOM antenna keep-out as a responsive diagram (v2).
//
// Teaching point: the ESP32-S3-WROOM-1 (U1) sits at the board edge with its PCB
// antenna overhanging the top edge. The area under and around that antenna is a
// KEEP-OUT: no copper, no ground pour, no parts, no traces — copper there detunes
// the antenna and kills range. The ground pour fills the rest of the board, under
// the module body and pads.
//
// v2: a top-down board figure (visible copper-pour hatch, a cleared dashed
// keep-out around the antenna, the shared WroomU1 module on the pour) beside a
// forbidden-list, landscape on desktop/print and stacking on a narrow phone
// (directive 1). Token-only color — the pour hatch line, the board, the keep-out,
// and the WroomU1 module all resolve via `var(--color-*)`, so the whole figure
// re-themes in light mode (the old presentation-attribute hex did not).
import { DiagramFrame } from "./DiagramFrame";
import { WroomU1 } from "./WroomU1";

const NO = ["no copper", "no ground pour", "no parts", "no traces"];

export function AntennaKeepout({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="LAYOUT · ANTENNA KEEP-OUT"
      tone="gold"
      title="Keep the antenna zone clear"
      ariaLabel="Top view of the carrier board: the ESP32-S3-WROOM-1 module (U1) sits at the board edge with its PCB antenna overhanging the top edge inside a dashed no-copper keep-out; the module's pads sit below the keep-out on the ground pour, which fills the rest of the board."
      caption={caption}
      defaultCaption="Clear copper and parts beneath the antenna."
    >
      <style>{CSS}</style>

      <div className="akz">
        {/* board figure */}
        <div className="akz-figwrap">
          <svg className="akz-svg" viewBox="0 0 240 180" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <defs>
              <pattern id="akzpour" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                <line className="akz-pourline" x1="0" y1="0" x2="0" y2="7" />
              </pattern>
            </defs>
            {/* copper ground pour (hatch) fills the board */}
            <rect className="akz-board" x="15" y="82" width="210" height="86" rx="8" />
            {/* keep-out: pour CLEARED under the antenna */}
            <rect className="akz-clear" x="70" y="82" width="100" height="9" />
            {/* the WROOM: body on the pour, antenna overhanging the top edge */}
            <WroomU1 x={85} y={61} scale={0.7} />
            {/* dashed no-copper keep-out around the antenna */}
            <rect className="akz-ko" x="70" y="55" width="100" height="36" />
            <text className="akz-kolab" x="120" y="50" textAnchor="middle">keep-out</text>
          </svg>
        </div>

        {/* forbidden-list */}
        <div className="akz-list">
          <p className="akz-h">UNDER THE ANTENNA</p>
          <ul className="akz-nos">
            {NO.map((n) => (
              <li className="akz-no" key={n}><span className="akz-x" aria-hidden="true">✗</span>{n}</li>
            ))}
          </ul>
          <p className="akz-sub">The ground pour (hatch) fills the rest, under the U1 body and pads.</p>
        </div>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.akz{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);align-items:center;
  gap:clamp(1rem,4vw,2rem);text-align:left;}
@container (max-width:520px){.akz{grid-template-columns:1fr;gap:1.1rem;}}
.akz-figwrap{width:100%;}
.akz-svg{display:block;width:100%;height:auto;overflow:visible;}

.akz-pourline{stroke:var(--color-command-gold,#c8963e);stroke-width:1.2;opacity:.42;}
.akz-board{fill:url(#akzpour);stroke:var(--color-command-gold,#c8963e);stroke-width:2.5;}
.akz-clear{fill:var(--color-deep-space,#08090d);}
.akz-ko{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2;stroke-dasharray:6 4;}
.akz-kolab{fill:var(--color-command-gold,#c8963e);font-family:var(--font-mono,"Space Mono",monospace);font-size:11px;font-weight:700;letter-spacing:.04em;}

.akz-h{margin:0 0 .75rem;font-family:var(--font-display,"Bebas Neue",sans-serif);
  font-size:clamp(1.5rem,5vw,1.9rem);letter-spacing:.03em;line-height:1;color:var(--color-command-gold,#c8963e);}
.akz-nos{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.5rem;}
.akz-no{display:flex;align-items:baseline;gap:.55rem;font-family:var(--font-mono,"Space Mono",monospace);
  font-weight:700;font-size:clamp(.95rem,2.6vw,1.15rem);color:var(--color-title,#f1ece0);}
.akz-x{color:var(--color-alert-red,#ef5350);font-weight:700;}
.akz-sub{margin:.9rem 0 0;font-family:var(--font-serif,"Lora",serif);
  font-size:clamp(.85rem,2.2vw,.95rem);line-height:1.45;color:var(--color-muted,#aaa);}

/* Tier-B reveal off the frame's armed/in contract. */
.dgfrm.armed .akz-no,.dgfrm.armed .akz-figwrap{opacity:0;transform:translateY(5px);}
.dgfrm.armed.in .akz-no,.dgfrm.armed.in .akz-figwrap{opacity:1;transform:none;transition:opacity .5s ease,transform .5s cubic-bezier(.2,.7,.2,1);}
.dgfrm.armed.in .akz-no:nth-child(2){transition-delay:.06s;}
.dgfrm.armed.in .akz-no:nth-child(3){transition-delay:.12s;}
.dgfrm.armed.in .akz-no:nth-child(4){transition-delay:.18s;}
@media (prefers-reduced-motion:reduce){.dgfrm .akz-no,.dgfrm .akz-figwrap{opacity:1!important;transform:none!important;}}
`;
