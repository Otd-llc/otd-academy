// Prose body for /tools/ws2812-power-supply. Server component wrapping the
// client island. Voice: answer-first, per-claim citations, first-hand figure
// from the OTD L1.03 board, no em-dashes.
import Link from "next/link";

import { Ws2812PowerCalculator } from "./Ws2812PowerCalculator";

export function Ws2812PowerBody() {
  return (
    <article className="text-[15px] leading-7 text-gray-2">
      <p>
        Size the supply for the worst case: every pixel at full white. A WS2812
        pixel draws about 60 mA there, so 30 pixels plus a 220 mA controller
        need roughly 2.0 A at 5 V, or about 2.4 A once you add 20% headroom. Set
        your own numbers below.
      </p>

      <Ws2812PowerCalculator />

      <h2 className="mt-10 text-xl font-semibold text-gray-1">
        Where the 60 mA per pixel comes from
      </h2>
      <p className="mt-3">
        A WS2812 is three LEDs in one package, red, green, and blue, each driven
        at about 20 mA. Full white turns all three on together, so one pixel
        peaks near 60 mA at 5 V (Adafruit NeoPixel &Uuml;berguide, powering
        section). The OTD L1.03 board uses the XINGLIGHT XL-5050RGBC-WS2812B,
        whose datasheet gives the same 60 mA full-white figure for one pixel
        (One Thousand Drones, L1.03 design 2026). Most animations never hit full
        white on every pixel at once, so 60 mA per pixel is a worst-case ceiling
        rather than a typical draw. Size to that ceiling anyway, because a
        browned-out strip flickers and resets.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-gray-1">The formula</h2>
      <p className="mt-3">
        supply current (A) = (pixel count &times; per-pixel mA + controller mA)
        &times; (1 + headroom) &divide; 1000. The per-pixel term dominates once
        you pass a few dozen pixels. If you cap brightness in firmware, lower the
        per-pixel input to match, since current scales with the PWM duty you
        actually run.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-gray-1">
        Long strings: inject power, watch the copper
      </h2>
      <p className="mt-3">
        A long strip cannot pull all its current through the first pixel&rsquo;s
        tiny pads. Voltage sags along the run, so the far end dims and shifts
        color. Feed 5 V at both ends, or every metre or so, from the same
        supply. On the L1.03 board the strip power comes in on its own injection
        terminal rather than through the USB rail, and the board copper, more
        than the screw terminal, sets the current limit (One Thousand Drones, L1.03
        design 2026). Keep your supply ground common with the controller ground
        or the data signal loses its reference.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-gray-1">Worked example</h2>
      <p className="mt-3">
        Drive 30 pixels from an ESP32 node that itself draws 220 mA: 30 &times;
        60 + 220 = 2020 mA worst case. Add 20% headroom and you want a 5 V
        supply rated for at least 2.4 A. Scale that to a 150-pixel strip and the
        pixels alone ask for 9 A, which is why a long run needs a dedicated
        brick and power injection rather than USB.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-gray-1">References</h2>
      <ul className="mt-3 space-y-1 text-sm text-muted">
        <li>
          Adafruit.{" "}
          <a
            className="text-command-gold hover:underline"
            href="https://learn.adafruit.com/adafruit-neopixel-uberguide/powering-neopixels"
            target="_blank"
            rel="noopener noreferrer"
          >
            NeoPixel &Uuml;berguide, powering NeoPixels
          </a>{" "}
          (60 mA per pixel at full white).
        </li>
        <li>
          One Thousand Drones. WS2812 addressable-LED driver (L1.03), power
          budget and XINGLIGHT XL-5050RGBC-WS2812B datasheet figure.{" "}
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
