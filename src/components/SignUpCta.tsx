// Anonymous-visitor call-to-action in the public app-shell header (the SEO
// funnel top). On PUBLIC routes the root layout renders this in place of the
// signed-in UserMenu — links to the sign-in / sign-up page.
//
// TEMP — STYLE BAKE-OFF: four modern, on-brand CTA treatments rendered side by
// side for a visual pick. The old `.glass-button-cta` (glossy gold gradient +
// outer glow + inset bevel) reads dated; these drop the gloss/glow/bevel and keep
// the brand (Space-Mono caps, command-gold on deep-space, crisp hairlines). Copy
// is also simplified from the four-benefit run-on to a clean "Sign up free".
// Once one is chosen: collapse to it + roll the treatment sitewide.
import Link from "next/link";

const OPTIONS: { n: string; cls: string; arrow?: boolean }[] = [
  {
    // 1 · Solid — flat gold, no gradient/glow/bevel. The confident primary.
    n: "1 · Solid",
    cls: "inline-flex items-center rounded-md bg-command-gold px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-deep-space transition-colors hover:bg-gold-light",
  },
  {
    // 2 · Outline — gold hairline + gold text, fills on hover. Technical/minimal;
    // matches the in-guide action button, so adopting it unifies the site.
    n: "2 · Outline",
    cls: "inline-flex items-center rounded-md border border-command-gold px-4 py-1.5 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space",
  },
  {
    // 3 · Soft — low-opacity gold tint + gold text. Quiet; sits in the header
    // without shouting, brightens on hover.
    n: "3 · Soft",
    cls: "inline-flex items-center rounded-md border border-command-gold/40 bg-command-gold/10 px-4 py-1.5 font-mono text-xs uppercase tracking-wider text-gold-light transition-colors hover:border-command-gold hover:bg-command-gold/20 hover:text-white",
  },
  {
    // 4 · Console — dark surface + gold hairline + gold text + a nudging arrow.
    // Reads like a console key; the most "aerospace" of the four.
    n: "4 · Console",
    cls: "group inline-flex items-center gap-1.5 rounded-md border border-command-gold/50 bg-navy-dark px-4 py-1.5 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:border-command-gold hover:text-gold-light",
    arrow: true,
  },
];

export function SignUpCta() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {OPTIONS.map((o) => (
        <div key={o.n} className="flex flex-col items-start gap-0.5">
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted">
            {o.n}
          </span>
          <Link href="/sign-in" className={o.cls}>
            Sign up free
            {o.arrow ? (
              <span className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            ) : null}
          </Link>
        </div>
      ))}
    </div>
  );
}
