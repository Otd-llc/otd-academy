"use client";

// Bench-instrument chrome for the /tools calculator islands. The aesthetic is
// the academy capability-brief language: deep-space surfaces (no filled navy
// cards), gold hairline rules, Space-Mono uppercase labels, and the result as a
// large Saira display-numeral readout (the same numeral face as the honeycomb
// hex-heroes). Inputs read like labelled bench fields, not form boxes.
import { type ReactNode } from "react";

export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  step = 1,
  suffix,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  step?: number;
  suffix?: string;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 border-b border-panel-border/50 py-3.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">{label}</span>
      <span className="flex items-baseline gap-2">
        <input
          type="number"
          inputMode="decimal"
          min={min}
          step={step}
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full border-0 border-b border-transparent bg-transparent px-0 py-1 font-numeral text-2xl tabular-nums text-text tracking-wide focus:border-command-gold focus:outline-none"
        />
        {suffix ? (
          <span className="shrink-0 font-mono text-sm text-muted">{suffix}</span>
        ) : null}
      </span>
      {hint ? <span className="text-xs leading-snug text-muted">{hint}</span> : null}
    </label>
  );
}

// The signature element: a large gold Saira numeral. Letters in `value` (h, m,
// A, %) fall back to Bebas per the --font-numeral stack, so "13 h 20 m" reads as
// Saira digits with Bebas units, like an instrument display.
export function Readout({
  value,
  unit,
  note,
}: {
  value: ReactNode;
  unit?: string;
  note?: ReactNode;
}) {
  return (
    <div>
      <p className="font-numeral text-5xl leading-none tracking-wide text-command-gold tabular-nums sm:text-6xl">
        {value}
      </p>
      {unit ? (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">{unit}</p>
      ) : null}
      {note ? <p className="mt-3 text-sm leading-snug text-muted">{note}</p> : null}
    </div>
  );
}

// A quieter secondary readout (mono number, not a hero numeral) for a second
// figure on a page that has one.
export function SubReadout({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border-t border-panel-border/50 pt-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">{label}</p>
      <p className="mt-1 font-mono text-lg text-text tabular-nums">{value}</p>
    </div>
  );
}

// Two-column instrument: inputs on the left, the readout on the right under a
// gold hairline. Stacks on mobile. Surfaces stay deep-space; the only fills are
// hairlines and the gold rule.
export function CalcShell({ fields, readout }: { fields: ReactNode; readout: ReactNode }) {
  return (
    <section className="my-9 grid gap-8 border-t border-command-gold/35 pt-7 sm:grid-cols-[1.1fr_0.9fr] sm:gap-10">
      <div>
        <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
          <span aria-hidden="true">▸ </span>Inputs
        </p>
        <div className="flex flex-col">{fields}</div>
      </div>
      <div className="sm:border-l sm:border-panel-border/50 sm:pl-9">
        <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
          <span aria-hidden="true">▸ </span>Result
        </p>
        {readout}
      </div>
    </section>
  );
}
