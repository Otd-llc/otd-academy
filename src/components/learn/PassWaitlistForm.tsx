"use client";

// Client island: All-Access Pass waitlist capture (the Pass is pre-sale). Mirrors
// WaitlistForm: a one-click "Notify me" when we know the signed-in email, an email
// input for anonymous visitors. Calls joinPassWaitlist through a transition; on
// success it swaps to a confirmation line.
import { useState, useTransition } from "react";
import { joinPassWaitlist } from "@/lib/actions/pass-waitlist";

export function PassWaitlistForm({ defaultEmail }: { defaultEmail?: string }) {
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(!defaultEmail);

  if (done) {
    return (
      <p className="font-mono text-xs uppercase tracking-wider text-status-green">
        ✓ You&apos;re on the list. We&apos;ll email you when the Pass opens.
      </p>
    );
  }

  function submit(value: string) {
    start(async () => {
      setError(null);
      try {
        await joinPassWaitlist({ email: value });
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
            className="inline-flex items-center gap-1.5 rounded border border-command-gold bg-deep-space px-4 py-2 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-50"
          >
            <span aria-hidden="true">🔔</span>
            {pending ? "Joining…" : "Join the Pass waitlist"}
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
          We&apos;ll email {defaultEmail} when the Pass opens at launch.
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
        Get notified when the Pass opens
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
          className="inline-flex items-center gap-1.5 rounded border border-command-gold bg-deep-space px-4 py-2 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-50"
        >
          {pending ? "Joining…" : "Join the Pass waitlist"}
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
