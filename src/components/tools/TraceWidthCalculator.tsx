"use client";

import { useState } from "react";

import { ipc2221TraceWidthMil, milToMm } from "@/lib/tools/calculators";
import { CalcShell, NumberField, Readout, SubReadout } from "./calc-ui";

// Interactive island for the IPC-2221 trace-width page. The layer (external vs
// internal) is a two-button toggle since the constant k differs; everything else
// is a number field. Width is shown in mil (IPC-native) + mm.
export function TraceWidthCalculator() {
  const [currentA, setCurrentA] = useState(2);
  const [tempRiseC, setTempRiseC] = useState(10);
  const [copperOz, setCopperOz] = useState(1);
  const [external, setExternal] = useState(true);

  const valid = currentA > 0 && tempRiseC > 0 && copperOz > 0;
  const mil = valid
    ? ipc2221TraceWidthMil({ currentA, tempRiseC, copperOz, external })
    : null;
  const mm = mil !== null ? milToMm(mil) : null;

  return (
    <CalcShell
      fields={
        <>
          <NumberField
            label="Current"
            value={currentA}
            onChange={setCurrentA}
            min={0.01}
            step={0.5}
            suffix="A"
            hint="The worst-case current the trace carries."
          />
          <NumberField
            label="Temperature rise"
            value={tempRiseC}
            onChange={setTempRiseC}
            min={1}
            step={5}
            suffix="°C"
            hint="How much warmer the trace may run than the board. 10–20 °C is typical."
          />
          <NumberField
            label="Copper weight"
            value={copperOz}
            onChange={setCopperOz}
            min={0.1}
            step={0.5}
            suffix="oz"
            hint="1 oz (≈ 35 µm) is the usual default; 2 oz for higher current."
          />
          <label className="flex flex-col gap-1.5 border-b border-panel-border/50 py-3.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              Layer
            </span>
            <span className="flex gap-2">
              {([["External", true], ["Internal", false]] as const).map(
                ([label, val]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setExternal(val)}
                    className={`flex-1 rounded border py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors focus-visible:border-command-gold focus-visible:outline-none ${
                      external === val
                        ? "border-command-gold text-command-gold"
                        : "border-panel-border text-muted hover:border-command-gold/50"
                    }`}
                  >
                    {label}
                  </button>
                ),
              )}
            </span>
            <span className="text-xs leading-snug text-gray-3">
              External traces cool in air and can be narrower; internal traces are
              buried and need more copper.
            </span>
          </label>
        </>
      }
      readout={
        <>
          <Readout
            value={mil !== null ? `${mil.toFixed(1)}` : "·"}
            unit="mil minimum width"
            note={
              mm !== null
                ? `≈ ${mm.toFixed(2)} mm. This is the IPC-2221 minimum; go wider for margin.`
                : "Enter values above 0."
            }
          />
          <div className="mt-5">
            <SubReadout
              label="In millimetres"
              value={mm !== null ? `${mm.toFixed(2)} mm` : "·"}
            />
          </div>
        </>
      }
    />
  );
}
