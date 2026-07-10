// USB-C: the CC pins and their 5.1 kohm resistors (v2). Communication &
// Interfaces cluster. Owner-picked O1 (10-option round), with a redrawn USB-C
// receptacle glyph.
//
// Teaching point: a USB-C port declares its role with a resistor on CC. On a
// simple board, VBUS carries 5 V and the two configuration-channel pins, CC1 and
// CC2, each go through a 5.1 kohm resistor to ground. Those two pull-downs mark
// the port as a device (a sink), so a USB-C host recognizes it and switches on
// 5 V. Leave them off and the port stays dead.
//
// Landscape desktop/print: the receptacle, VBUS to 5 V, and a 5.1 kohm pull-down
// on each CC pin to ground. REFLOWS on a phone to a labelled pin list. Token-only
// color: gold = VBUS/power + the resistors, blue = the CC signal pins.
import { DiagramFrame } from "./DiagramFrame";

// A vertical IEC-box resistor from y1 (top) down to y2, at x, with a value label.
function ResistorV({ x, y1, y2, value }: { x: number; y1: number; y2: number; value: string }) {
  const bh = 20;
  const by = (y1 + y2) / 2 - bh / 2;
  return (
    <>
      <line className="ucc-g" x1={x} y1={y1} x2={x} y2={by} />
      <rect className="ucc-res" x={x - 7} y={by} width={14} height={bh} rx={1} />
      <line className="ucc-g" x1={x} y1={by + bh} x2={x} y2={y2} />
      <text className="ucc-rv" x={x + 12} y={by + bh / 2 + 4}>{value}</text>
    </>
  );
}

function Gnd({ x, y }: { x: number; y: number }) {
  return (
    <>
      <line className="ucc-gnd" x1={x} y1={y} x2={x} y2={y + 6} />
      <line className="ucc-gnd" x1={x - 11} y1={y + 6} x2={x + 11} y2={y + 6} />
      <line className="ucc-gnd" x1={x - 7} y1={y + 11} x2={x + 7} y2={y + 11} />
      <line className="ucc-gnd" x1={x - 3} y1={y + 16} x2={x + 3} y2={y + 16} />
    </>
  );
}

export function CommsUsbCCc({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="COMMS · USB-C"
      tone="gold"
      title="The 5.1 kΩ resistors on CC"
      ariaLabel="The USB-C power input on a simple board. The USB-C receptacle's VBUS pin carries 5 V. Its two configuration-channel pins, CC1 and CC2, each connect through a 5.1 kilohm resistor to ground. Those two pull-downs mark the port as a device, or sink, so a USB-C host recognizes it and switches on 5 V. Leave them off and the port stays dead."
      caption={caption}
      defaultCaption="A 5.1 kΩ resistor from each CC pin to ground marks the port as a device, so the host turns on 5 V."
    >
      <style>{CSS}</style>

      {/* desktop / print: the receptacle + the CC circuit */}
      <svg className="ucc-scene" viewBox="0 0 580 268" aria-hidden="true">
        {/* USB-C receptacle glyph: housing, oval port opening, tongue */}
        <text className="ucc-conn-lbl" x={105} y={60} textAnchor="middle">USB-C RECEPTACLE</text>
        <rect className="ucc-shell" x={40} y={70} width={130} height={86} rx={14} />
        <rect className="ucc-opening" x={54} y={92} width={102} height={42} rx={21} />
        <rect className="ucc-tongue" x={68} y={106} width={74} height={14} rx={7} />
        {[78, 92, 106, 120, 134].map((tx) => (
          <g key={tx}>
            <circle className="ucc-pin" cx={tx} cy={110} r={1.3} />
            <circle className="ucc-pin" cx={tx} cy={116} r={1.3} />
          </g>
        ))}

        {/* VBUS */}
        <text className="ucc-pinlbl ucc-pinlbl-g" x={176} y={83}>VBUS</text>
        <line className="ucc-g" x1={170} y1={88} x2={470} y2={88} />
        <text className="ucc-vbus" x={476} y={92} textAnchor="start">VBUS = 5 V</text>

        {/* CC1 -> 5.1k -> GND (routed to the farther resistor so nothing crosses) */}
        <text className="ucc-pinlbl ucc-pinlbl-b" x={176} y={107}>CC1</text>
        <line className="ucc-b" x1={170} y1={112} x2={370} y2={112} />
        <ResistorV x={370} y1={112} y2={200} value="5.1 kΩ" />
        <Gnd x={370} y={200} />

        {/* CC2 -> 5.1k -> GND (nearer resistor) */}
        <text className="ucc-pinlbl ucc-pinlbl-b" x={176} y={140}>CC2</text>
        <line className="ucc-b" x1={170} y1={128} x2={300} y2={128} />
        <ResistorV x={300} y1={128} y2={200} value="5.1 kΩ" />
        <Gnd x={300} y={200} />

        <text className="ucc-take" x={290} y={246} textAnchor="middle">TWO 5.1 kΩ PULL-DOWNS = "I AM A DEVICE"</text>
      </svg>

      {/* phone: labelled pin list */}
      <div className="ucc-list" aria-hidden="true">
        <div className="ucc-port">
          <span className="ucc-port-glyph" />
          <span className="ucc-port-lbl">USB-C</span>
        </div>
        <ul className="ucc-pins">
          <li className="ucc-row ucc-row-g"><span className="ucc-rp">VBUS</span><span className="ucc-rd">= 5 V</span></li>
          <li className="ucc-row ucc-row-b"><span className="ucc-rp">CC1</span><span className="ucc-rd">→ 5.1 kΩ → GND</span></li>
          <li className="ucc-row ucc-row-b"><span className="ucc-rp">CC2</span><span className="ucc-rd">→ 5.1 kΩ → GND</span></li>
        </ul>
        <p className="ucc-note">Two 5.1 kΩ pull-downs = "I am a device", so the host gives 5 V.</p>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.ucc-scene{display:block;width:100%;height:auto;overflow:visible;}
.ucc-conn-lbl{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:12px;letter-spacing:.04em;fill:var(--color-muted,#aaa);}
.ucc-shell{fill:var(--color-navy-dark,#1a1a2e);stroke:var(--color-command-gold,#c8963e);stroke-width:2.5;}
.ucc-opening{fill:var(--color-deep-space,#08090d);stroke:var(--color-panel-border,#3a3f50);stroke-width:1.5;}
.ucc-tongue{fill:var(--color-navy-dark,#1a1a2e);stroke:var(--color-gold-light,#e8b865);stroke-width:1.4;}
.ucc-pin{fill:var(--color-gold-light,#e8b865);}
.ucc-g{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2;stroke-linecap:round;}
.ucc-b{fill:none;stroke:var(--color-signal-blue,#4a8fff);stroke-width:2;stroke-linecap:round;}
.ucc-gnd{fill:none;stroke:var(--color-muted,#aaa);stroke-width:2;stroke-linecap:round;}
.ucc-res{fill:var(--color-navy-dark,#1a1a2e);stroke:var(--color-command-gold,#c8963e);stroke-width:2;}
.ucc-rv{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:12px;fill:var(--color-gold-light,#e8b865);}
.ucc-pinlbl{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:11px;}
.ucc-pinlbl-g{fill:var(--color-command-gold,#c8963e);}
.ucc-pinlbl-b{fill:var(--color-signal-blue,#4a8fff);}
.ucc-vbus{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:13px;fill:var(--color-command-gold,#c8963e);}
.ucc-take{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:11px;letter-spacing:.04em;fill:var(--color-muted,#aaa);}

/* phone reflow */
.ucc-list{display:none;}
@media (max-width:520px){ .ucc-scene{display:none;} .ucc-list{display:block;} }
.ucc-port{display:flex;flex-direction:column;align-items:center;gap:.4rem;margin-bottom:.9rem;}
.ucc-port-glyph{width:80px;height:26px;border-radius:13px;background:var(--color-navy-dark,#1a1a2e);
  box-shadow:inset 0 0 0 2px var(--color-command-gold,#c8963e), inset 0 0 0 8px var(--color-deep-space,#08090d), inset 0 0 0 10px var(--color-panel-border,#3a3f50);}
.ucc-port-lbl{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.8rem;letter-spacing:.06em;color:var(--color-muted,#aaa);}
.ucc-pins{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.45rem;}
.ucc-row{display:flex;align-items:center;justify-content:space-between;gap:.6rem;padding:.5rem .8rem;border-radius:6px;
  background:var(--color-navy-dark,#1a1a2e);box-shadow:inset 0 0 0 1.5px var(--color-panel-border,#3a3f50);}
.ucc-rp{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.85rem;}
.ucc-row-g .ucc-rp{color:var(--color-command-gold,#c8963e);}
.ucc-row-b .ucc-rp{color:var(--color-signal-blue,#4a8fff);}
.ucc-rd{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.8rem;color:var(--color-title,#f1ece0);}
.ucc-note{margin:.9rem 0 0;font-family:var(--font-mono,"Space Mono",monospace);font-size:.74rem;letter-spacing:.02em;color:var(--color-muted,#aaa);text-align:center;}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .ucc-res{opacity:0;}
.dgfrm.armed.in .ucc-res{opacity:1;transition:opacity .5s ease .3s;}
@media (prefers-reduced-motion:reduce){ .dgfrm .ucc-res{opacity:1!important;} }
`;
