// Route classification behind the middleware (proxy.ts). The app's write
// boundary is the per-action `requireAdmin`; these are the matching VIEW
// boundaries.
//
// isAdminOnlyPath — operator/authoring surfaces a signed-in LEARNER is bounced
// off (curriculum, the project lifecycle, the parts CREATE form). The
// learner-facing build guide lives UNDER /projects/[slug]/[revLabel]/guide, so
// /projects is admin-only EXCEPT when "guide" sits at its route position
// (segment index 3) — keying on position, not substring, so a slug containing
// "guide" doesn't accidentally open the operator pages.
//
// isPublicPath — surfaces viewable by ANYONE, including signed-out visitors: the
// parts catalog (list + detail) is public for SEO / public-facing browsing. Only
// the create form (/parts/new) is held back to admins.
export function isAdminOnlyPath(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  const top = segments[0];
  if (top === "curriculum") return true;
  if (top === "parts") return segments[1] === "new";
  if (top === "projects") return segments[3] !== "guide";
  return false;
}

export function isPublicPath(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  const top = segments[0];
  // The home page "/" is public-eligible so a signed-out visitor isn't bounced
  // to /sign-in at the domain root (bad for SEO + first impressions). The page
  // itself sends anonymous visitors on to the public /courses catalog; only an
  // ADMIN sees the operator dashboard there.
  if (segments.length === 0) return true;
  // Parts catalog list (/parts) + detail (/parts/[id]) are public; the create
  // form (/parts/new) is not.
  if (top === "parts") return segments[1] !== "new";
  // The public /courses index (+ any subpaths) is crawlable.
  if (top === "courses") return true;
  // Guide routes are public-ELIGIBLE; the guide page enforces accessTier
  // (anonymous may read only PUBLIC projects). Key on the "guide" position so a
  // slug containing "guide" can't open the route.
  if (top === "projects") return segments[3] === "guide";
  return false;
}
