"use client";

import { useState } from "react";

import {
  ldoHeadroomV,
  ldoHolds,
  ldoDissipationW,
} from "@/lib/tools/calculators";
import { CalcShell, NumberField, Readout, SubReadout } from "./calc-ui";

// Interactive island for the LDO headroom + dissipation page. The hero readout
// is the power burned as heat (the real thermal limit); the note + sub-readout
// carry the does-it-regulate verdict.
export function LdoHeadroomCalculator() {
  const [vinV, setVinV] = useState(5);
  const [voutV, setVoutV] = useState(3.3);
  const [dropoutV, setDropoutV] = useState(0.3);
  const [currentMa, setCurrentMa] = useState(550);

  const headroom = ldoHeadroomV({ vinV, voutV });
  const holds = ldoHolds({ vinV, voutV, dropoutV });
  const watts = ldoDissipationW({ vinV, voutV, currentMa });

  return (
    <CalcShell
      fields={
        <>
          <NumberField
            label="Input voltage"
            value={vinV}
            onChange={setVinV}
            min={0}
            step={0.1}
            suffix="V"
            hint="The rail feeding the LDO (e.g. 5 V from USB, or a battery)."
          />
          <NumberField
            label="Output voltage"
            value={voutV}
            onChange={setVoutV}
            min={0}
            step={0.1}
            suffix="V"
            hint="The regulated rail you want (e.g. 3.3 V)."
          />
          <NumberField
            label="Dropout voltage"
            value={dropoutV}
            onChange={setDropoutV}
            min={0}
            step={0.05}
            suffix="V"
            hint="From the LDO datasheet, at your load current. Low-dropout parts are ~0.1–0.5 V."
          />
          <NumberField
            label="Load current"
            value={currentMa}
            onChange={setCurrentMa}
            min={0}
            step={50}
            suffix="mA"
            hint="The worst-case current the rail has to deliver."
          />
        </>
      }
      readout={
        <>
          <Readout
            value={`${watts.toFixed(2)} W`}
            unit="dissipated as heat"
            note={
              holds
                ? `Regulates: ${headroom.toFixed(2)} V headroom is at or above the ${dropoutV} V dropout.`
                : `Drops out: only ${headroom.toFixed(2)} V headroom, below the ${dropoutV} V dropout.`
            }
          />
          <div className="mt-5">
            <SubReadout
              label="Regulation"
              value={holds ? "✓ Holds the output" : "✕ Drops out"}
            />
          </div>
        </>
      }
    />
  );
}
