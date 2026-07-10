// Reading the pinout: not every pin is equal (v2). Microcontrollers cluster.
//
// Teaching point: before you wire, read the pin map. Some pins are strapping
// (keep them free), some reach the ADC, some are the USB pair or on-module flash
// (reserved), and the rest are free GPIO. Match each function to a pin that can
// do it.
//
// Landscape desktop/print: the module with a row of pins, each flagged by
// category colour, plus a legend. REFLOWS on a phone to a category list. Colours
// stay on-palette: gold free, blue ADC, red strapping (caution), muted reserved.
import { DiagramFrame } from "./DiagramFrame";

type Cat = "free" | "adc" | "strap" | "rsvd";
const PINS: { io: string; cat: Cat }[] = [
  { io: "0", cat: "strap" }, { io: "1", cat: "adc" }, { io: "2", cat: "adc" },
  { io: "3", cat: "strap" }, { io: "4", cat: "adc" }, { io: "5", cat: "free" },
  { io: "6", cat: "free" }, { io: "16", cat: "free" }, { io: "17", cat: "free" },
  { io: "19", cat: "rsvd" }, { io: "20", cat: "rsvd" }, { io: "35", cat: "rsvd" },
  { io: "36", cat: "rsvd" }, { io: "45", cat: "strap" },
];
const CATCLASS: Record<Cat, string> = { free: "pn-free", adc: "pn-adc", strap: "pn-strap", rsvd: "pn-rsvd" };
const LEGEND: { cat: Cat; label: string }[] = [
  { cat: "free", label: "free GPIO" },
  { cat: "adc", label: "ADC input" },
  { cat: "strap", label: "strapping" },
  { cat: "rsvd", label: "USB / flash" },
];

export function McuPinoutMap({ caption }: { caption?: string }) {
  const cx = (i: number) => 62 + i * 40;
  return (
    <DiagramFrame
      eyebrow="MICROCONTROLLERS · PINOUT"
      tone="gold"
      title="Not every pin is equal"
      ariaLabel="An annotated ESP32-S3 pin map. A row of pins runs along the module, each flagged by category. Free general-purpose GPIO pins are gold. ADC-capable pins, for analog input, are blue. Strapping pins, which must be kept free at reset or the board will not boot, are red. The USB pair and the on-module flash pins are reserved and shown muted. A legend maps the colours. Read the map and match each function to a pin that can actually do it before you wire."
      caption={caption}
      defaultCaption="Read the pin map first: strapping, ADC, USB, and flash pins each have their own rules. Match each function to a pin that can do it."
    >
      <style>{CSS}</style>

      <div className="pn">
        {/* desktop / print */}
        <svg className="pn-scene" viewBox="0 0 660 300" aria-hidden="true">
          {/* module body */}
          <rect className="pn-mod" x={44} y={80} width={572} height={44} rx={6} />
          <text className="pn-modt" x={330} y={108} textAnchor="middle">ESP32-S3</text>

          {/* pins */}
          {PINS.map((p, i) => {
            const x = cx(i);
            return (
              <g key={p.io} className={CATCLASS[p.cat]}>
                <line className="pn-stub" x1={x} y1={124} x2={x} y2={142} />
                <rect className="pn-cell" x={x - 17} y={142} width={34} height={44} rx={4} />
                <text className="pn-io" x={x} y={166} textAnchor="middle">{p.io}</text>
                <text className="pn-iolbl" x={x} y={179} textAnchor="middle">IO</text>
              </g>
            );
          })}

          {/* legend */}
          {LEGEND.map((l, i) => {
            const lx = 60 + i * 152;
            return (
              <g key={l.cat} className={CATCLASS[l.cat]}>
                <rect className="pn-sw" x={lx} y={228} width={16} height={16} rx={3} />
                <text className="pn-lgl" x={lx + 24} y={241}>{l.label}</text>
              </g>
            );
          })}
        </svg>

        {/* phone reflow */}
        <div className="pn-phone" aria-hidden="true">
          <p className="pn-plead">Not every pin can do every job. Read the map before you wire:</p>
          <ul className="pn-plist">
            <li className="pn-free"><span className="pn-pdot" />free GPIO</li>
            <li className="pn-adc"><span className="pn-pdot" />ADC input</li>
            <li className="pn-strap"><span className="pn-pdot" />strapping · keep free at reset</li>
            <li className="pn-rsvd"><span className="pn-pdot" />USB pair / on-module flash · reserved</li>
          </ul>
        </div>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.pn{display:block;}
.pn-scene{display:block;width:100%;height:auto;overflow:visible;}
.pn-mod{fill:var(--color-navy-dark,#1a1a2e);stroke:var(--color-command-gold,#c8963e);stroke-width:1.9;}
.pn-modt{font-family:var(--font-display,"Bebas Neue",sans-serif);font-size:24px;letter-spacing:.06em;fill:var(--color-title,#f1ece0);}
.pn-stub{stroke:var(--color-muted,#aaa);stroke-width:1.6;}
.pn-cell{fill:var(--color-navy-dark,#1a1a2e);stroke-width:2;}
.pn-io{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:16px;}
.pn-iolbl{font-family:var(--font-mono,"Space Mono",monospace);font-weight:400;font-size:8px;letter-spacing:.1em;fill:var(--color-muted,#aaa);}
.pn-sw{stroke-width:2;}
.pn-lgl{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:12px;fill:var(--color-text,#e8e8e8);}

/* category colours (on-palette) */
.pn-free .pn-cell,.pn-free .pn-sw{stroke:var(--color-command-gold,#c8963e);}
.pn-free .pn-io{fill:var(--color-command-gold,#c8963e);}
.pn-free .pn-sw{fill:var(--color-command-gold,#c8963e);}
.pn-adc .pn-cell,.pn-adc .pn-sw{stroke:var(--color-signal-blue,#4a8fff);}
.pn-adc .pn-io{fill:var(--color-signal-blue,#4a8fff);}
.pn-adc .pn-sw{fill:var(--color-signal-blue,#4a8fff);}
.pn-strap .pn-cell,.pn-strap .pn-sw{stroke:var(--color-alert-red,#ef5350);}
.pn-strap .pn-io{fill:var(--color-alert-red,#ef5350);}
.pn-strap .pn-sw{fill:var(--color-alert-red,#ef5350);}
.pn-rsvd .pn-cell,.pn-rsvd .pn-sw{stroke:var(--color-panel-border,#3a3f50);}
.pn-rsvd .pn-io{fill:var(--color-muted,#aaa);}
.pn-rsvd .pn-sw{fill:var(--color-panel-border,#3a3f50);}

/* phone reflow */
.pn-phone{display:none;}
@media (max-width:520px){ .pn-scene{display:none;} .pn-phone{display:block;} }
.pn-plead{margin:0 0 .5rem;font-family:var(--font-serif,"Lora",serif);font-size:.95rem;line-height:1.5;color:var(--color-text,#e8e8e8);}
.pn-plist{list-style:none;margin:0;padding:0;}
.pn-plist li{display:flex;align-items:center;gap:.5rem;font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.86rem;color:var(--color-text,#e8e8e8);margin-bottom:.45rem;}
.pn-pdot{width:14px;height:14px;border-radius:3px;flex:none;}
.pn-free .pn-pdot{background:var(--color-command-gold,#c8963e);}
.pn-adc .pn-pdot{background:var(--color-signal-blue,#4a8fff);}
.pn-strap .pn-pdot{background:var(--color-alert-red,#ef5350);}
.pn-rsvd .pn-pdot{background:var(--color-panel-border,#3a3f50);}
`;
