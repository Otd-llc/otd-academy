// Prose body for /tools/lipo-battery-runtime. Server component (the interactive
// island is the only client part). Voice: answer-first, per-claim citations,
// first-hand figures from the OTD L1.01 board, no em-dashes.
import Link from "next/link";

import { LipoRuntimeCalculator } from "./LipoRuntimeCalculator";

export function LipoRuntimeBody() {
  return (
    <article className="text-[15px] leading-7 text-gray-2">
      <p>
        Runtime is usable battery capacity divided by average current draw. A
        2000 mAh pack feeding a board that averages 120 mA, at 80% usable
        capacity, lasts about 13 hours. Change the three inputs below to size
        your own.
      </p>

      <LipoRuntimeCalculator />

      <h2 className="mt-10 text-xl font-semibold text-gray-1">The formula</h2>
      <p className="mt-3">
        runtime (hours) = capacity (mAh) &times; usable fraction &divide; average
        draw (mA). Capacity and draw share the same mA unit, so they cancel to
        hours. Two inputs decide the answer, and both are easy to get wrong:
        which current you use, and how much of the printed capacity you actually
        get.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-gray-1">
        Use the average current, measured over a full duty cycle
      </h2>
      <p className="mt-3">
        The figure that sets runtime is average draw across a complete wake and
        sleep cycle, in mA. Peaks barely matter. On the OTD L1.01 ESP32-S3
        board, the power budget is a 500 mA Wi-Fi transmit peak plus about
        50 mA for the rest of the board, roughly 550 mA total against the
        regulator&rsquo;s 600 mA ceiling (One Thousand Drones, L1.01 design
        2026). That 550 mA peak lasts microseconds during a transmit burst. A
        sensor node that wakes, samples, sends, then sleeps spends most of its
        life near its sleep floor, so its average can sit well below 120 mA.
        Size runtime on the average. Size the regulator and the wiring on the
        peak.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-gray-1">
        Usable capacity is never 100%
      </h2>
      <p className="mt-3">
        A LiPo gives your board less than its printed mAh. Some charge sits
        below the regulator&rsquo;s dropout cutoff, and a little more goes to
        converter loss. A usable fraction of 70 to 85% covers most
        linear-regulator designs; an efficient switch-mode converter can do
        better. The calculator defaults to 80%.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-gray-1">Worked example</h2>
      <p className="mt-3">
        Take a 2000 mAh single-cell LiPo on the L1.01 board, firmware that
        duty-cycles Wi-Fi down to a 120 mA average, and 80% usable capacity:
        2000 &times; 0.80 &divide; 120 = 13.3 hours. Halve the average draw and
        the runtime doubles, which is why firmware sleep usually buys more
        runtime per dollar than a bigger cell.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-gray-1">References</h2>
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
          , current consumption characteristics.
        </li>
        <li>
          One Thousand Drones. ESP32-S3 USB-C breakout (L1.01), measured power
          budget.{" "}
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
