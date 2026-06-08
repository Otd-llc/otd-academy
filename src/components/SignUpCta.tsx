// Anonymous-visitor call-to-action in the public app-shell header (the SEO
// funnel top). On PUBLIC routes the root layout renders this in place of the
// signed-in UserMenu — a solid gold CTA (.glass-button-cta) linking to the
// sign-in / sign-up page. A plain server component: no client state, just a
// styled link.
import Link from "next/link";

export function SignUpCta() {
  return (
    <Link
      href="/sign-in"
      className="glass-button glass-button-cta inline-flex items-center rounded-md px-3 py-1.5 text-center font-mono text-xs uppercase tracking-wider"
    >
      Sign up free — track your progress, earn mastery, get the project files
    </Link>
  );
}
