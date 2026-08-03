// Which configurator origin the /hex frame should load.
//
// NOT the same thing as `HEX_CONFIGURATOR_URL` in `hex-spec.ts`, and the two
// must not be merged. That constant is the PUBLISHED url: it is printed in the
// release README, printed on every build sheet, and pinned by a unit test, so
// it has to stay a literal that never varies by environment.
//
// This is the origin the iframe actually points at, which has to be
// overridable or configurator-side changes can only be exercised after they
// are already in production. `NEXT_PUBLIC_HEX_CONFIGURATOR_URL` lets a
// developer point the frame at `http://localhost:5180` (the Vite dev server,
// moved off 3000 for exactly this) or at a LAN address for handset testing.
import { env } from "@/env";
import { HEX_CONFIGURATOR_URL } from "@/lib/hex-spec";
import type { HexRecall } from "@/lib/hex-recall";

/** Origin only, no path, no trailing slash. The frame builds its own path. */
export function hexConfiguratorOrigin(): string {
  const override = env.NEXT_PUBLIC_HEX_CONFIGURATOR_URL;
  const raw = override && override.trim() ? override : HEX_CONFIGURATOR_URL;
  try {
    return new URL(raw).origin;
  } catch {
    // A malformed override must not take the page down; fall back to the
    // published constant, which is a literal and cannot be malformed.
    return new URL(HEX_CONFIGURATOR_URL).origin;
  }
}

/**
 * The full `src` for the embedded configurator.
 *
 * `embed=1` is what makes the app drop its own brand chrome. It is a flag the
 * PARENT sets rather than something the child infers from being framed, so a
 * standalone visitor who is somehow framed still gets a complete app.
 *
 * `ph_did` is the analytics person id AND the configurator's consent signal:
 * that app has no banner and refuses to initialise without it. It is passed
 * only when the caller already resolved one, which it can only do in the
 * browser after consent — never bake it in server-side, or a prerendered page
 * hands one visitor's id to everyone who sees it next.
 */
export function hexConfiguratorSrc(opts?: {
  distinctId?: string | null;
  /** Encoded build payload, placed in the FRAGMENT so it never reaches an
   *  access log, a Referer header, or PostHog's `$current_url`. */
  payload?: string | null;
  /** A saved build's identity, so a recalled cluster prints as CONTROLLED
   *  rather than as an anonymous copy of itself. All six fields or none: the
   *  type has no optional members, so a caller cannot drop one silently. */
  recall?: HexRecall | null;
}): string {
  const url = new URL("/hex", hexConfiguratorOrigin());
  url.searchParams.set("embed", "1");
  if (opts?.distinctId) url.searchParams.set("ph_did", opts.distinctId);

  if (opts?.recall) {
    const r = opts.recall;
    // The short keys the configurator reads in `adoptReturnLink`. It requires
    // ALL of them and rejects the recall outright if one is missing, so these
    // are written unconditionally -- including `n`, which is legitimately empty
    // for a build saved without a name and must still be PRESENT.
    url.searchParams.set("d", r.drawingLabel);
    url.searchParams.set("r", r.revLabel);
    url.searchParams.set("s", r.shareCode);
    // `h` ties the identity to the payload. Without it the configurator's check
    // is vacuous and a recalled build prints UNCONTROLLED with no error.
    url.searchParams.set("h", r.payloadHash);
    url.searchParams.set("n", r.name);
    url.searchParams.set("t", r.savedAt);
  }

  const base = url.toString();
  // Query BEFORE the fragment: everything after '#' is fragment.
  return opts?.payload ? `${base}#${opts.payload}` : base;
}
