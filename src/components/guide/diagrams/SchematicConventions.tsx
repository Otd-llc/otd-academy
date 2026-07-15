// Schematic-drawing conventions as a responsive diagram (v2).
//
// Teaching point: a schematic reads like a sentence — signal flows left to right,
// supplies (3V3) point up and grounds (GND) point down, parts group by sub-circuit,
// and the decoupling cap sits right at the IC power pin. One worked example carries
// all four, each labelled where it appears.
//
// v2: a single annotated schematic on desktop/print (~1.5 landscape), token-only so
// it re-themes (the old version used presentation-attribute hex and stayed dark). On
// a narrow phone the in-figure annotations hide and a readable HTML conventions list
// takes over, so no label ever scales below the ~14px floor (directive 1 / 3).
import { DiagramFrame } from "./DiagramFrame";

const CONVENTIONS = [
  "Signal flows left to right: in on the left, out on the right.",
  "Supplies point up (3V3), grounds point down (GND).",
  "Group parts by sub-circuit.",
  "Put the decoupling cap right at the IC power pin.",
];

export function SchematicConventions({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="SCHEMATIC · CONVENTIONS"
      tone="gold"
      title="Schematic conventions"
      ariaLabel="Schematic-drawing conventions: signal flows left to right, supply symbols (3V3) point up and grounds (GND) point down, parts are grouped by sub-circuit, and a decoupling capacitor sits right at the IC power pin. The worked example shows the 3V3 supply entering the top of an IC, signal in from the left and out to the right, ground leaving the bottom, and the decoupling cap branching off the supply at the pin."
      caption={caption}
      defaultCaption="Read it like a sentence: in left, out right."
    >
      <style>{CSS}</style>

      <div className="scon">
        <div className="scon-fig">
          <svg className="scon-svg" viewBox="0 0 560 236" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {/* supply rail down from 3V3 into the IC top */}
            <line className="scon-rail" x1="270" y1="56" x2="270" y2="114" />
            <line className="scon-rail" x1="244" y1="56" x2="296" y2="56" />
            {/* decoupling cap branch, taken right at the pin */}
            <line className="scon-wire" x1="270" y1="80" x2="336" y2="80" />
            <line className="scon-wire" x1="336" y1="80" x2="336" y2="93" />
            <line className="scon-capp" x1="321" y1="93" x2="351" y2="93" />
            <line className="scon-capp" x1="321" y1="100" x2="351" y2="100" />
            <line className="scon-gnd" x1="336" y1="100" x2="336" y2="110" />
            <line className="scon-gnd" x1="325" y1="110" x2="347" y2="110" />
            <line className="scon-gnd" x1="330" y1="115" x2="342" y2="115" />
            {/* IC body (one sub-circuit) */}
            <rect className="scon-ic" x="220" y="114" width="100" height="64" rx="4" />
            <text className="scon-iclbl" x="270" y="153" textAnchor="middle">IC</text>
            {/* signal in / out */}
            <line className="scon-wire" x1="162" y1="146" x2="220" y2="146" />
            <path className="scon-arrow" d="M220,146 L210,141 L210,151 Z" />
            <line className="scon-wire" x1="320" y1="146" x2="378" y2="146" />
            <path className="scon-arrow" d="M378,146 L368,141 L368,151 Z" />
            {/* ground rail down from the IC */}
            <line className="scon-gnd" x1="270" y1="178" x2="270" y2="198" />
            <line className="scon-gnd" x1="256" y1="198" x2="284" y2="198" />
            <line className="scon-gnd" x1="261" y1="203" x2="279" y2="203" />
            <line className="scon-gnd" x1="266" y1="208" x2="274" y2="208" />

            {/* annotations (hidden on phone → replaced by the list below) */}
            <text className="scon-anno scon-anno-g" x="270" y="44" textAnchor="middle">3V3 · supplies point up</text>
            <text className="scon-anno scon-anno-g" x="358" y="88">decoupling cap</text>
            <text className="scon-anno scon-anno-m" x="358" y="104">right at the pin</text>
            <text className="scon-anno scon-anno-b" x="154" y="150" textAnchor="end">in →</text>
            <text className="scon-anno scon-anno-b" x="386" y="150">→ out</text>
            <text className="scon-anno scon-anno-m" x="270" y="224" textAnchor="middle">GND · grounds point down</text>
          </svg>
        </div>

        {/* phone: readable conventions list (replaces the in-figure annotations) */}
        <ul className="scon-list" aria-hidden="true">
          {CONVENTIONS.map((c) => (
            <li className="scon-li" key={c}><b aria-hidden="true">›</b><span>{c}</span></li>
          ))}
        </ul>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.scon-svg{display:block;width:100%;height:auto;overflow:visible;}
.scon-rail,.scon-wire{stroke:var(--color-command-gold,#c8963e);stroke-width:3;fill:none;stroke-linecap:round;}
.scon-arrow{fill:var(--color-command-gold,#c8963e);}
.scon-capp{stroke:var(--color-title,#f1ece0);stroke-width:3;fill:none;stroke-linecap:round;}
.scon-gnd{stroke:var(--color-muted,#aaa);stroke-width:3;fill:none;stroke-linecap:round;}
.scon-ic{fill:var(--color-diagram-surface,#1f2438);stroke:var(--color-command-gold,#c8963e);stroke-width:3;}
.scon-iclbl{fill:var(--color-title,#f1ece0);font-family:var(--font-mono,"Space Mono",monospace);font-size:20px;font-weight:700;}
.scon-anno{font-family:var(--font-mono,"Space Mono",monospace);font-size:12px;font-weight:700;}
.scon-anno-g{fill:var(--color-command-gold,#c8963e);}
.scon-anno-b{fill:var(--color-signal-blue,#4a8fff);}
.scon-anno-m{fill:var(--color-muted,#aaa);font-weight:400;font-size:11px;}

.scon-list{display:none;list-style:none;margin:0;padding:0;flex-direction:column;gap:.6rem;text-align:left;}
@container (max-width:520px){
  .scon-anno{display:none;}
  .scon-list{display:flex;}
}
.scon-li{display:grid;grid-template-columns:auto 1fr;gap:.55rem;align-items:baseline;
  font-family:var(--font-serif,"Lora",serif);font-size:.92rem;line-height:1.4;color:var(--color-text,#e8e8e8);}
.scon-li b{color:var(--color-command-gold,#c8963e);font-family:var(--font-mono,"Space Mono",monospace);
  font-weight:700;font-size:1.15rem;line-height:1;}

/* Tier-B reveal off the frame's armed/in contract. */
.dgfrm.armed .scon-fig,.dgfrm.armed .scon-li{opacity:0;transform:translateY(5px);}
.dgfrm.armed.in .scon-fig,.dgfrm.armed.in .scon-li{opacity:1;transform:none;transition:opacity .5s ease,transform .5s cubic-bezier(.2,.7,.2,1);}
.dgfrm.armed.in .scon-li:nth-child(2){transition-delay:.06s;}
.dgfrm.armed.in .scon-li:nth-child(3){transition-delay:.12s;}
.dgfrm.armed.in .scon-li:nth-child(4){transition-delay:.18s;}
@media (prefers-reduced-motion:reduce){.dgfrm .scon-fig,.dgfrm .scon-li{opacity:1!important;transform:none!important;}}
`;
