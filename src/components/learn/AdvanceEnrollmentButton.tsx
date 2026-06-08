"use client";

// Client island: the learner's "advance to the next stage" affordance on the
// guide. Calls advanceEnrollment; on a blocked gate it renders the gate reasons
// (missing proof artifact and/or unpassed quiz) instead of advancing. On
// success it NAVIGATES the learner to the next stage's card (or the learn
// dashboard when the enrollment completes) — advancing updates the learner's
// own currentStage, so simply refreshing would leave them stranded on the old
// stage with the tracker gone.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { advanceEnrollment } from "@/lib/actions/enrollment";
import { advanceTargetHref } from "@/lib/learner-advance-nav";

export function AdvanceEnrollmentButton({
  projectId,
  cardBaseHref,
  guideStages,
  completedHref = "/learn",
}: {
  projectId: string;
  /** `/projects/{slug}/{revLabel}/guide` — the next card's href is this + `/{stage}`. */
  cardBaseHref: string;
  guideStages: readonly string[];
  completedHref?: string;
}) {
  const [pending, start] = useTransition();
  const [reasons, setReasons] = useState<string[] | null>(null);
  const router = useRouter();

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setReasons(null);
            try {
              const res = await advanceEnrollment({ projectId });
              if (res.ok) {
                const target = advanceTargetHref(
                  res.toStage,
                  guideStages,
                  cardBaseHref,
                  completedHref,
                );
                router.push(target);
                router.refresh();
              } else {
                setReasons(res.reasons);
              }
            } catch (e) {
              setReasons([e instanceof Error ? e.message : "Could not advance."]);
            }
          })
        }
        className="inline-flex items-center gap-1.5 rounded border border-command-gold bg-navy-dark px-4 py-2 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-50"
      >
        {pending ? "Checking…" : "Advance to next stage"}
      </button>
      {reasons && reasons.length > 0 && (
        <ul className="space-y-1">
          {reasons.map((r, i) => (
            <li
              key={i}
              className="font-mono text-xs uppercase tracking-wider text-alert-red"
            >
              {r}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
