"use client";

import { useState } from "react";

import {
  resistorPowerW,
  recommendResistorWattage,
} from "@/lib/tools/calculators";
import { CalcShell, NumberField, Readout, SubReadout } from "./calc-ui";

function formatW(w: number): string {
  if (w < 1) return `${(w * 1000).toFixed(0)} mW`;
  return `${w.toFixed(2)} W`;
}

// Interactive island for the resistor power / wattage-rating page. Math via the
// unit-tested helpers; the recommended standard rating carries a 2x margin.
export function ResistorPowerCalculator() {
  const [currentMa, setCurrentMa] = useState(1000);
  const [rOhms, setROhms] = useState(0.1);

  const valid = currentMa >= 0 && rOhms >= 0;
  const watts = valid ? resistorPowerW({ currentMa, rOhms }) : null;
  const rating = watts !== null ? recommendResistorWattage(watts) : null;
  const vAcross = (currentMa / 1000) * rOhms;

  return (
    <CalcShell
      fields={
        <>
          <NumberField
            label="Current through the resistor"
            value={currentMa}
            onChange={setCurrentMa}
            min={0}
            step={50}
            suffix="mA"
            hint="The worst-case current the resistor carries."
          />
          <NumberField
            label="Resistance"
            value={rOhms}
            onChange={setROhms}
            min={0}
            step={0.1}
            suffix="Ω"
          />
        </>
      }
      readout={
        <>
          <Readout
            value={watts !== null ? formatW(watts) : "·"}
            unit="dissipated as heat"
            note={
              rating !== null
                ? `Use a part rated ${rating} W or more (2x margin). Voltage across it: ${vAcross.toFixed(3)} V.`
                : "Enter values."
            }
          />
          <div className="mt-5">
            <SubReadout
              label="Smallest standard rating (2x margin)"
              value={rating !== null ? `${rating} W` : "·"}
            />
          </div>
        </>
      }
    />
  );
}
