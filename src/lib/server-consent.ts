// The visitor's c15t analytics consent, read on the SERVER.
//
// WHY THIS EXISTS. The browser side has always been gated: `getPosthog()` refuses
// to load until c15t's `measurement` category is granted. The server side
// (`@/lib/analytics`, posthog-node) was not: it sent account-linked events keyed
// to the user id whatever the visitor chose in the banner. Decision 1.14 says
// nothing is counted without consent, so the server needs the same answer the
// browser has. This module is that answer, and `@/lib/analytics` is its only
// caller.
//
// WHERE c15t KEEPS IT (c15t 2.2.1, offline mode, read from its dist, not from
// memory). `saveConsentToStorage` writes BOTH localStorage and a first-party
// cookie under the same key, default `"c15t"` (we set no `storageKey`), path `/`,
// SameSite=Lax, 365 days. The cookie value is NOT JSON: c15t flattens the
// object, shortens the keys (`consents` -> `c`, `consentInfo` -> `i`, ...) and
// joins `key:value` pairs with commas, e.g.
//
//   c.necessary:1,c.measurement:1,i.time:1759000000000,i.type:all
//
// A boolean is written ONLY when true, as `1`: a refused category is simply
// absent (`flattenObject` skips false). On load c15t re-syncs the cookie from
// localStorage if one is missing, so the two agree.
//
// THE RULE. Only a literal `c.measurement:1` counts as consent. A missing
// cookie, an unreadable one, a `0`, a JSON-shaped value, a request with no
// cookie store at all (cron, a webhook, a script, a test) — every one of them
// is NO consent. A consent read must fail closed.
import { cookies } from "next/headers";

/** c15t's default storage key, which is also its cookie name. */
export const C15T_COOKIE = "c15t";

/** The flattened, shortened key c15t writes for `consents.measurement`. */
const MEASUREMENT_KEY = "c.measurement";

/**
 * True iff a raw c15t cookie VALUE records `measurement` as granted.
 * Pure, so it is tested without a request.
 */
export function measurementGranted(cookieValue: string | undefined): boolean {
  if (!cookieValue) return false;
  let raw = cookieValue;
  try {
    raw = decodeURIComponent(cookieValue);
  } catch {
    // Malformed percent-encoding: read it as-is.
  }
  for (const pair of raw.split(",")) {
    const i = pair.indexOf(":");
    if (i === -1) continue;
    if (pair.slice(0, i).trim() === MEASUREMENT_KEY) {
      return pair.slice(i + 1).trim() === "1";
    }
  }
  return false;
}

/**
 * The current request's analytics consent. False outside a request (no cookie
 * store), on any error, and on anything but an explicit grant. Never throws.
 */
export async function serverAnalyticsConsent(): Promise<boolean> {
  try {
    const store = await cookies();
    return measurementGranted(store.get(C15T_COOKIE)?.value);
  } catch {
    // No request context (cron body after the response, a script, a test) or
    // a prerender that refuses dynamic data: no consent.
    return false;
  }
}
