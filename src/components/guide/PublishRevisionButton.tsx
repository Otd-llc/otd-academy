"use client";

// "Publish revision" button (audit Phase 2 / Task 2.3) — the go-live lever's
// first UI. Renders beside the ReadinessPanel in the hub's author view.
//
// Mirrors GenerateGuideButton: form POST via useActionState to
// `publishRevisionFormAction`, which dispatches the canonical
// `setPublishedRevision` (requireAdmin + the publishable readiness bar +
// invalidateProjectGraph). A readiness refusal surfaces as the single-line
// message below the button — that IS the UX for "not ready yet".
//
// Two-step arm instead of a dialog: the first click arms the button, the
// second submits. Publishing opens enrollment and puts the guide + its stage
// URLs in the sitemap, so a stray click shouldn't do it — but it's also
// reversible (publish a different revision), so a full confirm dialog would be
// ceremony.

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  type GuideFormState,
  publishRevisionFormAction,
} from "@/lib/actions/guides-form";

const initialState: GuideFormState = {};

function SubmitPill({ armed }: { armed: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded border border-command-gold bg-deep-space px-4 py-2 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-50"
    >
      {pending ? "PUBLISHING…" : armed ? "Confirm publish" : "Publish revision"}
    </button>
  );
}

export function PublishRevisionButton({
  projectId,
  revisionId,
  isPublished,
}: {
  projectId: string;
  revisionId: string;
  /** This revision is already the project's published revision. */
  isPublished: boolean;
}) {
  const [state, action] = useActionState(publishRevisionFormAction, initialState);
  const [armed, setArmed] = useState(false);

  if (isPublished || state.ok) {
    return (
      <span className="font-mono text-xs uppercase tracking-wider text-status-green">
        ▸ Published — live on /courses and in the sitemap
      </span>
    );
  }

  return (
    <div className="inline-flex flex-col items-start gap-2">
      {armed ? (
        <span className="font-mono text-xs uppercase tracking-wider text-muted">
          Publishing opens enrollment and adds the guide to the sitemap.
        </span>
      ) : null}
      <form
        action={action}
        onSubmit={(e) => {
          if (!armed) {
            e.preventDefault();
            setArmed(true);
          }
        }}
      >
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="revisionId" value={revisionId} />
        <SubmitPill armed={armed} />
      </form>
      {state.message ? (
        <span className="max-w-xl font-mono text-xs uppercase tracking-wider text-alert-red">
          {state.message}
        </span>
      ) : null}
    </div>
  );
}
