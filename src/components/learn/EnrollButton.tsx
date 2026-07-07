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
  label = "Enroll",
  busyLabel = "Enrolling…",
  cta = false,
}: {
  projectId: string;
  continueHref: string;
  /** Button label (e.g. "Start L1.01" for the first-run CTA). */
  label?: string;
  /** Label shown while the enroll request is in flight. */
  busyLabel?: string;
  /** Render as the solid-gold primary CTA instead of the gold-outline secondary. */
  cta?: boolean;
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
        className={`${cta ? "glass-button-cta" : "glass-button"} inline-flex items-center gap-1.5 px-4 py-2 font-mono text-xs uppercase tracking-wider`}
      >
        {pending ? busyLabel : label}
      </button>
      {error && (
        <p className="font-mono text-xs uppercase tracking-wider text-alert-red">
          {error}
        </p>
      )}
    </div>
  );
}
