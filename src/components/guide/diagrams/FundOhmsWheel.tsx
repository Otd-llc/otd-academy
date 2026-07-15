// Ohm's law + power as two mnemonic triangles (v2). Fundamentals cluster.
// Owner-picked W2 ("two triangles").
//
// Teaching point: cover the quantity you want in a triangle and it shows the
// formula. Left triangle (V over I·R) gives Ohm's law and its rearrangements;
// right triangle (P over V·I) brings in power. A quantity on top is a product
// (V = I × R); a quantity on the bottom is a ratio (I = V ÷ R).
//
// Landscape desktop/print: the two triangles side by side. REFLOWS to stacked,
// full-width triangles on a phone so the letters never scale under the floor.
// Token-only color (dark literal fallbacks for the standalone/exporter render;
// light comes from the token override).
import { DiagramFrame } from "./DiagramFrame";

const TRIANGLES = [
  { top: "V", bl: "I", br: "R", cap: "OHM'S LAW" },
  { top: "P", bl: "V", br: "I", cap: "POWER" },
] as const;

function Triangle({ top, bl, br, cap }: { top: string; bl: string; br: string; cap: string }) {
  return (
    <svg className="ow-tri" viewBox="0 0 220 216" aria-hidden="true">
      <path className="ow-edge" d="M110,18 L20,180 L200,180 Z" />
      <line className="ow-div" x1="65" y1="100" x2="155" y2="100" />
      <line className="ow-div" x1="110" y1="100" x2="110" y2="180" />
      <text className="ow-sym" x="110" y="76" textAnchor="middle">{top}</text>
      <text className="ow-sym" x="65" y="156" textAnchor="middle">{bl}</text>
      <text className="ow-sym" x="155" y="156" textAnchor="middle">{br}</text>
      <text className="ow-cap" x="110" y="206" textAnchor="middle">{cap}</text>
    </svg>
  );
}

export function FundOhmsWheel({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="FUNDAMENTALS · OHM'S LAW"
      tone="gold"
      title="Ohm's law"
      ariaLabel="Ohm's law and electrical power drawn as two mnemonic triangles. In the left triangle, V sits on top with I and R below it: cover the quantity you want and read the rest, so V equals I times R, I equals V divided by R, and R equals V divided by I. The right triangle puts P on top with V and I below, giving power P equals V times I. A letter on top is a product; a letter on the bottom is a division."
      caption={caption}
      defaultCaption="Cover the quantity you want. Top times bottom, or top over bottom: V = I × R and P = V × I."
    >
      <style>{CSS}</style>

      <div className="ow">
        {TRIANGLES.map((t) => (
          <Triangle key={t.cap} {...t} />
        ))}
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.ow{display:flex;gap:1.75rem;justify-content:center;align-items:flex-start;}
.ow-tri{flex:1 1 0;width:100%;max-width:250px;height:auto;overflow:visible;display:block;}
.ow-edge{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2.5;stroke-linejoin:round;}
.ow-div{stroke:var(--color-panel-border,#3a3f50);stroke-width:1.5;}
.ow-sym{font-family:var(--font-display,"Bebas Neue",sans-serif);font-size:38px;fill:var(--color-command-gold,#c8963e);}
.ow-cap{font-family:var(--font-mono,"Space Mono",monospace);font-size:12px;font-weight:700;letter-spacing:.12em;fill:var(--color-muted,#aaa);}

@container (max-width:520px){
  .ow{flex-direction:column;align-items:center;gap:1.25rem;}
  .ow-tri{max-width:280px;}
}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .ow-tri{opacity:0;transform:translateY(8px);}
.dgfrm.armed.in .ow-tri{opacity:1;transform:translateY(0);transition:opacity .5s ease,transform .5s ease;}
.dgfrm.armed.in .ow-tri:last-child{transition-delay:.15s;}
@media (prefers-reduced-motion:reduce){
  .dgfrm .ow-tri{opacity:1!important;transform:none!important;}
}
`;
