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
  if (top === "admin") return true; // operator-only section (e.g. /admin/waitlist)
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
  // Root-level metadata image routes (the default share card at /opengraph-image,
  // and any /twitter-image). Every bare public route inherits the site-default
  // og:image, so a crawler fetches this for all of them — it must never 307 to
  // /sign-in. Nested OG routes (e.g. /courses/[slug]/opengraph-image) already
  // inherit their public prefix; only these root-level ones need naming here.
  if (top === "opengraph-image" || top === "twitter-image") return true;
  // Parts catalog list (/parts) + detail (/parts/[id]) are public; the create
  // form (/parts/new) is not.
  if (top === "parts") return segments[1] !== "new";
  // The public /courses index (+ any subpaths) is crawlable.
  if (top === "courses") return true;
  // The public /pricing page (the storefront landing) is crawlable + must render
  // signed-out (the top of the purchase funnel).
  if (top === "pricing") return true;
  // The L1.01 beta landing page — the TOP of the beta funnel. Every visitor the
  // campaign sends is anonymous by definition, so a gate here would 307 the whole
  // campaign to /sign-in. It would also fail invisibly to anyone checking the
  // page while signed in, which is everyone who built it.
  if (top === "beta") return true;
  // Post-checkout confirmation (/checkout/success?session_id=...) — the BOTTOM of
  // the funnel. Must render without a session: a buyer's cookie can be absent/
  // expired at the Stripe redirect, and bouncing them to /sign-in right after they
  // paid is the exact drop this page exists to prevent. The unguessable Stripe
  // session id in the query is the "gate"; the page reads it display-only (the
  // access grant stays webhook-sourced) and shows no PII. noindex.
  if (top === "checkout" && segments[1] === "success") return true;
  // The public briefs (marketing one-pagers): index (/briefs) + each brief
  // (/briefs/overview, /briefs/learner). Static, gate-less, crawlable. The
  // downloadable PDFs are served from /public, outside the middleware matcher.
  if (top === "briefs") return true;
  // Certificate verification is for third parties (employers) who have no
  // account — must be reachable signed-out.
  if (top === "verify") return true;
  // Guide routes are public-ELIGIBLE; the guide page enforces accessTier
  // (anonymous may read only PUBLIC projects). Key on the "guide" position so a
  // slug containing "guide" can't open the route.
  if (top === "projects") return segments[3] === "guide";
  // The shareable certificate card (page + its OG image route) must be reachable
  // by signed-out visitors AND crawlers — that's the whole point of a share link.
  // The signed token in the path is the gate (verified in the route), so this is
  // safe to expose. Everything else under /learn stays auth-gated.
  if (top === "learn" && segments[2] === "certificate") return true;
  // The public Library (mini-lessons): index (/library) + every article
  // (/library/[slug]) are crawlable, anonymous-readable SEO pages. The admin
  // authoring surface lives under /admin/library (held back by isAdminOnlyPath's
  // top==="admin" rule), so the whole /library prefix is safe to expose.
  if (top === "library") return true;
  // The public glossary index — a crawlable reference page (also the resolve
  // target for DefinedTerm.inDefinedTermSet.url).
  if (top === "glossary") return true;
  // The public EE-tools hub (/tools) + each calculator (/tools/[slug]) — static,
  // gate-less, crawlable SEO pages with no authoring surface under the prefix.
  if (top === "tools") return true;
  // The embeddable calculator widgets (/embed/[slug]) render inside other sites'
  // iframes, where there is no session — must be anonymous-readable. They are
  // noindex with canonical pointing at /tools/[slug] (the calculator ranks once);
  // the attribution link back to the full tool is the SEO point.
  if (top === "embed") return true;
  // The legal/license page is a public static page (linked from the footer); it
  // must render for signed-out visitors.
  if (top === "license") return true;
  // The privacy disclosure is a public static page, linked from /sign-in as the
  // pre-consent Turnstile disclosure (and from the footer). It MUST render
  // signed-out: the sign-in screen links it before anyone authenticates, so
  // gating it bounces the reader to /sign-in in a loop.
  if (top === "privacy") return true;
  // One-click lifecycle-email unsubscribe (/email/unsubscribe/[token]). The signed
  // token in the path is the gate (verified in the route), so it must be reachable
  // signed-out — a recipient clicking from their inbox has no session. noindex.
  if (top === "email" && segments[1] === "unsubscribe") return true;
  // Dev/CI-only diagram render surface (the diagram exporter screenshots these
  // via a headless browser with no session). The page itself 404s in production
  // unless DIAGRAM_EXPORT is set, so exposing the prefix is safe.
  if (top === "diagram-render") return true;
  // The Hex Cluster spec + attribution page (/hex). This one is not a
  // preference: every published .3mf/.stl/.step carries an immutable
  // LICENSE.txt reading `Source: https://academy.onethousanddrones.com/hex`,
  // and CC BY makes attribution the whole return on the release. A 307 to
  // /sign-in here means every attribution in the wild points at nothing.
  // The URL those files cite, plus its share card and nothing else. This was
  // exactly one segment, with a note to add any child deliberately; the card is
  // that child. It has to be named because a nested OG route inherits its
  // prefix only where the prefix itself is open, and this one was pinned to a
  // single segment. Left out, the card 307s to /sign-in and every share of the
  // attribution target previews the sign-in page, which is the failure this
  // whole rule exists to prevent, one level down.
  //
  // MATCHED AS A PREFIX, because the served path is not `opengraph-image`. Next
  // appends a build hash, so the real request is for something like
  // `/hex/opengraph-image-1qmjwd?27f4a0eba33f3bf3`, and an equality check on the
  // bare name still returned 307 against the URL the page actually emits. Read
  // the `og:image` out of the rendered head rather than assuming the file name
  // is the route. Both metadata-image names are covered so adding a
  // twitter-image later does not reopen the same hole.
  if (top === "hex") {
    return (
      segments.length === 1 ||
      (segments.length === 2 &&
        /^(opengraph|twitter)-image(-[a-z0-9]+)?$/i.test(segments[1]))
    );
  }
  // The public page for one saved hex cluster (/c/[shareCode]). It is what a
  // printed build sheet's QR points at, so it MUST render signed-out — a
  // scanned sheet that 307s to /sign-in is a dead drawing. The unguessable
  // 22-char token in the path is the gate; the page is noindex and shows the
  // cluster's name, never the owner's.
  if (top === "c") return true;
  // The save page (/account/hex-clusters/save) is public-ELIGIBLE and gates
  // itself INSIDE the page with its own redirect, carrying the search string.
  // It has to be this way round: middleware would redirect before any page JS
  // runs, and the build being saved lives in the URL FRAGMENT — which a
  // client island has to stash across the magic-link round trip. A Server
  // Component redirect() never sends a body, so no island would ever mount.
  // EXACTLY three segments: this opens one page, not a prefix. Nothing nested
  // under it exists today, and a gate that admits paths that do not exist is a
  // gate that will admit the wrong one later.
  if (
    segments.length === 3 &&
    top === "account" &&
    segments[1] === "hex-clusters" &&
    segments[2] === "save"
  ) {
    return true;
  }
  return false;
}
