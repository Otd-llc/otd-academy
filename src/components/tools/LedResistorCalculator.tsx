"use client";

import { useState } from "react";

import {
  ledSeriesResistorOhms,
  ledResistorPowerMw,
  nextE24Up,
} from "@/lib/tools/calculators";
import { CalcShell, NumberField, Readout, SubReadout } from "./calc-ui";

// Interactive island for the LED series-resistor page. Math goes through the
// unit-tested helpers; the Ω symbol stays in the mono unit label (not the Saira
// readout, which is loaded for digits + basic-latin units, not Greek).
export function LedResistorCalculator() {
  const [supplyV, setSupplyV] = useState(3.3);
  const [ledVf, setLedVf] = useState(1.8);
  const [currentMa, setCurrentMa] = useState(5);

  const valid = supplyV > ledVf && currentMa > 0;
  const ohms = valid ? ledSeriesResistorOhms({ supplyV, ledVf, currentMa }) : null;
  const e24 = ohms !== null ? nextE24Up(ohms) : null;
  const powerMw = valid ? ledResistorPowerMw({ supplyV, ledVf, currentMa }) : null;

  return (
    <CalcShell
      fields={
        <>
          <NumberField
            label="Supply voltage"
            value={supplyV}
            onChange={setSupplyV}
            min={0}
            step={0.1}
            suffix="V"
            hint="The rail the LED + resistor sit across (e.g. 3.3 V or 5 V)."
          />
          <NumberField
            label="LED forward voltage"
            value={ledVf}
            onChange={setLedVf}
            min={0}
            step={0.1}
            suffix="V"
            hint="From the LED datasheet (Vf). Red is ~1.8–2.0 V; blue/white ~3.0–3.4 V."
          />
          <NumberField
            label="Target current"
            value={currentMa}
            onChange={setCurrentMa}
            min={0.1}
            step={1}
            suffix="mA"
            hint="Indicator LEDs are happy at 2–10 mA; 20 mA is a typical maximum."
          />
        </>
      }
      readout={
        <>
          <Readout
            value={ohms !== null ? `${Math.round(ohms)}` : "·"}
            unit="Ω · series resistor"
            note={
              e24 !== null
                ? `Nearest standard value (E24): ${e24} Ω`
                : "The supply must be higher than the LED's forward voltage."
            }
          />
          <div className="mt-5">
            <SubReadout
              label="Power in the resistor"
              value={powerMw !== null ? `${powerMw.toFixed(1)} mW` : "·"}
            />
          </div>
        </>
      }
    />
  );
}
