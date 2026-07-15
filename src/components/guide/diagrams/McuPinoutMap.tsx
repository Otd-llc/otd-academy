// Reading the pinout, grouped by usability (diagram-standards v2).
// MCU cluster, diagram 11 (final). Owner-picked P2.
//
// Teaching point (lesson 10): not every pin can do every job, so read the pin map
// before you wire. Three groups: the general-purpose pins free to use (gold), the
// ADC1-capable analog inputs (blue), and the reserved pins to leave alone (red),
// each tagged with why (strapping, USB, or on-module flash). Assign your signals
// to the pins that are left. Pin functions are real ESP32-S3 assignments.
//
// HTML groups, so the text stays crisp and the columns stack on a phone. Token
// color, both themes. Header + caption from the DiagramFrame.
import { DiagramFrame } from "./DiagramFrame";

const GROUPS = [
  { cls: "use", h: "USE THESE", sub: "free GPIO", pins: [{ n: "GPIO4" }, { n: "GPIO5" }, { n: "GPIO6" }, { n: "GPIO7" }] },
  { cls: "adc", h: "ANALOG IN", sub: "ADC1 pins", pins: [{ n: "GPIO1" }, { n: "GPIO2" }, { n: "GPIO3" }] },
  {
    cls: "res", h: "LEAVE ALONE", sub: "reserved", pins: [
      { n: "GPIO0", tag: "strap" }, { n: "GPIO19", tag: "USB" }, { n: "GPIO20", tag: "USB" },
      { n: "GPIO26", tag: "flash" }, { n: "GPIO45", tag: "strap" }, { n: "GPIO46", tag: "strap" },
    ],
  },
];

export function McuPinoutMap({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="MICROCONTROLLERS · PINOUT"
      tone="gold"
      title="Not every pin can do every job"
      ariaLabel="An ESP32-S3 pin map grouped by how you can use each pin. The first group, in gold, is the general-purpose pins free to use: GPIO4, GPIO5, GPIO6, GPIO7. The second, in blue, is the ADC1-capable analog inputs: GPIO1, GPIO2, GPIO3. The third, in red, is the reserved pins to leave alone, each tagged with why: GPIO0, GPIO45, and GPIO46 are strapping pins, GPIO19 and GPIO20 are the native USB pair, and GPIO26 is wired to the on-module flash. Read the map and wire your signals to the pins that are free."
      caption={caption}
      defaultCaption="Read the pin map first: gold pins are free to use, blue pins reach ADC1, and the red pins are reserved (strapping, USB, or flash) to leave alone."
    >
      <style>{CSS}</style>
      <div className="po">
        {GROUPS.map((g) => (
          <div key={g.cls} className={`po-col po-${g.cls}`}>
            <p className="po-h">{g.h}</p>
            <p className="po-sub">{g.sub}</p>
            <div className="po-chips">
              {g.pins.map((p) => (
                <div key={p.n} className="po-chip">
                  <span className="po-pin">{p.n}</span>
                  {"tag" in p && p.tag ? <span className="po-tag">{p.tag}</span> : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.po{display:flex;gap:clamp(.55rem,3vw,1.3rem);justify-content:center;align-items:flex-start;max-width:36rem;margin-inline:auto;}
.po-col{flex:1 1 0;min-width:0;}
.po-res{flex:1.7 1 0;}
.po-res .po-chips{display:grid;grid-template-columns:1fr 1fr;gap:.32rem;}
.po-res .po-chip{margin-bottom:0;}
@container (max-width:520px){ .po{flex-wrap:wrap;} .po-col{flex:1 1 8rem;} .po-res{flex:1 1 100%;} }
.po-h{margin:0;font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;
  font-size:clamp(.74rem,2.1vw,.86rem);letter-spacing:.08em;}
.po-sub{margin:.05rem 0 .4rem;font-family:var(--font-mono,"Space Mono",monospace);
  font-size:clamp(.66rem,1.7vw,.74rem);color:var(--color-muted,#aaaaaa);}
.po-chip{display:flex;align-items:center;justify-content:space-between;gap:.4rem;
  border:1.5px solid var(--color-panel-border,#3a3f50);border-radius:6px;
  padding:.26rem .5rem;margin-bottom:.32rem;}
.po-pin{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:700;
  font-size:clamp(.82rem,2.3vw,.94rem);color:var(--color-title,#f1ece0);}
.po-tag{font-family:var(--font-mono,"Space Mono",monospace);font-size:clamp(.62rem,1.6vw,.72rem);}
.po-use .po-h{color:var(--color-command-gold,#c8963e);}
.po-use .po-chip{border-color:var(--color-command-gold,#c8963e);}
.po-adc .po-h{color:var(--color-signal-blue,#4a8fff);}
.po-adc .po-chip{border-color:var(--color-signal-blue,#4a8fff);}
.po-res .po-h{color:var(--color-alert-red,#ef5350);}
.po-res .po-chip{border-color:var(--color-alert-red,#ef5350);}
.po-res .po-tag{color:var(--color-alert-red,#ef5350);}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .po-col{opacity:0;transform:translateY(6px);}
.dgfrm.armed.in .po-col{opacity:1;transform:none;transition:opacity .5s ease,transform .5s cubic-bezier(.2,.7,.2,1);}
.dgfrm.armed.in .po-col:nth-child(2){transition-delay:.1s;}
.dgfrm.armed.in .po-col:nth-child(3){transition-delay:.2s;}
@media (prefers-reduced-motion:reduce){
  .dgfrm .po-col{opacity:1!important;transform:none!important;transition:none!important;}
}
`;
