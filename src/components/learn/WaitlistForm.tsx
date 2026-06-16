"use client";

// Client island: anonymous waitlist capture (a PREMIUM paywall, or a coming-soon
// course's preview page). Calls `joinWaitlist` through a transition; on success
// it swaps to a confirmation line, on failure it surfaces the error and retries.
// No auth required — anyone can leave an email.
//
// `defaultEmail` (the signed-in user's address) enables ONE-CLICK join: we show
// a single "Notify me" button instead of an empty input, with a "use a different
// email" escape hatch. Anonymous visitors (no defaultEmail) get the input form.
import { useState, useTransition } from "react";
import { joinWaitlist } from "@/lib/actions/waitlist";

export function WaitlistForm({
  projectId,
  defaultEmail,
}: {
  projectId: string;
  defaultEmail?: string;
}) {
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  // One-click when we have the signed-in email; the input form otherwise. The
  // "use a different email" link flips a one-click visitor into the input.
  const [editing, setEditing] = useState(!defaultEmail);

  if (done) {
    return (
      <p className="font-mono text-xs uppercase tracking-wider text-status-green">
        ✓ We&apos;ll email you when this course opens
      </p>
    );
  }

  function submit(value: string) {
    start(async () => {
      setError(null);
      try {
        await joinWaitlist({ email: value, projectId });
        setDone(true);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Could not join the waitlist.",
        );
      }
    });
  }

  // One-click mode — signed in, address known.
  if (!editing && defaultEmail) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => submit(defaultEmail)}
            className="inline-flex items-center gap-1.5 rounded border border-command-gold bg-navy-dark px-4 py-2 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-50"
          >
            <span aria-hidden="true">🔔</span>
            {pending ? "Joining…" : "Notify me when it opens"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="font-mono text-xs uppercase tracking-wider text-muted underline hover:text-gray-1"
          >
            Use a different email
          </button>
        </div>
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
          We&apos;ll email {defaultEmail}
        </p>
        {error && (
          <p className="font-mono text-xs uppercase tracking-wider text-alert-red">
            {error}
          </p>
        )}
      </div>
    );
  }

  // Input mode — anonymous, or a one-click visitor who chose another address.
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
          onClick={() => submit(email)}
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
