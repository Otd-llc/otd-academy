"use client";

// Bulk paste-tabbed measurements dialog (Task 14.2).
//
// Opens a native <dialog> modal with:
//   - A textarea where the user pastes lines of tab-separated columns:
//       stage \t step \t expected \t actual \t unit \t result
//     (the first row may be a header — it's detected & dropped server-side).
//   - A live, client-side preview that splits the textarea into rows so the
//     user sees exactly what will be sent.
//   - A "Submit batch" button that hits addMeasurementsBulkFormAction;
//     all rows land in one Serializable tx server-side.
//
// On success the dialog reports the inserted-row count and closes; the
// server revalidates the board page so the log re-renders.
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  addMeasurementsBulkFormAction,
  type MeasurementFormState,
} from "@/lib/actions/measurements-form";

const initialState: MeasurementFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded border border-command-gold bg-navy-dark px-3 py-2 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-50"
    >
      {pending ? "WORKING…" : "Submit batch"}
    </button>
  );
}

function parsePreview(text: string): Array<string[]> {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  return lines.map((l) => l.split("\t"));
}

export function BulkMeasurementsDialog({
  boardId,
  disabled,
  disabledReason,
}: {
  boardId: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState("");
  const [state, action] = useActionState(
    addMeasurementsBulkFormAction,
    initialState,
  );

  useEffect(() => {
    if (state.ok) {
      // Close dialog and reset textarea on successful submit.
      ref.current?.close();
      setText("");
    }
  }, [state.ok]);

  const preview = parsePreview(text);

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        disabled={disabled}
        title={disabled ? disabledReason : undefined}
        className="rounded border border-command-gold bg-navy-dark px-3 py-1 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-40"
      >
        Bulk add (tab-paste)
      </button>

      <dialog
        ref={ref}
        className="m-auto max-w-3xl rounded border border-panel-border bg-navy-dark p-6 text-link-muted backdrop:bg-deep-space/70"
      >
        <form action={action} className="space-y-4 font-mono text-sm">
          <input type="hidden" name="boardId" value={boardId} />

          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-display text-2xl tracking-wider text-white">
              BULK ADD MEASUREMENTS
            </h2>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              className="rounded border border-panel-border bg-deep-space px-2 py-1 font-mono text-xs uppercase tracking-wider text-muted hover:border-command-gold hover:text-command-gold"
            >
              Close
            </button>
          </div>

          {state.message ? (
            <p className="border-l-4 border-alert-red bg-deep-space px-3 py-2 font-mono text-xs font-bold text-alert-red">
              {state.message}
            </p>
          ) : null}

          <p className="font-mono text-xs uppercase tracking-wider text-muted">
            Columns: stage TAB step TAB expected TAB actual TAB unit TAB result. Header row optional. Empty cells allowed; result defaults to PEND.
          </p>

          <textarea
            name="bulkText"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            placeholder={"BRINGUP\t5V0 rail\t5.00\t5.02\tV\tPASS"}
            className="w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
          />

          {preview.length > 0 ? (
            <div className="rounded border border-panel-border bg-deep-space p-3">
              <p className="mb-2 font-mono text-xs uppercase tracking-wider text-muted">
                Preview ({preview.length} row{preview.length === 1 ? "" : "s"})
              </p>
              <div className="overflow-x-auto">
                <table className="w-full font-mono text-xs text-link-muted">
                  <thead>
                    <tr className="border-b border-panel-border">
                      <th className="px-1 py-1 text-left">stage</th>
                      <th className="px-1 py-1 text-left">step</th>
                      <th className="px-1 py-1 text-left">expected</th>
                      <th className="px-1 py-1 text-left">actual</th>
                      <th className="px-1 py-1 text-left">unit</th>
                      <th className="px-1 py-1 text-left">result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-b border-panel-border/40">
                        {[0, 1, 2, 3, 4, 5].map((c) => (
                          <td key={c} className="px-1 py-1">
                            {row[c] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <SubmitButton />
        </form>
      </dialog>
    </>
  );
}
