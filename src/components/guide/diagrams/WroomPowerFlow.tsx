// USB-C → 3.3 V power-flow as a responsive HTML component.
//
// Why not the /guide-diagrams SVG: a fixed-viewBox 780×1390 SVG scales to its
// container, so on a ~360px phone every label shrinks to ~6px (unreadable), and
// the original crammed each stage's annotations into one- or two-word ribbons.
// Rendered as real HTML/CSS, the labels are actual CSS px (clamped, never below
// ~14px) that do NOT scale with the viewport; the "graphic" is plain CSS node
// boxes (gold = power rail, blue = USB data).
//
// The power chain reads as ONE clean vertical spine — J1 → F1 → U2 → U1 — with
// the rail voltage on each connecting arrow. The supporting parts (CC resistors,
// caps, decoupling) sit as small muted notes tucked BESIDE each stage so they
// never interrupt the J1→U1 flow. The USB-data path is kept visually separate
// and in Signal Blue.
//
// BRAND (onethousanddrones.com/brand): gold-dominant on Deep Space, Navy Dark
// node bodies, Signal Blue only as the secondary data-path accent, muted (#aaa)
// for body — never a darker gray. The frame/header/caption come from the shared
// DiagramFrame; this file supplies only the graphic body and its scoped <style>.
import { DiagramFrame } from "./DiagramFrame";

export function WroomPowerFlow({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="SCHEMATIC · POWER FLOW"
      tone="gold"
      title="Power flow: USB-C to the WROOM"
      ariaLabel="Power flow from USB-C to the ESP32-S3-WROOM-1. The power chain is one vertical spine: J1 USB-C in sends 5 volts to F1, a resettable polyfuse; 5 volts continues to U2, the RT9080 3.3 volt LDO; the LDO outputs 3.3 volts to U1, the ESP32-S3-WROOM-1. Supporting parts beside each stage: J1 has CC resistors R3 and R4, 5.1k Rd pulldowns; U2 has input caps C1 10 microfarad bulk and C5 1 microfarad, plus output cap C6 1 microfarad; U1 is decoupled by C2, C3 and C7. A separate USB data path in blue: J1 USB-C data carries D plus and D minus to D1, an ESD array, which passes clean USB to U1 and shunts surges to ground before they reach U1."
      caption={caption}
      defaultCaption="5 V comes in; the LDO drops it to a clean 3.3 V for the WROOM."
    >
      <style>{CSS}</style>

      <p className="wpf-key">
        <span className="g">Gold = power rails</span> &middot; <span className="b">Blue = USB data</span>
      </p>

      <p className="wpf-sectlabel g">&#9656; Power chain</p>
      <div className="wpf-spine">
        <div className="wpf-stage">
          <div className="wpf-node">
            <span className="wpf-ref">J1</span>
            <span className="wpf-name">USB-C</span>
            <span className="wpf-role">power in</span>
          </div>
          <p className="wpf-aside">+ R3 &middot; R4 CC pulldowns (5.1k Rd) request power.</p>
        </div>

        <div className="wpf-link">
          <span className="arrow">&#9660;</span>
          <span className="rail">5 V</span>
        </div>

        <div className="wpf-stage">
          <div className="wpf-node">
            <span className="wpf-ref">F1</span>
            <span className="wpf-name">Polyfuse</span>
            <span className="wpf-role">resettable</span>
          </div>
          <p className="wpf-aside">Trips on an over-current fault, then resets when it cools.</p>
        </div>

        <div className="wpf-link">
          <span className="arrow">&#9660;</span>
          <span className="rail">5 V</span>
        </div>

        <div className="wpf-stage">
          <div className="wpf-node">
            <span className="wpf-ref">U2</span>
            <span className="wpf-name">RT9080</span>
            <span className="wpf-role">3.3 V LDO</span>
          </div>
          <p className="wpf-aside">+ C1 10&micro;F &middot; C5 1&micro;F in, C6 1&micro;F out steady the LDO.</p>
        </div>

        <div className="wpf-link">
          <span className="arrow">&#9660;</span>
          <span className="rail">3.3 V</span>
        </div>

        <div className="wpf-stage">
          <div className="wpf-node">
            <span className="wpf-ref">U1</span>
            <span className="wpf-name">ESP32-S3</span>
            <span className="wpf-role">WROOM-1</span>
          </div>
          <p className="wpf-aside">+ C2 &middot; C3 &middot; C7 decoupling steady the rail at the module.</p>
        </div>
      </div>

      <p className="wpf-sectlabel b">&#9656; USB data path</p>
      <div className="wpf-spine">
        <div className="wpf-stage">
          <div className="wpf-node data">
            <span className="wpf-ref">J1</span>
            <span className="wpf-name">USB-C</span>
            <span className="wpf-role">data</span>
          </div>
        </div>

        <div className="wpf-link data">
          <span className="arrow">&#9660;</span>
          <span className="rail">D+ / D&minus;</span>
        </div>

        <div className="wpf-stage">
          <div className="wpf-node data">
            <span className="wpf-ref">D1</span>
            <span className="wpf-name">ESD array</span>
            <span className="wpf-role">protection</span>
          </div>
          <p className="wpf-aside b">Clamps static spikes; shunts surges to ground before they reach U1.</p>
        </div>

        <div className="wpf-link data">
          <span className="arrow">&#9660;</span>
          <span className="rail">clean USB</span>
        </div>

        <div className="wpf-stage">
          <div className="wpf-node data">
            <span className="wpf-ref">U1</span>
            <span className="wpf-name">ESP32-S3</span>
            <span className="wpf-role">WROOM-1</span>
          </div>
        </div>
      </div>
    </DiagramFrame>
  );
}

// Token-driven (var(--color-*) / var(--font-*) from @theme) with literal
// fallbacks so a standalone render still resolves. Gold-dominant per brand;
// unique .wpf- prefix so styles never collide with other diagrams on the page.
const CSS = `
.wpf-key{margin:0;text-align:center;color:var(--color-muted,#aaa);
  font-size:clamp(.85rem,2.3vw,.95rem);line-height:1.4;}
.wpf-key .g{color:var(--color-command-gold,#c8963e);font-weight:700;}
.wpf-key .b{color:var(--color-signal-blue,#4a8fff);font-weight:700;}

.wpf-sectlabel{margin:clamp(1.4rem,5vw,1.9rem) 0 .9rem;text-align:center;
  font-size:.62rem;font-weight:700;letter-spacing:.22em;text-transform:uppercase;}
.wpf-sectlabel.g{color:var(--color-command-gold,#c8963e);}
.wpf-sectlabel.b{color:var(--color-signal-blue,#4a8fff);}

/* The chain is one centered vertical spine; nodes + arrows align on it. */
.wpf-spine{display:flex;flex-direction:column;align-items:center;}
.wpf-stage{display:flex;flex-direction:column;align-items:center;width:100%;max-width:24rem;}
.wpf-node{width:100%;box-sizing:border-box;
  background:var(--color-navy-dark,#1f2438);border:2px solid var(--color-command-gold,#c8963e);
  border-radius:8px;padding:.7rem .6rem;text-align:center;}
.wpf-node.data{border-color:var(--color-signal-blue,#4a8fff);}
.wpf-ref{color:var(--color-gold-light,#e8b865);font-weight:700;
  font-size:clamp(1.05rem,3vw,1.3rem);line-height:1;}
.wpf-node.data .wpf-ref{color:var(--color-signal-blue,#4a8fff);}
.wpf-name{display:block;color:#fff;font-weight:700;margin-top:.28rem;
  font-size:clamp(.95rem,2.5vw,1.05rem);line-height:1.2;}
.wpf-role{display:block;color:var(--color-muted,#aaa);margin-top:.2rem;
  font-size:clamp(.85rem,2.3vw,.95rem);line-height:1.25;}

/* Supporting parts: muted, secondary, tucked under the node — never on the spine. */
.wpf-aside{margin:.4rem 0 0;text-align:center;color:var(--color-muted,#aaa);
  font-size:clamp(.8rem,2.2vw,.9rem);line-height:1.4;}
.wpf-aside.b{color:var(--color-signal-blue,#4a8fff);}

/* Vertical connector: a centered arrow with the rail voltage as its label. */
.wpf-link{display:flex;flex-direction:column;align-items:center;gap:.1rem;
  margin:clamp(.7rem,3vw,1rem) 0;}
.wpf-link .arrow{color:var(--color-command-gold,#c8963e);font-size:1.3rem;line-height:1;}
.wpf-link.data .arrow{color:var(--color-signal-blue,#4a8fff);}
.wpf-link .rail{color:var(--color-command-gold,#c8963e);font-weight:700;
  font-size:clamp(.95rem,2.5vw,1.05rem);line-height:1.2;}
.wpf-link.data .rail{color:var(--color-signal-blue,#4a8fff);}
`;
