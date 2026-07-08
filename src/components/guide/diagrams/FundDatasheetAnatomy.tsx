// Reading a datasheet: the specification table (v2). Fundamentals cluster.
// Owner-picked M1 (redo round).
//
// Teaching point: the heart of a datasheet is the parameter table. Read across
// each row: a minimum, the typical value you design around, and an absolute
// maximum you never cross. Values here are the AP2112K LDO on the L1.01 BOM.
//
// Landscape desktop/print: a five-column spec table with the MAX column flagged.
// REFLOWS to one card per parameter on a phone. Token-only color; en-dashes (not
// the house-banned em-dash) mark unspecified cells; red = the limits, gold = typ.
import { DiagramFrame } from "./DiagramFrame";

type Row = { p: string; min: string; typ: string; max: string; unit: string };
const ROWS: Row[] = [
  { p: "Input voltage", min: "2.5", typ: "–", max: "6.0", unit: "V" },
  { p: "Output", min: "–", typ: "3.3", max: "–", unit: "V" },
  { p: "Output current", min: "–", typ: "–", max: "600", unit: "mA" },
  { p: "Dropout", min: "–", typ: "250", max: "400", unit: "mV" },
  { p: "Junction temp", min: "−40", typ: "–", max: "125", unit: "°C" },
];

const cls = (v: string, kind: "min" | "typ" | "max") =>
  v === "–" ? "dsa-dash" : kind === "max" ? "dsa-max" : kind === "typ" ? "dsa-typ" : "dsa-val";

export function FundDatasheetAnatomy({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="FUNDAMENTALS · READING A DATASHEET"
      tone="gold"
      title="Reading a datasheet"
      ariaLabel="A datasheet specification table for an LDO regulator, with columns for parameter, minimum, typical, maximum, and unit. Input voltage runs from a 2.5 volt minimum to a 6.0 volt absolute maximum. The output is 3.3 volts typical. Output current is 600 milliamps maximum. Dropout is 250 millivolts typical and 400 millivolts maximum. Junction temperature runs from minus 40 to 125 degrees Celsius. Read across each row: the typical column is the value you design around, and the maximum column is the absolute limit you never cross."
      caption={caption}
      defaultCaption="A datasheet's table reads across each row: a minimum, the typical you design around, and an absolute maximum you never cross."
    >
      <style>{CSS}</style>

      {/* desktop / print: the table */}
      <svg className="dsa-scene" viewBox="0 0 520 250" aria-hidden="true">
        <rect className="dsa-maxcol" x="360" y="52" width="62" height="182" />
        <text className="dsa-head" x="95" y="46">PARAMETER</text>
        <text className="dsa-head" x="250" y="46" textAnchor="middle">MIN</text>
        <text className="dsa-head" x="320" y="46" textAnchor="middle">TYP</text>
        <text className="dsa-head" x="391" y="46" textAnchor="middle">MAX</text>
        <text className="dsa-head" x="450" y="46" textAnchor="middle">UNIT</text>
        <line className="dsa-rule-top" x1="60" y1="54" x2="470" y2="54" />
        {ROWS.map((r, i) => {
          const y = 78 + i * 32;
          return (
            <g key={r.p}>
              <text className="dsa-param" x="95" y={y}>{r.p}</text>
              <text className={`${cls(r.min, "min")} dsa-num`} x="250" y={y} textAnchor="middle">{r.min}</text>
              <text className={`${cls(r.typ, "typ")} dsa-num`} x="320" y={y} textAnchor="middle">{r.typ}</text>
              <text className={`${cls(r.max, "max")} dsa-num`} x="391" y={y} textAnchor="middle">{r.max}</text>
              <text className="dsa-unit" x="450" y={y} textAnchor="middle">{r.unit}</text>
              {i < ROWS.length - 1 ? <line className="dsa-rule" x1="60" y1={y + 9} x2="470" y2={y + 9} /> : null}
            </g>
          );
        })}
        <text className="dsa-never" x="391" y="246" textAnchor="middle">NEVER CROSS</text>
      </svg>

      {/* phone: one card per parameter */}
      <ul className="dsa-list" aria-hidden="true">
        {ROWS.map((r) => (
          <li key={r.p}>
            <span className="dsa-li-param">{r.p}</span>
            <span className="dsa-li-vals">
              <span className="dsa-li-k">min</span> <span className={cls(r.min, "min")}>{r.min}</span>
              {"  ·  "}
              <span className="dsa-li-k">typ</span> <span className={cls(r.typ, "typ")}>{r.typ}</span>
              {"  ·  "}
              <span className="dsa-li-k">max</span> <span className={cls(r.max, "max")}>{r.max}</span> {r.unit}
            </span>
          </li>
        ))}
      </ul>
    </DiagramFrame>
  );
}

const CSS = `
.dsa-scene{display:block;width:100%;height:auto;overflow:visible;}
.dsa-maxcol{fill:var(--color-command-gold,#c8963e);opacity:.14;}
.dsa-head{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:11px;letter-spacing:.1em;fill:var(--color-muted,#aaa);}
.dsa-rule-top{stroke:var(--color-command-gold,#c8963e);stroke-width:1.5;}
.dsa-rule{stroke:var(--color-panel-border,#3a3f50);stroke-width:1;stroke-dasharray:2 4;}
.dsa-param{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:12px;fill:var(--color-title,#f1ece0);}
.dsa-num{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:13px;}
.dsa-val{fill:var(--color-title,#f1ece0);}
.dsa-typ{fill:var(--color-command-gold,#c8963e);}
.dsa-max{fill:var(--color-alert-red,#ef5350);}
.dsa-dash{fill:var(--color-muted,#aaa);}
.dsa-unit{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:11px;fill:var(--color-muted,#aaa);}
.dsa-never{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:9px;letter-spacing:.08em;fill:var(--color-alert-red,#ef5350);}

/* phone reflow */
.dsa-list{display:none;list-style:none;margin:0;padding:0;flex-direction:column;gap:.5rem;}
@media (max-width:520px){ .dsa-scene{display:none;} .dsa-list{display:flex;} }
.dsa-list li{display:flex;flex-direction:column;gap:.25rem;padding:.6rem .9rem;border-radius:6px;text-align:left;
  background:var(--color-navy-dark,#1f2438);box-shadow:inset 0 0 0 1.5px var(--color-panel-border,#3a3f50);}
.dsa-li-param{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.9rem;color:var(--color-title,#f1ece0);}
.dsa-li-vals{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:800;font-size:1rem;color:var(--color-title,#f1ece0);}
.dsa-li-k{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.7rem;color:var(--color-muted,#aaa);}
.dsa-list .dsa-typ{color:var(--color-command-gold,#c8963e);}
.dsa-list .dsa-max{color:var(--color-alert-red,#ef5350);}
.dsa-list .dsa-val{color:var(--color-title,#f1ece0);}
.dsa-list .dsa-dash{color:var(--color-muted,#aaa);}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .dsa-maxcol{opacity:0;}
.dgfrm.armed.in .dsa-maxcol{opacity:.14;transition:opacity .6s ease .2s;}
@media (prefers-reduced-motion:reduce){ .dgfrm .dsa-maxcol{opacity:.14!important;} }
`;
