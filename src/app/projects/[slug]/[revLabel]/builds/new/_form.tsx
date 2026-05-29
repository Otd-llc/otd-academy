"use client";

// Client form for /projects/[slug]/[revLabel]/builds/new. Mirrors the
// NewRevisionForm pattern: useActionState wires the form action and
// surfaces Zod / business errors inline. The action redirects on success
// to the new Build's detail page.
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  createBuildFormAction,
  type CreateBuildFormState,
} from "@/lib/actions/builds-form";

const initialState: CreateBuildFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded border border-command-gold bg-navy-dark px-6 py-2 font-mono text-sm uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-50"
    >
      {pending ? "WORKING…" : "Create build"}
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

export function NewBuildForm({ revisionId }: { revisionId: string }) {
  const [state, action] = useActionState(
    createBuildFormAction,
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
          placeholder="BUILD-001"
          className="mt-1 w-full rounded border border-panel-border bg-deep-space px-3 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
        />
        <p className="mt-1 font-mono text-xs text-muted">
          case-preserving; must be unique per revision (case-insensitive)
        </p>
        <FieldError messages={state.errors?.label} />
      </div>

      <div>
        <label
          htmlFor="boardCount"
          className="block font-mono text-xs uppercase tracking-wider text-muted"
        >
          Board count
        </label>
        <input
          id="boardCount"
          name="boardCount"
          type="number"
          min={1}
          max={100}
          required
          defaultValue={5}
          className="mt-1 w-full rounded border border-panel-border bg-deep-space px-3 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
        />
        <p className="mt-1 font-mono text-xs text-muted">
          how many physical boards this run will produce (1..100)
        </p>
        <FieldError messages={state.errors?.boardCount} />
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton />
      </div>
    </form>
  );
}
