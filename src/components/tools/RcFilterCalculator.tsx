"use client";

import { useState } from "react";

import { rcCutoffHz } from "@/lib/tools/calculators";
import { CalcShell, NumberField, Readout, SubReadout } from "./calc-ui";

// Format a frequency into Hz / kHz / MHz so the readout stays human.
function formatHz(hz: number): string {
  if (hz >= 1e6) return `${(hz / 1e6).toFixed(2)} MHz`;
  if (hz >= 1e3) return `${(hz / 1e3).toFixed(2)} kHz`;
  return `${hz.toFixed(1)} Hz`;
}

// Interactive island for the RC cutoff page. C is entered in nF (the usual unit
// for filter caps) and converted to farads before the unit-tested math runs.
export function RcFilterCalculator() {
  const [rOhms, setROhms] = useState(10000);
  const [cNanofarads, setCNanofarads] = useState(100);

  const valid = rOhms > 0 && cNanofarads > 0;
  const hz = valid ? rcCutoffHz({ rOhms, cFarads: cNanofarads * 1e-9 }) : null;
  const tauMs = valid ? rOhms * (cNanofarads * 1e-9) * 1000 : null;

  return (
    <CalcShell
      fields={
        <>
          <NumberField
            label="Resistance R"
            value={rOhms}
            onChange={setROhms}
            min={1}
            step={1000}
            suffix="Ω"
          />
          <NumberField
            label="Capacitance C"
            value={cNanofarads}
            onChange={setCNanofarads}
            min={0.1}
            step={10}
            suffix="nF"
            hint="100 nF = 0.1 µF; 1000 nF = 1 µF."
          />
        </>
      }
      readout={
        <>
          <Readout
            value={hz !== null ? formatHz(hz) : "·"}
            unit="−3 dB cutoff frequency"
            note="First-order: the response rolls off 20 dB per decade past the corner. For a steeper skirt, cascade stages or use an active filter."
          />
          <div className="mt-5">
            <SubReadout
              label="Time constant (τ = R × C)"
              value={tauMs !== null ? `${tauMs.toFixed(2)} ms` : "·"}
            />
          </div>
        </>
      }
    />
  );
}
