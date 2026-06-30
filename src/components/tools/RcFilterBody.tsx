// Prose body for /tools/rc-filter-cutoff. Server component wrapping the client
// island. Voice: answer-first, first-hand to the OTD L1.05 ADC, no em-dashes.
import Link from "next/link";

import { RcFilterCalculator } from "./RcFilterCalculator";

export function RcFilterBody() {
  return (
    <article className="text-[15px] leading-7 text-text">
      <p>
        A first-order RC filter&rsquo;s corner frequency is f<sub>c</sub> = 1
        &divide; (2&pi;RC). That is the &minus;3 dB point, where the filter starts
        to bite. A 10 k&#937; resistor with a 100 nF capacitor rolls off above
        159 Hz. Set your own values below.
      </p>

      <RcFilterCalculator />

      <h2 className="title-section mt-10">The formula</h2>
      <p className="mt-3">
        One resistor and one capacitor set a single corner. Below f<sub>c</sub> a
        low-pass passes the signal; above it, the response falls off at 20 dB per
        decade. Swap which element goes in series and you get a high-pass with the
        same corner. The corner is set by the product RC, so a 10 k&#937; / 100 nF
        and a 1 k&#937; / 1 µF land at the same place. The two values still matter
        for loading and noise: bigger R is a higher source impedance, bigger C is
        a stiffer node.
      </p>

      <h2 className="title-section mt-10">From a real board</h2>
      <p className="mt-3">
        The OTD L1.05 board reads analog signals on the ESP32&rsquo;s ADC. A small
        RC low-pass at the input rolls off noise above the corner before the ADC
        samples it, and it gives the converter a settled voltage to grab (One
        Thousand Drones, L1.05 design 2026). Set the corner above the signal you
        care about and below the noise you do not.
      </p>

      <h2 className="title-section mt-10">A first-order filter is gentle</h2>
      <p className="mt-3">
        One stage is a soft slope, not a wall: a decade past the corner you are
        only down 20 dB. If you need a sharp edge, cascade stages (each adds
        another 20 dB per decade) or move to an active filter with a defined
        response. For a simple anti-alias or noise trim on a slow signal, one RC
        is usually enough.
      </p>

      <h2 className="title-section mt-10">References</h2>
      <ul className="mt-3 space-y-1 text-sm text-muted">
        <li>
          One Thousand Drones. ESP32 analog sensing (L1.05), ADC input filtering.{" "}
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
