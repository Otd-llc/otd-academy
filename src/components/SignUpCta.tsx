// Anonymous-visitor call-to-action in the public app-shell header (the SEO
// funnel top). On PUBLIC routes the root layout renders this in place of the
// signed-in UserMenu.
//
// One-door auth: Google / GitHub / magic-link all create-or-sign-in in a single
// step — there is no separate "sign up" flow. So the CTA is a single gold-outline
// "Sign in / Sign up" (design A3): a returning visitor is never wrongly told to
// "sign up", and a new one is never told they must already have an account.
import Link from "next/link";

export function SignUpCta() {
  return (
    <Link
      href="/sign-in"
      className="glass-button inline-flex items-center rounded-md px-3 py-1.5 text-center font-mono text-xs uppercase tracking-wider"
    >
      Sign in / Sign up
    </Link>
  );
}
