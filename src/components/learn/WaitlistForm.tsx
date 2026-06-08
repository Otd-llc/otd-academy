"use client";

// Client island: the anonymous waitlist capture on a PREMIUM project's paywall.
// An email input + submit that calls `joinWaitlist` through a transition. On
// success it swaps to a confirmation line; on failure it surfaces the error and
// lets the visitor retry. No auth — anyone hitting the wall can leave an email.
import { useState, useTransition } from "react";
import { joinWaitlist } from "@/lib/actions/waitlist";

export function WaitlistForm({ projectId }: { projectId: string }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <p className="font-mono text-xs uppercase tracking-wider text-status-green">
        ✓ We&apos;ll email you when this course opens
      </p>
    );
  }

  function submit() {
    start(async () => {
      setError(null);
      try {
        await joinWaitlist({ email, projectId });
        setDone(true);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Could not join the waitlist.",
        );
      }
    });
  }

  return (
    <div className="space-y-2">
      <label className="block font-mono text-xs uppercase tracking-wider text-muted">
        Get notified when it opens
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="min-w-0 flex-1 rounded border border-panel-border bg-deep-space px-3 py-2 font-mono text-sm text-gray-1"
        />
        <button
          type="button"
          disabled={pending || email.length === 0}
          onClick={submit}
          className="inline-flex items-center gap-1.5 rounded border border-command-gold bg-navy-dark px-4 py-2 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-50"
        >
          {pending ? "Joining…" : "Join the waitlist"}
        </button>
      </div>
      {error && (
        <p className="font-mono text-xs uppercase tracking-wider text-alert-red">
          {error}
        </p>
      )}
    </div>
  );
}
