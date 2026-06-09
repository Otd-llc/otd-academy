// SEO-preserving redirect for the old legacy-prefixed project slugs.
//
// Project slugs are PUBLIC URLs. When the legacy slug prefix was dropped, every
// existing `/projects/foundry-<rest>/...` URL — indexed, linked, bookmarked —
// had to keep resolving. This pure helper rewrites such a path to its
// prefix-free form so the middleware can issue a single permanent (308)
// redirect; everything else returns null (no redirect). Kept pure +
// dependency-free so it's unit-testable in isolation, without booting Auth.js or
// Next's edge runtime.
export function legacySlugRedirect(pathname: string): string | null {
  // The literal old-URL prefix is intentionally preserved here: it matches real
  // indexed/bookmarked links and must keep doing so for the 308 to fire.
  const PREFIX = "/projects/foundry-";
  if (!pathname.startsWith(PREFIX)) return null;
  // Drop only the legacy prefix token, keeping the rest of the slug + any
  // sub-path:
  //   /projects/foundry-l1-01-wroom-breakout/v1/guide
  //     → /projects/l1-01-wroom-breakout/v1/guide
  return "/projects/" + pathname.slice(PREFIX.length);
}
