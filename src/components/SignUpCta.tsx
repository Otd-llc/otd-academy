// Anonymous-visitor call-to-action in the public app-shell header (the SEO
// funnel top). On PUBLIC routes the root layout renders this in place of the
// signed-in UserMenu.
//
// One-door auth: Google / GitHub / magic-link all create-or-sign-in in a single
// step — there is no separate "sign up" flow. So the CTA is a single gold-outline
// "Sign in / Sign up" (design A3): a returning visitor is never wrongly told to
// "sign up", and a new one is never told they must already have an account.
//
// The label is a prop because the two places it renders have different budgets:
// in the body of /pricing it can say the whole thing, but in a one-row header it
// competes with the brand lockup, the theme toggle and the menu for a 375px
// line. Both halves of the promise have to survive the shortening -- a label
// that says only "sign in" tells a first-time visitor they need an account they
// do not have, which is the exact misread design A3 exists to prevent.
import Link from "next/link";

export function SignUpCta({ label = "Sign in / Sign up" }: { label?: string }) {
  return (
    <Link
      href="/sign-in"
      className="glass-button inline-flex items-center whitespace-nowrap rounded-md px-3 py-1.5 text-center font-mono text-xs uppercase tracking-wider"
    >
      {label}
    </Link>
  );
}
