"use client";

// Opens the Stripe Customer Portal (invoices, payment method, cancel a subscription).
// Mirrors PassButtons: gold command button, transition pending state, inline error. Calls
// the server action directly (no server-only imports). Any error (e.g. the Stripe Portal
// not yet configured in the dashboard) surfaces inline rather than crashing the page.
import { useState, useTransition } from "react";
import { createBillingPortalSession } from "@/lib/actions/billing";

const BTN =
  "inline-flex items-center justify-center gap-1.5 rounded border border-command-gold bg-navy-dark px-6 py-3 font-mono text-sm uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-50";

export function ManageBillingButton() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function open() {
    start(async () => {
      setError(null);
      try {
        const { url } = await createBillingPortalSession();
        window.location.href = url;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not open billing.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <button type="button" disabled={pending} onClick={open} className={BTN}>
        {pending ? "Opening…" : "Manage billing"}
      </button>
      {error ? (
        <p className="font-mono text-xs uppercase tracking-wider text-alert-red">
          {error}
        </p>
      ) : null}
    </div>
  );
}
