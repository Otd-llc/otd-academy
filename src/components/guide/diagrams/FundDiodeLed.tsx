// Reverse-polarity protection: a series diode passes the correct supply and
// blocks a reversed one (v2). Fundamentals cluster. Owner-picked F4.
//
// Teaching point: a diode conducts one way only. Put one in series with the
// power input and it protects the board: connect the supply the right way round
// and it passes; connect it backwards and the same diode blocks. The diode
// stays put; the supply polarity is what changes.
//
// Landscape desktop/print: two panels side by side, correct-powers over
// reversed-blocks. REFLOWS to two stacked cards on a phone. Token-only color;
// green marks the working case, red the blocked fault.
import { DiagramFrame } from "./DiagramFrame";

// one protection panel in local coords (0..234 x 0..104): supply → diode → load
function Panel({ forward }: { forward: boolean }) {
  return (
    <>
      <rect className="dl-box" x={8} y={30} width={46} height={48} rx={4} />
      <text className={forward ? "dl-plus" : "dl-minus"} x={31} y={61} textAnchor="middle">
        {forward ? "+" : "−"}
      </text>
      <line className="dl-wire" x1={54} y1={54} x2={92} y2={54} />
      {/* the diode (same orientation in both panels) */}
      <path className="dl-diode" d="M94,42 L94,66 L118,54 Z" />
      <line className="dl-bar" x1={118} y1={42} x2={118} y2={66} />
      <line className="dl-wire" x1={118} y1={54} x2={162} y2={54} />
      {forward ? (
        <>
          <line className="dl-flow" x1={126} y1={54} x2={156} y2={54} />
          <path className="dl-flow" fill="none" d="M148,49 L156,54 L148,59" />
        </>
      ) : (
        <>
          <line className="dl-x" x1={92} y1={40} x2={120} y2={68} />
          <line className="dl-x" x1={120} y1={40} x2={92} y2={68} />
        </>
      )}
      <rect className={forward ? "dl-load-on" : "dl-load-off"} x={162} y={30} width={54} height={48} rx={4} />
      <text className={forward ? "dl-load-t" : "dl-load-off-t"} x={189} y={59} textAnchor="middle">LOAD</text>
    </>
  );
}

export function FundDiodeLed({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="FUNDAMENTALS · DIODES"
      tone="gold"
      title="Reverse-polarity protection"
      ariaLabel="Reverse-polarity protection with a series diode. In the top case the supply is connected the correct way round, positive in: the diode is forward-biased, current flows through it, and the load is powered. In the bottom case the supply is reversed, negative in: the same diode is now reverse-biased and blocks, shown by a red cross, so no current reaches the load. A diode passes current one way only, so a series diode on the power input protects the board from a backwards connection."
      caption={caption}
      defaultCaption="A diode passes current one way. In series on the power input it passes the correct supply and blocks a reversed one."
    >
      <style>{CSS}</style>

      {/* desktop / print: two panels */}
      <svg className="dl-scene" viewBox="0 0 520 230" aria-hidden="true">
        <text className="dl-lbl dl-good" x="150" y="46" textAnchor="middle">CORRECT · POWERS</text>
        <g transform="translate(35,70)">
          <Panel forward />
        </g>
        <line className="dl-div" x1="260" y1="60" x2="260" y2="205" />
        <text className="dl-lbl dl-bad" x="385" y="46" textAnchor="middle">REVERSED · BLOCKS</text>
        <g transform="translate(270,70)">
          <Panel forward={false} />
        </g>
      </svg>

      {/* phone: two stacked cards */}
      <ul className="dl-list" aria-hidden="true">
        <li>
          <span className="dl-li-lbl dl-good">CORRECT · POWERS</span>
          <svg viewBox="0 0 234 104" className="dl-mini">
            <Panel forward />
          </svg>
        </li>
        <li>
          <span className="dl-li-lbl dl-bad">REVERSED · BLOCKS</span>
          <svg viewBox="0 0 234 104" className="dl-mini">
            <Panel forward={false} />
          </svg>
        </li>
      </ul>
    </DiagramFrame>
  );
}

const CSS = `
.dl-scene{display:block;width:100%;height:auto;overflow:visible;}
.dl-wire{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2.5;stroke-linecap:round;}
.dl-flow{fill:none;stroke:var(--color-signal-blue,#4a8fff);stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;}
.dl-diode{fill:var(--color-diagram-surface,#1f2438);stroke:var(--color-command-gold,#c8963e);stroke-width:2;}
.dl-bar{stroke:var(--color-command-gold,#c8963e);stroke-width:3;stroke-linecap:round;}
.dl-x{stroke:var(--color-alert-red,#ef5350);stroke-width:3;stroke-linecap:round;}
.dl-box{fill:var(--color-diagram-surface,#1f2438);stroke:var(--color-command-gold,#c8963e);stroke-width:2;}
.dl-load-on{fill:var(--color-diagram-surface,#1f2438);stroke:var(--color-command-gold,#c8963e);stroke-width:2;}
.dl-load-off{fill:var(--color-diagram-surface,#1f2438);stroke:var(--color-panel-border,#3a3f50);stroke-width:1.5;}
.dl-plus{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:20px;fill:var(--color-command-gold,#c8963e);}
.dl-minus{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:20px;fill:var(--color-alert-red,#ef5350);}
.dl-load-t{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:12px;fill:var(--color-text,#e8e8e8);}
.dl-load-off-t{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:12px;fill:var(--color-muted,#aaa);}
.dl-div{stroke:var(--color-panel-border,#3a3f50);stroke-width:1.5;stroke-dasharray:4 4;}
.dl-lbl{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:13px;letter-spacing:.08em;}
.dl-good{fill:var(--color-status-green,#66bb6a);color:var(--color-status-green,#66bb6a);}
.dl-bad{fill:var(--color-alert-red,#ef5350);color:var(--color-alert-red,#ef5350);}

/* phone reflow */
.dl-list{display:none;list-style:none;margin:0;padding:0;flex-direction:column;gap:.6rem;}
@container (max-width:520px){ .dl-scene{display:none;} .dl-list{display:flex;} }
.dl-list li{display:flex;flex-direction:column;gap:.4rem;padding:.7rem .9rem;border-radius:6px;text-align:left;
  }
.dl-mini{display:block;width:100%;max-width:280px;height:auto;margin:0 auto;overflow:visible;}
.dl-li-lbl{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.82rem;letter-spacing:.08em;}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .dl-flow,.dgfrm.armed .dl-x{opacity:0;}
.dgfrm.armed.in .dl-flow{opacity:1;transition:opacity .5s ease .2s;}
.dgfrm.armed.in .dl-x{opacity:1;transition:opacity .5s ease .35s;}
@media (prefers-reduced-motion:reduce){ .dgfrm .dl-flow,.dgfrm .dl-x{opacity:1!important;} }
`;
