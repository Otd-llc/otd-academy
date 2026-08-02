"use client";

import { useEffect } from "react";

/**
 * Carry a build across the magic-link round trip.
 *
 * A saved build arrives in the URL FRAGMENT, which never reaches the server and
 * — unlike the 307 to /sign-in, where RFC 9110 §10.2.2 makes the UA inherit it —
 * does NOT survive an email round trip: the link opens a fresh browsing context
 * with a fresh URL.
 *
 * This runs on /sign-in, not on the save page. A Server Component redirect()
 * never sends a page body, so on an anonymous first visit no island on the save
 * page ever mounts to do the stashing. /sign-in already renders client code and
 * the fragment is still alive there, so it stashes; the save page restores after
 * the round trip.
 *
 * localStorage, not sessionStorage: MEASURED — a magic link opens a new tab,
 * and a new tab reads sessionStorage as null. Short TTL, and the save page
 * clears it on restore, because this is a build someone is part-way through
 * saving and not a thing to keep.
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

export function FragmentStash({
  callbackUrl,
}: {
  callbackUrl: string | undefined;
}) {
  useEffect(() => {
    // Only stash when the destination is actually the save page. Every other
    // sign-in has no build to carry, and writing then would leave a stale
    // envelope for the next real save to pick up.
    if (!callbackUrl) return;
    let path: string;
    let search = "";
    try {
      const url = new URL(callbackUrl, window.location.origin);
      path = url.pathname;
      search = url.search;
    } catch {
      return;
    }
    if (path !== "/account/hex-clusters/save") return;

    const envelope = window.location.hash.replace(/^#/, "");
    if (!envelope) return;

    try {
      const stash: HexStash = { envelope, search, at: Date.now() };
      window.localStorage.setItem(HEX_STASH_KEY, JSON.stringify(stash));
    } catch {
      // Private mode, quota, blocked storage. The save page tells the user
      // their build could not be carried through sign-in and to press Save
      // again — which is recoverable, unlike a silent empty form.
    }
  }, [callbackUrl]);

  return null;
}
