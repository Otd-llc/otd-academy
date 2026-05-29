"use client";

// Single-row "Add measurement" form (Task 14.2).
//
// Inline at the top of the MeasurementsLog; submits one row via
// createMeasurementFormAction. The stage default is sourced from the
// parent (current revision stage) — most measurements happen at the
// current stage and the picker can be flipped on the fly.
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { MeasurementResult, Stage } from "@prisma/client";
import {
  type MeasurementFormState,
  createMeasurementFormAction,
} from "@/lib/actions/measurements-form";

const initialState: MeasurementFormState = {};

const STAGES_LIST: Stage[] = [
  "REQUIREMENTS",
  "SCHEMATIC",
  "BOM_SOURCING",
  "LAYOUT",
  "DRC_GERBER",
  "ORDERING",
  "ASSEMBLY",
  "BRINGUP",
  "REVISION",
];

const RESULTS: MeasurementResult[] = ["PEND", "PASS", "FAIL", "OBSERVED"];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded border border-command-gold bg-navy-dark px-3 py-2 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-50"
    >
      {pending ? "WORKING…" : "Add measurement"}
    </button>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return (
    <p className="mt-1 font-mono text-xs font-bold text-alert-red">
      {messages.join("; ")}
    </p>
  );
}

export function AddMeasurementForm({
  boardId,
  defaultStage,
  disabled,
  disabledReason,
}: {
  boardId: string;
  defaultStage: Stage;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [state, action] = useActionState(
    createMeasurementFormAction,
    initialState,
  );

  if (disabled) {
    return (
      <p className="font-mono text-xs uppercase tracking-wider text-muted">
        {disabledReason ?? "Measurement entry disabled."}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3 font-mono text-sm text-link-muted">
      <input type="hidden" name="boardId" value={boardId} />
      {state.message ? (
        <p className="border-l-4 border-alert-red bg-deep-space px-3 py-2 font-mono text-xs font-bold text-alert-red">
          {state.message}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div>
          <label className="block font-mono text-xs uppercase tracking-wider text-muted">
            Stage
          </label>
          <select
            name="stage"
            defaultValue={defaultStage}
            className="mt-1 w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
          >
            {STAGES_LIST.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <FieldError messages={state.errors?.stage} />
        </div>
        <div>
          <label className="block font-mono text-xs uppercase tracking-wider text-muted">
            Step
          </label>
          <input
            name="step"
            required
            maxLength={200}
            className="mt-1 w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
          />
          <FieldError messages={state.errors?.step} />
        </div>
        <div>
          <label className="block font-mono text-xs uppercase tracking-wider text-muted">
            Result
          </label>
          <select
            name="result"
            defaultValue="PEND"
            className="mt-1 w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
          >
            {RESULTS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div>
          <label className="block font-mono text-xs uppercase tracking-wider text-muted">
            Expected
          </label>
          <input
            name="expectedValue"
            maxLength={200}
            className="mt-1 w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
          />
        </div>
        <div>
          <label className="block font-mono text-xs uppercase tracking-wider text-muted">
            Actual
          </label>
          <input
            name="actualValue"
            required
            maxLength={200}
            className="mt-1 w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
          />
          <FieldError messages={state.errors?.actualValue} />
        </div>
        <div>
          <label className="block font-mono text-xs uppercase tracking-wider text-muted">
            Unit
          </label>
          <input
            name="unit"
            maxLength={50}
            className="mt-1 w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block font-mono text-xs uppercase tracking-wider text-muted">
          Notes (optional)
        </label>
        <input
          name="notes"
          maxLength={2000}
          className="mt-1 w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
        />
      </div>

      <SubmitButton />
    </form>
  );
}
