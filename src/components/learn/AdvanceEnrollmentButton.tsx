"use client";

// Client island: the learner's "advance to the next stage" affordance on the
// guide. Calls advanceEnrollment; on a blocked gate it renders the gate reasons
// (missing proof artifact and/or unpassed quiz) instead of advancing.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { advanceEnrollment } from "@/lib/actions/enrollment";

export function AdvanceEnrollmentButton({ projectId }: { projectId: string }) {
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
