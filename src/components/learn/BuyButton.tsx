"use client";

// Client island: the Buy CTA on a priced PREMIUM project's paywall (Task B1).
// A single "Unlock $X.XX" button that starts a Hosted Stripe Checkout. On click
// it calls `createCheckoutSession` through a transition and, on success,
// redirects the browser to Stripe's hosted page. The webhook — not this redirect
// — is the source of truth for granting the entitlement; this island only kicks
// off the purchase.
//
// Mirrors WaitlistForm's look (gold-bordered command button, transition pending
// state, inline error on failure). No server-only imports here — it calls the
// server action directly.
import { useState, useTransition } from "react";
import { createCheckoutSession } from "@/lib/actions/checkout";
import { formatUsd } from "@/lib/format-money";

export function BuyButton({
  projectId,
  priceCents,
}: {
  projectId: string;
  priceCents: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function buy() {
    start(async () => {
      setError(null);
      try {
        const { url } = await createCheckoutSession({ projectId });
        // Hand off to Stripe's hosted Checkout. Keep `pending` true through the
        // navigation so the button stays in its redirecting state.
        window.location.href = url;
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Could not start checkout.",
        );
      }
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={buy}
        className="inline-flex items-center gap-1.5 rounded border border-command-gold bg-navy-dark px-5 py-2.5 font-mono text-sm uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-50"
      >
        {pending ? "Redirecting…" : `Unlock ${formatUsd(priceCents)}`}
      </button>
      <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
        One-time purchase · lifetime access · secure checkout by Stripe
      </p>
      {error && (
        <p className="font-mono text-xs uppercase tracking-wider text-alert-red">
          {error}
        </p>
      )}
    </div>
  );
}
