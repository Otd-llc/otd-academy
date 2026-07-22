"use client";

// PostHog identity stitching (audit Phase 3 / Task 3.5).
//
// Nothing in the app ever called posthog.identify(), so every client event
// (pageviews, pricing, formative checks) lived on an anonymous device person
// while every server event (signed_up, checkout_started, purchase_completed)
// lived on a different person keyed by the DB user id — the funnel could not
// stitch a single journey across the sign-in boundary and its conversion rates
// were uninterpretable. This island mounts inside the header's account slot
// (which already resolved the session — no extra request) and identifies /
// resets accordingly (see applyIdentity for the exact decision).
//
// It goes through getPosthog() — the ONE loader that owns init AND the c15t
// consent gate — rather than importing posthog-js directly. Two wins over the
// old private import + `__loaded` retry loop: (1) getPosthog() resolves the
// initialized instance itself, so there is no first-mount race to retry around;
// (2) it returns null until analytics consent is granted, so identify() can
// never fire for a visitor who declined — the retry loop had no such gate.

import { useEffect } from "react";
import { getPosthog } from "@/lib/posthog-client";
import { applyIdentity } from "@/lib/identity-sync";

export function IdentitySync({ userId }: { userId: string | null }) {
  useEffect(() => {
    let cancelled = false;
    void getPosthog().then((ph) => {
      // null → no key or consent not granted: nothing to stitch, and we must
      // not touch an instance that was never allowed to init.
      if (cancelled || !ph) return;
      applyIdentity(ph, userId, window.localStorage);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return null;
}
