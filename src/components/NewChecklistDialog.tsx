"use client";

// "New checklist" modal (Tasks 13.2 + 13.3).
//
// One client component for both Build and Board scopes — `ownerKind` flips
// the hidden field on the form and the subkind picker is sourced from the
// caller. Uses the native HTML <dialog> element for the modal so we avoid
// dragging in a portal/state library: the parent renders a "+ New checklist"
// button that triggers `dialog.showModal()` via the `useRef` handle, and
// `dialog.close()` runs after a successful create.
//
// Stage is pinned by the caller (passed from the page) so the new row binds
// to the current stage of the parent revision — matching what the gate
// reader expects.
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { ChecklistSubkind, Stage } from "@prisma/client";
import {
  type ChecklistFormState,
  createChecklistFormAction,
} from "@/lib/actions/checklists-form";
import { InlineBanner } from "@/components/InlineBanner";
import { PlusIcon } from "@/components/icons";

const initialState: ChecklistFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded border border-command-gold bg-navy-dark px-3 py-2 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-50"
    >
      {pending ? "WORKING…" : "Create checklist"}
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

export function NewChecklistDialog({
  ownerKind,
  ownerId,
  stage,
  allowedSubkinds,
  disabled,
  disabledReason,
}: {
  ownerKind: "revision" | "build" | "board";
  ownerId: string;
  stage: Stage;
  allowedSubkinds: ChecklistSubkind[];
  disabled?: boolean;
  disabledReason?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, action] = useActionState(
    createChecklistFormAction,
    initialState,
  );
  const [subkind, setSubkind] = useState<ChecklistSubkind>(
    allowedSubkinds[0]!,
  );

  // Close the dialog once a create succeeds. Server revalidates the route
  // so the parent re-renders with the new row.
  useEffect(() => {
    if (state.ok && state.createdId) {
      ref.current?.close();
    }
  }, [state.ok, state.createdId]);

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        disabled={disabled}
        title={disabled ? disabledReason : undefined}
        className="inline-flex items-center gap-1.5 rounded border border-command-gold bg-navy-dark px-3 py-1 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-40"
      >
        <PlusIcon className="h-4 w-4" />
        New checklist
      </button>

      <dialog
        ref={ref}
        className="m-auto max-w-lg rounded border border-panel-border bg-navy-dark p-6 text-link-muted backdrop:bg-deep-space/70"
      >
        <form action={action} className="space-y-4 font-mono text-sm">
          <input type="hidden" name="ownerKind" value={ownerKind} />
          <input type="hidden" name="ownerId" value={ownerId} />
          <input type="hidden" name="stage" value={stage} />

          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-display text-2xl tracking-wider text-white">
              NEW CHECKLIST
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
            <InlineBanner variant="error">{state.message}</InlineBanner>
          ) : null}

          <div>
            <label className="block font-mono text-xs uppercase tracking-wider text-muted">
              Subkind
            </label>
            <select
              name="subkind"
              value={subkind}
              onChange={(e) => setSubkind(e.target.value as ChecklistSubkind)}
              className="mt-1 w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
            >
              {allowedSubkinds.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <FieldError messages={state.errors?.subkind} />
          </div>

          <div>
            <label className="block font-mono text-xs uppercase tracking-wider text-muted">
              Stage
            </label>
            <p className="mt-1 font-mono text-xs uppercase tracking-wider text-link-muted">
              {stage} (pinned to the current rev stage)
            </p>
          </div>

          <div>
            <label className="block font-mono text-xs uppercase tracking-wider text-muted">
              Title
            </label>
            <input
              name="title"
              required
              maxLength={200}
              className="mt-1 w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
            />
            <FieldError messages={state.errors?.title} />
          </div>

          <SubmitButton />
        </form>
      </dialog>
    </>
  );
}
