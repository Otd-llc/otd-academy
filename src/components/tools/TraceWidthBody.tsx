// Prose body for /tools/pcb-trace-width. Server component wrapping the client
// island. Voice: answer-first, cited to IPC-2221, first-hand to the OTD L1.03
// 5 V injection traces, no em-dashes.
import Link from "next/link";

import { TraceWidthCalculator } from "./TraceWidthCalculator";

export function TraceWidthBody() {
  return (
    <article className="text-[15px] leading-7 text-text">
      <p>
        How wide a PCB trace needs to be is set by the current it carries and how
        warm you will let it run. Using the IPC-2221 curve, a 2 A trace at a 10 &deg;C
        rise on 1 oz outer-layer copper wants about 31 mil, roughly 0.78 mm. Set
        your own below.
      </p>

      <TraceWidthCalculator />

      <h2 className="title-section mt-10">The formula</h2>
      <p className="mt-3">
        IPC-2221 fits a curve to measured data: I = k &middot; &Delta;T<sup>0.44</sup>
        &middot; A<sup>0.725</sup>, where A is the trace cross-section (width
        &times; copper thickness) in square mils, &Delta;T is the temperature rise
        you allow, and k captures cooling (Association Connecting Electronics
        Industries, IPC-2221). Solving for the width: pick a current and a rise,
        get the cross-section, then divide by the copper thickness. Outer copper is
        usually about 1.4 mil per ounce.
      </p>

      <h2 className="title-section mt-10">External vs internal</h2>
      <p className="mt-3">
        An outer-layer trace sits in air and sheds heat, so it can be narrower; an
        inner-layer trace is buried in laminate with nowhere for the heat to go,
        so it needs more copper for the same current. The constant k carries this:
        0.048 external, 0.024 internal. The toggle switches between them. Letting
        the trace run warmer also lets it be narrower, since the formula trades
        width against temperature rise.
      </p>

      <h2 className="title-section mt-10">From a real board</h2>
      <p className="mt-3">
        On the OTD L1.03 WS2812 board the strip&rsquo;s 5 V power comes in on a
        dedicated injection terminal and runs across the board to the output. The
        screw terminals handle far more current than the copper does, so the board
        trace is the real limit and it is sized for the strip&rsquo;s worst-case
        current with exactly this calculation (One Thousand Drones, L1.03 design
        2026). A strip that draws amps needs real copper, not a signal trace.{" "}
        <Link className="text-command-gold hover:underline" href="/courses/l1-03-ws2812-node">
          See the WS2812 driver course
        </Link>
        .
      </p>

      <h2 className="title-section mt-10">Treat it as a floor, not a target</h2>
      <p className="mt-3">
        IPC-2221 gives a conservative minimum from old, broad data. It does not
        know about a nearby hot regulator, a via that pinches the current, or a
        plane that helps spread the heat. Use it to find the floor, then widen for
        margin where you have the room, and use a poured copper area rather than a
        skinny trace for a high-current rail.
      </p>

      <h2 className="title-section mt-10">References</h2>
      <ul className="mt-3 space-y-1 text-sm text-muted">
        <li>
          IPC. IPC-2221, Generic Standard on Printed Board Design (the
          current-capacity curves this calculator fits).
        </li>
        <li>
          DigiKey.{" "}
          <a
            className="text-command-gold hover:underline"
            href="https://www.digikey.com/en/resources/conversion-calculators/conversion-calculator-pcb-trace-width"
            target="_blank"
            rel="noopener noreferrer"
          >
            PCB trace width conversion calculator
          </a>{" "}
          (the same IPC-2221 formula and constants).
        </li>
        <li>
          One Thousand Drones. WS2812 driver (L1.03), 5 V injection traces.{" "}
          <Link className="text-command-gold hover:underline" href="/courses/l1-03-ws2812-node">
            Build the board
          </Link>
          .
        </li>
      </ul>

      <p className="mt-8 text-sm">
        <Link className="text-command-gold hover:underline" href="/tools">
          &larr; More OTD calculators
        </Link>
      </p>
    </article>
  );
}
