// Reading a schematic: the symbol / refdes / name key (v2). Fundamentals cluster.
// Owner-picked K8 (variants-of-J2 round).
//
// Teaching point: a schematic is written in symbols. Each symbol says what the
// part is, and its reference-designator letter (the prefix R, C, D, L, U) names
// the family, so you can match the drawing to the same part on the board.
//
// Landscape desktop/print: a three-column table, symbol then refdes then name.
// REFLOWS to stacked row-cards on a phone. Token-only color.
import type { ReactNode } from "react";
import { DiagramFrame } from "./DiagramFrame";

type Kind = "R" | "C" | "D" | "L" | "U";

function Sym({ kind, cx, cy }: { kind: Kind; cx: number; cy: number }): ReactNode {
  if (kind === "R") {
    const x = cx - 24;
    const pts = [`${x},${cy}`];
    for (let i = 0; i < 6; i++) pts.push(`${x + 8 * (i + 0.5)},${cy + (i % 2 ? 6 : -6)}`);
    pts.push(`${cx + 24},${cy}`);
    return <polyline className="sa-sym" fill="none" points={pts.join(" ")} />;
  }
  if (kind === "C") {
    return (
      <>
        <line className="sa-sym" x1={cx} y1={cy - 13} x2={cx} y2={cy - 4} />
        <line className="sa-sym" x1={cx - 14} y1={cy - 4} x2={cx + 14} y2={cy - 4} />
        <line className="sa-sym" x1={cx - 14} y1={cy + 4} x2={cx + 14} y2={cy + 4} />
        <line className="sa-sym" x1={cx} y1={cy + 4} x2={cx} y2={cy + 13} />
      </>
    );
  }
  if (kind === "D") {
    return (
      <>
        <path className="sa-fill" d={`M${cx - 12},${cy - 12} L${cx - 12},${cy + 12} L${cx + 12},${cy} Z`} />
        <line className="sa-sym" x1={cx + 12} y1={cy - 12} x2={cx + 12} y2={cy + 12} />
        <line className="sa-sym" x1={cx - 24} y1={cy} x2={cx - 12} y2={cy} />
        <line className="sa-sym" x1={cx + 12} y1={cy} x2={cx + 24} y2={cy} />
      </>
    );
  }
  if (kind === "L") {
    let d = `M${cx - 24},${cy}`;
    for (let i = 0; i < 4; i++) d += ` A6,6 0 0 1 ${cx - 24 + 12 * (i + 1)},${cy}`;
    return <path className="sa-sym" fill="none" d={d} />;
  }
  // U — IC box with pin stubs
  return (
    <>
      <rect className="sa-fill" x={cx - 16} y={cy - 13} width={32} height={26} rx={2} />
      <line className="sa-sym" x1={cx - 22} y1={cy - 5} x2={cx - 16} y2={cy - 5} />
      <line className="sa-sym" x1={cx - 22} y1={cy + 5} x2={cx - 16} y2={cy + 5} />
      <line className="sa-sym" x1={cx + 16} y1={cy - 5} x2={cx + 22} y2={cy - 5} />
      <line className="sa-sym" x1={cx + 16} y1={cy + 5} x2={cx + 22} y2={cy + 5} />
    </>
  );
}

const ROWS: { k: Kind; name: string }[] = [
  { k: "R", name: "resistor" },
  { k: "C", name: "capacitor" },
  { k: "D", name: "diode" },
  { k: "L", name: "inductor" },
  { k: "U", name: "IC / chip" },
];

export function FundSchematicAnatomy({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="FUNDAMENTALS · READING A SCHEMATIC"
      tone="gold"
      title="Schematic symbols"
      ariaLabel="A key of common schematic symbols with their reference-designator letters and names. A resistor's zigzag is designated R. A capacitor's two plates are C. A diode's triangle and bar are D. An inductor's series of humps is L. A rectangular integrated circuit is U. The symbol tells you what the part is, and the reference-designator letter names its family so you can match the drawing to the same part on the board."
      caption={caption}
      defaultCaption="Each symbol carries a reference-designator letter: R resistor, C capacitor, D diode, L inductor, U chip."
    >
      <style>{CSS}</style>

      {/* desktop / print: table */}
      <svg className="sa-scene" viewBox="0 0 520 248" aria-hidden="true">
        <text className="sa-head" x="120" y="42" textAnchor="middle">SYMBOL</text>
        <text className="sa-head" x="280" y="42" textAnchor="middle">REFDES</text>
        <text className="sa-head" x="415" y="42" textAnchor="middle">NAME</text>
        {ROWS.map((r, i) => {
          const y = 82 + i * 34;
          return (
            <g key={r.k}>
              <Sym kind={r.k} cx={120} cy={y} />
              <text className="sa-refdes" x="280" y={y + 7} textAnchor="middle">{r.k}</text>
              <text className="sa-name" x="415" y={y + 6} textAnchor="middle">{r.name}</text>
              {i < ROWS.length - 1 ? (
                <line className="sa-rule" x1="55" y1={y + 17} x2="465" y2={y + 17} />
              ) : null}
            </g>
          );
        })}
      </svg>

      {/* phone: stacked row-cards */}
      <ul className="sa-list" aria-hidden="true">
        {ROWS.map((r) => (
          <li key={r.k}>
            <svg viewBox="0 0 56 34" className="sa-mini">
              <Sym kind={r.k} cx={28} cy={17} />
            </svg>
            <span className="sa-li-refdes">{r.k}</span>
            <span className="sa-li-name">{r.name}</span>
          </li>
        ))}
      </ul>
    </DiagramFrame>
  );
}

const CSS = `
.sa-scene{display:block;width:100%;height:auto;overflow:visible;}
.sa-sym{fill:none;stroke:var(--color-command-gold,#c8963e);stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;}
.sa-fill{fill:var(--color-navy-dark,#1f2438);stroke:var(--color-command-gold,#c8963e);stroke-width:2;}
.sa-head{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:11px;letter-spacing:.1em;fill:var(--color-muted,#aaa);}
.sa-refdes{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:20px;fill:var(--color-command-gold,#c8963e);}
.sa-name{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:13px;fill:var(--color-title,#f1ece0);}
.sa-rule{stroke:var(--color-panel-border,#3a3f50);stroke-width:1;stroke-dasharray:2 4;}

/* phone reflow */
.sa-list{display:none;list-style:none;margin:0;padding:0;flex-direction:column;gap:.5rem;}
@media (max-width:520px){ .sa-scene{display:none;} .sa-list{display:flex;} }
.sa-list li{display:grid;grid-template-columns:56px 2.2rem 1fr;align-items:center;gap:1rem;padding:.6rem .9rem;border-radius:6px;text-align:left;
  background:var(--color-navy-dark,#1f2438);box-shadow:inset 0 0 0 1.5px var(--color-panel-border,#3a3f50);}
.sa-mini{width:56px;height:34px;overflow:visible;}
.sa-li-refdes{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:1.5rem;color:var(--color-command-gold,#c8963e);text-align:center;}
.sa-li-name{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.95rem;color:var(--color-title,#f1ece0);}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .sa-refdes{opacity:0;}
.dgfrm.armed.in .sa-refdes{opacity:1;transition:opacity .5s ease .2s;}
@media (prefers-reduced-motion:reduce){ .dgfrm .sa-refdes{opacity:1!important;} }
`;
