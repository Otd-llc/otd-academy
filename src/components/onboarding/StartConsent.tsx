"use client";

// First-run email opt-in (GDPR). A compact, inline consent checkbox for /start —
// UNCHECKED by default, UNBUNDLED (never required to start a lesson), saved the
// moment it is ticked via the same setEmailConsent action the /account toggle
// uses (which stamps emailConsentUpdatedAt). This is the high-intent moment the
// buried account toggle misses. Optimistic: reverts on error.
import { useState, useTransition } from "react";
import { setEmailConsent } from "@/lib/actions/email-consent";

export function StartConsent({ initialConsent }: { initialConsent: boolean }) {
  const [on, setOn] = useState(initialConsent);
  const [pending, start] = useTransition();

  function toggle(next: boolean) {
    setOn(next); // optimistic
    start(async () => {
      try {
        const res = await setEmailConsent(next);
        setOn(res.emailConsent);
      } catch {
        setOn(!next); // revert
      }
    });
  }

  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={on}
        disabled={pending}
        onChange={(e) => toggle(e.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 accent-command-gold disabled:opacity-50"
      />
      <span className="flex flex-col gap-0.5">
        <span className="font-serif text-sm text-text">
          Email me build tips as new boards ship
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
          Optional · unsubscribe anytime
        </span>
      </span>
    </label>
  );
}
