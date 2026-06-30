// Prose body for /tools/ldo-headroom. Server component wrapping the client
// island. Voice: answer-first, first-hand to the OTD L1.01 RT9080, no em-dashes.
import Link from "next/link";

import { LdoHeadroomCalculator } from "./LdoHeadroomCalculator";

export function LdoHeadroomBody() {
  return (
    <article className="text-[15px] leading-7 text-text">
      <p>
        A linear LDO holds its output only while the input stays above the output
        by at least its dropout voltage. The voltage it drops becomes heat: power
        = (V<sub>in</sub> &minus; V<sub>out</sub>) &times; the load current. A 5 V
        rail regulated to 3.3 V at 550 mA burns 1.7 V &times; 0.55 A = 0.94 W,
        which is what actually limits the part. Set your own below.
      </p>

      <LdoHeadroomCalculator />

      <h2 className="title-section mt-10">Headroom: will it even regulate?</h2>
      <p className="mt-3">
        The gap between input and output, V<sub>in</sub> &minus; V<sub>out</sub>,
        is the headroom. The LDO needs that gap to stay at or above its dropout
        voltage, or the output starts following the input down and the rail sags.
        Dropout grows with load current, so read it from the datasheet at the
        current you actually draw, not the headline figure. A battery is the case
        to watch: as it discharges, V<sub>in</sub> falls toward V<sub>out</sub>
        and a regulator that was fine at full charge can drop out near empty.
      </p>

      <h2 className="title-section mt-10">Dissipation is the real limit</h2>
      <p className="mt-3">
        A linear LDO passes its full output current straight through, so the input
        current roughly equals the output current. Every volt of headroom times
        that current turns into heat in the package. A big input-to-output gap at
        high current cooks the part: the same 0.94 W on a tiny SOT-23 has nowhere
        to go. The calculator shows the watts so you can check it against the
        package&rsquo;s thermal rating before you trust it.
      </p>

      <h2 className="title-section mt-10">From a real board</h2>
      <p className="mt-3">
        The OTD L1.01 board regulates USB&rsquo;s 5 V down to 3.3 V with an RT9080
        linear LDO. At the board&rsquo;s Wi-Fi-transmit peak near 550 mA that is
        roughly 1 W transient through the regulator (One Thousand Drones, L1.01 /
        L1.03 design 2026), which is exactly why it is sized as a 600 mA part with
        a thermal pad and not a tiny one.
      </p>

      <h2 className="title-section mt-10">When a switcher beats an LDO</h2>
      <p className="mt-3">
        An LDO is small, quiet, and cheap, and it is the right call for a small
        drop or a low current. When the drop is large and the current is high, the
        wasted heat is the problem, and a switching (buck) converter that steps the
        voltage down efficiently makes more sense. The trade is size, cost, and
        switching noise.{" "}
        <Link className="text-command-gold hover:underline" href="/courses/l2-01-battery-power-module">
          See the battery and power module course
        </Link>
        .
      </p>

      <h2 className="title-section mt-10">References</h2>
      <ul className="mt-3 space-y-1 text-sm text-muted">
        <li>
          Your LDO&rsquo;s datasheet for the dropout voltage (at your load current)
          and the package thermal resistance.
        </li>
        <li>
          One Thousand Drones. ESP32-S3 USB-C breakout (L1.01), RT9080 3.3 V rail.{" "}
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
