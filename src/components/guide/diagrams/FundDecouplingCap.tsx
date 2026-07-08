// Decoupling: a capacitor steadies a supply rail (v2). Fundamentals cluster.
// Owner-picked C2 ("rail steadiness, with vs without").
//
// Teaching point: a capacitor stores charge, so a decoupling cap at a chip's
// power pin hands over current the instant the chip gulps. Without it the rail
// dips on every spike; with it the rail holds. That is why a decoupling cap sits
// beside every chip.
//
// Landscape desktop/print: two rail traces, a dipping red one (no cap) over a
// steady blue one (with cap), dips aligned to the chip's current spikes.
// REFLOWS to two stacked trace cards on a phone. Token-only color; red marks the
// fault (a sagging rail), blue the healthy at-rest rail.
import { DiagramFrame } from "./DiagramFrame";

const BAD = "60,90 150,90 165,120 185,90 250,90 265,122 285,90 400,90 415,118 435,90 470,90";
const GOOD = "60,190 155,190 165,196 185,190 255,190 265,196 285,190 405,190 415,196 435,190 470,190";
const SPIKES = [165, 265, 415];

export function FundDecouplingCap({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="FUNDAMENTALS · CAPACITORS"
      tone="gold"
      title="Capacitors and decoupling"
      ariaLabel="Two supply-rail traces showing what a decoupling capacitor does. The top trace, labelled no cap, is a supply rail that dips sharply every time the chip draws a burst of current. The bottom trace, labelled with cap, stays nearly flat through the same current spikes, because the capacitor stores charge and hands it over locally the instant the chip needs it. A capacitor steadies a rail, which is why a decoupling cap sits beside every chip's power pin."
      caption={caption}
      defaultCaption="A cap stores charge and steadies the rail. Without it the supply dips on every current spike; with it, it holds."
    >
      <style>{CSS}</style>

      {/* desktop / print: both traces */}
      <svg className="dk-scene" viewBox="0 0 520 230" aria-hidden="true">
        <line className="dk-axis" x1="55" y1="75" x2="55" y2="205" />
        {SPIKES.map((x) => (
          <line key={x} className="dk-spike" x1={x} y1="88" x2={x} y2="192" />
        ))}
        <text className="dk-lbl dk-bad-t" x="62" y="66">NO CAP</text>
        <polyline className="dk-bad" fill="none" points={BAD} />
        <text className="dk-lbl dk-good-t" x="62" y="166">WITH CAP</text>
        <polyline className="dk-good" fill="none" points={GOOD} />
        <text className="dk-note-t" x="265" y="224" textAnchor="middle">chip current spikes</text>
      </svg>

      {/* phone: two trace cards */}
      <ul className="dk-list" aria-hidden="true">
        <li>
          <span className="dk-li-lbl dk-bad-t">NO CAP</span>
          <svg viewBox="0 0 300 46" className="dk-mini">
            <polyline className="dk-bad" fill="none" points="8,16 78,16 90,40 106,16 188,16 200,40 216,16 292,16" />
          </svg>
          <span className="dk-li-note">rail dips when the chip gulps current</span>
        </li>
        <li>
          <span className="dk-li-lbl dk-good-t">WITH CAP</span>
          <svg viewBox="0 0 300 46" className="dk-mini">
            <polyline className="dk-good" fill="none" points="8,26 84,26 92,34 106,26 188,26 196,34 210,26 292,26" />
          </svg>
          <span className="dk-li-note">the cap fills the gap; the rail holds</span>
        </li>
      </ul>
    </DiagramFrame>
  );
}

const CSS = `
.dk-scene{display:block;width:100%;height:auto;overflow:visible;}
.dk-axis{stroke:var(--color-panel-border,#3a3f50);stroke-width:1.5;}
.dk-spike{stroke:var(--color-muted,#aaa);stroke-width:1;opacity:.35;stroke-dasharray:3 4;}
.dk-bad{stroke:var(--color-alert-red,#ef5350);stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;}
.dk-good{stroke:var(--color-signal-blue,#4a8fff);stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;}
.dk-lbl{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:13px;letter-spacing:.1em;}
.dk-bad-t{fill:var(--color-alert-red,#ef5350);color:var(--color-alert-red,#ef5350);}
.dk-good-t{fill:var(--color-status-green,#66bb6a);color:var(--color-status-green,#66bb6a);}
.dk-note-t{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:11px;letter-spacing:.06em;fill:var(--color-muted,#aaa);}

/* phone reflow */
.dk-list{display:none;list-style:none;margin:0;padding:0;flex-direction:column;gap:.6rem;}
@media (max-width:520px){ .dk-scene{display:none;} .dk-list{display:flex;} }
.dk-list li{display:flex;flex-direction:column;gap:.3rem;padding:.7rem .9rem;border-radius:6px;text-align:left;
  background:var(--color-navy-dark,#1f2438);box-shadow:inset 0 0 0 1.5px var(--color-panel-border,#3a3f50);}
.dk-mini{display:block;width:100%;height:auto;overflow:visible;}
.dk-li-lbl{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:.82rem;letter-spacing:.08em;}
.dk-li-note{font-family:var(--font-serif,"Lora",serif);font-size:.82rem;color:var(--color-muted,#aaa);}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .dk-good{opacity:0;}
.dgfrm.armed.in .dk-good{opacity:1;transition:opacity .6s ease .25s;}
@media (prefers-reduced-motion:reduce){ .dgfrm .dk-good{opacity:1!important;} }
`;
