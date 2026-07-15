// The 10-20 system's midline spacing as a responsive diagram (v2).
//
// Teaching point: the name "10-20" is literal. Walking the midline from the
// nasion (front) to the inion (back), the electrodes sit at 10%, then 20%, 20%,
// 20%, 20%, then 10% of that measured distance. Proportional spacing means the
// same name lands on the same brain region across different head sizes. Cz, the
// vertex, is the midpoint.
//
// v2 landscape reflow: the old version stacked the chain top-to-bottom (portrait
// ~0.70), which gapped the field-guide PDF. This lays the midline over a
// head-profile DOME (nasion -> vertex -> inion) with faint spokes from the
// measuring centre dividing it into the proportional 10/20/20/20/20/10 sectors
// (a protractor read of "why it's 10-20"). The %s are Saira numerals set into
// each sector.
//
// Because a curved layout carrying labels can't be pure CSS, the dome is an SVG
// on desktop/print (the surface the exporter screenshots, ~1.5 landscape) and
// REFLOWS to a plain vertical HTML list on a narrow phone (real px, no shrinking
// SVG text) — honouring directive 1. SVG color is token-only via CSS classes
// (never a fill="#..." presentation attribute), so it re-themes under
// data-theme="light"; labels are sized to clear the ~9pt print floor.
import { DiagramFrame } from "./DiagramFrame";

// Phone-reflow list (the proven vertical chain).
type Item =
  | { kind: "cap" | "node"; name: string; note?: string; hi?: boolean }
  | { kind: "seg"; pct: string };

const CHAIN: Item[] = [
  { kind: "cap", name: "Nasion", note: "front landmark" },
  { kind: "seg", pct: "10%" },
  { kind: "node", name: "Fpz" },
  { kind: "seg", pct: "20%" },
  { kind: "node", name: "Fz" },
  { kind: "seg", pct: "20%" },
  { kind: "node", name: "Cz", note: "vertex", hi: true },
  { kind: "seg", pct: "20%" },
  { kind: "node", name: "Pz" },
  { kind: "seg", pct: "20%" },
  { kind: "node", name: "Oz" },
  { kind: "seg", pct: "10%" },
  { kind: "cap", name: "Inion", note: "back landmark" },
];

export function TenTwentyMidline({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="EEG ELECTRODES · 10-20"
      tone="gold"
      title="Why it's called the 10-20 system"
      ariaLabel="The 10-20 system's midline spacing, drawn over a head-profile dome from the nasion at the front to the inion at the back. Measuring along that midline, the electrodes are placed at 10 percent (Fpz), then 20 percent (Fz), 20 percent (Cz, the vertex at the top of the head), 20 percent (Pz), 20 percent (Oz), then 10 percent to the inion. Those 10 and 20 percent steps give the system its name, and because they are proportional, the same electrode name lands on the same brain region across different head sizes."
      caption={caption}
      defaultCaption="Proportional spacing, not fixed centimetres, so the same name means the same brain region on any head."
    >
      <style>{CSS}</style>

      <div className="tt">
        {/* desktop / print: the protractor dome */}
        <div className="tt-arc">
          <svg className="tta-svg" viewBox="0 -18 400 205" role="presentation" aria-hidden="true">
            {/* nasion -> inion measured baseline */}
            <line className="tta-base" x1="50" y1="160" x2="350" y2="160" />
            {/* spokes from the measuring centre divide the dome into proportional sectors */}
            <line className="tta-spoke" x1="200" y1="160" x2="57.3" y2="113.7" />
            <line className="tta-spoke" x1="200" y1="160" x2="111.8" y2="38.7" />
            <line className="tta-spoke" x1="200" y1="160" x2="200" y2="10" />
            <line className="tta-spoke" x1="200" y1="160" x2="288.2" y2="38.7" />
            <line className="tta-spoke" x1="200" y1="160" x2="342.7" y2="113.7" />
            {/* scalp dome */}
            <path className="tta-scalp" d="M50,160 A150,150 0 0 1 350,160" />
            {/* proportional % per sector (Saira) */}
            <text className="tta-pct" x="83" y="128">10</text>
            <text className="tta-pct" x="104" y="80">20</text>
            <text className="tta-pct" x="163" y="52">20</text>
            <text className="tta-pct" x="237" y="52">20</text>
            <text className="tta-pct" x="296" y="80">20</text>
            <text className="tta-pct" x="317" y="128">10</text>
            {/* electrode beads + landmark dots */}
            <circle className="tta-bead" cx="57.3" cy="113.7" r="7" />
            <circle className="tta-bead" cx="111.8" cy="38.7" r="7" />
            <circle className="tta-bead-hi" cx="200" cy="10" r="8.5" />
            <circle className="tta-bead" cx="288.2" cy="38.7" r="7" />
            <circle className="tta-bead" cx="342.7" cy="113.7" r="7" />
            <circle className="tta-bead-hi" cx="50" cy="160" r="4" />
            <circle className="tta-bead-hi" cx="350" cy="160" r="4" />
            {/* names */}
            <text className="tta-nm" x="44" y="112" textAnchor="end">Fpz</text>
            <text className="tta-nm" x="104" y="34" textAnchor="end">Fz</text>
            <text className="tta-nm tta-nm-hi" x="200" y="-4" textAnchor="middle">Cz</text>
            <text className="tta-nm" x="296" y="34" textAnchor="start">Pz</text>
            <text className="tta-nm" x="356" y="112" textAnchor="start">Oz</text>
            {/* landmarks */}
            <text className="tta-land" x="50" y="178" textAnchor="middle">NASION</text>
            <text className="tta-land" x="350" y="178" textAnchor="middle">INION</text>
          </svg>
        </div>

        {/* phone: the vertical chain (real px, stacks) */}
        <ol className="tt-list" aria-hidden="true">
          {CHAIN.map((it, i) =>
            it.kind === "seg" ? (
              <li className="tt-seg" key={i}>
                <span className="tt-line" />
                <span className="tt-pct">{it.pct}</span>
                <span className="tt-line" />
              </li>
            ) : it.kind === "cap" ? (
              <li className="tt-cap" key={i}>
                {it.name}
                <span className="tt-note"> · {it.note}</span>
              </li>
            ) : (
              <li className={`tt-node${it.hi ? " tt-node-hi" : ""}`} key={i}>
                <span className="tt-dot" />
                <span className="tt-name">{it.name}</span>
                {it.note ? <span className="tt-note"> · {it.note}</span> : null}
              </li>
            ),
          )}
        </ol>
      </div>
    </DiagramFrame>
  );
}

// Token-driven with DARK literal fallbacks so a standalone / exporter render
// resolves; light values come only from the token override under data-theme.
const CSS = `
.tt-arc{max-width:27rem;margin:0 auto;}
.tta-svg{width:100%;height:auto;display:block;overflow:visible;}
.tta-base{stroke:var(--color-panel-border,#3a3f50);stroke-width:1.5;stroke-dasharray:3 4;opacity:.7;}
.tta-spoke{stroke:var(--color-panel-border,#3a3f50);stroke-width:1;opacity:.4;}
.tta-scalp{fill:none;stroke:var(--color-panel-border,#3a3f50);stroke-width:2.5;}
.tta-bead{fill:var(--color-deep-space,#08090d);stroke:var(--color-command-gold,#c8963e);stroke-width:2.5;}
.tta-bead-hi{fill:var(--color-command-gold,#c8963e);stroke:var(--color-command-gold,#c8963e);stroke-width:2.5;}
.tta-nm{fill:var(--color-title,#f1ece0);font-family:var(--font-display,"Bebas Neue",sans-serif);font-size:16px;letter-spacing:.02em;}
.tta-nm-hi{fill:var(--color-command-gold,#c8963e);}
.tta-land{fill:var(--color-command-gold,#c8963e);font-family:var(--font-mono,"Space Mono",monospace);font-size:12px;font-weight:700;letter-spacing:.1em;}
.tta-pct{fill:var(--color-gold-light,#e8b865);font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:18px;text-anchor:middle;dominant-baseline:middle;}

/* phone reflow: hidden by default, shown ≤520px */
.tt-list{display:none;list-style:none;margin:0;padding:0;flex-direction:column;align-items:center;}
@container (max-width:520px){
  .tt-arc{display:none;}
  .tt-list{display:flex;}
}
.tt-cap{padding:.4rem .8rem;border-radius:999px;background:var(--color-deep-space,#08090d);
  box-shadow:inset 0 0 0 1.5px var(--color-command-gold,#c8963e);color:var(--color-command-gold,#c8963e);
  font-family:var(--font-mono,"Space Mono",monospace);font-size:.82rem;font-weight:700;
  text-transform:uppercase;letter-spacing:.08em;}
.tt-seg{display:flex;flex-direction:column;align-items:center;gap:.15rem;}
.tt-line{width:2px;height:1rem;background:var(--color-command-gold,#c8963e);opacity:.4;}
.tt-pct{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:1rem;
  color:var(--color-gold-light,#e8b865);letter-spacing:.02em;}
.tt-node{display:flex;align-items:center;gap:.5rem;padding:.2rem 0;}
.tt-dot{width:.85rem;height:.85rem;border-radius:999px;flex:none;
  background:var(--color-deep-space,#08090d);box-shadow:inset 0 0 0 2px var(--color-command-gold,#c8963e);}
.tt-node-hi .tt-dot{background:var(--color-command-gold,#c8963e);}
.tt-name{color:var(--color-title,#f1ece0);font-family:var(--font-display,"Bebas Neue",sans-serif);
  font-size:1.15rem;letter-spacing:.02em;}
.tt-node-hi .tt-name{color:var(--color-command-gold,#c8963e);}
.tt-note{color:var(--color-muted,#aaa);font-family:var(--font-mono,"Space Mono",monospace);
  font-size:.9rem;letter-spacing:.02em;}

/* Tier-B reveal off the frame's armed/in contract: the beads + %s settle in.
   Gated behind .armed so reduced-motion / no-JS / exporter shows the final state. */
.dgfrm.armed .tta-bead,.dgfrm.armed .tta-bead-hi,.dgfrm.armed .tta-pct{opacity:0;}
.dgfrm.armed.in .tta-bead,.dgfrm.armed.in .tta-bead-hi,.dgfrm.armed.in .tta-pct{opacity:1;
  transition:opacity .5s ease;}
.dgfrm.armed .tt-list>*{opacity:0;transform:translateY(5px);}
.dgfrm.armed.in .tt-list>*{opacity:1;transform:none;transition:opacity .45s ease,transform .45s cubic-bezier(.2,.7,.2,1);}
@media (prefers-reduced-motion:reduce){
  .dgfrm .tta-bead,.dgfrm .tta-bead-hi,.dgfrm .tta-pct{opacity:1!important;}
  .dgfrm .tt-list>*{opacity:1!important;transform:none!important;}
}
`;
