"use client";

// Shared input + result chrome for the /tools calculator islands. Kept token-
// driven (command-gold / navy-dark / panel-border / muted) so the calculators
// match the guide diagrams and the rest of the academy surface.
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
    <label className="flex flex-col gap-1">
      <span className="font-mono text-xs uppercase tracking-wider text-muted">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          min={min}
          step={step}
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full rounded-md border border-panel-border bg-navy-dark px-3 py-2 text-gray-1 focus:border-command-gold focus:outline-none"
        />
        {suffix ? <span className="font-mono text-sm text-muted">{suffix}</span> : null}
      </span>
      {hint ? <span className="text-xs text-gray-3">{hint}</span> : null}
    </label>
  );
}

export function ResultCard({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="rounded-md border border-command-gold/40 bg-command-gold/5 p-5">
      <p className="font-mono text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-command-gold">{value}</p>
      {note ? <p className="mt-2 text-sm text-muted">{note}</p> : null}
    </div>
  );
}

export function CalcShell({ children }: { children: ReactNode }) {
  return (
    <section className="my-8 grid gap-5 rounded-lg border border-panel-border bg-navy-dark/40 p-5 sm:grid-cols-2">
      {children}
    </section>
  );
}
