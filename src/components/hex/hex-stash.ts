/**
 * Carrying a mid-save build across sign-in.
 *
 * A build arrives in the URL FRAGMENT, which never reaches the server. Two
 * things can separate the fragment from the save page, and they need different
 * answers:
 *
 *  - The REDIRECT to /sign-in. This app does not send a 307 here: the route has
 *    a cached shell, so the response is 200 with a body and the Server
 *    Component's redirect() is executed by the client router. A scripted
 *    navigation inherits nothing — MEASURED: the save page's document loads
 *    with a 956-character fragment and /sign-in's location.hash is empty. RFC
 *    9110 §10.2.2 fragment inheritance applies to a Location header, and there
 *    is no Location header in that hop.
 *  - The MAGIC LINK. It opens a fresh browsing context with a fresh URL, so
 *    even a surviving fragment would be gone.
 *
 * So the stash is written on the SAVE PAGE, by the gate that does the
 * redirecting, before it navigates. localStorage rather than sessionStorage
 * because a magic link opens a new tab, where sessionStorage reads null.
 *
 * Short TTL, and the save page clears it on restore: this is a build someone is
 * part-way through saving, not a thing to keep.
 *
 * A plain module, not an export off the client component, so the shape can be
 * imported by anything without dragging a component with it.
 */

export const HEX_STASH_KEY = "otd-hex-pending-save";

/** Long enough to find the email and click it; short enough that a build does
 *  not linger in storage after someone abandons the flow. */
export const HEX_STASH_TTL_MS = 30 * 60 * 1000;

export interface HexStash {
  /** The base64url envelope from the fragment, with no leading '#'. */
  envelope: string;
  /** The save page's own query (mode, share) — since the user's mode choice
   *  lives only there, losing it turns a revision save into a modeless one. */
  search: string;
  at: number;
}
