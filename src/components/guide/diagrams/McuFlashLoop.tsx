// The flashing loop (v2). Microcontrollers & ESP32 cluster.
//
// Teaching point: your code compiles to a binary, esptool sends it over USB to
// the chip's bootloader, it is written to flash, and the next reset runs it. Then
// you edit and do it again: a load-and-go loop.
//
// Landscape desktop/print: a left-to-right rail of four stages with labelled
// arrows, plus a blue return arc (edit and repeat). REFLOWS on a phone to a
// vertical stage list. Token-only color.
import { type ReactNode } from "react";
import { DiagramFrame } from "./DiagramFrame";

const CX = [69, 243, 417, 591];
const NY = 108, NH = 74;

function Node({ cx, icon, name, sub }: { cx: number; icon: ReactNode; name: string; sub: string }) {
  return (
    <g>
      <rect className="fl-box" x={cx - 46} y={NY} width={92} height={NH} rx={6} />
      <g transform={`translate(${cx},${NY + 24})`}>{icon}</g>
      <text className="fl-nm" x={cx} y={NY + 50} textAnchor="middle">{name}</text>
      <text className="fl-sub" x={cx} y={NY + 66} textAnchor="middle">{sub}</text>
    </g>
  );
}

function Arrow({ x0, x1, label, sub }: { x0: number; x1: number; label: string; sub?: string }) {
  const mid = (x0 + x1) / 2, y = NY + NH / 2;
  return (
    <g>
      <line className="fl-arw" x1={x0} y1={y} x2={x1 - 2} y2={y} />
      <path className="fl-arw" fill="none" d={`M${x1 - 9},${y - 5} L${x1},${y} L${x1 - 9},${y + 5}`} />
      <text className="fl-al" x={mid} y={y - 12} textAnchor="middle">{label}</text>
      {sub ? <text className="fl-as" x={mid} y={y + 20} textAnchor="middle">{sub}</text> : null}
    </g>
  );
}

export function McuFlashLoop({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="MICROCONTROLLERS · FLASHING"
      tone="gold"
      title="Compile, flash, run"
      ariaLabel="The flashing loop, left to right. Your code compiles to a binary image. The esptool utility sends that binary over USB to the chip's bootloader, which writes it into flash memory. The next reset runs it. Then you edit the code and do it again: a blue return arc closes the loop back to the start."
      caption={caption}
      defaultCaption="Code compiles to a binary, esptool sends it over USB to the bootloader, it is written to flash, and reset runs it."
    >
      <style>{CSS}</style>

      <div className="fl">
        {/* desktop / print */}
        <svg className="fl-scene" viewBox="0 0 660 260" aria-hidden="true">
          <Node cx={CX[0]} name="CODE" sub="your source" icon={<text className="fl-ic" textAnchor="middle">{"</>"}</text>} />
          <Node cx={CX[1]} name="BINARY" sub=".bin image" icon={<text className="fl-icn" textAnchor="middle">1011</text>} />
          <Node cx={CX[2]} name="FLASH" sub="on the chip" icon={
            <g>
              <rect className="fl-chip" x={-11} y={-9} width={22} height={18} rx={2} />
              {[-6, 0, 6].map((o) => <line key={`a${o}`} className="fl-pin" x1={-11} y1={o} x2={-16} y2={o} />)}
              {[-6, 0, 6].map((o) => <line key={`b${o}`} className="fl-pin" x1={11} y1={o} x2={16} y2={o} />)}
            </g>
          } />
          <Node cx={CX[3]} name="RUN" sub="on reset" icon={<path className="fl-play" d="M-8,-9 L-8,9 L9,0 Z" />} />

          <Arrow x0={CX[0] + 46} x1={CX[1] - 46} label="compile" />
          <Arrow x0={CX[1] + 46} x1={CX[2] - 46} label="esptool · USB" sub="bootloader" />
          <Arrow x0={CX[2] + 46} x1={CX[3] - 46} label="reset" />

          {/* return arc: edit and repeat */}
          <path className="fl-ret" fill="none" d={`M${CX[3]},${NY + NH} C${CX[3]},214 ${CX[3]},224 ${CX[3] - 34},224 L${CX[0] + 34},224 C${CX[0]},224 ${CX[0]},214 ${CX[0]},${NY + NH + 2}`} />
          <path className="fl-ret" fill="none" d={`M${CX[0] - 5},${NY + NH + 10} L${CX[0]},${NY + NH + 1} L${CX[0] + 5},${NY + NH + 10}`} />
          <text className="fl-retl" x={330} y={220} textAnchor="middle">edit, then flash again</text>
        </svg>

        {/* phone reflow */}
        <div className="fl-phone" aria-hidden="true">
          {[["CODE", "your source"], ["BINARY", "compile → .bin"], ["FLASH", "esptool over USB → the bootloader writes it"], ["RUN", "the next reset runs it"]].map(([n, s], i) => (
            <div className="fl-prow" key={n}>
              <span className="fl-pn">{n}</span>
              <span className="fl-ps">{s}</span>
              {i < 3 ? <span className="fl-parr" aria-hidden="true">↓</span> : null}
            </div>
          ))}
          <p className="fl-pret">↺ edit, then flash again</p>
        </div>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.fl{display:block;}
.fl-scene{display:block;width:100%;height:auto;overflow:visible;}
.fl-box{fill:var(--color-navy-dark,#1a1a2e);stroke:var(--color-command-gold,#c8963e);stroke-width:1.7;}
.fl-arw{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;}
.fl-ret{fill:none;stroke:var(--color-signal-blue,#4a8fff);stroke-width:2.1;stroke-linecap:round;stroke-linejoin:round;}
.fl-nm{font-family:var(--font-display,"Bebas Neue",sans-serif);font-size:20px;letter-spacing:.03em;fill:var(--color-title,#f1ece0);}
.fl-sub{font-family:var(--font-mono,"Space Mono",monospace);font-weight:400;font-size:10.5px;fill:var(--color-muted,#aaa);}
.fl-al{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:10.5px;letter-spacing:.02em;fill:var(--color-command-gold,#c8963e);}
.fl-as{font-family:var(--font-mono,"Space Mono",monospace);font-weight:400;font-size:10px;fill:var(--color-muted,#aaa);}
.fl-retl{font-family:var(--font-serif,"Lora",serif);font-style:italic;font-size:13px;fill:var(--color-signal-blue,#4a8fff);}
.fl-ic{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:17px;fill:var(--color-command-gold,#c8963e);}
.fl-icn{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:15px;letter-spacing:.06em;fill:var(--color-command-gold,#c8963e);}
.fl-chip{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:1.8;}
.fl-pin{stroke:var(--color-command-gold,#c8963e);stroke-width:1.8;stroke-linecap:round;}
.fl-play{fill:var(--color-command-gold,#c8963e);stroke:var(--color-command-gold,#c8963e);stroke-width:1;}

/* phone reflow */
.fl-phone{display:none;}
@media (max-width:520px){ .fl-scene{display:none;} .fl-phone{display:block;} }
.fl-prow{display:grid;grid-template-columns:5rem 1fr;align-items:baseline;column-gap:.6rem;position:relative;padding-bottom:1.1rem;}
.fl-pn{font-family:var(--font-display,"Bebas Neue",sans-serif);font-size:1.3rem;letter-spacing:.03em;color:var(--color-command-gold,#c8963e);}
.fl-ps{font-family:var(--font-serif,"Lora",serif);font-size:.92rem;line-height:1.4;color:var(--color-text,#e8e8e8);}
.fl-parr{position:absolute;left:1.6rem;bottom:.1rem;color:var(--color-panel-border,#3a3f50);font-size:1rem;}
.fl-pret{margin:.2rem 0 0;font-family:var(--font-serif,"Lora",serif);font-style:italic;font-size:.9rem;color:var(--color-signal-blue,#4a8fff);}
`;
