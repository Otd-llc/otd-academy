"use client";

import { useState } from "react";

import {
  ohmsLawVoltageV,
  ohmsLawCurrentMa,
  ohmsLawResistanceOhms,
  ohmsLawPowerMw,
} from "@/lib/tools/calculators";
import { CalcShell, NumberField, Readout, SubReadout } from "./calc-ui";

// Ohm's-law island: pick which of V / I / R to solve for, enter the other two,
// and read the answer plus the power. Math goes through the unit-tested helpers.
type SolveFor = "voltage" | "current" | "resistance";

const MODES: { key: SolveFor; label: string }[] = [
  { key: "voltage", label: "Voltage" },
  { key: "current", label: "Current" },
  { key: "resistance", label: "Resistance" },
];

// Scale a resistance to Ω / kΩ / MΩ so a large value stays readable in the hero.
function formatOhms(ohms: number): { value: string; unit: string } {
  if (ohms >= 1e6) return { value: (ohms / 1e6).toFixed(2), unit: "MΩ · resistance" };
  if (ohms >= 1e3) return { value: (ohms / 1e3).toFixed(2), unit: "kΩ · resistance" };
  return { value: Math.round(ohms).toString(), unit: "Ω · resistance" };
}

export function OhmsLawCalculator() {
  const [solveFor, setSolveFor] = useState<SolveFor>("current");
  const [voltageV, setVoltageV] = useState(3.3);
  const [currentMa, setCurrentMa] = useState(10);
  const [rOhms, setROhms] = useState(330);

  // Compute the solved quantity, and the V + I that feed the power readout.
  let readout: { value: string; unit: string };
  let vForPower = voltageV;
  let iForPower = currentMa;

  if (solveFor === "voltage") {
    const v = ohmsLawVoltageV({ currentMa, rOhms });
    vForPower = v;
    readout = { value: v.toFixed(2), unit: "V · voltage" };
  } else if (solveFor === "current") {
    const i = rOhms > 0 ? ohmsLawCurrentMa({ voltageV, rOhms }) : null;
    iForPower = i ?? 0;
    readout = {
      value: i !== null ? i.toFixed(i < 10 ? 2 : 1) : "·",
      unit: "mA · current",
    };
  } else {
    const r = currentMa > 0 ? ohmsLawResistanceOhms({ voltageV, currentMa }) : null;
    readout = r !== null ? formatOhms(r) : { value: "·", unit: "Ω · resistance" };
  }

  const powerMw = ohmsLawPowerMw({ voltageV: vForPower, currentMa: iForPower });
  const powerLabel =
    powerMw >= 1000 ? `${(powerMw / 1000).toFixed(2)} W` : `${powerMw.toFixed(powerMw < 10 ? 1 : 0)} mW`;

  return (
    <CalcShell
      fields={
        <>
          <div className="flex flex-col gap-1.5 border-b border-panel-border/50 py-3.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              Solve for
            </span>
            <div className="mt-1 flex gap-2">
              {MODES.map((m) => {
                const active = m.key === solveFor;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setSolveFor(m.key)}
                    aria-pressed={active}
                    className={`flex-1 border px-2 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                      active
                        ? "border-command-gold text-command-gold"
                        : "border-panel-border text-muted hover:border-command-gold/50 hover:text-text"
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {solveFor !== "voltage" ? (
            <NumberField
              label="Voltage"
              value={voltageV}
              onChange={setVoltageV}
              min={0}
              step={0.1}
              suffix="V"
              hint="The voltage across the component (e.g. 3.3 V or 5 V)."
            />
          ) : null}
          {solveFor !== "current" ? (
            <NumberField
              label="Current"
              value={currentMa}
              onChange={setCurrentMa}
              min={0}
              step={1}
              suffix="mA"
              hint="The current through it, in milliamps."
            />
          ) : null}
          {solveFor !== "resistance" ? (
            <NumberField
              label="Resistance"
              value={rOhms}
              onChange={setROhms}
              min={0}
              step={10}
              suffix="Ω"
              hint="The resistance, in ohms."
            />
          ) : null}
        </>
      }
      readout={
        <>
          <Readout
            value={readout.value}
            unit={readout.unit}
            note="V = I × R, rearranged. Power is V × I."
          />
          <div className="mt-5">
            <SubReadout label="Power dissipated" value={powerLabel} />
          </div>
        </>
      }
    />
  );
}
