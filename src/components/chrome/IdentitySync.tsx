"use client";

// PostHog identity stitching (audit Phase 3 / Task 3.5).
//
// Nothing in the app ever called posthog.identify(), so every client event
// (pageviews, pricing, formative checks) lived on an anonymous device person
// while every server event (signed_up, checkout_started, purchase_completed)
// lived on a different person keyed by the DB user id — the funnel could not
// stitch a single journey across the sign-in boundary and its conversion rates
// were uninterpretable. This island mounts inside the header's account slot
// (which already resolved the session — no extra request) and:
//   - signed in  → identify(userId): merges the pre-signup anonymous history
//     onto the user person (PostHog aliases the device id on first identify).
//   - signed out AFTER a previous identify → reset(): drops the id so a shared
//     device doesn't keep attributing events to the signed-out user.
//
// The "was identified" marker lives in localStorage rather than poking
// posthog-js internals; it is instance state, not per-user data, so it is
// deliberately NOT userId-scoped (cf. localstorage-user-scope — this is the
// same class as the theme/device flags).
//
// posthog-js loads lazily; init may land after this effect (the provider owns
// it), so a short bounded retry covers the first-mount race instead of losing
// the identify until the next navigation.

import { useEffect } from "react";

const MARKER = "otd:ph-identified";

export function IdentitySync({ userId }: { userId: string | null }) {
  useEffect(() => {
    let cancelled = false;
    let tries = 0;

    const attempt = () => {
      if (cancelled) return;
      void import("posthog-js").then(({ default: ph }) => {
        if (cancelled) return;
        if (!ph.__loaded) {
          // Provider hasn't initialized yet (or analytics is disabled). Retry
          // briefly; if the key is unset this simply gives up after ~5s.
          if (tries++ < 5) setTimeout(attempt, 1000);
          return;
        }
        try {
          if (userId) {
            if (ph.get_distinct_id() !== userId) ph.identify(userId);
            window.localStorage.setItem(MARKER, "1");
          } else if (window.localStorage.getItem(MARKER)) {
            ph.reset();
            window.localStorage.removeItem(MARKER);
          }
        } catch {
          /* telemetry must never break the UI */
        }
      });
    };
    attempt();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return null;
}
