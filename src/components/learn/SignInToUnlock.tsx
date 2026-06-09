// Server-renderable sign-in CTA for the premium sales surfaces (Paywall + guide
// hub). An anonymous visitor can see a purchasable course but can't buy —
// `createCheckoutSession` requires a signed-in user. Rather than dead-ending on
// a raw "Unauthorized", we show a link to /sign-in styled like the BuyButton,
// labelled "Sign in to unlock $X.XX". After signing in the viewer lands back on
// the sales surface with the real BuyButton.
//
// Pure markup + a Link — no client state — so it's safe to render from either
// server component. Mirrors BuyButton's gold-bordered command-button look.
import Link from "next/link";
import { formatUsd } from "@/lib/format-money";

export function SignInToUnlock({ priceCents }: { priceCents: number }) {
  return (
    <div className="space-y-2">
      <Link
        href="/sign-in"
        className="inline-flex items-center gap-1.5 rounded border border-command-gold bg-navy-dark px-5 py-2.5 font-mono text-sm uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space"
      >
        Sign in to unlock {formatUsd(priceCents)}
      </Link>
      <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
        One-time purchase · lifetime access · secure checkout by Stripe
      </p>
    </div>
  );
}
