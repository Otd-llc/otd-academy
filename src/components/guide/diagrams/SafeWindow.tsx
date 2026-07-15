// Lithium-cell safe voltage window (v2). Power & Batteries cluster.
// Owner-picked S2 (window + protection cutoffs "just outside").
//
// Teaching point (lithium-battery-safety): a single cell is safe between 3.0 V
// empty and 4.2 V full. The protection circuit trips JUST OUTSIDE that band, at
// about 2.5 V on discharge and 4.25 V on charge; beyond those cutoffs the cell is
// over-discharged or over-charged and can be damaged. Gold = safe, red = genuine
// hazard, dashed = the protection cutoff.
//
// Landscape voltage scale; reflows on a phone to a compact bar + an HTML rule
// strip so no label scales under the floor. Token-only color (re-themes in
// light + print).
import { DiagramFrame } from "./DiagramFrame";

// desktop voltage scale 2.4..4.4 V across x0..x1
const X0 = 64, X1 = 472, VA = 2.4, VB = 4.4;
const hx = (v: number) => X0 + ((v - VA) / (VB - VA)) * (X1 - X0);
// phone mini scale
const mxw = (v: number) => 6 + ((v - VA) / (VB - VA)) * 288;

export function SafeWindow({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="LIPO SAFETY"
      tone="gold"
      title="The safe voltage window of a lithium cell"
      ariaLabel="The safe voltage window of a single lithium cell, on a scale from 2.4 to 4.4 volts. The safe window, in gold, runs from 3.0 volts empty to 4.2 volts full. Just outside it the protection circuit trips, at about 2.5 volts on discharge and about 4.25 volts on charge. Beyond those cutoffs, in red, the cell is over-discharged or over-charged and can be damaged."
      caption={caption}
      defaultCaption="Safe between 3.0 V empty and 4.2 V full. The protection circuit trips just outside that band, before the cell is harmed."
    >
      <style>{CSS}</style>

      <div className="sw">
        {/* desktop / print: the voltage scale */}
        <svg className="sw-scene" viewBox="0 0 512 176" aria-hidden="true">
          {/* danger caps beyond the protection cutoffs */}
          <rect className="sw-dngr" x={hx(2.4)} y="74" width={hx(2.5) - hx(2.4)} height="36" rx="3" />
          <rect className="sw-dngr" x={hx(4.25)} y="74" width={hx(4.4) - hx(4.25)} height="36" rx="3" />
          {/* the safe window */}
          <rect className="sw-safe" x={hx(3.0)} y="74" width={hx(4.2) - hx(3.0)} height="36" />
          <text className="sw-in" x={(hx(3.0) + hx(4.2)) / 2} y="97" textAnchor="middle">SAFE WINDOW</text>
          {/* window-edge voltages */}
          <text className="sw-key" x={hx(3.0)} y="64" textAnchor="middle">3.0 V empty</text>
          <text className="sw-key" x={hx(4.2)} y="64" textAnchor="middle">4.2 V full</text>
          {/* protection cutoffs, just outside */}
          <line className="sw-cut" x1={hx(2.5)} y1="66" x2={hx(2.5)} y2="118" />
          <line className="sw-cut" x1={hx(4.25)} y1="66" x2={hx(4.25)} y2="118" />
          <text className="sw-red" x={hx(2.5)} y="134" textAnchor="middle">cutoff 2.5 V</text>
          <text className="sw-red" x={hx(4.25)} y="134" textAnchor="middle">cutoff 4.25 V</text>
          <text className="sw-note" x="256" y="162" textAnchor="middle">the protection circuit trips just outside the window</text>
        </svg>

        {/* phone: compact bar + rule strip */}
        <div className="sw-list" aria-hidden="true">
          <svg viewBox="0 0 300 34" className="sw-mini">
            <rect className="sw-dngr" x={mxw(2.4)} y="6" width={mxw(2.5) - mxw(2.4)} height="22" rx="2" />
            <rect className="sw-safe" x={mxw(3.0)} y="6" width={mxw(4.2) - mxw(3.0)} height="22" />
            <rect className="sw-dngr" x={mxw(4.25)} y="6" width={mxw(4.4) - mxw(4.25)} height="22" rx="2" />
            <line className="sw-cut" x1={mxw(2.5)} y1="2" x2={mxw(2.5)} y2="32" />
            <line className="sw-cut" x1={mxw(4.25)} y1="2" x2={mxw(4.25)} y2="32" />
          </svg>
          <ul className="sw-rules">
            <li><b className="sw-b-gold">3.0 - 4.2 V</b> the safe window</li>
            <li><b className="sw-b-red">below 3.0 V</b> over-discharge, cutoff 2.5 V</li>
            <li><b className="sw-b-red">above 4.2 V</b> over-charge, cutoff 4.25 V</li>
          </ul>
          <p className="sw-pnote">The protection circuit trips just outside the window, before the cell is harmed.</p>
        </div>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.sw{display:block;}
.sw-scene{display:block;width:100%;height:auto;overflow:visible;}
.sw-safe{fill:var(--color-command-gold,#c8963e);}
.sw-dngr{fill:var(--color-alert-red,#ef5350);opacity:.85;}
.sw-cut{stroke:var(--color-alert-red,#ef5350);stroke-width:2;stroke-dasharray:4 3;fill:none;}
.sw-in{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:13px;letter-spacing:.06em;fill:var(--color-deep-space,#08090d);}
.sw-key{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:15px;fill:var(--color-command-gold,#c8963e);}
.sw-red{font-family:var(--font-mono,"Space Mono",monospace);font-size:11px;fill:var(--color-alert-red,#ef5350);}
.sw-note{font-family:var(--font-mono,"Space Mono",monospace);font-size:12px;fill:var(--color-muted,#aaa);}

/* phone reflow */
.sw-list{display:none;flex-direction:column;gap:.7rem;}
@container (max-width:520px){ .sw-scene{display:none;} .sw-list{display:flex;} }
.sw-mini{display:block;width:100%;height:auto;overflow:visible;}
.sw-rules{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.4rem;text-align:left;}
.sw-rules li{font-family:var(--font-mono,"Space Mono",monospace);font-size:.86rem;color:var(--color-muted,#aaa);
  display:flex;align-items:baseline;gap:.5rem;}
.sw-rules b{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:1rem;flex:none;min-width:6.5rem;}
.sw-b-gold{color:var(--color-command-gold,#c8963e);}
.sw-b-red{color:var(--color-alert-red,#ef5350);}
.sw-pnote{margin:0;text-align:left;font-family:var(--font-serif,"Lora",serif);font-size:.86rem;color:var(--color-muted,#aaa);line-height:1.45;}

/* Tier-B reveal off the frame's armed/in contract (settled under reduced-motion). */
.dgfrm.armed .sw-safe{opacity:0;}
.dgfrm.armed.in .sw-safe{opacity:1;transition:opacity .55s ease .12s;}
@media (prefers-reduced-motion:reduce){ .dgfrm .sw-safe{opacity:1!important;} }
`;
