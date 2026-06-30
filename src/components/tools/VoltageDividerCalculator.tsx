"use client";

import { useState } from "react";

import {
  voltageDividerOut,
  voltageDividerCurrentMa,
} from "@/lib/tools/calculators";
import { CalcShell, NumberField, Readout, SubReadout } from "./calc-ui";

// Interactive island for the voltage-divider page. Math goes through the
// unit-tested helpers. R1/R2 take ohms; the Ω stays in the mono unit chrome.
export function VoltageDividerCalculator() {
  const [vinV, setVinV] = useState(5);
  const [r1Ohms, setR1Ohms] = useState(10000);
  const [r2Ohms, setR2Ohms] = useState(20000);

  const valid = r1Ohms + r2Ohms > 0;
  const vout = valid ? voltageDividerOut({ vinV, r1Ohms, r2Ohms }) : null;
  const currentMa = valid ? voltageDividerCurrentMa({ vinV, r1Ohms, r2Ohms }) : null;

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
            hint="The voltage going into the top of the divider."
          />
          <NumberField
            label="R1 (top, to Vin)"
            value={r1Ohms}
            onChange={setR1Ohms}
            min={0}
            step={1000}
            suffix="Ω"
            hint="The upper resistor, between Vin and the tap."
          />
          <NumberField
            label="R2 (bottom, to GND)"
            value={r2Ohms}
            onChange={setR2Ohms}
            min={0}
            step={1000}
            suffix="Ω"
            hint="The lower resistor, between the tap and ground. Vout is read here."
          />
        </>
      }
      readout={
        <>
          <Readout
            value={vout !== null ? `${vout.toFixed(2)} V` : "·"}
            unit="output voltage (at the tap)"
            note="Add an ADC's input impedance in parallel with R2 if it's not much larger than R2."
          />
          <div className="mt-5">
            <SubReadout
              label="Quiescent current through the divider"
              value={currentMa !== null ? `${currentMa.toFixed(3)} mA` : "·"}
            />
          </div>
        </>
      }
    />
  );
}
