"use client";

// Admin-only test harness (Stripe Phase 3): starts a recurring subscription checkout so
// the full sub → portal → dunning loop is exercisable without a public storefront button
// (the subscription is for a future program, not courses, so there is no public subscribe
// CTA). Mirrors PassButtons. It subscribes the SIGNED-IN ADMIN's own account, so a live
// charge would be real money — use Stripe test mode. The action throws "isn't available
// yet" until scripts/set-subscription-price.ts has provisioned the recurring price; that
// surfaces inline here (expected).
import { useState, useTransition } from "react";
import { createSubscriptionCheckoutSession } from "@/lib/actions/pass";

const BTN =
  "inline-flex items-center justify-center gap-1.5 rounded border border-command-gold bg-navy-dark px-6 py-3 font-mono text-sm uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-50";

export function StartTestSubscriptionButton() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function subscribe() {
    start(async () => {
      setError(null);
      try {
        const { url } = await createSubscriptionCheckoutSession();
        window.location.href = url;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not start the subscription.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <button type="button" disabled={pending} onClick={subscribe} className={BTN}>
        {pending ? "Redirecting…" : "Start test subscription"}
      </button>
      {error ? (
        <p className="font-mono text-xs uppercase tracking-wider text-alert-red">
          {error}
        </p>
      ) : null}
    </div>
  );
}
