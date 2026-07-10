// A bus crossing an isolation barrier (v2). Communication & Interfaces cluster.
// Owner-picked O2 (10-option round): the signal crosses, the grounds never join.
//
// Teaching point: a digital isolator carries the bits across an insulating
// barrier so two parts trade data with no direct electrical connection between
// them. The signal crosses (through an isolator, drawn as a small capacitor gap),
// but each side keeps its own ground, GND A and GND B, with no wire joining them.
// Cutting that shared ground is what breaks a ground loop and keeps a fault on
// one side off the other.
//
// Landscape desktop/print: side A and side B either side of a shaded barrier, a
// signal crossing, two separate grounds with a broken "no connection" path.
// REFLOWS on a phone to stacked side cards around a barrier divider. Token-only
// color: gold = side A + the signal, blue = the isolated side B, red = the
// deliberately-absent ground connection.
import { DiagramFrame } from "./DiagramFrame";

const BX = 300; // barrier centre

function Gnd({ x, y }: { x: number; y: number }) {
  return (
    <>
      <line className="iso-gnl" x1={x} y1={y} x2={x} y2={y + 6} />
      <line className="iso-gnl" x1={x - 11} y1={y + 6} x2={x + 11} y2={y + 6} />
      <line className="iso-gnl" x1={x - 7} y1={y + 11} x2={x + 7} y2={y + 11} />
      <line className="iso-gnl" x1={x - 3} y1={y + 16} x2={x + 3} y2={y + 16} />
    </>
  );
}

// A signal line crossing the barrier through a capacitor-gap isolator.
function CrossCap({ xL, xR, y }: { xL: number; xR: number; y: number }) {
  return (
    <>
      <line className="iso-g" x1={xL} y1={y} x2={BX - 6} y2={y} />
      <line className="iso-plate" x1={BX - 6} y1={y - 7} x2={BX - 6} y2={y + 7} />
      <line className="iso-plate" x1={BX + 6} y1={y - 7} x2={BX + 6} y2={y + 7} />
      <line className="iso-g" x1={BX + 6} y1={y} x2={xR} y2={y} />
    </>
  );
}

export function CommsIsolationBarrier({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="COMMS · ISOLATION"
      tone="gold"
      title="Two grounds, never joined"
      ariaLabel="A digital bus crossing an isolation barrier. On the left is side A, a computer; on the right, side B, an isolated sensor. A signal crosses the barrier through an isolator, drawn as a small capacitor gap, so the data still gets across. But the two sides keep separate grounds, GND A and GND B, with no wire joining them, so there is no direct electrical path from one side to the other. That is what breaks a ground loop and keeps a fault on one side off the other."
      caption={caption}
      defaultCaption="The signal crosses the isolation barrier, but the two grounds stay separate: no direct electrical connection between the sides."
    >
      <style>{CSS}</style>

      {/* desktop / print: barrier crossing + two grounds */}
      <svg className="iso-scene" viewBox="0 0 600 244" aria-hidden="true">
        <text className="iso-lbl" x={BX} y={30} textAnchor="middle">ISOLATION BARRIER</text>
        <rect className="iso-barrier" x={BX - 24} y={40} width={48} height={192} rx={4} />
        <line className="iso-barrier-l" x1={BX} y1={40} x2={BX} y2={232} />

        <rect className="iso-box" x={48} y={80} width={116} height={72} rx={6} />
        <text className="iso-bt" x={106} y={110} textAnchor="middle">SIDE A</text>
        <text className="iso-bsub" x={106} y={126} textAnchor="middle">computer</text>
        <rect className="iso-box-b" x={436} y={80} width={116} height={72} rx={6} />
        <text className="iso-bt" x={494} y={110} textAnchor="middle">SIDE B</text>
        <text className="iso-bsub" x={494} y={126} textAnchor="middle">isolated sensor</text>

        <CrossCap xL={164} xR={436} y={112} />
        <text className="iso-sig" x={232} y={106} textAnchor="middle">SIGNAL</text>

        {/* two separate grounds */}
        <line className="iso-g" x1={106} y1={152} x2={106} y2={186} />
        <Gnd x={106} y={186} />
        <text className="iso-gl" x={106} y={220} textAnchor="middle">GND A</text>
        <line className="iso-b" x1={494} y1={152} x2={494} y2={186} />
        <Gnd x={494} y={186} />
        <text className="iso-gl" x={494} y={220} textAnchor="middle">GND B</text>

        {/* the ground connection that is deliberately absent */}
        <line className="iso-noconn" x1={128} y1={194} x2={BX - 30} y2={194} />
        <line className="iso-noconn" x1={BX + 30} y1={194} x2={472} y2={194} />
        <path className="iso-x" d={`M${BX - 12},186 l24,16 M${BX + 12},186 l-24,16`} />
        <text className="iso-no" x={BX} y={224} textAnchor="middle">NO CONNECTION</text>
      </svg>

      {/* phone: stacked side cards around a barrier divider */}
      <div className="iso-list" aria-hidden="true">
        <div className="iso-card iso-card-a">
          <span className="iso-card-hd">SIDE A</span>
          <span className="iso-card-sub">computer</span>
          <span className="iso-card-gnd iso-gnd-a">GND A</span>
        </div>
        <div className="iso-div">
          <span className="iso-div-t">ISOLATION BARRIER</span>
          <span className="iso-div-ok">signal crosses</span>
          <span className="iso-div-no">grounds do not</span>
        </div>
        <div className="iso-card iso-card-b">
          <span className="iso-card-hd">SIDE B</span>
          <span className="iso-card-sub">isolated sensor</span>
          <span className="iso-card-gnd iso-gnd-b">GND B</span>
        </div>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.iso-scene{display:block;width:100%;height:auto;overflow:visible;}
.iso-lbl{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:11px;letter-spacing:.05em;fill:var(--color-muted,#aaa);text-transform:uppercase;}
.iso-barrier{fill:var(--color-command-gold,#c8963e);opacity:.10;}
.iso-barrier-l{stroke:var(--color-command-gold,#c8963e);stroke-width:1.6;stroke-dasharray:5 4;fill:none;opacity:.7;}
.iso-box{fill:var(--color-navy-dark,#1a1a2e);stroke:var(--color-command-gold,#c8963e);stroke-width:2;}
.iso-box-b{fill:var(--color-navy-dark,#1a1a2e);stroke:var(--color-signal-blue,#4a8fff);stroke-width:2;}
.iso-bt{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:13px;fill:var(--color-title,#f1ece0);}
.iso-bsub{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:9px;fill:var(--color-muted,#aaa);letter-spacing:.02em;}
.iso-g{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2;stroke-linecap:round;}
.iso-b{fill:none;stroke:var(--color-signal-blue,#4a8fff);stroke-width:2;stroke-linecap:round;}
.iso-gnl{fill:none;stroke:var(--color-muted,#aaa);stroke-width:2;stroke-linecap:round;}
.iso-plate{stroke:var(--color-command-gold,#c8963e);stroke-width:2.4;stroke-linecap:round;}
.iso-sig{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:11px;fill:var(--color-command-gold,#c8963e);}
.iso-gl{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:11px;fill:var(--color-muted,#aaa);}
.iso-noconn{stroke:var(--color-muted,#aaa);stroke-width:1.6;stroke-dasharray:4 4;opacity:.45;}
.iso-x{fill:none;stroke:var(--color-alert-red,#ef5350);stroke-width:2.4;stroke-linecap:round;}
.iso-no{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:11px;letter-spacing:.04em;fill:var(--color-alert-red,#ef5350);text-transform:uppercase;}

/* phone reflow */
.iso-list{display:none;flex-direction:column;align-items:center;gap:0;}
@media (max-width:520px){ .iso-scene{display:none;} .iso-list{display:flex;} }
.iso-card{display:flex;flex-direction:column;align-items:center;gap:.15rem;padding:.7rem 1rem;border-radius:8px;width:100%;max-width:260px;
  background:var(--color-navy-dark,#1a1a2e);}
.iso-card-a{box-shadow:inset 0 0 0 1.5px var(--color-command-gold,#c8963e);}
.iso-card-b{box-shadow:inset 0 0 0 1.5px var(--color-signal-blue,#4a8fff);}
.iso-card-hd{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:1rem;color:var(--color-title,#f1ece0);}
.iso-card-sub{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.68rem;color:var(--color-muted,#aaa);}
.iso-card-gnd{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.72rem;margin-top:.25rem;}
.iso-gnd-a{color:var(--color-command-gold,#c8963e);}
.iso-gnd-b{color:var(--color-signal-blue,#4a8fff);}
.iso-div{display:flex;flex-direction:column;align-items:center;gap:.15rem;padding:.55rem 0;}
.iso-div-t{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.68rem;letter-spacing:.06em;text-transform:uppercase;color:var(--color-muted,#aaa);}
.iso-div-ok{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.8rem;color:var(--color-command-gold,#c8963e);}
.iso-div-no{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.8rem;color:var(--color-alert-red,#ef5350);}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .iso-x{opacity:0;}
.dgfrm.armed.in .iso-x{opacity:1;transition:opacity .5s ease .35s;}
@media (prefers-reduced-motion:reduce){ .dgfrm .iso-x{opacity:1!important;} }
`;
