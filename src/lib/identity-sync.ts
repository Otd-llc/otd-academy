// The pure identify/reset decision behind the IdentitySync island (audit Phase
// 3 / Task 3.5). Split out of the "use client" component so the branching logic
// is node-testable — the island just awaits getPosthog() (which owns init AND
// the consent gate) and delegates here.
//
// Consent is enforced upstream: the island only calls this with a non-null,
// consent-cleared instance (getPosthog returns null pre-consent), so identify()
// never fires for a visitor who declined analytics.
import type { PostHog } from "posthog-js";

const MARKER = "otd:ph-identified";

// Only the three methods we touch — keeps the fake in the test trivial and the
// contract explicit. `Storage` narrowed to the three calls the effect makes.
type PhIdentity = Pick<PostHog, "get_distinct_id" | "identify" | "reset">;
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * Stitch the PostHog person to the current user:
 *   - signed in  → identify(userId) (only if the person actually changed, so we
 *     don't churn aliases) and record that we identified.
 *   - signed out AFTER a prior identify → reset() so a shared device stops
 *     attributing events to the signed-out user, and clear the marker.
 * The "was identified" marker is instance state, not per-user data, so it is
 * deliberately NOT userId-scoped (cf. localstorage-user-scope).
 */
export function applyIdentity(
  ph: PhIdentity,
  userId: string | null,
  store: Store,
): void {
  try {
    if (userId) {
      if (ph.get_distinct_id() !== userId) ph.identify(userId);
      store.setItem(MARKER, "1");
    } else if (store.getItem(MARKER)) {
      ph.reset();
      store.removeItem(MARKER);
    }
  } catch {
    /* telemetry must never break the UI */
  }
}
