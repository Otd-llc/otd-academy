"use client";

// Client island: enroll the signed-in learner in a board, then jump straight
// into the guide on success. Server-side `enroll` is idempotent + prereq-gated,
// so a failure (locked board) surfaces as an inline message.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enroll } from "@/lib/actions/enrollment";

export function EnrollButton({
  projectId,
  continueHref,
}: {
  projectId: string;
  continueHref: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            try {
              await enroll({ projectId });
              router.push(continueHref);
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not enroll.");
            }
          })
        }
        className="inline-flex items-center gap-1.5 rounded border border-command-gold bg-navy-dark px-4 py-2 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-50"
      >
        {pending ? "Enrolling…" : "Enroll"}
      </button>
      {error && (
        <p className="font-mono text-xs uppercase tracking-wider text-alert-red">
          {error}
        </p>
      )}
    </div>
  );
}
