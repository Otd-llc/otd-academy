import Link from "next/link";

// In-app dunning nudge: a quiet alert-red hairline strip shown when the learner's
// subscription needs attention (payment failed / lapsed). Token-only color, no filled
// box, no big radius, no em-dash (house voice + design system). Rendered on /account and
// the learner home only (deliberately not a global app-shell banner). It is NOT
// dismissible: it is derived from live status, so it clears itself the moment the payment
// recovers or the subscription is canceled. The CTA points at /account, where the
// Manage-billing button opens the Stripe portal.
export function DunningBanner() {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border border-alert-red/50 bg-alert-red/[0.06] px-4 py-3">
      <p className="font-mono text-xs uppercase tracking-wider text-alert-red">
        Your last subscription payment did not go through. Update your card to keep access.
      </p>
      <Link
        href="/account"
        className="shrink-0 font-mono text-xs uppercase tracking-wider text-command-gold underline-offset-4 hover:underline"
      >
        Manage billing →
      </Link>
    </div>
  );
}
