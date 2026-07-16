"use client";

// Client form for /projects/[slug]/revisions/new. Mirrors the project
// create form's structure: useActionState wires the form action and
// surface Zod errors inline; the action redirects on success.
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  createRevisionFormAction,
  type CreateRevisionFormState,
} from "@/lib/actions/revisions-form";
import { InlineBanner } from "@/components/InlineBanner";

const initialState: CreateRevisionFormState = {};

type RevisionOption = {
  id: string;
  label: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded border border-command-gold bg-navy-dark px-6 py-2 font-mono text-sm uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-50"
    >
      {pending ? "WORKING…" : "Create revision"}
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

export function NewRevisionForm({
  projectId,
  existingRevisions,
}: {
  projectId: string;
  existingRevisions: RevisionOption[];
}) {
  const [state, action] = useActionState(
    createRevisionFormAction,
    initialState,
  );

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="projectId" value={projectId} />

      {state.message && (
        <InlineBanner variant="error">{state.message}</InlineBanner>
      )}

      <div>
        <label
          htmlFor="label"
          className="block font-mono text-xs uppercase tracking-wider text-muted"
        >
          Label
        </label>
        <input
          id="label"
          name="label"
          required
          maxLength={32}
          placeholder="v1.1 / rev A / etc."
          className="mt-1 w-full rounded border border-panel-border bg-deep-space px-3 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
        />
        <p className="mt-1 font-mono text-xs text-muted">
          case-preserving; must be unique per project (case-insensitive)
        </p>
        <FieldError messages={state.errors?.label} />
      </div>

      <div>
        <label
          htmlFor="copyForwardFromRevisionId"
          className="block font-mono text-xs uppercase tracking-wider text-muted"
        >
          Copy forward from (optional)
        </label>
        <select
          id="copyForwardFromRevisionId"
          name="copyForwardFromRevisionId"
          defaultValue=""
          className="mt-1 w-full rounded border border-panel-border bg-deep-space px-3 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
        >
          <option value="">— none —</option>
          {existingRevisions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
        <p className="mt-1 font-mono text-xs text-muted">
          clones BOM lines + revision-scoped artifacts; builds are not copied
        </p>
        <FieldError messages={state.errors?.copyForwardFromRevisionId} />
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton />
      </div>
    </form>
  );
}
