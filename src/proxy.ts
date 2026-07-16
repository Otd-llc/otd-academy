import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { legacySlugRedirect } from "@/lib/legacy-slug-redirect";
import { resolveRouteGate } from "@/lib/route-gate";

// Auth.js v5's bare `auth` export only attaches `req.auth` to the request — it
// does not redirect unauthenticated users on its own. Wrap it so unauth requests
// land on `/sign-in`. The matcher excludes Auth.js callback routes, the Stripe
// webhook (`/api/stripe/webhook` — a server-to-server POST from Stripe that
// carries NO session cookie; it MUST reach the route to verify the signature,
// never be redirected to /sign-in), the desktop-capture routes (`/api/capture`
// + `/api/capture/status` — the OTD Capture app POSTs/polls with NO session
// cookie; they're gated by a short-lived signed token in the route itself, so
// they MUST reach the route, never be 307'd to /sign-in), the public asset
// proxies (`/api/avatar/*`, `/api/part-model/*` — cache-friendly R2 streamers that
// must load for signed-out visitors on public lessons), the Vercel cron route
// (`/api/cron/*` — invoked by Vercel's scheduler with an `Authorization: Bearer
// $CRON_SECRET` header and NO session cookie; it has its own CRON_SECRET guard,
// so it MUST reach the route, never be 307'd to /sign-in), the sign-in page
// itself, the SEO crawl files
// (`sitemap.xml` / `robots.txt` — must be reachable by signed-out crawlers, never
// redirected), Next's static assets, AND any path with a file extension
// (`.*\\..*`) — public/ files (the guide-diagram SVGs, the brand icon, etc.)
// are served outside `_next`, so without this they'd be 307-redirected to
// /sign-in for signed-out visitors and silently fail to load.
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

  // The auth + role gate (pure, unit-tested — see @/lib/route-gate). Anonymous
  // requests on non-public routes go to /sign-in; an explicit LEARNER on an
  // admin-only view goes to /learn. Public surfaces (the parts catalog, the
  // public /courses index, guide pages) pass through for signed-out visitors —
  // deliberate, for SEO.
  //
  // Gating on `req.auth?.user` (inside resolveRouteGate), NOT on `req.auth`, is
  // load-bearing: Auth.js assigns a truthy ERROR OBJECT to `req.auth` when its
  // config is rejected, and `!req.auth` would let that through — a fail-OPEN. The
  // guard treats any shape without a `.user` as signed-out. Both redirects keep
  // the default 307 (the legacy 308 above is a separate concern).
  const gate = resolveRouteGate(req.auth, pathname);
  if (gate) {
    return NextResponse.redirect(new URL(gate, req.nextUrl.origin));
  }

  // No `x-pathname` forwarding: which routes wear the chrome is structural now
  // (the `(chrome)` route group), not something the layout sniffs from a header
  // at request time. That sniff was what forced the header behind a <Suspense>
  // boundary — a prerendered shell cannot read a request header, so it could not
  // know whether chrome applied to the route.
  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api/auth|api/avatar|api/part-model|api/stripe/webhook|api/capture|api/cron|sign-in|sitemap.xml|robots.txt|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
