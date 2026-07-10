// Power-input protection (v2). Power & Batteries cluster. Owner-picked W10
// (minimal: flow + the inrush waveform).
//
// Teaching point (reverse-polarity-protection): two guards sit right at a board's
// power input. A P-channel MOSFET blocks a reversed supply; an inrush-limiting
// element ramps the turn-on current into the bulk capacitors. The trace below
// shows the sharp spike the caps would pull without the limiter (dashed, red) and
// the gentle ramp with it (solid, green).
//
// Landscape flow + a current-vs-time band; reflows on a phone to two guard rows +
// a mini waveform. Token-only color (gold = path, red = the avoided spike, green
// = the tamed ramp); re-themes in light + print.
import { DiagramFrame } from "./DiagramFrame";

function spike(x0: number, x1: number, base: number, pk: number): string {
  const m = (x0 + x1) / 2;
  return `M${x0},${base} L${m - 5},${base} L${m},${pk} L${m + 5},${base} L${x1},${base}`;
}
function ramp(x0: number, x1: number, base: number, top: number): string {
  const m = x0 + (x1 - x0) * 0.5;
  return `M${x0},${base} C${m},${base} ${m},${top} ${x1},${top}`;
}

export function InputProtection({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="INPUT PROTECTION"
      tone="gold"
      title="Two guards at the power input"
      ariaLabel="Two guards at a board's power input. A P-channel MOSFET blocks a reversed supply, and an inrush-limiting element ramps the turn-on current into the bulk capacitors. Below, a current-versus-time trace shows the sharp spike the capacitors would pull without the limiter, drawn dashed, and the gentle ramp with it, drawn solid."
      caption={caption}
      defaultCaption="A P-FET blocks a reversed supply; the inrush element ramps the turn-on surge into the bulk caps."
    >
      <style>{CSS}</style>

      <div className="ip">
        {/* desktop / print: the flow + the current trace */}
        <svg className="ip-scene" viewBox="0 0 500 196" aria-hidden="true">
          {/* flow */}
          <text className="ip-v" x="20" y="50" textAnchor="start">Vin</text>
          <line className="ip-w" x1="20" y1="64" x2="72" y2="64" />
          <path className="ip-w" fill="none" d="M67,59 L80,64 L67,69" />
          <rect className="ip-blk" x="80" y="42" width="118" height="44" rx="6" />
          <text className="ip-part" x="139" y="61" textAnchor="middle">P-FET</text>
          <text className="ip-lbl" x="139" y="77" textAnchor="middle">reverse block</text>
          <line className="ip-w" x1="198" y1="64" x2="224" y2="64" />
          <path className="ip-w" fill="none" d="M219,59 L232,64 L219,69" />
          <rect className="ip-blk" x="232" y="42" width="118" height="44" rx="6" />
          <text className="ip-part" x="291" y="61" textAnchor="middle">INRUSH</text>
          <text className="ip-lbl" x="291" y="77" textAnchor="middle">ramp surge</text>
          <line className="ip-w" x1="350" y1="64" x2="380" y2="64" />
          <path className="ip-w" fill="none" d="M375,59 L388,64 L375,69" />
          <line className="ip-w" x1="388" y1="64" x2="388" y2="94" />
          <line className="ip-w" x1="377" y1="94" x2="399" y2="94" />
          <line className="ip-w" x1="377" y1="100" x2="399" y2="100" />
          <line className="ip-w" x1="388" y1="100" x2="388" y2="112" />
          <line className="ip-gnd" x1="374" y1="112" x2="402" y2="112" />
          <text className="ip-lbl" x="414" y="68" textAnchor="start">bulk caps</text>
          {/* turn-on current trace */}
          <line className="ip-axis" x1="96" y1="172" x2="404" y2="172" />
          <path className="ip-spk" fill="none" d={spike(110, 186, 172, 140)} />
          <path className="ip-rmp" fill="none" d={ramp(240, 398, 172, 146)} />
          <text className="ip-cap" x="250" y="192" textAnchor="middle">turn-on current: spike vs ramp</text>
        </svg>

        {/* phone: guard rows + mini waveform */}
        <div className="ip-list" aria-hidden="true">
          <ul>
            <li><b className="ip-b">P-FET</b>blocks a reversed supply</li>
            <li><b className="ip-b">inrush</b>ramps the turn-on surge into the caps</li>
          </ul>
          <svg viewBox="0 0 300 60" className="ip-mini">
            <line className="ip-axis" x1="8" y1="48" x2="292" y2="48" />
            <path className="ip-spk" fill="none" d={spike(24, 96, 48, 14)} />
            <path className="ip-rmp" fill="none" d={ramp(150, 288, 48, 18)} />
          </svg>
        </div>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.ip{display:block;}
.ip-scene{display:block;width:100%;height:auto;overflow:visible;}
.ip-w{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;}
.ip-blk{fill:var(--color-navy-dark,#1a1a2e);stroke:var(--color-command-gold,#c8963e);stroke-width:2;}
.ip-part{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;fill:var(--color-command-gold,#c8963e);font-size:13px;}
.ip-lbl{font-family:var(--font-mono,"Space Mono",monospace);fill:var(--color-muted,#aaa);font-size:11px;}
.ip-v{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;fill:var(--color-text,#e8e8e8);font-size:15px;}
.ip-gnd{stroke:var(--color-panel-border,#3a3f50);stroke-width:2;}
.ip-axis{stroke:var(--color-panel-border,#3a3f50);stroke-width:1.5;fill:none;}
.ip-spk{stroke:var(--color-alert-red,#ef5350);stroke-width:2;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:4 3;opacity:.8;}
.ip-rmp{stroke:var(--color-status-green,#66bb6a);stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;}
.ip-cap{font-family:var(--font-mono,"Space Mono",monospace);fill:var(--color-muted,#aaa);font-size:11px;}

/* phone reflow */
.ip-list{display:none;flex-direction:column;gap:.7rem;}
@media (max-width:520px){ .ip-scene{display:none;} .ip-list{display:flex;} }
.ip-list ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.45rem;text-align:left;}
.ip-list li{font-family:var(--font-mono,"Space Mono",monospace);font-size:.85rem;color:var(--color-muted,#aaa);display:flex;align-items:baseline;gap:.6rem;}
.ip-b{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;color:var(--color-command-gold,#c8963e);font-size:1rem;min-width:3.6rem;}
.ip-mini{display:block;width:100%;height:auto;overflow:visible;max-width:280px;margin:0 auto;}

/* Tier-B reveal off the frame's armed/in contract (settled under reduced-motion). */
.dgfrm.armed .ip-rmp{opacity:0;}
.dgfrm.armed.in .ip-rmp{opacity:1;transition:opacity .6s ease .18s;}
@media (prefers-reduced-motion:reduce){ .dgfrm .ip-rmp{opacity:1!important;} }
`;
