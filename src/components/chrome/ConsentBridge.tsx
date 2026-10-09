"use client";

// Bridges c15t's React consent state into the plain-module analytics signal
// (consent-signal.ts) that getPosthog() and loadGa() read, and drives PostHog
// opt-in/out and GA4 boot/revoke on change. Mounts once beside PostHogProvider.
// Renders nothing.
//
// On grant: mirror the decision so getPosthog() will init on its next call, and
// eagerly opt the already-loaded instance back in; boot GA4, then report a
// pending sign-up if the auth flow left one. On revoke: opt out + reset
// so a shared device stops attributing events, and clear the mirror so a cold
// load stays denied.
import { useEffect } from "react";
import { useConsentManager } from "@c15t/nextjs";
import { setAnalyticsConsent } from "@/lib/consent-signal";
import { getPosthog, getLoadedPosthog } from "@/lib/posthog-client";
import { loadGa, revokeGa } from "@/lib/ga-client";
import { consumeLoginFlag, consumeSignupFlag } from "@/lib/analytics-client";

export function ConsentBridge() {
  const { consents, consentInfo } = useConsentManager();
  // c15t's `measurement` category IS the analytics gate (ConsentState is keyed
  // by AllConsentNames: experience | functionality | marketing | measurement |
  // necessary). PostHog and GA4 are both measurement.
  const granted = Boolean(consents.measurement);
  // An explicit decision, as opposed to a banner still waiting. Only a decided
  // "no" deletes GA's cookies: they live on the parent domain, and an undecided
  // visitor here never loaded GA, so there is nothing of ours to remove.
  const decided = consentInfo != null;

  useEffect(() => {
    setAnalyticsConsent(granted);
    if (granted) {
      // getPosthog now passes the gate → inits (or returns the live instance).
      void getPosthog().then((ph) => ph?.opt_in_capturing());
      if (loadGa()) {
        consumeSignupFlag();
        consumeLoginFlag();
      }
    } else {
      // getPosthog would return null post-revoke; reach the loaded instance
      // directly (no gate, no init) to opt out + drop the person.
      void getLoadedPosthog().then((ph) => {
        if (!ph) return;
        ph.opt_out_capturing();
        ph.reset();
      });
      if (decided) revokeGa();
    }
  }, [granted, decided]);

  return null;
}
