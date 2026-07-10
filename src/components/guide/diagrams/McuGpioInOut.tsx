// GPIO: one pin, two directions (v2). Microcontrollers & ESP32 cluster.
//
// Teaching point: the same GPIO pin is an OUTPUT (drive it high or low to light
// an LED through a resistor) or an INPUT (read a button, held to a known level by
// a pull-up). Gold = the driven/forward path; blue = the value read back in.
//
// Landscape desktop/print: two mini-schematics side by side. REFLOWS on a phone
// to two stacked summary cards. Token-only color.
import { DiagramFrame } from "./DiagramFrame";

// vertical zigzag resistor from (cx,y0) down height h
function vRes(cx: number, y0: number, h: number): string {
  const n = 6;
  const seg = h / n;
  const pts: [number, number][] = [[cx, y0]];
  for (let i = 0; i < n; i++) pts.push([cx + (i % 2 ? 7 : -7), y0 + seg * (i + 0.5)]);
  pts.push([cx, y0 + h]);
  return pts.map((p) => p.join(",")).join(" ");
}

function Ground({ cx, y }: { cx: number; y: number }) {
  return (
    <>
      <line className="gio-w" x1={cx - 13} y1={y} x2={cx + 13} y2={y} />
      <line className="gio-w" x1={cx - 8} y1={y + 5} x2={cx + 8} y2={y + 5} />
      <line className="gio-w" x1={cx - 3} y1={y + 10} x2={cx + 3} y2={y + 10} />
    </>
  );
}

export function McuGpioInOut({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="MICROCONTROLLERS · GPIO"
      tone="gold"
      title="One pin, two directions"
      ariaLabel="A GPIO pin shown two ways. On the left, as an output: the pin drives current down through a 330 ohm resistor and an LED to ground, so setting the pin high lights the LED. On the right, as an input: a 10 kilohm pull-up resistor ties the pin to the 3.3 volt rail, and a button connects the pin to ground, so the pin reads high when idle and low when the button is pressed. The value is read back into the chip."
      caption={caption}
      defaultCaption="Set a pin an output to drive an LED, or an input to read a button held by a pull-up."
    >
      <style>{CSS}</style>

      <div className="gio">
        {/* desktop / print */}
        <svg className="gio-scene" viewBox="0 0 660 296" aria-hidden="true">
          {/* divider */}
          <line className="gio-div" x1={330} y1={46} x2={330} y2={250} />

          {/* ── OUTPUT ── */}
          <text className="gio-hd" x={165} y={30} textAnchor="middle">OUTPUT · DRIVE A PIN</text>
          <rect className="gio-pin" x={100} y={48} width={70} height={34} rx={4} />
          <text className="gio-pinn" x={135} y={70} textAnchor="middle">GPIO</text>
          <line className="gio-drv" x1={135} y1={82} x2={135} y2={100} />
          <polyline className="gio-drv" fill="none" points={vRes(135, 100, 46)} />
          <text className="gio-val" x={108} y={128} textAnchor="end">330 Ω</text>
          <line className="gio-drv" x1={135} y1={146} x2={135} y2={158} />
          {/* LED, pointing down */}
          <path className="gio-drv-f" d="M123,158 L147,158 L135,178 Z" />
          <line className="gio-drv" x1={121} y1={180} x2={149} y2={180} />
          <path className="gio-drv" fill="none" d="M150,160 L158,153 M152,168 L160,161" />
          <text className="gio-val" x={165} y={172}>LED</text>
          <line className="gio-drv" x1={135} y1={180} x2={135} y2={200} />
          <Ground cx={135} y={200} />
          <text className="gio-note" x={165} y={238} textAnchor="middle">drive HIGH → the LED lights</text>

          {/* ── INPUT ── */}
          <text className="gio-hd" x={495} y={30} textAnchor="middle">INPUT · READ A PIN</text>
          <circle className="gio-node" cx={470} cy={56} r={4} />
          <text className="gio-val" x={470} y={44} textAnchor="middle">3.3 V</text>
          <line className="gio-w" x1={470} y1={56} x2={470} y2={74} />
          <polyline className="gio-w" fill="none" points={vRes(470, 74, 46)} />
          <text className="gio-val" x={443} y={102} textAnchor="end">10 kΩ</text>
          <line className="gio-w" x1={470} y1={120} x2={470} y2={158} />
          <circle className="gio-node" cx={470} cy={139} r={4} />
          {/* tap to the pin (read = blue, into chip) */}
          <line className="gio-read" x1={470} y1={139} x2={512} y2={139} />
          <path className="gio-read" fill="none" d="M562,124 L590,124 L590,154 L562,154" />
          <rect className="gio-pin" x={512} y={123} width={78} height={32} rx={4} />
          <text className="gio-pinn" x={551} y={144} textAnchor="middle">GPIO</text>
          <path className="gio-read" fill="none" d="M504,134 L512,139 L504,144" />
          {/* button to ground */}
          <line className="gio-w" x1={470} y1={158} x2={470} y2={166} />
          <line className="gio-w" x1={462} y1={166} x2={478} y2={166} />
          <line className="gio-w" x1={462} y1={180} x2={478} y2={180} />
          <line className="gio-w" x1={458} y1={162} x2={472} y2={155} />
          <text className="gio-val" x={443} y={176} textAnchor="end">BTN</text>
          <line className="gio-w" x1={470} y1={180} x2={470} y2={200} />
          <Ground cx={470} y={200} />
          <text className="gio-note" x={495} y={238} textAnchor="middle">idle HIGH · press pulls it LOW</text>
        </svg>

        {/* phone reflow */}
        <div className="gio-phone" aria-hidden="true">
          <div className="gio-card">
            <span className="gio-ceye gio-gold">Output · drive</span>
            <span className="gio-cv">Pin → <b>330 Ω</b> → LED → GND. Drive the pin HIGH and the LED lights.</span>
          </div>
          <div className="gio-card">
            <span className="gio-ceye gio-blue">Input · read</span>
            <span className="gio-cv"><b>3.3 V</b> → 10 kΩ pull-up → pin, with a button to GND. Idle reads HIGH; a press pulls it LOW.</span>
          </div>
        </div>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.gio{display:block;}
.gio-scene{display:block;width:100%;height:auto;overflow:visible;}
.gio-div{stroke:var(--color-panel-border,#3a3f50);stroke-width:1.2;stroke-dasharray:3 5;}
.gio-w{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2.3;stroke-linecap:round;stroke-linejoin:round;}
.gio-drv{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2.3;stroke-linecap:round;stroke-linejoin:round;}
.gio-drv-f{fill:var(--color-command-gold,#c8963e);stroke:var(--color-command-gold,#c8963e);stroke-width:1;}
.gio-read{fill:none;stroke:var(--color-signal-blue,#4a8fff);stroke-width:2.3;stroke-linecap:round;stroke-linejoin:round;}
.gio-node{fill:var(--color-command-gold,#c8963e);}
.gio-pin{fill:var(--color-navy-dark,#1a1a2e);stroke:var(--color-command-gold,#c8963e);stroke-width:1.8;}
.gio-pinn{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:14px;letter-spacing:.05em;fill:var(--color-title,#f1ece0);}
.gio-hd{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:12px;letter-spacing:.13em;fill:var(--color-command-gold,#c8963e);}
.gio-val{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:15px;fill:var(--color-text,#e8e8e8);}
.gio-note{font-family:var(--font-serif,"Lora",serif);font-style:italic;font-size:14px;fill:var(--color-muted,#aaa);}

/* phone reflow */
.gio-phone{display:none;}
@media (max-width:520px){ .gio-scene{display:none;} .gio-phone{display:block;text-align:left;} }
.gio-card{border:1px solid var(--color-panel-border,#3a3f50);background:var(--color-navy-dark,#1a1a2e);border-radius:6px;padding:.6rem .75rem;margin-bottom:.55rem;display:flex;flex-direction:column;gap:.25rem;}
.gio-ceye{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;}
.gio-gold{color:var(--color-command-gold,#c8963e);}
.gio-blue{color:var(--color-signal-blue,#4a8fff);}
.gio-cv{font-family:var(--font-serif,"Lora",serif);font-size:.94rem;line-height:1.45;color:var(--color-text,#e8e8e8);}
.gio-cv b{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;color:var(--color-title,#f1ece0);}
`;
