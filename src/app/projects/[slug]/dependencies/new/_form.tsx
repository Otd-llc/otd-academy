"use client";

// Client form for /projects/[slug]/dependencies/new. Mirrors the m11 + 12.10
// pattern: useActionState drives the form, FieldError surfaces per-field Zod
// failures, and InlineBanner shows the top-level rejection message (e.g.
// cycle detection from createProjectDependency).
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  createProjectDependencyAction,
  type ProjectDependencyFormState,
} from "@/lib/actions/project-dependencies";
import { InlineBanner } from "@/components/InlineBanner";
import { STAGE_VALUES } from "@/lib/schemas/project-dependency";

const initialState: ProjectDependencyFormState = {};

// Mirrors the ProjectDepKind Prisma enum. Kept inline so the select can
// render even if the @prisma/client enum object isn't tree-shakable from a
// "use client" module.
const KIND_VALUES = ["DE_RISK", "FOUNDATION", "SHARED_BLOCK"] as const;

type ProjectOption = {
  id: string;
  slug: string;
  name: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded border border-command-gold bg-navy-dark px-6 py-2 font-mono text-sm uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-50"
    >
      {pending ? "WORKING…" : "Create dependency"}
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

export function NewDependencyForm({
  currentProject,
  candidates,
}: {
  currentProject: { id: string; slug: string; name: string };
  candidates: ProjectOption[];
}) {
  const [state, action] = useActionState(
    createProjectDependencyAction,
    initialState,
  );

  return (
    <form action={action} className="space-y-6">
      {/* Hidden context: the dependent project (this page's project) is fixed
          and not user-selectable. projectSlug rides along so the action can
          redirect back without an extra DB lookup. */}
      <input
        type="hidden"
        name="dependentProjectId"
        value={currentProject.id}
      />
      <input type="hidden" name="projectSlug" value={currentProject.slug} />

      {state.message && (
        <InlineBanner variant="error">{state.message}</InlineBanner>
      )}

      <div>
        <label
          htmlFor="dependsOnProjectId"
          className="block font-mono text-xs uppercase tracking-wider text-muted"
        >
          Depends on
        </label>
        <select
          id="dependsOnProjectId"
          name="dependsOnProjectId"
          required
          defaultValue=""
          className="mt-1 w-full rounded border border-panel-border bg-deep-space px-3 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
        >
          <option value="" disabled>
            — select project —
          </option>
          {candidates.map((p) => (
            <option key={p.id} value={p.id}>
              {p.slug} — {p.name}
            </option>
          ))}
        </select>
        <p className="mt-1 font-mono text-xs text-muted">
          non-archived projects, current project excluded
        </p>
        <FieldError messages={state.errors?.dependsOnProjectId} />
      </div>

      <div>
        <label
          htmlFor="kind"
          className="block font-mono text-xs uppercase tracking-wider text-muted"
        >
          Kind
        </label>
        <select
          id="kind"
          name="kind"
          defaultValue="DE_RISK"
          className="mt-1 w-full rounded border border-panel-border bg-deep-space px-3 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
        >
          {KIND_VALUES.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <FieldError messages={state.errors?.kind} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label
            htmlFor="dependentStageGated"
            className="block font-mono text-xs uppercase tracking-wider text-muted"
          >
            Dependent stage gated
          </label>
          <select
            id="dependentStageGated"
            name="dependentStageGated"
            required
            defaultValue=""
            className="mt-1 w-full rounded border border-panel-border bg-deep-space px-3 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
          >
            <option value="" disabled>
              — select stage —
            </option>
            {STAGE_VALUES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <p className="mt-1 font-mono text-xs text-muted">
            stage on this project that is blocked
          </p>
          <FieldError messages={state.errors?.dependentStageGated} />
        </div>

        <div>
          <label
            htmlFor="dependsOnStageRequired"
            className="block font-mono text-xs uppercase tracking-wider text-muted"
          >
            Depends-on stage required
          </label>
          <select
            id="dependsOnStageRequired"
            name="dependsOnStageRequired"
            required
            defaultValue=""
            className="mt-1 w-full rounded border border-panel-border bg-deep-space px-3 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
          >
            <option value="" disabled>
              — select stage —
            </option>
            {STAGE_VALUES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <p className="mt-1 font-mono text-xs text-muted">
            stage the upstream must reach before the gate lifts
          </p>
          <FieldError messages={state.errors?.dependsOnStageRequired} />
        </div>
      </div>

      <div>
        <label
          htmlFor="notes"
          className="block font-mono text-xs uppercase tracking-wider text-muted"
        >
          Notes (optional)
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={500}
          className="mt-1 w-full rounded border border-panel-border bg-deep-space px-3 py-2 font-serif text-base text-link-muted focus:border-command-gold focus:outline-none"
        />
        <FieldError messages={state.errors?.notes} />
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton />
        <a
          href={`/projects/${currentProject.slug}`}
          className="font-mono text-xs uppercase tracking-wider text-signal-blue underline"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
