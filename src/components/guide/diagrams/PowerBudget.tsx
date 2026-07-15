// Power-budget diagram (V3 arrow-chain, owner-approved 2026-07-09).
//
// Teaching point: a 3.3 V rail feeds several loads; sum their current, add a
// margin, then round up to a real source. The rail across the top taps four
// loads (80 + 120 + 30 + 10 = 240 mA); the chain below turns that sum into the
// source size: 240 mA, +30% margin -> 312 mA needed, round up -> a 500 mA source.
// Numbers are illustrative but satisfy the lesson's I_supply >= 1.3 x I_total.
//
// v2: full HTML/CSS (no SVG text), so every label is real clamped px that reflows
// (loads -> 2x2 grid, chain -> vertical) on a phone instead of shrinking. Landscape
// on desktop. Token-only color throughout, so it re-themes in light + print.
import { DiagramFrame } from "./DiagramFrame";

const LOADS: [string, number][] = [
  ["MCU", 80],
  ["Radio TX", 120],
  ["Sensors", 30],
  ["LEDs", 10],
];

function Arrow({ tag }: { tag: string }) {
  return (
    <div className="pbud-arrow">
      <span className="pbud-atag">{tag}</span>
      <svg className="pbud-aico" viewBox="0 0 40 16" aria-hidden="true">
        <path d="M3,8 L34,8 M27,3 L34,8 L27,13" />
      </svg>
    </div>
  );
}

export function PowerBudget({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="POWER BUDGET"
      tone="gold"
      title="Add the loads, add margin, size the supply"
      ariaLabel="A power budget: a 3.3 V rail feeds four loads (MCU 80 mA, Radio TX 120 mA, sensors 30 mA, LEDs 10 mA) that sum to 240 mA. Adding a 30 percent margin gives 312 mA needed, so you round up to a 500 mA source."
      caption={caption}
      defaultCaption="Sum every load on the rail, add margin for the peaks you missed, then round up to a real source."
    >
      <style>{CSS}</style>

      <div className="pbud">
        <div className="pbud-railwrap">
          <span className="pbud-raillabel">3.3 V rail</span>
          <ul className="pbud-railrow">
            {LOADS.map(([n, ma]) => (
              <li className="pbud-load" key={n}>
                <span className="pbud-dot" aria-hidden="true" />
                <span className="pbud-lname">{n}</span>
                <span className="pbud-lma">
                  {ma}
                  <i>mA</i>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="pbud-chain">
          <div className="pbud-node">
            <span className="pbud-nlabel">loads</span>
            <span className="pbud-nval">
              240<i>mA</i>
            </span>
          </div>
          <Arrow tag="+30% margin" />
          <div className="pbud-node">
            <span className="pbud-nlabel">needed</span>
            <span className="pbud-nval">
              312<i>mA</i>
            </span>
          </div>
          <Arrow tag="round up" />
          <div className="pbud-node pbud-node--answer">
            <span className="pbud-nlabel">supply</span>
            <span className="pbud-nval pbud-nval--big">
              500<i>mA</i>
            </span>
          </div>
        </div>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.pbud{display:flex;flex-direction:column;gap:clamp(1.2rem,4.5vw,1.9rem);}

/* ── rail with tapped loads ── */
.pbud-raillabel{display:block;text-align:left;font-family:var(--font-mono,"Space Mono",monospace);
  font-size:clamp(.8rem,2.2vw,.88rem);color:var(--color-muted,#aaa);}
.pbud-railrow{position:relative;display:flex;gap:.4rem;list-style:none;margin:.35rem 0 0;padding:0;}
.pbud-railrow::before{content:"";position:absolute;top:8px;left:2%;right:2%;height:5px;border-radius:3px;
  background:var(--color-command-gold,#c8963e);}
/* li reserves the rail + stub zone with its OWN padding-top, so the dot/stub sit
   ABOVE the name (both live in li space) instead of landing on it. */
.pbud-load{flex:1 1 0;position:relative;text-align:center;min-width:0;padding-top:44px;}
.pbud-load .pbud-dot{position:absolute;top:5px;left:50%;transform:translateX(-50%);
  width:11px;height:11px;border-radius:50%;background:var(--color-command-gold,#c8963e);}
.pbud-load::before{content:"";position:absolute;top:16px;left:50%;transform:translateX(-50%);
  width:2px;height:24px;background:var(--color-panel-border,#3a3f50);}
.pbud-lname{display:block;font-family:var(--font-mono,"Space Mono",monospace);
  font-size:clamp(.85rem,2.3vw,.95rem);color:var(--color-muted,#aaa);line-height:1.25;}
.pbud-lma{display:block;font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;
  font-size:clamp(1.1rem,3vw,1.4rem);color:var(--color-text,#e8e8e8);line-height:1.15;}
.pbud-lma i{font-style:normal;font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;
  font-size:.6em;color:var(--color-muted,#aaa);margin-left:2px;letter-spacing:.02em;}

/* ── sum -> margin -> source chain ── */
.pbud-chain{display:flex;align-items:center;justify-content:center;gap:clamp(.3rem,1.6vw,.75rem);}
.pbud-node{display:flex;flex-direction:column;align-items:center;gap:.15rem;padding:.5rem .75rem;
  border:1px solid var(--color-panel-border,#3a3f50);border-radius:6px;
  background:var(--color-diagram-surface,#1f2438);min-width:0;}
.pbud-node--answer{border-color:var(--color-gold-light,#e8b865);}
.pbud-nlabel{font-family:var(--font-mono,"Space Mono",monospace);
  font-size:clamp(.72rem,2vw,.8rem);color:var(--color-muted,#aaa);}
.pbud-nval{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;
  font-size:clamp(1.25rem,3.6vw,1.65rem);color:var(--color-command-gold,#c8963e);line-height:1;}
.pbud-nval i{font-style:normal;font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;
  font-size:.5em;color:var(--color-muted,#aaa);margin-left:3px;letter-spacing:.02em;}
.pbud-nval--big{font-size:clamp(1.8rem,5.2vw,2.6rem);color:var(--color-gold-light,#e8b865);}
.pbud-arrow{display:flex;flex-direction:column;align-items:center;gap:.25rem;flex:none;}
.pbud-atag{font-family:var(--font-mono,"Space Mono",monospace);white-space:nowrap;
  font-size:clamp(.68rem,1.9vw,.76rem);color:var(--color-muted,#aaa);}
.pbud-aico{width:clamp(30px,7vw,44px);height:auto;display:block;}
.pbud-aico path{fill:none;stroke:var(--color-gold-light,#e8b865);stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}

/* ── phone reflow: loads -> 2x2 tapped cards, chain -> vertical ── */
@container (max-width:520px){
  .pbud-railrow{flex-wrap:wrap;gap:.6rem .5rem;padding-top:0;}
  .pbud-railrow::before{display:none;}
  .pbud-load{flex:1 1 42%;padding:.55rem .5rem;border:1px solid var(--color-panel-border,#3a3f50);
    border-top:3px solid var(--color-command-gold,#c8963e);border-radius:5px;}
  .pbud-load .pbud-dot,.pbud-load::before{display:none;}
  .pbud-chain{flex-direction:column;gap:.55rem;}
  .pbud-arrow{flex-direction:row;gap:.45rem;}
  .pbud-aico{transform:rotate(90deg);width:34px;}
}

/* Tier-B reveal off the frame's armed/in contract (settled under reduced-motion). */
.dgfrm.armed .pbud-railwrap,.dgfrm.armed .pbud-chain{opacity:0;transform:translateY(6px);}
.dgfrm.armed.in .pbud-railwrap{opacity:1;transform:none;transition:opacity .55s ease,transform .55s cubic-bezier(.2,.7,.2,1);}
.dgfrm.armed.in .pbud-chain{opacity:1;transform:none;transition:opacity .5s ease .12s,transform .5s ease .12s;}
@media (prefers-reduced-motion:reduce){
  .dgfrm .pbud-railwrap,.dgfrm .pbud-chain{opacity:1!important;transform:none!important;transition:none!important;}
}
`;
