"use client";

// Client form for /projects/new. Uses React 19's `useActionState` to drive
// the form: the server action returns either { errors } (Zod validation
// failure) or redirects on success. Pending state disables the submit
// button and swaps its label per design §9.4.
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  createProjectFormAction,
  type ProjectFormState,
} from "@/lib/actions/projects";
import { InlineBanner } from "@/components/InlineBanner";

const initialState: ProjectFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded border border-command-gold bg-navy-dark px-6 py-2 font-mono text-sm uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-50"
    >
      {pending ? "WORKING…" : "Create project"}
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

export function NewProjectForm() {
  const [state, formAction] = useActionState(
    createProjectFormAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-6">
      {state.message && (
        <InlineBanner variant="error">{state.message}</InlineBanner>
      )}

      <div>
        <label
          htmlFor="slug"
          className="block font-mono text-xs uppercase tracking-wider text-muted"
        >
          Slug
        </label>
        <input
          id="slug"
          name="slug"
          required
          maxLength={64}
          pattern="[a-z0-9-]+"
          className="mt-1 w-full rounded border border-panel-border bg-deep-space px-3 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
        />
        <p className="mt-1 font-mono text-xs text-muted">
          lowercase + digits + hyphens; becomes the URL path
        </p>
        <FieldError messages={state.errors?.slug} />
      </div>

      <div>
        <label
          htmlFor="name"
          className="block font-mono text-xs uppercase tracking-wider text-muted"
        >
          Name
        </label>
        <input
          id="name"
          name="name"
          required
          maxLength={200}
          className="mt-1 w-full rounded border border-panel-border bg-deep-space px-3 py-2 font-serif text-base text-link-muted focus:border-command-gold focus:outline-none"
        />
        <FieldError messages={state.errors?.name} />
      </div>

      <div>
        <label
          htmlFor="description"
          className="block font-mono text-xs uppercase tracking-wider text-muted"
        >
          Description (optional)
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={2000}
          className="mt-1 w-full rounded border border-panel-border bg-deep-space px-3 py-2 font-serif text-base text-link-muted focus:border-command-gold focus:outline-none"
        />
        <FieldError messages={state.errors?.description} />
      </div>

      <div>
        <label
          htmlFor="repoUrl"
          className="block font-mono text-xs uppercase tracking-wider text-muted"
        >
          Repo URL (optional)
        </label>
        <input
          id="repoUrl"
          name="repoUrl"
          type="url"
          placeholder="https://github.com/you/your-project"
          className="mt-1 w-full rounded border border-panel-border bg-deep-space px-3 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
        />
        <FieldError messages={state.errors?.repoUrl} />
      </div>

      <div>
        <label
          htmlFor="targetCost"
          className="block font-mono text-xs uppercase tracking-wider text-muted"
        >
          Target cost (optional, USD)
        </label>
        <input
          id="targetCost"
          name="targetCost"
          type="number"
          step="0.01"
          min="0"
          className="mt-1 w-full rounded border border-panel-border bg-deep-space px-3 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
        />
        <FieldError messages={state.errors?.targetCost} />
      </div>

      <fieldset className="rounded border border-panel-border p-4">
        <legend className="px-2 font-mono text-sm uppercase tracking-wider text-muted">
          Curriculum metadata (optional)
        </legend>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label htmlFor="track" className="block">
            <span className="block font-mono text-xs uppercase tracking-wider text-muted">
              Track
            </span>
            <select
              id="track"
              name="track"
              defaultValue=""
              className="mt-1 block w-full rounded border border-panel-border bg-navy-dark px-2 py-1 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
            >
              <option value="">— none —</option>
              <option value="SENSE">SENSE</option>
              <option value="ACT">ACT</option>
              <option value="POWER">POWER</option>
              <option value="COMMS">COMMS</option>
            </select>
            <FieldError messages={state.errors?.track} />
          </label>
          <label htmlFor="level" className="block">
            <span className="block font-mono text-xs uppercase tracking-wider text-muted">
              Level
            </span>
            <select
              id="level"
              name="level"
              defaultValue=""
              className="mt-1 block w-full rounded border border-panel-border bg-navy-dark px-2 py-1 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
            >
              <option value="">— none —</option>
              <option value="L1">L1</option>
              <option value="L2">L2</option>
              <option value="L3">L3</option>
            </select>
            <FieldError messages={state.errors?.level} />
          </label>
          <label htmlFor="disciplineTaught" className="block md:col-span-2">
            <span className="block font-mono text-xs uppercase tracking-wider text-muted">
              Discipline taught
            </span>
            <input
              id="disciplineTaught"
              name="disciplineTaught"
              type="text"
              maxLength={200}
              className="mt-1 block w-full rounded border border-panel-border bg-navy-dark px-2 py-1 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
            />
            <FieldError messages={state.errors?.disciplineTaught} />
          </label>
          <label
            htmlFor="criticalPath"
            className="inline-flex items-center gap-2"
          >
            <input
              id="criticalPath"
              name="criticalPath"
              type="checkbox"
              defaultChecked
            />
            <span className="font-mono text-xs uppercase tracking-wider text-muted">
              Critical path (uncheck for bench tool)
            </span>
          </label>
          <label
            htmlFor="requiresStripboard"
            className="inline-flex items-center gap-2"
          >
            <input
              id="requiresStripboard"
              name="requiresStripboard"
              type="checkbox"
            />
            <span className="font-mono text-xs uppercase tracking-wider text-muted">
              Requires stripboard de-risk rung
            </span>
          </label>
          {/* m18: hasMainsNet drives the BOM_SOURCING certified-module
              gate. Tooltip surfaces the gate implication so the form is
              self-documenting (proposal §3 #5). */}
          <label
            htmlFor="hasMainsNet"
            className="inline-flex items-center gap-2"
            title="When checked, BOM_SOURCING gate requires at least one BomLine.part.isCertifiedModule === true"
          >
            <input
              id="hasMainsNet"
              name="hasMainsNet"
              type="checkbox"
            />
            <span className="font-mono text-xs uppercase tracking-wider text-muted">
              Has mains net (requires certified-module BOM line)
            </span>
          </label>
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <SubmitButton />
        <a
          href="/"
          className="font-mono text-xs uppercase tracking-wider text-signal-blue underline"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
