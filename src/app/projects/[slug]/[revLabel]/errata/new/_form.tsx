"use client";

// Client form for /projects/[slug]/[revLabel]/errata/new (Task 11.3).
// Mirrors NewRevisionForm / NewBuildForm: useActionState wires the form
// action and surfaces validation / business errors inline. The action
// redirects to the revision detail page on success — the new erratum then
// shows up in the ErrataPane there.
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ErratumSeverity } from "@prisma/client";
import {
  createErratumPageFormAction,
  type ErratumFormState,
} from "@/lib/actions/errata-form";

const initialState: ErratumFormState = {};

const SEVERITIES: ErratumSeverity[] = ["BLOCKER", "MAJOR", "MINOR"];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded border border-command-gold bg-navy-dark px-6 py-2 font-mono text-sm uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-50"
    >
      {pending ? "WORKING…" : "Create erratum"}
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

export function NewErratumForm({
  revisionId,
  linkableRevisions,
}: {
  revisionId: string;
  linkableRevisions: { id: string; label: string }[];
}) {
  const [state, action] = useActionState(
    createErratumPageFormAction,
    initialState,
  );

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="revisionId" value={revisionId} />

      {state.message && (
        <p className="border-l-4 border-alert-red bg-navy-dark px-4 py-3 font-mono text-sm font-bold text-alert-red">
          {state.message}
        </p>
      )}

      <div>
        <label
          htmlFor="title"
          className="block font-mono text-xs uppercase tracking-wider text-muted"
        >
          Title
        </label>
        <input
          id="title"
          name="title"
          required
          maxLength={200}
          placeholder="VBUS rail rings on hot-plug"
          className="mt-1 w-full rounded border border-panel-border bg-deep-space px-3 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
        />
        <FieldError messages={state.errors?.title} />
      </div>

      <div>
        <label
          htmlFor="description"
          className="block font-mono text-xs uppercase tracking-wider text-muted"
        >
          Description
        </label>
        <textarea
          id="description"
          name="description"
          required
          rows={6}
          placeholder="What broke; how it was found; suspected cause; reproduction steps."
          className="mt-1 w-full rounded border border-panel-border bg-deep-space px-3 py-2 font-serif text-sm text-link-muted focus:border-command-gold focus:outline-none"
        />
        <FieldError messages={state.errors?.description} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label
            htmlFor="severity"
            className="block font-mono text-xs uppercase tracking-wider text-muted"
          >
            Severity
          </label>
          <select
            id="severity"
            name="severity"
            defaultValue="MAJOR"
            className="mt-1 w-full rounded border border-panel-border bg-deep-space px-3 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
          >
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <FieldError messages={state.errors?.severity} />
        </div>

        <div>
          <label
            htmlFor="addressedByRevisionId"
            className="block font-mono text-xs uppercase tracking-wider text-muted"
          >
            Addressed by (optional)
          </label>
          <select
            id="addressedByRevisionId"
            name="addressedByRevisionId"
            defaultValue=""
            className="mt-1 w-full rounded border border-panel-border bg-deep-space px-3 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
          >
            <option value="">— none —</option>
            {linkableRevisions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          <p className="mt-1 font-mono text-xs text-muted">
            link to the revision that fixes this defect; must be the same project
          </p>
          <FieldError messages={state.errors?.addressedByRevisionId} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton />
      </div>
    </form>
  );
}
