// Prose body for /tools/led-series-resistor. Server component wrapping the
// client island. Voice: answer-first, per-claim grounding, first-hand to the
// OTD L1.01 indicator LED, no em-dashes.
import Link from "next/link";

import { LedResistorCalculator } from "./LedResistorCalculator";

export function LedResistorBody() {
  return (
    <article className="text-[15px] leading-7 text-text">
      <p>
        An LED sets its brightness by its current, not its voltage, so it needs a
        series resistor to limit that current. The resistor is the supply voltage
        minus the LED&rsquo;s own forward drop, divided by the current you want. A
        red LED (about 1.8 V) on a 3.3 V rail at 5 mA wants (3.3 &minus; 1.8) &divide;
        0.005 = 300 &#937;. Set your own numbers below.
      </p>

      <LedResistorCalculator />

      <h2 className="title-section mt-10">The formula</h2>
      <p className="mt-3">
        R = (V<sub>supply</sub> &minus; V<sub>f</sub>) &divide; I. Subtract the
        LED&rsquo;s forward voltage first: the LED &ldquo;eats&rdquo; that much,
        and only the leftover voltage falls across the resistor. Then it&rsquo;s
        Ohm&rsquo;s law on the resistor. Two inputs you have to get from the
        datasheet or pick deliberately: the forward voltage V<sub>f</sub> (it
        varies by colour and part, from ~1.8 V for red up to ~3.4 V for blue and
        white) and the current you want.
      </p>

      <h2 className="title-section mt-10">Round up to a real part</h2>
      <p className="mt-3">
        The exact number is rarely a stocked value, so the calculator snaps it to
        the nearest <strong>E24</strong> standard (the 5% preferred-value series,
        IEC 60063). It rounds UP, which means a slightly higher resistance and a
        touch less current. That is the safe direction: a little dimmer beats over
        a limit. For an indicator you will not notice the difference between 300 &#937;
        and 330 &#937;.
      </p>

      <h2 className="title-section mt-10">From a real board</h2>
      <p className="mt-3">
        The OTD L1.01 ESP32-S3 board carries a power indicator LED off its 3.3 V
        rail, sized with exactly this calculation (One Thousand Drones, L1.01
        design 2026). Indicator LEDs are comfortable at 2 to 10 mA, well under the
        20 mA a typical 5 mm part is rated for, and dimmer LEDs draw less and read
        fine on a board you look at up close.
      </p>

      <h2 className="title-section mt-10">Check the resistor&rsquo;s power</h2>
      <p className="mt-3">
        The resistor burns (V<sub>supply</sub> &minus; V<sub>f</sub>) &times; I.
        For an indicator that is a few milliwatts, so any 0402/0603 part is fine.
        It matters at higher currents: a 5 V rail driving 20 mA burns 60 mW in the
        resistor, so pick a part rated for at least twice the dissipation.
      </p>

      <h2 className="title-section mt-10">When a resistor is the wrong tool</h2>
      <p className="mt-3">
        A series resistor suits indicators. It is a poor fit for a high-power LED:
        the resistor wastes real power as heat, and the current drifts as the LED
        warms and its forward voltage falls. Power LEDs want a constant-current
        driver that holds the current steady regardless. That is a different board
        entirely.{" "}
        <Link className="text-command-gold hover:underline" href="/courses/l2-04-power-led-driver">
          See the power-LED driver course
        </Link>
        .
      </p>

      <h2 className="title-section mt-10">References</h2>
      <ul className="mt-3 space-y-1 text-sm text-muted">
        <li>
          Your LED&rsquo;s datasheet for the forward voltage V<sub>f</sub> and the
          absolute-maximum current.
        </li>
        <li>
          IEC 60063 preferred values (the E12/E24/E96 resistor and capacitor
          series).
        </li>
        <li>
          One Thousand Drones. ESP32-S3 USB-C breakout (L1.01), indicator LED.{" "}
          <Link className="text-command-gold hover:underline" href="/courses/l1-01-wroom-breakout">
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
