// 0805-vs-0402 size comparison. Real HTML/CSS (not a scaled SVG) so labels stay
// accessible at any width; the chips' AREAS carry the real ~5:1 ratio. Header /
// frame / caption come from the shared DiagramFrame (site-standard Bebas title);
// this file supplies only the graphic body. Brand: gold-dominant, navy bodies,
// Signal Blue only as the secondary data callout.
import { type CSSProperties } from "react";
import { DiagramFrame } from "./diagrams/DiagramFrame";

export function PackageSizeDiagram({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="BOM · PACKAGE SIZE"
      tone="gold"
      title="Same value, very different to solder"
      ariaLabel="An 0805 passive (2.0 by 1.25 mm) is about five times the area of an 0402 (1.0 by 0.5 mm). The larger 0805 solders with a plain iron and tweezers; the tiny 0402 wants solder paste and hot air. This board uses 0805."
      caption={caption}
      defaultCaption="Your board uses 0805 — a plain iron handles it."
    >
      <style>{CSS}</style>
      <div className="pkgcmp-stage">
        <div className="pkgcmp-col">
          <div className="pkgcmp-rail">
            <div className="pkgcmp-chip" style={{ "--w": "168px", "--h": "105px" } as CSSProperties} />
          </div>
          <p className="pkgcmp-glyph">0805</p>
          <p className="pkgcmp-dim">2.0 × 1.25 mm</p>
          <p className="pkgcmp-method">iron + tweezers</p>
        </div>

        <div className="pkgcmp-col">
          <p className="pkgcmp-callout">≈ 1/5 the area</p>
          <div className="pkgcmp-rail">
            <div className="pkgcmp-chip" style={{ "--w": "84px", "--h": "42px" } as CSSProperties} />
          </div>
          <p className="pkgcmp-glyph">0402</p>
          <p className="pkgcmp-dim">1.0 × 0.5 mm</p>
          <p className="pkgcmp-method">paste + hot air</p>
        </div>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.pkgcmp-stage{display:flex;justify-content:center;align-items:flex-start;gap:clamp(1.5rem,8vw,4rem);text-align:center;}
.pkgcmp-col{display:flex;flex-direction:column;align-items:center;}
/* fixed-height rail so the two chips bottom-align on a shared baseline */
.pkgcmp-rail{height:105px;display:flex;align-items:flex-end;border-bottom:1px solid rgba(170,170,170,.3);}
.pkgcmp-chip{position:relative;width:var(--w);height:var(--h);
  background:var(--color-navy-dark,#1f2438);border:2.5px solid var(--color-command-gold,#c8963e);}
.pkgcmp-chip::before,.pkgcmp-chip::after{content:"";position:absolute;top:0;bottom:0;
  width:14%;background:var(--color-muted,#aaa);opacity:.6;}
.pkgcmp-chip::before{left:0;}
.pkgcmp-chip::after{right:0;}
.pkgcmp-glyph{margin:.7rem 0 0;color:#fff;font-weight:700;font-size:clamp(1.1rem,3vw,1.4rem);}
.pkgcmp-dim{margin:.35rem 0 0;color:var(--color-gray-1,#e8e8e8);font-size:clamp(.95rem,2.5vw,1.05rem);}
.pkgcmp-method{margin:.3rem 0 0;color:var(--color-muted,#aaa);font-size:clamp(.9rem,2.3vw,1rem);}
.pkgcmp-callout{margin:0 0 .6rem;color:var(--color-signal-blue,#4a8fff);font-weight:700;font-size:clamp(.95rem,2.5vw,1.05rem);}

/* Narrow screens: stack the two packages so the big labels never cramp/wrap. */
@media (max-width:520px){
  .pkgcmp-stage{flex-direction:column;align-items:center;gap:1.6rem;}
  .pkgcmp-rail{height:auto;}
}
`;
