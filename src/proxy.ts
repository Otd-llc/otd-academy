import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminOnlyPath, isPublicPath } from "@/lib/admin-routes";
import { legacySlugRedirect } from "@/lib/legacy-slug-redirect";

// Auth.js v5's bare `auth` export only attaches `req.auth` to the request — it
// does not redirect unauthenticated users on its own. Wrap it so unauth requests
// land on `/sign-in`. The matcher excludes Auth.js callback routes, the Stripe
// webhook (`/api/stripe/webhook` — a server-to-server POST from Stripe that
// carries NO session cookie; it MUST reach the route to verify the signature,
// never be redirected to /sign-in), the sign-in page itself, the SEO crawl files
// (`sitemap.xml` / `robots.txt` — must be reachable by signed-out crawlers, never
// redirected), Next's static assets, AND any path with a file extension
// (`.*\\..*`) — public/ files like `/brand/1kd-logotype.svg` and the guide
// diagrams are served outside `_next`, so without this they'd be 307-redirected
// to /sign-in for signed-out visitors and silently fail to load.
export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Legacy `foundry-` slug URLs (pre-rename) 308 → their prefix-free form so
  // indexed/bookmarked project links keep resolving. Runs BEFORE the auth gate so
  // signed-out crawlers following an old public-lesson link land on the canonical
  // URL directly instead of bouncing through /sign-in. 308 (permanent + method-
  // preserving) tells search engines to update the index.
  const legacyPath = legacySlugRedirect(pathname);
  if (legacyPath) {
    return NextResponse.redirect(new URL(legacyPath, req.nextUrl.origin), 308);
  }

  // Public surfaces (the parts catalog list + detail) are viewable by ANYONE,
  // including signed-out visitors — that's deliberate, for SEO / public browsing.
  // Every other route still requires a signed-in user.
  if (!req.auth && !isPublicPath(pathname)) {
    return NextResponse.redirect(new URL("/sign-in", req.nextUrl.origin));
  }

  // Operator / authoring surfaces (curriculum, the project lifecycle, the parts
  // CREATE form) are admin-only. A confirmed LEARNER who reaches one by URL or
  // stale link is sent to their dashboard rather than shown author tooling.
  // Writes are already `requireAdmin`; this is the matching VIEW gate. We deny
  // only an explicit LEARNER (not "anyone != ADMIN") so that if the role were
  // ever absent in the edge runtime this degrades to a harmless no-op instead of
  // locking the admin out. Learner guide routes (/projects/.../guide) and the
  // public parts catalog are excluded by isAdminOnlyPath.
  if (req.auth?.user?.role === "LEARNER" && isAdminOnlyPath(pathname)) {
    return NextResponse.redirect(new URL("/learn", req.nextUrl.origin));
  }

  // Forward the request path as a header so the root layout (a Server
  // Component, which can't read the URL otherwise) knows which route is
  // rendering and can pick the right chrome — full app-shell for signed-in
  // users, a public header + sign-up CTA on PUBLIC routes. Only the
  // pass-through response carries it; the redirect branches above are unchanged.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
});

export const config = {
  matcher: [
    "/((?!api/auth|api/stripe/webhook|sign-in|sitemap.xml|robots.txt|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
