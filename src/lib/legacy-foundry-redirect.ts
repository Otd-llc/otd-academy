// SEO-preserving redirect for the old `foundry-` codename slugs.
//
// Project slugs are PUBLIC URLs. When the `foundry-` prefix was dropped (product
// renamed "Project Foundry" → "One Thousand Drones Academy"), every existing
// `/projects/foundry-<rest>/...` URL — indexed, linked, bookmarked — had to keep
// resolving. This pure helper rewrites such a path to its prefix-free form so the
// middleware can issue a single permanent (308) redirect; everything else returns
// null (no redirect). Kept pure + dependency-free so it's unit-testable in
// isolation, without booting Auth.js or Next's edge runtime.
export function legacyFoundryRedirect(pathname: string): string | null {
  const PREFIX = "/projects/foundry-";
  if (!pathname.startsWith(PREFIX)) return null;
  // Drop only the `foundry-` token, keeping the rest of the slug + any sub-path:
  //   /projects/foundry-l1-01-wroom-breakout/v1/guide
  //     → /projects/l1-01-wroom-breakout/v1/guide
  return "/projects/" + pathname.slice(PREFIX.length);
}
