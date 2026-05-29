"use client";

// Inline commit-SHA edit forms for the revision header strip (design §9.1).
// Space Mono input style; Zod-validated against SILKSCREEN_HASH_RE — empty
// string clears. assertNotFrozen rejects on a frozen revision.
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  setLayoutCommitAction,
  setSchematicCommitAction,
  type RevisionFormState,
} from "@/lib/actions/revisions";

const initialState: RevisionFormState = {};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded border border-panel-border bg-deep-space px-3 py-1 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:border-command-gold disabled:opacity-50"
    >
      {pending ? "WORKING…" : "Save"}
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

function ActionMessage({ state }: { state: RevisionFormState }) {
  if (!state.message) return null;
  return (
    <p className="mt-1 font-mono text-xs font-bold text-alert-red">
      {state.message}
    </p>
  );
}

export function EditSchematicCommitForm({
  revisionId,
  value,
  disabled,
}: {
  revisionId: string;
  value: string | null;
  disabled?: boolean;
}) {
  const [state, action] = useActionState(
    setSchematicCommitAction,
    initialState,
  );
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="revisionId" value={revisionId} />
      <label className="block font-mono text-xs uppercase tracking-wider text-muted">
        Schematic commit
      </label>
      <div className="flex items-start gap-2">
        <input
          name="value"
          defaultValue={value ?? ""}
          disabled={disabled}
          placeholder="g1ebc1cc"
          maxLength={64}
          className="flex-1 rounded border border-panel-border bg-deep-space px-3 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none disabled:opacity-50"
        />
        <SaveButton />
      </div>
      <FieldError messages={state.errors?.value} />
      <ActionMessage state={state} />
    </form>
  );
}

export function EditLayoutCommitForm({
  revisionId,
  value,
  disabled,
}: {
  revisionId: string;
  value: string | null;
  disabled?: boolean;
}) {
  const [state, action] = useActionState(setLayoutCommitAction, initialState);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="revisionId" value={revisionId} />
      <label className="block font-mono text-xs uppercase tracking-wider text-muted">
        Layout commit
      </label>
      <div className="flex items-start gap-2">
        <input
          name="value"
          defaultValue={value ?? ""}
          disabled={disabled}
          placeholder="gb170ddb"
          maxLength={64}
          className="flex-1 rounded border border-panel-border bg-deep-space px-3 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none disabled:opacity-50"
        />
        <SaveButton />
      </div>
      <FieldError messages={state.errors?.value} />
      <ActionMessage state={state} />
    </form>
  );
}
