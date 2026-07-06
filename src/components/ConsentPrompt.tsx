"use client";

// Post-signup lifecycle-email consent prompt (GDPR). The layout renders this only
// for a signed-in user who has never made an email choice
// (emailConsentUpdatedAt == null). It is a non-blocking corner card, NOT a modal:
// consent must be unbundled from using the account, so nothing here gates the page.
// Either explicit choice (or the dismiss ×, which counts as "no") calls
// setEmailConsent, which stamps the timestamp — so the prompt then never shows
// again. Dismiss defaults to NO consent (the privacy-safe outcome).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setEmailConsent } from "@/lib/actions/email-consent";

export function ConsentPrompt() {
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  function choose(optIn: boolean) {
    setHidden(true); // optimistic — the card slides out immediately
    setError(false);
    startTransition(async () => {
      try {
        await setEmailConsent(optIn);
        router.refresh(); // re-pull the server state so it won't re-render
      } catch {
        setHidden(false);
        setError(true);
      }
    });
  }

  if (hidden) return null;

  return (
    <aside
      aria-label="Email preferences"
      className="fixed bottom-4 right-4 z-40 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-panel-border bg-deep-space p-4 shadow-[var(--elev-card)] print:hidden"
    >
      <button
        type="button"
        aria-label="No thanks"
        disabled={pending}
        onClick={() => choose(false)}
        className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded text-muted transition-colors hover:text-gold-light focus-visible:text-gold-light focus-visible:outline-none disabled:opacity-50"
      >
        <span aria-hidden="true" className="text-lg leading-none">
          ×
        </span>
      </button>

      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        ▸ Email
      </p>
      <p className="mt-2 pr-5 font-serif text-sm text-text">
        Want build tips by email?
      </p>
      <p className="mt-1 font-serif text-xs leading-relaxed text-muted">
        Occasional new lessons, build tips, and launch news. Off unless you turn it
        on, with one-click unsubscribe on every email.
      </p>

      {error ? (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-alert-red">
          Could not save that. Try again.
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => choose(true)}
          className="inline-flex items-center gap-2 rounded-md border border-command-gold bg-command-gold px-3.5 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-deep-space transition-colors hover:bg-gold-light disabled:opacity-50"
        >
          Email me build tips
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => choose(false)}
          className="inline-flex items-center gap-2 rounded-md border border-panel-border px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted transition-colors hover:border-command-gold hover:text-gold-light disabled:opacity-50"
        >
          No thanks
        </button>
      </div>
    </aside>
  );
}
