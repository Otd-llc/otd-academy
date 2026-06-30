"use client";

import { useState } from "react";

import { lipoRuntimeHours, formatRuntime } from "@/lib/tools/calculators";
import { CalcShell, NumberField, Readout } from "./calc-ui";

// Interactive island for the LiPo runtime page. All math goes through the
// unit-tested lipoRuntimeHours/formatRuntime so the widget can't disagree with
// the worked example in the prose. Inputs are clamped to > 0 before the pure
// function runs (it throws on non-positive draw/capacity).
export function LipoRuntimeCalculator() {
  const [capacityMah, setCapacityMah] = useState(2000);
  const [averageCurrentMa, setAverageCurrentMa] = useState(120);
  const [usablePct, setUsablePct] = useState(80);

  const valid = capacityMah > 0 && averageCurrentMa > 0 && usablePct > 0;
  const hours = valid
    ? lipoRuntimeHours({ capacityMah, averageCurrentMa, usablePct })
    : null;

  return (
    <CalcShell
      fields={
        <>
          <NumberField
            label="Battery capacity"
            value={capacityMah}
            onChange={setCapacityMah}
            min={1}
            step={50}
            suffix="mAh"
          />
          <NumberField
            label="Average current draw"
            value={averageCurrentMa}
            onChange={setAverageCurrentMa}
            min={1}
            step={10}
            suffix="mA"
            hint="Average draw over a full duty cycle. A duty-cycled Wi-Fi node averages far below its transmit peak."
          />
          <NumberField
            label="Usable capacity"
            value={usablePct}
            onChange={setUsablePct}
            min={1}
            step={5}
            suffix="%"
            hint="Derating for cutoff voltage + converter loss. 70 to 85% is typical."
          />
        </>
      }
      readout={
        <Readout
          value={hours !== null ? formatRuntime(hours) : "·"}
          unit="estimated runtime"
          note={
            hours !== null
              ? `${hours.toFixed(1)} hours at ${averageCurrentMa} mA average`
              : "Enter values above 0."
          }
        />
      }
    />
  );
}
