// Prose body for /tools/resistor-power. Server component wrapping the client
// island. Voice: answer-first, first-hand to the OTD bn-02 electronic load, no
// em-dashes.
import Link from "next/link";

import { ResistorPowerCalculator } from "./ResistorPowerCalculator";

export function ResistorPowerBody() {
  return (
    <article className="text-[15px] leading-7 text-text">
      <p>
        A resistor turns the power it cannot pass into heat: P = I&sup2;R, which
        is the same as V &times; I or V&sup2; &divide; R. A 0.1 &#937; current-sense
        resistor carrying 1 A burns 0.1 W, so you would fit a part rated 0.25 W or
        more for margin. Set your own below.
      </p>

      <ResistorPowerCalculator />

      <h2 className="title-section mt-10">The formula</h2>
      <p className="mt-3">
        Three forms of the same thing, depending on what you know: P = I&sup2;R if
        you have the current and the resistance, P = V &times; I if you have the
        voltage across it and the current, P = V&sup2; &divide; R from the voltage
        and resistance. For a current-sense or ballast resistor you usually know
        the current and the value, so I&sup2;R is the one to reach for.
      </p>

      <h2 className="title-section mt-10">Pick the rating with margin</h2>
      <p className="mt-3">
        A resistor&rsquo;s power rating is the point where it sits near its maximum
        temperature in still air. Running one at its rating is asking for a hot,
        drifting, short-lived part, so the calculator recommends the smallest
        standard rating at twice the dissipation. Derate further if the resistor
        lives in a hot enclosure or next to other heat, and check the
        datasheet&rsquo;s derating curve, which pulls the allowed power down as
        ambient temperature rises.
      </p>

      <h2 className="title-section mt-10">From a real board</h2>
      <p className="mt-3">
        Power dissipation is the whole design constraint for the OTD bn-02 DC
        electronic load, a bench tool that sinks a programmable current and burns
        it as heat in a resistor and a transistor (One Thousand Drones, bench-tools
        arc 2026). Sink 1 A from a 5 V supply and you are turning 5 W into heat
        that has to go somewhere, which is why a load like that is mostly heatsink.{" "}
        <Link className="text-command-gold hover:underline" href="/courses/bn-02-dc-electronic-load">
          See the electronic-load course
        </Link>
        .
      </p>

      <h2 className="title-section mt-10">References</h2>
      <ul className="mt-3 space-y-1 text-sm text-muted">
        <li>
          Your resistor&rsquo;s datasheet for the power rating and the temperature
          derating curve.
        </li>
        <li>
          One Thousand Drones. ESP32 DC electronic load (bn-02), power handling.{" "}
          <Link className="text-command-gold hover:underline" href="/courses/bn-02-dc-electronic-load">
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
