// What a page looks like to analytics: the URL and title with anything that
// identifies a person taken out.
//
// WHY THIS EXISTS. GA4's automatic page_view sends `page_location` and
// `page_title` verbatim, and Google's terms forbid sending anything that
// identifies a person. Two routes did exactly that (found 2026-10-09):
//
//   - /learn/<slug>/certificate/<token>: the title is "<Name> · Verified
//     Certificate…", and the token is base64url JSON whose payload IS the
//     learner's name (src/lib/certificate-token.ts). Either one alone leaks it.
//   - /verify?code=OTD-…: the code is public-lookup, so it resolves to a name.
//
// So page views are no longer automatic (ga-client.ts sends them, with
// `send_page_view: false` in the config and GA's "page changes based on browser
// history events" switched off in the stream). Every page view and every
// tracked download link goes through this file first. PostHog's $pageview takes
// the same URL, so the two tools see the same scrubbed address.
//
// The rule for anything new: if a route puts a person's name, email, a secret,
// or a lookup code in its path, query or <title>, it is handled here.

/** Query parameters that never reach analytics. Values only; the key is dropped too. */
const DROP_PARAMS = new Set([
  "code", // /verify lookup code → resolves to a name
  "token",
  "email",
  "session_id", // Stripe checkout session; purchase carries it as transaction_id
  "callbackUrl", // can carry any of the paths above
]);

/** Path patterns whose segment is a person-identifying token. */
const TOKEN_PATHS: { re: RegExp; replace: string; title?: string }[] = [
  {
    re: /^(\/learn\/[^/]+\/certificate\/)[^/]+/,
    replace: "$1[token]",
    title: "Certificate · One Thousand Drones Academy",
  },
];

export type PageContext = { location: string; title: string };

/** The analytics view of a URL (absolute or path) and its document title. */
export function sanitizePage(url: string, title: string): PageContext {
  const u = new URL(url, "https://academy.onethousanddrones.com");
  let path = u.pathname;
  let safeTitle = title;
  for (const t of TOKEN_PATHS) {
    if (t.re.test(path)) {
      path = path.replace(t.re, t.replace);
      if (t.title) safeTitle = t.title;
    }
  }
  for (const key of [...u.searchParams.keys()]) {
    if (DROP_PARAMS.has(key)) u.searchParams.delete(key);
  }
  const qs = u.searchParams.toString();
  return { location: `${u.origin}${path}${qs ? `?${qs}` : ""}`, title: safeTitle };
}

/** Just the URL half, for download links and PostHog's $current_url. */
export function sanitizeUrl(url: string): string {
  return sanitizePage(url, "").location;
}
