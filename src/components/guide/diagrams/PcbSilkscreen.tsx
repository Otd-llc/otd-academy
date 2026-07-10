// Silkscreen + soldermask: an annotated board corner (diagram-standards v2).
//
// Teaching point (lesson 8): silkscreen is the board's printed legend (reference
// designators, a pin-1 dot, polarity marks) and soldermask is the coat with
// openings only over the pads. A board corner shows a chip (U2) with its pin-1
// dot and silk outline, a diode (D1) with its polarity band, an electrolytic
// (C1) with its plus mark, and a pad with its soldermask opening, each called out.
//
// One inline SVG; color via CSS classes so both themes flip and `--light` works.
// Component bodies are drawn as silk OUTLINES (which is what silkscreen actually
// is), not filled boxes, so they read on a dark or a light board. Labels are SVG
// text sized for the landscape mobile floor. Header + caption from DiagramFrame.
import { DiagramFrame } from "./DiagramFrame";

export function PcbSilkscreen({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="PCB · SILKSCREEN"
      tone="gold"
      title="Silkscreen labels the board, mask protects it"
      ariaLabel="A board corner with its silkscreen and soldermask called out. A chip labelled U2 has a silkscreen outline, four copper pads, and a pin-1 dot in one corner that fixes its rotation. A diode labelled D1 has a silkscreen polarity band at one end. An electrolytic capacitor labelled C1 has a plus mark for polarity. A copper pad shows its soldermask opening, the bare copper the solder wets, ringed by the mask. Good silkscreen makes a board buildable and debuggable; soldermask keeps solder only on the pads."
      caption={caption}
      defaultCaption="Reference designators, a pin-1 dot, and polarity marks make a board buildable; the mask opening is the bare copper solder wets."
    >
      <style>{CSS}</style>
      <div className="sk">
        <svg className="sk-svg" viewBox="0 0 382 150" aria-hidden="true">
          <path d="M10 22 H150 V144 H10 Z" className="sk-brd" />

          {/* U2 chip: silk outline + pads + pin-1 dot + refdes */}
          <rect x="34" y="44" width="60" height="30" className="sk-silk" />
          <rect x="24" y="48" width="10" height="6" className="sk-pad" />
          <rect x="24" y="64" width="10" height="6" className="sk-pad" />
          <rect x="94" y="48" width="10" height="6" className="sk-pad" />
          <rect x="94" y="64" width="10" height="6" className="sk-pad" />
          <circle cx="41" cy="51" r="3" className="sk-silkf" />
          <text x="64" y="38" textAnchor="middle" className="sk-refdes">U2</text>

          {/* D1 diode: silk outline + polarity band */}
          <rect x="26" y="88" width="8" height="8" className="sk-pad" />
          <rect x="74" y="88" width="8" height="8" className="sk-pad" />
          <rect x="34" y="85" width="40" height="14" className="sk-silk" />
          <rect x="68" y="85" width="4" height="14" className="sk-band" />
          <text x="52" y="80" textAnchor="middle" className="sk-refdes">D1</text>

          {/* C1 electrolytic: silk outline + plus mark */}
          <rect x="100" y="83" width="24" height="24" rx="3" className="sk-silk" />
          <text x="105" y="99" className="sk-silkf sk-plus">+</text>
          <text x="112" y="80" textAnchor="middle" className="sk-refdes">C1</text>

          {/* mask opening over a pad */}
          <rect x="34" y="118" width="16" height="10" className="sk-pad" />
          <rect x="31" y="115" width="22" height="16" rx="2" className="sk-maskring" />

          {/* callouts */}
          <line x1="94" y1="38" x2="178" y2="32" className="sk-lead" />
          <text x="182" y="36" className="sk-lbl">reference designator</text>
          <line x1="41" y1="51" x2="178" y2="68" className="sk-leadg" />
          <text x="182" y="72" className="sk-lbl sk-lbl-g">pin-1 dot</text>
          <line x1="72" y1="93" x2="178" y2="94" className="sk-lead" />
          <text x="182" y="98" className="sk-lbl">polarity band</text>
          <line x1="53" y1="123" x2="178" y2="124" className="sk-lead" />
          <text x="182" y="128" className="sk-lbl">mask opening</text>
        </svg>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.sk{max-width:35rem;margin-inline:auto;}
.sk-svg{display:block;width:100%;height:auto;overflow:visible;}
.sk-brd{fill:var(--color-navy-dark,#1a1a2e);stroke:var(--color-panel-border,#3a3f50);stroke-width:1.4;}
.sk-pad{fill:var(--color-command-gold,#c8963e);}
.sk-silk{fill:none;stroke:var(--color-title,#f1ece0);stroke-width:1.5;}
.sk-silkf{fill:var(--color-title,#f1ece0);}
.sk-plus{font-family:var(--font-mono,"Space Mono",monospace);font-size:13px;font-weight:700;}
.sk-band{fill:var(--color-command-gold,#c8963e);}
.sk-refdes{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:12px;fill:var(--color-title,#f1ece0);}
.sk-maskring{fill:none;stroke:var(--color-panel-border,#3a3f50);stroke-width:3;}
.sk-lead{stroke:var(--color-muted,#aaaaaa);stroke-width:1;stroke-dasharray:2 2;fill:none;}
.sk-leadg{stroke:var(--color-command-gold,#c8963e);stroke-width:1;stroke-dasharray:2 2;fill:none;}
.sk-lbl{font-family:var(--font-mono,"Space Mono",monospace);font-size:14px;fill:var(--color-muted,#aaaaaa);}
.sk-lbl-g{fill:var(--color-command-gold,#c8963e);font-weight:700;}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .sk-svg{opacity:0;transform:translateY(6px);}
.dgfrm.armed.in .sk-svg{opacity:1;transform:none;transition:opacity .55s ease,transform .55s cubic-bezier(.2,.7,.2,1);}
@media (prefers-reduced-motion:reduce){
  .dgfrm .sk-svg{opacity:1!important;transform:none!important;transition:none!important;}
}
`;
