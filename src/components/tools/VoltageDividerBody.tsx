// Prose body for /tools/voltage-divider. Server component wrapping the client
// island. Voice: answer-first, grounded first-hand in the OTD L1.05 ADC board,
// no em-dashes.
import Link from "next/link";

import { VoltageDividerCalculator } from "./VoltageDividerCalculator";

export function VoltageDividerBody() {
  return (
    <article className="text-[15px] leading-7 text-text">
      <p>
        A voltage divider scales a voltage down with two resistors in series: the
        output, tapped between them, is the input times the ratio of the bottom
        resistor to the pair. V<sub>out</sub> = V<sub>in</sub> &times; R2 &divide;
        (R1 + R2). To bring a 5 V rail into an ESP32&rsquo;s 3.3 V ADC, R1 = 10 k&#937;
        and R2 = 20 k&#937; give 5 &times; 20 &divide; 30 = 3.33 V. Set your own below.
      </p>

      <VoltageDividerCalculator />

      <h2 className="title-section mt-10">The formula</h2>
      <p className="mt-3">
        R2 sits between the tap and ground, R1 between the tap and the input. The
        output is the fraction of the input that R2 claims:
        R2 &divide; (R1 + R2). Equal resistors halve the voltage; making R2 larger
        than R1 keeps more of it. The ratio sets the voltage, but the two actual
        values still matter, because together they set how much current the
        divider draws and how stiff it is.
      </p>

      <h2 className="title-section mt-10">From a real board</h2>
      <p className="mt-3">
        The OTD L1.05 board reads analog signals on the ESP32&rsquo;s built-in ADC,
        which only measures up to roughly its 3.3 V rail (One Thousand Drones,
        L1.05 design 2026). Anything higher, a 5 V USB rail or a battery, has to be
        divided down first or it clips, or worse, exceeds the pin&rsquo;s
        absolute-maximum. A divider is the simplest way to fit a bigger voltage
        into that window.
      </p>

      <h2 className="title-section mt-10">Mind the loading</h2>
      <p className="mt-3">
        Whatever you connect to the tap draws a little current and pulls the output
        down. What that load sees is R1 in parallel with R2, the divider&rsquo;s
        output impedance, so keep the resistors modest enough that the ADC&rsquo;s
        input does not sag the reading, and add a small capacitor at the tap to
        give the ADC a stiff, settled voltage to sample. Bigger resistors waste
        less quiescent current but load more easily; smaller resistors are stiffer
        but burn more. The calculator shows the quiescent current so you can size
        that trade.
      </p>

      <h2 className="title-section mt-10">What it does not do</h2>
      <p className="mt-3">
        A divider scales a voltage; it is not a regulator. The output tracks the
        input, so if the input sags, the output sags with it. For a steady
        reference you want an actual reference or regulator, not a divider.
      </p>

      <h2 className="title-section mt-10">References</h2>
      <ul className="mt-3 space-y-1 text-sm text-muted">
        <li>
          Espressif Systems.{" "}
          <a
            className="text-command-gold hover:underline"
            href="https://www.espressif.com/sites/default/files/documentation/esp32-s3_datasheet_en.pdf"
            target="_blank"
            rel="noopener noreferrer"
          >
            ESP32-S3 datasheet
          </a>
          , ADC characteristics and input range.
        </li>
        <li>
          One Thousand Drones. ESP32 analog sensing (L1.05), internal ADC.{" "}
          <Link className="text-command-gold hover:underline" href="/courses/l1-05-internal-adc">
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
