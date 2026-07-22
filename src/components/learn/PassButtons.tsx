"use client";

// Client islands for the /pricing storefront CTAs (signed-in viewers).
//
//   - <BuyPassButton>     starts a Hosted Stripe Checkout for the All-Access Pass.
//   - <UpgradePassButton> starts the pay-the-difference upgrade; when the
//     learner's prior purchases already cover the Pass, the action grants it
//     directly (no checkout) and we send them to /learn.
//
// Both mirror BuyButton's look (gold command button, transition pending state,
// inline error). They call the server actions directly — no server-only imports.
import { useState, useTransition } from "react";
import {
  createPassCheckoutSession,
  createUpgradeCheckoutSession,
} from "@/lib/actions/pass";
import { formatUsd } from "@/lib/format-money";
import { trackCtaClicked } from "@/lib/analytics-client";

const BTN =
  "inline-flex items-center justify-center gap-1.5 rounded border border-command-gold bg-deep-space px-6 py-3 font-mono text-sm uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-50";

export function BuyPassButton({ priceCents }: { priceCents: number }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function buy() {
    trackCtaClicked("buy_pass");
    start(async () => {
      setError(null);
      try {
        const { url } = await createPassCheckoutSession();
        window.location.href = url;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not start checkout.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <button type="button" disabled={pending} onClick={buy} className={BTN}>
        {pending ? "Redirecting…" : `Get the Pass ${formatUsd(priceCents)}`}
      </button>
      {error ? (
        <p className="font-mono text-xs uppercase tracking-wider text-alert-red">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function UpgradePassButton({ chargeCents }: { chargeCents: number }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function upgrade() {
    trackCtaClicked("upgrade_pass");
    start(async () => {
      setError(null);
      try {
        const result = await createUpgradeCheckoutSession();
        // Already covered → granted directly, no checkout.
        window.location.href = result.url ?? "/learn?pass=1";
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not start upgrade.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <button type="button" disabled={pending} onClick={upgrade} className={BTN}>
        {pending
          ? "Redirecting…"
          : `Upgrade to the Pass ${formatUsd(chargeCents)}`}
      </button>
      <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
        We credit what you already paid toward the Pass.
      </p>
      {error ? (
        <p className="font-mono text-xs uppercase tracking-wider text-alert-red">
          {error}
        </p>
      ) : null}
    </div>
  );
}
