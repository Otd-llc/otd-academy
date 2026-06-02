"use client";

// "Generate checklist" button for the guide stage-gate footer (M9 / Task 9.1).
//
// When a card's `revisionChecklist` / `buildChecklist` completionRef points at
// a canonical checklist that has not been materialized yet, StageGate renders
// this affordance instead of the ChecklistEditor. One click materializes the
// canonical template (item set included) and `revalidatePath` re-renders the
// card with the live editor.
//
// Two owner scopes, dispatched to the matching form-action wrapper:
//   - revision-scoped (REQUIREMENTS_REVIEW / LAYOUT_REVIEW / STRIPBOARD_VALIDATION)
//   - build-scoped     (POST_ASSEMBLY_CONTINUITY)
// Subkinds that are NOT canonical (e.g. GENERIC) carry no template, so the
// host (StageGate) renders a plain "not materialized" note rather than this
// button — see `isCanonicalSubkind` there.

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  type ChecklistFormState,
  materializeBuildChecklistFormAction,
  materializeCanonicalChecklistFormAction,
} from "@/lib/actions/checklists-form";

const initialState: ChecklistFormState = {};

type RevisionTemplateKey =
  | "REQUIREMENTS_REVIEW"
  | "LAYOUT_REVIEW"
  | "STRIPBOARD_VALIDATION";

function SubmitPill({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded border border-command-gold bg-navy-dark px-3 py-2 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-50"
    >
      {pending ? "WORKING…" : label}
    </button>
  );
}

type Props =
  | { scope: "revision"; revisionId: string; templateKey: RevisionTemplateKey }
  | { scope: "build"; buildId: string; templateKey: "POST_ASSEMBLY_CONTINUITY" };

export function GenerateChecklistButton(props: Props) {
  const formAction =
    props.scope === "revision"
      ? materializeCanonicalChecklistFormAction
      : materializeBuildChecklistFormAction;
  const [state, action] = useActionState(formAction, initialState);

  return (
    <div className="inline-flex flex-col items-start gap-2">
      <form action={action}>
        {props.scope === "revision" ? (
          <input type="hidden" name="revisionId" value={props.revisionId} />
        ) : (
          <input type="hidden" name="buildId" value={props.buildId} />
        )}
        <input type="hidden" name="templateKey" value={props.templateKey} />
        <SubmitPill label={`Generate ${props.templateKey} checklist`} />
      </form>
      {state.message ? (
        <span className="font-mono text-xs uppercase tracking-wider text-alert-red">
          {state.message}
        </span>
      ) : null}
    </div>
  );
}
