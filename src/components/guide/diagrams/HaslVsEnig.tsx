// HASL-vs-ENIG surface-finish comparison as a responsive HTML component.
//
// Why not the source /guide-diagrams SVG: a fixed-viewBox SVG scales to its
// container, so on a ~360px phone the 780-wide canvas renders at ~0.46x and ANY
// text shrinks below an accessible size. Here every label/sentence is real CSS
// px (clamped, never below ~14px) that does NOT scale with the viewport, and the
// two panels STACK on mobile. Only the cross-sections are inline <svg> graphics
// (no text inside) — the tilted module on uneven domes (HASL) vs the level module
// on flat fillets (ENIG) — sized in CSS so they stay crisp at any width.
//
// Header / frame / caption come from the shared DiagramFrame (site-standard Bebas
// title); this file supplies only the graphic body and its scoped CSS.
//
// BRAND (onethousanddrones.com/brand): gold-dominant on Deep Space, Navy Dark
// panel bodies, Signal Blue only as the secondary "every pad meets it" data
// accent, Alert Red reserved for the genuine bad/forbidden state (the floating-
// pad GAP). All colours via @theme tokens with literal fallbacks.
import { DiagramFrame } from "./DiagramFrame";

export function HaslVsEnig({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="SURFACE FINISH · WROOM PADS"
      tone="gold"
      title="Why ENIG under the WROOM"
      ariaLabel="Two cross-sections under the WROOM module's fine-pitch pads. With HASL the solder is domed at uneven heights, so the module tilts and one pad never makes contact, leaving a gap where no joint forms. With ENIG the finish is flat, so the module sits level and every pad meets it."
      caption={caption}
      defaultCaption="HASL's bumps miss joints you can't see — fine pitch needs ENIG."
    >
      <style>{CSS}</style>

      <p className="hve-sub">A flat finish makes every joint connect.</p>

      <div className="hve-grid">
        <div className="hve-panel hve-bad">
          <div className="hve-ptop">
            <span className="hve-glyph">HASL</span>
            <span className="hve-tag hve-tag-bad">tilts · gap</span>
          </div>
          <p className="hve-finish">hot-air leveled — uneven domes</p>
          <svg className="hve-svg" viewBox="0 0 320 150" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {/* tilted module: rests on the tall dome at left, lifts at right */}
            <path d="M40,42 L284,18 L284,2 L40,26 Z" fill="#1f2438" stroke="#c8963e" strokeWidth="2.5" />
            {/* uneven solder domes */}
            <path d="M64,96 q22,-56 44,0 z" fill="#aaaaaa" />
            <path d="M138,96 q22,-40 44,0 z" fill="#aaaaaa" />
            <path d="M212,96 q22,-24 44,0 z" fill="#aaaaaa" />
            {/* gold pads */}
            <rect x="62" y="96" width="48" height="8" fill="#c8963e" />
            <rect x="136" y="96" width="48" height="8" fill="#c8963e" />
            <rect x="210" y="96" width="48" height="8" fill="#c8963e" />
            {/* FR-4 slab */}
            <rect x="44" y="104" width="232" height="24" fill="#1f2438" stroke="#c8963e" strokeWidth="1.5" />
            {/* red gap marker under the lifted right pad */}
            <line x1="282" y1="20" x2="282" y2="40" stroke="#c62828" strokeWidth="2" />
            <line x1="276" y1="20" x2="288" y2="20" stroke="#c62828" strokeWidth="2" />
            <line x1="276" y1="40" x2="288" y2="40" stroke="#c62828" strokeWidth="2" />
          </svg>
          <p className="hve-note hve-note-bad">
            Domes sit at different heights, so the module tilts and one pad floats — a <b>GAP</b> where no joint
            forms.
          </p>
        </div>

        <div className="hve-panel hve-good">
          <div className="hve-ptop">
            <span className="hve-glyph">ENIG</span>
            <span className="hve-tag hve-tag-good">level · all meet</span>
          </div>
          <p className="hve-finish">flat gold plating — even</p>
          <svg className="hve-svg" viewBox="0 0 320 150" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {/* level module */}
            <rect x="40" y="14" width="240" height="16" fill="#1f2438" stroke="#c8963e" strokeWidth="2.5" />
            {/* equal flat solder fillets */}
            <rect x="62" y="30" width="48" height="58" fill="#aaaaaa" />
            <rect x="136" y="30" width="48" height="58" fill="#aaaaaa" />
            <rect x="210" y="30" width="48" height="58" fill="#aaaaaa" />
            {/* gold pads */}
            <rect x="62" y="88" width="48" height="8" fill="#c8963e" />
            <rect x="136" y="88" width="48" height="8" fill="#c8963e" />
            <rect x="210" y="88" width="48" height="8" fill="#c8963e" />
            {/* FR-4 slab */}
            <rect x="44" y="96" width="232" height="24" fill="#1f2438" stroke="#c8963e" strokeWidth="1.5" />
          </svg>
          <p className="hve-note hve-note-good">
            The finish is flat, so the module sits level and <b>every pad meets it</b> — full contact across the
            row.
          </p>
        </div>
      </div>
    </DiagramFrame>
  );
}

// Body-only CSS. Token-driven (var(--color-*) / var(--font-*) from @theme) with
// literal fallbacks so a standalone render still resolves. Gold-dominant per
// brand. The frame box / title / eyebrow / footer rules live in DiagramFrame.
const CSS = `
.hve-sub{margin:0 0 clamp(1.1rem,4vw,1.6rem);color:var(--color-muted,#aaa);
  font-family:var(--font-serif,"Lora",serif);font-size:clamp(.85rem,2.3vw,.95rem);line-height:1.45;}

.hve-grid{display:grid;grid-template-columns:1fr;gap:clamp(1rem,3.5vw,1.4rem);text-align:left;}

.hve-panel{background:var(--color-navy-dark,#1f2438);border:1px solid var(--color-panel-border,#3a3f50);
  border-radius:6px;padding:clamp(.85rem,3vw,1.1rem);}
.hve-bad{border-top:3px solid var(--color-alert-red,#c62828);}
.hve-good{border-top:3px solid var(--color-command-gold,#c8963e);}

.hve-ptop{display:flex;align-items:baseline;gap:.55rem;flex-wrap:wrap;margin:0 0 .15rem;}
.hve-glyph{color:#fff;font-weight:700;font-size:clamp(1.05rem,3vw,1.3rem);letter-spacing:.04em;}
.hve-tag{font-size:.62rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;}
.hve-tag-bad{color:var(--color-alert-red,#c62828);}
.hve-tag-good{color:var(--color-command-gold,#c8963e);}
.hve-finish{margin:0 0 .85rem;color:var(--color-muted,#aaa);font-size:clamp(.85rem,2.3vw,.95rem);}

.hve-svg{display:block;width:100%;height:auto;}

.hve-note{margin:.85rem 0 0;font-family:var(--font-serif,"Lora",serif);
  font-size:clamp(.95rem,2.5vw,1.05rem);line-height:1.45;color:var(--color-gray-1,#e8e8e8);}
.hve-note-bad b{color:var(--color-alert-red,#c62828);font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;}
.hve-note-good b{color:var(--color-signal-blue,#4a8fff);font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;}
`;
