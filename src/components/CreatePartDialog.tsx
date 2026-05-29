"use client";

// Inline "Create new Part" modal (design §9.1, reachable from the BOM
// editor). Backed by a native <dialog> element so we get the platform
// modality + ESC-to-close behavior. Submission calls createPartFormAction;
// on success we close the dialog and emit the new part to the parent so
// the BomLine dropdown can refresh without a navigation.
//
// The same form is also reachable as the full page /parts/new (per §9
// routes table).
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import {
  createPartFormAction,
  type PartFormState,
} from "@/lib/actions/parts";
import { InlineBanner } from "@/components/InlineBanner";

export type PartOption = {
  id: string;
  mpn: string;
  manufacturer: string;
};

const initialState: PartFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded border border-command-gold bg-navy-dark px-4 py-2 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-50"
    >
      {pending ? "WORKING…" : "Create part"}
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

export function CreatePartDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (p: PartOption) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, action] = useActionState(createPartFormAction, initialState);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  // When the action succeeds, emit upstream and close. Run via effect so we
  // don't mutate state during render.
  useEffect(() => {
    if (state.created) {
      onCreated?.(state.created);
    }
  }, [state.created, onCreated]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="w-full max-w-xl rounded border border-panel-border bg-navy-dark p-6 text-link-muted backdrop:bg-deep-space/80"
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-2xl tracking-wider text-white">
          NEW PART
        </h2>
        <form method="dialog">
          <button
            type="submit"
            aria-label="Close"
            className="rounded border border-panel-border bg-deep-space px-2 py-1 font-mono text-xs uppercase tracking-wider text-link-muted hover:border-command-gold"
          >
            ✕
          </button>
        </form>
      </div>

      <PartFields state={state} action={action} />
    </dialog>
  );
}

// Shared form body — used by both the modal here and /parts/new.
export function PartFields({
  state,
  action,
}: {
  state: PartFormState;
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form action={action} className="mt-4 space-y-4">
      {state.message && (
        <InlineBanner variant="error">{state.message}</InlineBanner>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="block font-mono text-xs uppercase tracking-wider text-muted">
            Manufacturer
          </label>
          <input
            name="manufacturer"
            required
            maxLength={128}
            className="mt-1 w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
          />
          <FieldError messages={state.errors?.manufacturer} />
        </div>
        <div>
          <label className="block font-mono text-xs uppercase tracking-wider text-muted">
            MPN
          </label>
          <input
            name="mpn"
            required
            maxLength={128}
            className="mt-1 w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
          />
          <FieldError messages={state.errors?.mpn} />
        </div>
      </div>

      <div>
        <label className="block font-mono text-xs uppercase tracking-wider text-muted">
          Description
        </label>
        <input
          name="description"
          required
          maxLength={500}
          className="mt-1 w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-serif text-base text-link-muted focus:border-command-gold focus:outline-none"
        />
        <FieldError messages={state.errors?.description} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="block font-mono text-xs uppercase tracking-wider text-muted">
            Category (optional)
          </label>
          <input
            name="category"
            maxLength={128}
            className="mt-1 w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
          />
          <FieldError messages={state.errors?.category} />
        </div>
        <div>
          <label className="block font-mono text-xs uppercase tracking-wider text-muted">
            Footprint (optional)
          </label>
          <input
            name="footprint"
            maxLength={128}
            className="mt-1 w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
          />
          <FieldError messages={state.errors?.footprint} />
        </div>
        <div>
          <label className="block font-mono text-xs uppercase tracking-wider text-muted">
            Lifecycle
          </label>
          <select
            name="lifecycle"
            defaultValue="ACTIVE"
            className="mt-1 w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
          >
            <option value="ACTIVE">ACTIVE</option>
            <option value="NRND">NRND</option>
            <option value="EOL">EOL</option>
            <option value="OBSOLETE">OBSOLETE</option>
          </select>
          <FieldError messages={state.errors?.lifecycle} />
        </div>
      </div>

      <div>
        <label className="block font-mono text-xs uppercase tracking-wider text-muted">
          Datasheet URL (optional)
        </label>
        <input
          name="datasheetUrl"
          type="url"
          className="mt-1 w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
        />
        <FieldError messages={state.errors?.datasheetUrl} />
      </div>

      <div>
        <label className="block font-mono text-xs uppercase tracking-wider text-muted">
          Notes (optional)
        </label>
        <textarea
          name="notes"
          rows={2}
          maxLength={2000}
          className="mt-1 w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-serif text-base text-link-muted focus:border-command-gold focus:outline-none"
        />
        <FieldError messages={state.errors?.notes} />
      </div>

      <div>
        <SubmitButton />
      </div>
    </form>
  );
}
