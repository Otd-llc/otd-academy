// GPIO: one pin, two directions (diagram-standards v2). MCU cluster, diagram 2.
// Owner-picked G1: two schematic panels.
//
// Teaching point (lesson 1): a GPIO pin is set as an output to drive a wire high
// or low (lighting an LED through a resistor) or as an input to read a level
// (a pull-up holds it high until a button pulls it low). Left panel = the output
// circuit; right panel = the input circuit. Gold is the drive path, blue is the
// read path.
//
// Two real schematics (resistor, LED, button, ground). Each panel is its own SVG
// in a flex row, so on a phone they STACK and each fills the width instead of
// shrinking its labels. Token color, both themes. Header + caption from DiagramFrame.
import { DiagramFrame } from "./DiagramFrame";

function Gnd({ x, y }: { x: number; y: number }) {
  return (
    <>
      <line x1={x} y1={y} x2={x} y2={y + 8} className="gpw" />
      <line x1={x - 9} y1={y + 8} x2={x + 9} y2={y + 8} className="gpw" />
      <line x1={x - 5} y1={y + 12} x2={x + 5} y2={y + 12} className="gpw" />
      <line x1={x - 2} y1={y + 16} x2={x + 2} y2={y + 16} className="gpw" />
    </>
  );
}

export function McuGpioInOut({ caption }: { caption?: string }) {
  return (
    <DiagramFrame
      eyebrow="MICROCONTROLLERS · GPIO"
      tone="gold"
      title="One pin, two directions"
      ariaLabel="One GPIO pin shown two ways. As an output, the pin drives current through a resistor and an LED to ground, lighting the LED. As an input, a pull-up resistor ties the pin to 3.3 volts so it reads high, until a button to ground pulls it low. You set the direction first, then write the pin or read it."
      caption={caption}
      defaultCaption="Drive a pin high or low as an output to light an LED through a resistor; read a level as an input, with a pull-up holding it high until a button pulls it low."
    >
      <style>{CSS}</style>
      <div className="gp">
        {/* OUTPUT panel */}
        <svg className="gp-svg" viewBox="0 0 236 150" aria-hidden="true">
          <text x="4" y="14" className="gp-po">OUTPUT · DRIVE</text>
          <circle cx="22" cy="84" r="5" className="gpn" />
          <text x="22" y="106" textAnchor="middle" className="gp-pin">GPIO</text>
          <line x1="27" y1="84" x2="54" y2="84" className="gpw" />
          <path d="M54 84 L61 78 L68 90 L75 78 L82 90 L89 78 L96 84" className="gpw" fill="none" />
          <text x="75" y="68" textAnchor="middle" className="gp-l">R</text>
          <line x1="96" y1="84" x2="120" y2="84" className="gpw" />
          {/* LED */}
          <path d="M120 75 L120 93 L138 84 Z" className="gpw" fill="none" />
          <line x1="138" y1="75" x2="138" y2="93" className="gpw" />
          <line x1="126" y1="71" x2="133" y2="64" className="gpw" />
          <line x1="131" y1="74" x2="138" y2="67" className="gpw" />
          <text x="130" y="57" textAnchor="middle" className="gp-l">LED</text>
          <line x1="138" y1="84" x2="168" y2="84" className="gpw" />
          <line x1="168" y1="84" x2="168" y2="108" className="gpw" />
          <Gnd x={168} y={108} />
        </svg>

        <div className="gp-div" aria-hidden="true" />

        {/* INPUT panel */}
        <svg className="gp-svg" viewBox="0 0 236 220" aria-hidden="true">
          <text x="4" y="14" className="gp-pi">INPUT · READ</text>
          <text x="120" y="40" textAnchor="middle" className="gp-v">3.3 V</text>
          <line x1="120" y1="46" x2="120" y2="58" className="gpw" />
          <path d="M120 58 L114 65 L126 71 L114 78 L126 85 L114 91 L120 98" className="gpw" fill="none" />
          <text x="150" y="80" className="gp-l">pull-up</text>
          <line x1="120" y1="98" x2="120" y2="132" className="gpw" />
          <circle cx="120" cy="132" r="3" className="gp-dot" />
          {/* read path — blue */}
          <line x1="120" y1="132" x2="27" y2="132" className="gpwb" />
          <circle cx="22" cy="132" r="5" className="gpnb" />
          <text x="22" y="154" textAnchor="middle" className="gp-pin">GPIO</text>
          {/* button to ground */}
          <line x1="120" y1="132" x2="120" y2="150" className="gpw" />
          <line x1="120" y1="150" x2="120" y2="158" className="gpw" />
          <line x1="120" y1="172" x2="120" y2="180" className="gpw" />
          <circle cx="120" cy="158" r="2" className="gp-dotf" />
          <circle cx="120" cy="172" r="2" className="gp-dotf" />
          <line x1="118" y1="159" x2="133" y2="152" className="gpw" />
          <text x="150" y="170" className="gp-l">button</text>
          <line x1="120" y1="180" x2="120" y2="196" className="gpw" />
          <Gnd x={120} y={196} />
        </svg>
      </div>
    </DiagramFrame>
  );
}

const CSS = `
.gp{display:flex;gap:.6rem;align-items:flex-start;justify-content:center;max-width:36rem;margin-inline:auto;padding-top:.4rem;}
.gp-svg{flex:1 1 236px;min-width:0;max-width:266px;height:auto;overflow:visible;}
.gp-div{flex:0 0 0;align-self:stretch;border-left:1px dashed var(--color-panel-border,#3a3f50);margin:.5rem 0;}
@media (max-width:520px){
  .gp{flex-direction:column;gap:.2rem;}
  .gp-svg{max-width:min(320px,100%);}
  .gp-div{align-self:stretch;border-left:0;border-top:1px dashed var(--color-panel-border,#3a3f50);margin:0 2rem;width:auto;}
}
.gpw{stroke:var(--color-command-gold,#c8963e);stroke-width:1.8;fill:none;stroke-linecap:round;}
.gpwb{stroke:var(--color-signal-blue,#4a8fff);stroke-width:1.8;fill:none;stroke-linecap:round;}
.gpn{fill:var(--color-navy-dark,#1a1a2e);stroke:var(--color-command-gold,#c8963e);stroke-width:1.8;}
.gpnb{fill:var(--color-navy-dark,#1a1a2e);stroke:var(--color-signal-blue,#4a8fff);stroke-width:1.8;}
.gp-dot{fill:var(--color-command-gold,#c8963e);}
.gp-dotf{fill:var(--color-command-gold,#c8963e);}
.gp-po{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:12px;letter-spacing:.12em;fill:var(--color-command-gold,#c8963e);}
.gp-pi{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:12px;letter-spacing:.12em;fill:var(--color-signal-blue,#4a8fff);}
.gp-pin{font-family:var(--font-mono,"Space Mono",monospace);font-weight:700;font-size:12px;fill:var(--color-title,#f1ece0);}
.gp-l{font-family:var(--font-mono,"Space Mono",monospace);font-size:11px;fill:var(--color-muted,#aaaaaa);}
.gp-v{font-family:var(--font-numeral,"Saira Condensed",sans-serif);font-weight:700;font-size:14px;fill:var(--color-muted,#aaaaaa);}

/* Tier-B reveal off the frame's armed/in contract (final state under reduced-motion). */
.dgfrm.armed .gp-svg{opacity:0;transform:translateY(6px);}
.dgfrm.armed.in .gp-svg{opacity:1;transform:none;transition:opacity .55s ease,transform .55s cubic-bezier(.2,.7,.2,1);}
.dgfrm.armed.in .gp-svg:last-of-type{transition-delay:.12s;}
@media (prefers-reduced-motion:reduce){
  .dgfrm .gp-svg{opacity:1!important;transform:none!important;transition:none!important;}
}
`;
