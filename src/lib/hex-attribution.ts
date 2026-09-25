// Where a Hex Cluster download came from (launch readiness 6.6, decision 1.14).
//
// TWO FIELDS, ONE ENUM.
//   `src`      -- the query parameter on a download URL: which surface sent the
//                 person to the file (the configurator, the /hex page, a share
//                 page), or which listing they arrived from (`?src=<platform>`,
//                 11.2 / 11.3). Per-request.
//   `otd_src`  -- a FIRST-TOUCH cookie: the listing the visitor first arrived
//                 from, written once on the academy and read back on the
//                 download. Per-visitor.
//
// A CLOSED ENUM, NOT FREE TEXT. A query parameter or cookie forwarded verbatim
// into PostHog is an attacker-chosen property value of unbounded cardinality: a
// way to write arbitrary text into the analytics store and shred every
// breakdown. So both are read through `readHexSource`, and anything outside the
// list becomes the fixed token `unknown`. Same rule as `bedFrom`
// (`readBedSource` in `hex-pack.ts`), for the same reason.
//
// CONSENT (1.14). Attribution is measurement, so it follows the c15t
// `measurement` category and nothing else:
//   - `otd_src` is WRITTEN only while measurement is granted, and deleted on
//     revoke (`ConsentBridge`).
//   - Both fields are REPORTED only when the request carries a c15t cookie that
//     grants measurement. Without it the download event (which the routes
//     already captured before 6.6) goes out with no attribution field at all.
//   - `ph_did` is never consent, and neither is a `src` in the URL.
//   - There is no `on_reject` counting: a denial is not an event.
//
// A PLAIN MODULE with no Next or React import, so the rules are testable in the
// `node` suite and shared by the client writer and the server reader.

/** Every value `src` / `otd_src` can take, in the order a funnel should list
 *  them. The first four are surfaces; the rest are the launch listings and
 *  channels of 11.2 and 11.3 (platforms on day 0, Show HN day 1, Reddit days
 *  1-2, Hackaday day 3). Adding a channel is adding a string here. */
export const HEX_SOURCES = [
  "configurator",
  "hex_page",
  "share_page",
  "direct",
  "printables",
  "thingiverse",
  "makerworld",
  "reddit",
  "hn",
  "hackaday",
] as const;

export type HexSource = (typeof HEX_SOURCES)[number] | "unknown";

/** The first-touch cookie's name. */
export const OTD_SRC_COOKIE = "otd_src";

/** How long the first touch is remembered: 90 days. */
export const OTD_SRC_MAX_AGE_S = 90 * 24 * 60 * 60;

/** The cookie c15t writes its decision into (its default `storageKey`). */
export const C15T_COOKIE = "c15t";

/**
 * Read a raw `src` into the enum, never passing the string through.
 *
 * Absent or empty is `undefined` (the caller said nothing); anything else that
 * is not EXACTLY one of `HEX_SOURCES` -- a different case, padding, markup, a
 * control character, four kilobytes -- is `"unknown"`. NOT a refusal: this field
 * changes no byte of a download, and a surface that ships a new value before
 * this list learns it must not deny anyone their files.
 */
export function readHexSource(
  raw: string | null | undefined,
): HexSource | undefined {
  if (raw == null || raw === "") return undefined;
  return (HEX_SOURCES as readonly string[]).includes(raw)
    ? (raw as HexSource)
    : "unknown";
}

/**
 * Does a raw c15t cookie value grant `measurement`?
 *
 * c15t (2.0 rc) writes `c15t=c.measurement:1,c.necessary:1,i.time:...`:
 * `consents` shortened to `c`, a granted category as `1`, a denied one OMITTED.
 * Only a literal `c.measurement:1` pair is a grant. Absent, `0`, malformed,
 * or a legacy JSON shape all read as denied. Consent fails CLOSED or it is not
 * consent -- the same reading as `measurementGranted` in `hex-embed-consent.ts`.
 */
export function measurementGrantedByCookie(
  cookieValue: string | undefined | null,
): boolean {
  if (!cookieValue) return false;
  let raw = cookieValue;
  try {
    raw = decodeURIComponent(cookieValue);
  } catch {
    // Malformed percent-encoding: read the value as written.
  }
  return raw.split(",").some((pair) => pair.trim() === "c.measurement:1");
}

type CookieJar = { get(name: string): { value: string } | undefined };

/** What a download event may say about where it came from. EMPTY without
 *  consent, so spreading it into the event adds nothing. */
export type HexAttribution = { src?: HexSource; otd_src?: HexSource };

/**
 * The attribution properties for a download event.
 *
 * Without a measurement grant this is `{}`: the event is still sent (it was
 * before 6.6) but carries no attribution. With one, `src` is the enum value of
 * the query parameter -- `unknown` when the caller named none, so the property
 * is always there to break down on -- and `otd_src` is the enum value of the
 * first-touch cookie when one is set.
 */
export function hexAttribution(
  srcParam: string | null | undefined,
  cookies: CookieJar,
): HexAttribution {
  if (!measurementGrantedByCookie(cookies.get(C15T_COOKIE)?.value)) return {};
  const out: HexAttribution = { src: readHexSource(srcParam) ?? "unknown" };
  const first = readHexSource(cookies.get(OTD_SRC_COOKIE)?.value);
  if (first !== undefined) out.otd_src = first;
  return out;
}

/** Read one cookie out of a `document.cookie` string. */
function cookieFrom(documentCookie: string, name: string): string | undefined {
  for (const part of documentCookie.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return undefined;
}

/**
 * What the browser should do to the first-touch cookie, as a `document.cookie`
 * assignment, or null for nothing.
 *
 *  - Not granted: DELETE it if it is there (a revoke takes the attribution
 *    with it), otherwise nothing. Never write.
 *  - Granted, a valid first touch already stored: nothing. First touch means
 *    the first one.
 *  - Granted, none stored, and the page URL names a listed source: write it.
 *    An unknown or hostile `src` is not stored -- `unknown` is not a touch.
 */
export function otdSrcCookieWrite(opts: {
  granted: boolean;
  search: string;
  documentCookie: string;
  secure: boolean;
}): string | null {
  const existing = cookieFrom(opts.documentCookie, OTD_SRC_COOKIE);
  if (!opts.granted) {
    return existing === undefined
      ? null
      : `${OTD_SRC_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  }
  const stored = readHexSource(existing);
  if (stored !== undefined && stored !== "unknown") return null;
  const src = readHexSource(new URLSearchParams(opts.search).get("src"));
  if (src === undefined || src === "unknown") return null;
  return (
    `${OTD_SRC_COOKIE}=${src}; Path=/; Max-Age=${OTD_SRC_MAX_AGE_S}; SameSite=Lax` +
    (opts.secure ? "; Secure" : "")
  );
}
