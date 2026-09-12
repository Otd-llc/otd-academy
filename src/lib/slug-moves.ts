// Permanent redirects for content URLs whose slug changed, and 404s for content
// deliberately withdrawn.
//
// WHY THIS IS NOT A BIGGER MACHINE, stated up front because the obvious designs
// are all more expensive and none of them is warranted yet.
//
// Under cacheComponents every dynamic route ships a prerendered fallback shell,
// and the shell commits its 200 before the component runs. So `/library/<gone>`
// answers 200 with the "No such page" body -- a soft 404. That is measured, not
// assumed (see @/lib/static-param-404, which fixes the three routes whose valid
// params are enumerable at the edge). The DB-backed routes are not enumerable
// there, so middleware is the only lever, and middleware needs data.
//
// WHAT THE 200 ACTUALLY COSTS, measured 2026-08-24 against a local production
// build. Less than it looks:
//   * the soft-404 body already carries `robots: noindex` (src/app/not-found.tsx)
//     and no canonical, while a real lesson carries a canonical and no robots tag;
//   * Google detects soft 404s and EXCLUDES those URLs from the index on its own.
// So an unknown slug nobody links to costs crawl budget and a Search Console
// line, not an indexed page.
//
// The one loss `noindex` cannot repair is a MOVED page: Google's guidance is a
// 301 for content that has a replacement, because that passes the signal on. A
// renamed lesson answering 200 throws that away. Hence: this table redirects, and
// only incidentally 404s.
//
// WHY A TABLE IN CODE AND NOT A LIVE STORE. Publishing the slug set (or a
// tombstone set) to Vercel Global Config was designed and rejected on evidence:
//   * `src/proxy.ts` does NOT read Global Config today -- `defenseEnabled` is read
//     in src/auth.ts and in server actions -- so it would be a NEW network
//     dependency on the request path of exactly the pages that must be fast;
//   * nothing persists a rename anywhere. `mini-lesson.ts` computes `priorSlug`
//     and uses it only to drop a cache tag. There is no alias table, so there is
//     nothing to publish;
//   * and the premise is unrealised: as of 2026-08-24 all 69 mini-lessons are
//     published and none has ever been renamed. Zero moves, zero withdrawals.
// Infrastructure for an event that has not happened is how a codebase acquires
// machinery nobody can explain later.
//
// The precedent is right here: @/lib/legacy-slug-redirect is a committed pure
// function covering the one bulk rename that DID happen (the `foundry-` prefix
// drop), and it has been sufficient. That is a prefix RULE; this is a per-slug
// TABLE, which is why they are separate modules rather than one.
//
// ADDING AN ENTRY IS THE WORKFLOW. When you rename or withdraw a lesson through
// /admin, add its old slug here in the same change. If that ever stops being
// reliable -- if renames become frequent enough that someone forgets -- the next
// step is a SlugAlias table written by the rename action and generated into this
// file by a `slugs:check` CI gate, the same shape as `diagrams:check`. Do that
// when the forgetting actually costs something, not before.
//
// PURE, and the table is injected rather than imported, so the middleware wiring
// and the data are testable apart. Same shape as `isUnknownStaticParam`.

/** What a request to a known-moved URL should get. `null` = not a known move. */
export type MoveOutcome =
  | { kind: "moved"; to: string }
  | { kind: "gone" }
  | null;

/**
 * Old slug -> new slug, or `null` for "withdrawn, no replacement", keyed by the
 * first path segment.
 *
 * EMPTY ON PURPOSE. See the header: no lesson, course or part has been renamed or
 * withdrawn. The mechanism ships armed so the first one is a one-line data edit
 * instead of a design project.
 */
export type MoveTable = Record<string, Record<string, string | null>>;

export const SLUG_MOVES: MoveTable = {
  library: {},
  courses: {},
  parts: {},
};

/**
 * Resolve a request path against the move table.
 *
 *   /library/old-name   with { library: { "old-name": "new-name" } }  -> moved
 *   /library/withdrawn  with { library: { withdrawn: null } }         -> gone
 *   /library/anything   otherwise                                      -> null
 *
 * Deliberately narrow, for the same reasons `isUnknownStaticParam` is: it fires
 * only on a two-segment path whose first segment is in the table. A deeper path
 * is not a route this owns, and the hub index is a real page.
 *
 * FAIL-OPEN BY CONSTRUCTION. An absent entry returns `null` and the request is
 * served exactly as it is today. There is no state that can go stale, be
 * unreachable, or arrive empty and start 404ing live lessons -- which is the
 * failure mode that ruled out publishing a positive slug set.
 */
export function resolveSlugMove(pathname: string, table: MoveTable = SLUG_MOVES): MoveOutcome {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length !== 2) return null;

  const [top, param] = segments;
  const surface = table[top!];
  if (!surface) return null;

  // Decode before lookup: a crawler following an old link may percent-encode it,
  // and a malformed escape is not a slug we have ever issued.
  let decoded: string;
  try {
    decoded = decodeURIComponent(param!);
  } catch {
    return null;
  }

  if (!Object.hasOwn(surface, decoded)) return null;
  const to = surface[decoded];
  // An entry mapping to itself would loop the redirect forever. Treat it as no
  // move rather than trusting the table to never contain one.
  if (to === decoded) return null;
  return to === null ? { kind: "gone" } : { kind: "moved", to: `/${top}/${to}` };
}
