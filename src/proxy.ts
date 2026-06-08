import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminOnlyPath } from "@/lib/admin-routes";

// Auth.js v5's bare `auth` export only attaches `req.auth` to the request — it
// does not redirect unauthenticated users on its own. Wrap it so unauth requests
// land on `/sign-in`. The matcher excludes Auth.js callback routes, the sign-in
// page itself, and Next's static asset paths.
export default auth((req) => {
  if (!req.auth) {
    const signInUrl = new URL("/sign-in", req.nextUrl.origin);
    return NextResponse.redirect(signInUrl);
  }
  // Operator / authoring surfaces (curriculum, the parts catalog, the project
  // lifecycle) are admin-only. A confirmed LEARNER who reaches one by URL or
  // stale link is sent to their dashboard rather than shown author tooling.
  // Writes are already `requireAdmin`; this is the matching VIEW gate. We deny
  // only an explicit LEARNER (not "anyone != ADMIN") so that if the role were
  // ever absent in the edge runtime this degrades to a harmless no-op instead of
  // locking the admin out. Learner guide routes (/projects/.../guide) are
  // excluded by isAdminOnlyPath.
  if (req.auth.user?.role === "LEARNER" && isAdminOnlyPath(req.nextUrl.pathname)) {
    return NextResponse.redirect(new URL("/learn", req.nextUrl.origin));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api/auth|sign-in|_next/static|_next/image|favicon.ico).*)"],
};
