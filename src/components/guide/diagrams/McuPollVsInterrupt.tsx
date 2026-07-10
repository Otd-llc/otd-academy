// Polling versus interrupts (v2). Microcontrollers & ESP32 cluster.
//
// Teaching point: polling is the CPU asking "has it happened yet?" over and over,
// wasting cycles. An interrupt lets the hardware call your handler the instant the
// event fires, so the CPU is free until then.
//
// Landscape desktop/print: a looping poll circle on the left versus a straight
// event-to-ISR shot on the right. REFLOWS on a phone to two stacked cards. Tokens.
import { DiagramFrame } from "./DiagramFrame";

export function McuPollVsInterrupt({ caption }: { caption?: string }) {
  const cx = 158, cy = 160, r = 50;
  return (
    <DiagramFrame
      eyebrow="MICROCONTROLLERS · INTERRUPTS"
      tone="gold"
      title="Polling versus interrupts"
      ariaLabel="Two ways to react to an event, side by side. On the left, polling: the CPU loops, checking the pin over and over, asking is it high yet, and only catches the event on a later check, wasting cycles in between. On the right, an interrupt: the event fires and the hardware calls the interrupt service routine directly, the instant it happens, while the CPU was free to do other work. The interrupt path is direct; the polling path goes in circles."
      caption={caption}
      defaultCaption="Polling checks over and over and wastes cycles; an interrupt calls the handler the moment the event fires."
    >
      <style>{CSS}</style>

      <div className="pi">
        {/* desktop / print */}
        <svg className="pi-scene" viewBox="0 0 660 300" aria-hidden="true">
          <line className="pi-div" x1={330} y1={40} x2={330} y2={264} />

          {/* ── POLLING ── */}
          <text className="pi-hd" x={168} y={34} textAnchor="middle">POLLING · KEEP ASKING</text>
          {/* loop circle with tangent arrowheads (clockwise) */}
          <circle className="pi-loop" cx={cx} cy={cy} r={r} />
          <path className="pi-loop" fill="none" d={`M${cx + r - 6},${cy - 8} L${cx + r},${cy} L${cx + r + 6},${cy - 8}`} />
          <path className="pi-loop" fill="none" d={`M${cx - r - 6},${cy + 8} L${cx - r},${cy} L${cx - r + 6},${cy + 8}`} />
          <text className="pi-cq" x={cx} y={cy - 4} textAnchor="middle">pin</text>
          <text className="pi-cq" x={cx} y={cy + 18} textAnchor="middle">high?</text>
          <text className="pi-no" x={cx} y={cy - r - 10} textAnchor="middle">no · again</text>
          {/* exit: yes → handle */}
          <line className="pi-w" x1={cx + r} y1={cy} x2={244} y2={cy} />
          <path className="pi-w" fill="none" d={`M236,${cy - 5} L244,${cy} L236,${cy + 5}`} />
          <text className="pi-yes" x={228} y={cy - 10} textAnchor="middle">yes</text>
          <rect className="pi-box" x={246} y={cy - 20} width={72} height={40} rx={5} />
          <text className="pi-bx" x={282} y={cy + 5} textAnchor="middle">handle</text>
          <text className="pi-note" x={168} y={252} textAnchor="middle">the CPU spins, checking over and over</text>

          {/* ── INTERRUPT ── */}
          <text className="pi-hd" x={496} y={34} textAnchor="middle">INTERRUPT · GET TOLD</text>
          {/* CPU free doing other work */}
          <rect className="pi-boxd" x={372} y={92} width={116} height={36} rx={5} />
          <text className="pi-dim" x={430} y={115} textAnchor="middle">CPU: other work</text>
          {/* event bolt */}
          <text className="pi-ev" x={430} y={150} textAnchor="middle">EVENT</text>
          <path className="pi-bolt" d="M430,156 L422,176 L430,176 L424,196 L440,172 L432,172 L438,156 Z" />
          {/* straight shot to ISR */}
          <line className="pi-w" x1={452} y1={176} x2={506} y2={176} />
          <path className="pi-w" fill="none" d="M498,171 L506,176 L498,181" />
          <rect className="pi-box pi-isr" x={508} y={154} width={120} height={44} rx={6} />
          <text className="pi-isrt" x={568} y={172} textAnchor="middle">ISR</text>
          <text className="pi-isrs" x={568} y={188} textAnchor="middle">handle it</text>
          <text className="pi-note" x={496} y={252} textAnchor="middle">called the instant it happens, no waste</text>
        </svg>

        {/* phone reflow */}
        <div className="pi-phone" aria-hidden="true">
          <div className="pi-card pi-cgold">
            <span className="pi-ceye">Polling</span>
            <span className="pi-cv">The CPU loops, checking the pin over and over, and catches the event late. Cycles wasted between checks.</span>
          </div>
          <div className="pi-card pi-cgold">
            <span className="pi-ceye">Interrupt</span>
            <span className="pi-cv">The event fires and the hardware calls the ISR directly, the instant it happens, while the CPU was free.</span>
          </div>
        </div>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.pi{display:block;}
.pi-scene{display:block;width:100%;height:auto;overflow:visible;}
.pi-div{stroke:var(--color-panel-border,#3a3f50);stroke-width:1.2;stroke-dasharray:3 5;}
.pi-loop{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round;}
.pi-w{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2.3;stroke-linecap:round;stroke-linejoin:round;}
.pi-box{fill:var(--color-navy-dark,#1a1a2e);stroke:var(--color-command-gold,#c8963e);stroke-width:1.7;}
.pi-isr{stroke-width:2.2;}
.pi-boxd{fill:var(--color-navy-dark,#1a1a2e);stroke:var(--color-panel-border,#3a3f50);stroke-width:1.4;}
.pi-bolt{fill:var(--color-command-gold,#c8963e);stroke:var(--color-command-gold,#c8963e);stroke-width:1;stroke-linejoin:round;}
.pi-hd{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:12px;letter-spacing:.11em;fill:var(--color-command-gold,#c8963e);}
.pi-cq{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:14px;fill:var(--color-title,#f1ece0);}
.pi-no{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:12px;fill:var(--color-muted,#aaa);}
.pi-yes{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:12px;fill:var(--color-command-gold,#c8963e);}
.pi-bx{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:13px;fill:var(--color-title,#f1ece0);}
.pi-dim{font-family:var(--font-mono,"Space Mono",monospace);font-weight:400;font-size:11px;fill:var(--color-muted,#aaa);}
.pi-ev{font-family:var(--font-display,"Bebas Neue",sans-serif);font-size:16px;letter-spacing:.05em;fill:var(--color-command-gold,#c8963e);}
.pi-isrt{font-family:var(--font-display,"Bebas Neue",sans-serif);font-size:20px;letter-spacing:.04em;fill:var(--color-command-gold,#c8963e);}
.pi-isrs{font-family:var(--font-mono,"Space Mono",monospace);font-weight:400;font-size:11px;fill:var(--color-text,#e8e8e8);}
.pi-note{font-family:var(--font-serif,"Lora",serif);font-style:italic;font-size:13px;fill:var(--color-muted,#aaa);}

/* phone reflow */
.pi-phone{display:none;}
@media (max-width:520px){ .pi-scene{display:none;} .pi-phone{display:block;} }
.pi-card{border:1px solid var(--color-command-gold,#c8963e);border-radius:6px;background:var(--color-navy-dark,#1a1a2e);padding:.55rem .7rem;margin-bottom:.55rem;display:flex;flex-direction:column;gap:.2rem;}
.pi-ceye{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;color:var(--color-command-gold,#c8963e);}
.pi-cv{font-family:var(--font-serif,"Lora",serif);font-size:.92rem;line-height:1.45;color:var(--color-text,#e8e8e8);}
`;
