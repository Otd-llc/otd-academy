// Prose body for /tools/battery-watt-hours. Server component wrapping the client
// island. Voice: answer-first, first-hand to the OTD l3-04 BMS / l2-01 battery
// module, no em-dashes.
import Link from "next/link";

import { BatteryEnergyCalculator } from "./BatteryEnergyCalculator";

export function BatteryEnergyBody() {
  return (
    <article className="text-[15px] leading-7 text-text">
      <p>
        A battery&rsquo;s energy is watt-hours, not milliamp-hours:
        Wh = (capacity in Ah) &times; the nominal voltage. A 3000 mAh, 3.7 V cell
        holds 11.1 Wh. Stack them into a pack and a 3S2P of those cells holds
        66.6 Wh at 11.1 V. Set your own below.
      </p>

      <BatteryEnergyCalculator />

      <h2 className="title-section mt-10">Series adds volts, parallel adds capacity</h2>
      <p className="mt-3">
        A pack is written S&times;P: S cells in series stack their voltages, P
        cells in parallel add their capacities. Energy is the product of the two,
        so a 3S2P and a 2S3P of the same cells hold the same watt-hours but at
        different voltage and current. Use watt-hours to compare them, because mAh
        alone is meaningless across different voltages: 2000 mAh at 12 V is far
        more energy than 2000 mAh at 3.7 V.
      </p>

      <h2 className="title-section mt-10">Why watt-hours is the number that matters</h2>
      <p className="mt-3">
        Watt-hours is what sets runtime (energy divided by the load&rsquo;s power),
        what sizes a charger, and what the shipping and airline rules go by, since
        they cap watt-hours per cell and per pack. Capacity in mAh only tells you
        the story once you also fix the voltage.
      </p>

      <h2 className="title-section mt-10">From a real board</h2>
      <p className="mt-3">
        The OTD l3-04 board is a multi-cell battery management system: it charges
        and protects a pack whose energy you size exactly this way (One Thousand
        Drones, curriculum 2026). A bigger pack stores more energy and also more to
        go wrong, which is the whole reason a BMS watches every cell.{" "}
        <Link className="text-command-gold hover:underline" href="/courses/l3-04-bms">
          See the BMS course
        </Link>
        , or start with the single-cell{" "}
        <Link className="text-command-gold hover:underline" href="/courses/l2-01-battery-power-module">
          battery and power module
        </Link>
        .
      </p>

      <h2 className="title-section mt-10">References</h2>
      <ul className="mt-3 space-y-1 text-sm text-muted">
        <li>
          Your cell&rsquo;s datasheet for the rated capacity and the nominal
          voltage (and the watt-hour figure, if it lists one).
        </li>
        <li>
          One Thousand Drones. Multi-cell battery management system (l3-04).{" "}
          <Link className="text-command-gold hover:underline" href="/courses/l3-04-bms">
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
