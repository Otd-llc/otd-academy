// Read the browser's PostHog person id, server-side.
//
// WHY THIS EXISTS. `capture()` mints `anon-<uuid>` when no distinctId is given,
// deliberately, so anonymous events do not all collapse into one shared person.
// The cost is that each such event becomes its OWN person, which is exactly
// wrong for a funnel: a download and the configurator click that followed it
// would be two strangers, and "of everyone who downloaded, how many went on to
// configure" stays unanswerable — the question Gate A exists to answer.
//
// posthog-js stores its person id in a cookie named `ph_<projectApiKey>_posthog`
// holding URL-encoded JSON. Reading it on the server and passing it as
// distinctId stitches the server event onto the same person the browser events
// belong to.
//
// This is a READ of an id the browser already set. It mints nothing, and it
// falls back to null rather than guessing, so a visitor with no PostHog cookie
// (analytics disabled, cookie blocked, first-ever request) simply keeps the
// anonymous-per-event behaviour instead of being mis-joined to someone else.
import { env } from "@/env";

/** The cookie posthog-js writes for a given project key. */
export function posthogCookieName(apiKey: string): string {
  return `ph_${apiKey}_posthog`;
}

/**
 * Extract `distinct_id` from a raw PostHog cookie VALUE.
 *
 * Tolerates the shapes seen in the wild: URL-encoded or not, and any JSON that
 * simply lacks the field. Returns null on anything it cannot read — a wrong id
 * is worse than no id, because it attributes a real action to the wrong person.
 */
export function parseDistinctId(cookieValue: string | undefined): string | null {
  if (!cookieValue) return null;
  let raw = cookieValue;
  try {
    raw = decodeURIComponent(cookieValue);
  } catch {
    // Malformed percent-encoding: fall through and try the value as-is.
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const id = (parsed as { distinct_id?: unknown }).distinct_id;
    return typeof id === "string" && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

/**
 * The visitor's PostHog person id from a request's cookies, or null.
 *
 * `cookies` is anything with a `.get(name)` returning `{ value }` — i.e. Next's
 * `cookies()` store or a `NextRequest.cookies`, without this module needing to
 * know which.
 */
export function distinctIdFromCookies(cookies: {
  get(name: string): { value: string } | undefined;
}): string | null {
  const key = env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null; // analytics disabled: nothing to join to
  return parseDistinctId(cookies.get(posthogCookieName(key))?.value);
}
