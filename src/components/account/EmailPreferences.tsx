"use client";

// Lifecycle-email opt-in toggle for /account (GDPR). Default state comes from the
// server (User.emailConsent). Flipping it calls the setEmailConsent action, which
// stamps emailConsentUpdatedAt. Optimistic: the switch moves immediately and
// reverts on error. router.refresh() re-pulls the server value so the label stays
// truthful even if two tabs disagree.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setEmailConsent } from "@/lib/actions/email-consent";

export function EmailPreferences({ initialConsent }: { initialConsent: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(initialConsent);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !on;
    setError(null);
    setOn(next); // optimistic
    startTransition(async () => {
      try {
        const res = await setEmailConsent(next);
        setOn(res.emailConsent);
        router.refresh();
      } catch {
        setOn(!next); // revert
        setError("Could not save that. Try again.");
      }
    });
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-5 border-y border-panel-border/60 py-3.5">
        <div>
          <p className="font-serif text-sm text-text">Build tips and product updates</p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-gray-3">
            {on ? "On · you'll get occasional emails" : "Off · you won't get any"}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Build tips and product updates"
          disabled={pending}
          onClick={toggle}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-command-gold disabled:opacity-50 ${
            on ? "border-command-gold bg-command-gold" : "border-panel-border bg-deep-space"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full transition-transform ${
              on ? "translate-x-[22px] bg-deep-space" : "translate-x-[3px] bg-panel-border"
            }`}
          />
        </button>
      </div>
      <p className="mt-2 font-serif text-xs leading-relaxed text-muted">
        Off unless you turn it on. Every email includes one-click unsubscribe. Sign-in
        links are separate and always arrive.
      </p>
      {error ? (
        <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-alert-red">
          {error}
        </p>
      ) : null}
    </div>
  );
}
