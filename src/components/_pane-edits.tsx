"use client";

// Client-side edit-in-place form for a dependency's `notes` field. Extracted
// from `ProjectDependenciesPane` (server component) so the pane stays pure;
// this file owns the hook surface (`useActionState` / `useFormStatus`).
//
// Mirrors the m11 pattern in `src/app/projects/[slug]/_edit-fields.tsx` —
// hidden id + single editable field + Save button + field-error surface.
// The other dependency fields (kind / stage / target project) are NOT
// editable in place; delete + recreate is the supported flow (see
// `ProjectDependenciesPane.tsx` header for rationale).
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  editProjectDependencyNotesAction,
  type ProjectDependencyFormState,
} from "@/lib/actions/project-dependencies";
import { InlineBanner } from "@/components/InlineBanner";

const initialState: ProjectDependencyFormState = {};

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

function ActionMessage({ state }: { state: ProjectDependencyFormState }) {
  if (!state.message) return null;
  return (
    <div className="mt-1">
      <InlineBanner variant="error">{state.message}</InlineBanner>
    </div>
  );
}

export function EditDependencyNotesForm({
  id,
  value,
}: {
  id: string;
  value: string | null;
}) {
  const [state, action] = useActionState(
    editProjectDependencyNotesAction,
    initialState,
  );
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <label className="block font-mono text-xs uppercase tracking-wider text-muted">
        Notes
      </label>
      <textarea
        name="notes"
        defaultValue={value ?? ""}
        rows={2}
        maxLength={500}
        className="w-full rounded border border-panel-border bg-deep-space px-3 py-2 font-serif text-sm text-link-muted focus:border-command-gold focus:outline-none"
      />
      <SaveButton />
      <FieldError messages={state.errors?.notes} />
      <ActionMessage state={state} />
    </form>
  );
}
