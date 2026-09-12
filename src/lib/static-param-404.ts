// Real 404s for unknown params on STATICALLY-ENUMERATED routes.
//
// THE PROBLEM, measured rather than assumed (2026-08-21, local production build
// with AUTH_TRUST_HOST=1 so the route gate was actually on):
//
//   /tools/ohms-law               200   <- control, a real tool
//   /tools/garbage-not-a-tool     200   <- renders the 404 BODY
//   /briefs/overview              200   <- control
//   /briefs/garbage-key           200   <- renders the 404 BODY
//   /embed/ohms-law               200   <- control
//   /embed/garbage-not-a-tool     200   <- renders the 404 BODY
//   /totally-unrouted-path-xyz    307   <- control: middleware IS running
//
// A page-level `notFound()` cannot set a 404 STATUS on a route Next prerenders:
// the status belongs to the shell, which is committed before the component has
// answered. So these served the "No such page" body under a 200 — a soft-404,
// which a crawler indexes as a real page. Adding src/app/not-found.tsx (#485)
// made that body look right and changed the status not at all.
//
// This is the same failure and the same fix as src/lib/dev-only-routes.ts, whose
// header records the original measurement. Middleware is the last point where a
// real 404 is still possible, so the answer has to happen there.
//
// SCOPE — why only these three routes. The fix needs the valid params at the
// EDGE. These three have them: /tools and /embed both map over the pure-data
// TOOLS registry, and /briefs over BRIEF_KEYS. The other soft-404s measured in
// the same run — /library/<unknown>, /courses/<unknown>, /parts/<unknown> — are
// DB-backed, and enumerating them would mean a database round trip in middleware
// on every request. That is a different and much more expensive problem; it is
// recorded, not silently folded in here.
//
// PURE (no I/O, no framework imports) so it is unit-testable, and so the
// middleware bundle carries a function rather than a data fetch. The caller
// supplies the known sets; this module owns only the route→set mapping and the
// path parsing.

/** The routes this guard covers, and which set of params each accepts. */
export type KnownParams = {
  /** Slugs in the TOOLS registry — serves both /tools/<slug> and /embed/<slug>. */
  tools: readonly string[];
  /** BRIEF_KEYS — serves /briefs/<key>. */
  briefs: readonly string[];
};

/** First path segment → which known set governs its single child segment. */
const GUARDED: Record<string, keyof KnownParams> = {
  tools: "tools",
  embed: "tools",
  briefs: "briefs",
};

/**
 * True when `pathname` addresses a guarded route with a param that does not
 * exist, and the caller should answer 404 instead of letting the request through.
 *
 * Deliberately narrow. It fires ONLY on a two-segment path whose first segment is
 * guarded:
 *
 *   /tools                 -> false  (the hub index, a real page)
 *   /tools/ohms-law        -> false  (a real tool)
 *   /tools/nope            -> TRUE
 *   /tools/nope/deeper     -> false  (not a route this owns; Next 404s it itself)
 *
 * A trailing slash is tolerated because a crawler will send one.
 */
export function isUnknownStaticParam(
  pathname: string,
  known: KnownParams,
): boolean {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length !== 2) return false;

  const [top, param] = segments;
  const setName = GUARDED[top!];
  if (!setName) return false;

  // Decode before comparing: a crawler may percent-encode, and "ohms%2Dlaw"
  // is the same tool as "ohms-law". A malformed escape is not a real param.
  let decoded: string;
  try {
    decoded = decodeURIComponent(param!);
  } catch {
    return true;
  }

  return !known[setName].includes(decoded);
}
