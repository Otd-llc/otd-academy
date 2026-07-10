// Power sequencing (v2). Power & Batteries cluster. Owner-picked Q2 (staggered
// soft-start ramps + the "rail 1 good" trigger).
//
// Teaching point (power-sequencing): some chips need their rails to come up in a
// set order, and each rail should soft-start (ramp gently) rather than switch on
// instantly. Rail 1 ramps up and holds; when it reaches its good level, that is
// what starts rail 2's own soft-start ramp. Gold = the first rail, blue = the
// second, green = the "good" trigger.
//
// Landscape time chart; reflows on a phone to a compact chart + a fact strip.
// Token-only color (re-themes in light + print).
import { DiagramFrame } from "./DiagramFrame";

const X0 = 70, X1 = 460, Y0 = 46, Y1 = 178;
const tx = (t: number) => X0 + t * (X1 - X0);
// soft-start ramp: flat at yBase until t0, S-rise to yTop by t1, flat after
function rail(t0: number, t1: number, yTop: number): string {
  const a = tx(t0), b = tx(t1), m = (a + b) / 2;
  return `M${tx(0)},${Y1} L${a},${Y1} C${m},${Y1} ${m},${yTop} ${b},${yTop} L${tx(1)},${yTop}`;
}
const RAIL1_TOP = 74, RAIL2_TOP = 118, GOOD_T = 0.34;

// phone mini geometry
function mrail(t0: number, t1: number, yTop: number): string {
  const px = (t: number) => 8 + t * 284;
  const a = px(t0), b = px(t1), m = (a + b) / 2;
  return `M${px(0)},72 L${a},72 C${m},72 ${m},${yTop} ${b},${yTop} L${px(1)},${yTop}`;
}

export function PowerSequencing({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="POWER SEQUENCING"
      tone="gold"
      title="Rails come up in order, one after another"
      ariaLabel="Power sequencing: two rails coming up in order over time, with voltage on the vertical axis. Rail 1, in gold, ramps up first with a gentle soft-start and holds. When it reaches its good level, marked by a green dot and a dashed line, rail 2, in blue, begins its own soft-start ramp. Each rail comes up gently and in order rather than all at once."
      caption={caption}
      defaultCaption="The first rail ramps up and reaches good; that is what starts the second rail's soft-start."
    >
      <style>{CSS}</style>

      <div className="sq">
        {/* desktop / print: the time chart */}
        <svg className="sq-scene" viewBox="0 0 500 210" aria-hidden="true">
          <line className="sq-ax" x1={X0} y1={Y0 - 6} x2={X0} y2={Y1} />
          <line className="sq-ax" x1={X0} y1={Y1} x2={X1 + 6} y2={Y1} />
          <text className="sq-ttl" x={X0 - 40} y={(Y0 + Y1) / 2} textAnchor="middle" transform={`rotate(-90 ${X0 - 40} ${(Y0 + Y1) / 2})`}>voltage</text>
          <text className="sq-ttl" x={(X0 + X1) / 2} y={Y1 + 22} textAnchor="middle">time</text>
          {/* the "rail 1 good" trigger */}
          <line className="sq-good" x1={tx(0.4)} y1={Y0} x2={tx(0.4)} y2={Y1} />
          <circle className="sq-dot" cx={tx(GOOD_T)} cy={RAIL1_TOP} r="4.5" />
          <text className="sq-goodt" x={tx(0.4)} y={Y0 - 2} textAnchor="middle">rail 1 good</text>
          {/* the two rails */}
          <path className="sq-r1" fill="none" d={rail(0.06, GOOD_T, RAIL1_TOP)} />
          <path className="sq-r2" fill="none" d={rail(0.46, 0.74, RAIL2_TOP)} />
          <text className="sq-l1" x={tx(0.2)} y="62" textAnchor="middle">rail 1</text>
          <text className="sq-l2" x={tx(0.78)} y={RAIL2_TOP - 10} textAnchor="middle">rail 2</text>
        </svg>

        {/* phone: compact chart + fact strip */}
        <div className="sq-list" aria-hidden="true">
          <svg viewBox="0 0 300 90" className="sq-mini">
            <line className="sq-good" x1={8 + 0.4 * 284} y1="6" x2={8 + 0.4 * 284} y2="84" />
            <path className="sq-r1" fill="none" d={mrail(0.06, GOOD_T, 20)} />
            <path className="sq-r2" fill="none" d={mrail(0.46, 0.74, 44)} />
            <circle className="sq-dot" cx={8 + GOOD_T * 284} cy="20" r="4" />
          </svg>
          <ol className="sq-steps">
            <li><b className="sq-b1">rail 1</b> soft-starts first, then holds</li>
            <li>its <b className="sq-bg">good</b> signal then starts</li>
            <li><b className="sq-b2">rail 2</b>, which soft-starts too</li>
          </ol>
        </div>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.sq{display:block;}
.sq-scene{display:block;width:100%;height:auto;overflow:visible;}
.sq-ax{stroke:var(--color-panel-border,#3a3f50);stroke-width:1.5;fill:none;}
.sq-r1{stroke:var(--color-command-gold,#c8963e);stroke-width:3.5;stroke-linecap:round;stroke-linejoin:round;}
.sq-r2{stroke:var(--color-signal-blue,#4a8fff);stroke-width:3.5;stroke-linecap:round;stroke-linejoin:round;}
.sq-good{stroke:var(--color-gold-light,#e8b865);stroke-width:1.5;stroke-dasharray:5 4;fill:none;}
.sq-dot{fill:var(--color-status-green,#66bb6a);}
.sq-ttl{font-family:var(--font-mono,"Space Mono",monospace);fill:var(--color-muted,#aaa);font-size:12px;}
.sq-goodt{font-family:var(--font-mono,"Space Mono",monospace);fill:var(--color-status-green,#66bb6a);font-size:11px;font-weight:700;}
.sq-l1{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;fill:var(--color-command-gold,#c8963e);font-size:14px;}
.sq-l2{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;fill:var(--color-signal-blue,#4a8fff);font-size:14px;}

/* phone reflow */
.sq-list{display:none;flex-direction:column;gap:.7rem;}
@media (max-width:520px){ .sq-scene{display:none;} .sq-list{display:flex;} }
.sq-mini{display:block;width:100%;height:auto;overflow:visible;}
.sq-steps{margin:0;padding-left:1.2rem;display:flex;flex-direction:column;gap:.35rem;text-align:left;
  font-family:var(--font-mono,"Space Mono",monospace);font-size:.85rem;color:var(--color-muted,#aaa);line-height:1.4;}
.sq-steps b{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:1em;}
.sq-b1{color:var(--color-command-gold,#c8963e);}
.sq-b2{color:var(--color-signal-blue,#4a8fff);}
.sq-bg{color:var(--color-status-green,#66bb6a);}

/* Tier-B reveal off the frame's armed/in contract (settled under reduced-motion). */
.dgfrm.armed .sq-r2{opacity:0;}
.dgfrm.armed.in .sq-r2{opacity:1;transition:opacity .6s ease .25s;}
@media (prefers-reduced-motion:reduce){ .dgfrm .sq-r2{opacity:1!important;} }
`;
