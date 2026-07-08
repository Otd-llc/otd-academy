// Prose body for /tools/ohms-law. Server component wrapping the client island.
// Voice: answer-first, first-hand to the OTD L1.01 board, no em-dashes.
import Link from "next/link";

import { OhmsLawCalculator } from "./OhmsLawCalculator";

export function OhmsLawBody() {
  return (
    <article className="text-[15px] leading-7 text-text">
      <p>
        Ohm&rsquo;s law is V = I &times; R: the voltage across a resistor equals the
        current through it times its resistance. Rearrange it for whichever you need,
        I = V &divide; R or R = V &divide; I, and the power it burns is P = V &times; I.
        That is most of practical electronics in one line. Solve for any of the three
        below.
      </p>

      <OhmsLawCalculator />

      <h2 className="title-section mt-10">The three forms</h2>
      <p className="mt-3">
        They are one equation, written for whatever you are missing. Know the current
        and the resistance and you want the voltage: V = I &times; R. Know the voltage
        and the resistance and you want the current: I = V &divide; R. Know the voltage
        and the current and you want the resistance: R = V &divide; I. Keep the units
        honest, volts and amps and ohms, and the arithmetic is exact. This calculator
        takes current in milliamps and converts for you.
      </p>

      <h2 className="title-section mt-10">Power comes with it</h2>
      <p className="mt-3">
        Any part carrying current at a voltage is dissipating power, P = V &times; I,
        and for a resistor that also equals I&sup2;R or V&sup2; &divide; R. It leaves
        as heat. A resistor rated for less than it dissipates runs hot, drifts, and
        eventually fails, so once you have the value, check the power and pick a part
        rated above it with margin. The{" "}
        <Link className="text-command-gold hover:underline" href="/tools/resistor-power">
          resistor power calculator
        </Link>{" "}
        does that step.
      </p>

      <h2 className="title-section mt-10">From a real board</h2>
      <p className="mt-3">
        The status LED on the OTD L1.01 ESP32-S3 USB-C breakout is a plain Ohm&rsquo;s-law
        problem (One Thousand Drones, L1.01 build guide). The 3.3 V rail drives a red LED
        that drops about 1.8 V, so the resistor sees the difference, 1.5 V. Aim for a
        gentle 3 mA and the resistor is R = 1.5 V &divide; 3 mA = 500 &#937;, so you fit
        the nearest standard value and move on. Every current-limiting resistor on the
        board is the same three-line calculation.{" "}
        <Link className="text-command-gold hover:underline" href="/courses/l1-01-wroom-breakout">
          See the L1.01 build
        </Link>
        .
      </p>

      <h2 className="title-section mt-10">References</h2>
      <ul className="mt-3 space-y-1 text-sm text-muted">
        <li>
          Georg Ohm&rsquo;s relation between voltage, current, and resistance, in any
          introductory circuits text.
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
