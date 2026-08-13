// Dev-only route surfaces, gated where the gate can actually work.
//
// WHY THIS IS NOT DONE IN THE PAGE. Every one of these pages opens with
//
//     if (process.env.NODE_ENV === "production") notFound();
//
// and that was believed for a long time to be sufficient. It is not, and the
// way it fails is silent.
//
// `notFound()` produces a 404 STATUS only when the route renders per request.
// Under cacheComponents/PPR, Next emits a static shell for the route and streams
// the dynamic part into it. The response status belongs to the SHELL, and the
// shell is committed before the dynamic part has answered - so `notFound()`
// renders the 404 BODY into a page that was already sent with **200**. Every
// fully-static dev page happened to be fine (Next resolves those at build and
// records a real 404), which is exactly why nobody noticed: the pattern looked
// proven by the cases where it held.
//
// Measured on production 2026-08-13, three routes answering 200 with the 404
// body: /film-render/[cut], /diagram-render/[key], /sandbox/share-cards.
// `await connection()` in the page was tried first and DOES NOT FIX IT - it
// marks the dynamic hole, it does not stop the shell being emitted. Verified
// against a local production build, still 200. The gate has to run before a
// response is committed at all, which means middleware.
//
// A SECOND THING THIS FIXES. An env var read during a build is frozen into the
// artefact, so DIAGRAM_EXPORT / FILM_EXPORT could never have un-gated a
// deployed build from inside a prerendered page. Middleware reads env at
// request time, so the escape hatch below is real rather than decorative.
//
// The page-level `notFound()` calls stay as defence in depth. They are the
// correct behaviour for anything that reaches the page; they are simply not
// capable of being the only gate.

/** The dev-only prefixes, and the env var (if any) that deliberately re-opens one. */
const DEV_ONLY: { prefix: string; unlockedBy?: string }[] = [
  // Audition surfaces. No escape hatch: a sandbox round is never captured from a
  // deployed build, and every one of them is deleted before its PR anyway.
  { prefix: "sandbox" },
  // The diagram exporter's render surface. CI un-gates it to raster the guide
  // diagrams from a production build.
  { prefix: "diagram-render", unlockedBy: "DIAGRAM_EXPORT" },
  // The promo film's capture surface, driven by Otd-llc/otd-promo the same way.
  { prefix: "film-render", unlockedBy: "FILM_EXPORT" },
];

/**
 * Should this request be refused outright as a dev-only surface?
 *
 * Pure, so it can be unit-tested without a build, a server or a browser - the
 * lesson from the defect above being that the interesting behaviour here is
 * request-time and cannot be read off the source of a page.
 *
 * @param pathname  the request path, e.g. "/film-render/logbook"
 * @param env       the environment to consult (defaults to process.env)
 */
export function isDevOnlyBlocked(
  pathname: string,
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.NODE_ENV !== "production") return false;
  // Split rather than `startsWith`: "/film-renderer" and "/sandboxes" are
  // different routes and must not inherit either the block or the exemption.
  const top = pathname.split("/").filter(Boolean)[0];
  if (!top) return false;
  const entry = DEV_ONLY.find((d) => d.prefix === top);
  if (!entry) return false;
  // Present and non-empty. An accidental `FILM_EXPORT=` in a deployment's env
  // should not silently open the route.
  if (entry.unlockedBy && (env[entry.unlockedBy] ?? "") !== "") return false;
  return true;
}

/** The prefixes this module governs. Exported for the tests, so a new entry in
 *  DEV_ONLY cannot be added without the coverage assertion noticing. */
export const DEV_ONLY_PREFIXES = DEV_ONLY.map((d) => d.prefix);
