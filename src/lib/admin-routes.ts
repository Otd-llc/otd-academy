// Which routes the middleware (proxy.ts) restricts to ADMINs. The app's write
// boundary is the per-action `requireAdmin`; THIS is the view boundary — it keeps
// learners out of operator/authoring surfaces (curriculum, the parts catalog,
// the project lifecycle) so they never see author tooling that would just fail.
//
// The learner-facing build guide lives UNDER /projects/[slug]/[revLabel]/guide,
// so /projects is admin-only EXCEPT when "guide" sits at its route position
// (segment index 3). Keying on position, not substring, means a project whose
// slug happens to contain "guide" doesn't accidentally open the operator pages.
export function isAdminOnlyPath(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  const top = segments[0];
  if (top === "curriculum" || top === "parts") return true;
  if (top === "projects") return segments[3] !== "guide";
  return false;
}
