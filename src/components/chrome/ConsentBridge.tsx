"use client";

// Bridges c15t's React consent state into the plain-module analytics signal
// (consent-signal.ts) that getPosthog() reads, and drives PostHog opt-in/out on
// change. Mounts once beside PostHogProvider. Renders nothing.
//
// On grant: mirror the decision so getPosthog() will init on its next call, and
// eagerly opt the already-loaded instance back in. On revoke: opt out + reset
// so a shared device stops attributing events, and clear the mirror so a cold
// load stays denied.
import { useEffect } from "react";
import { useConsentManager } from "@c15t/nextjs";
import { setAnalyticsConsent } from "@/lib/consent-signal";
import { otdSrcCookieWrite } from "@/lib/hex-attribution";
import { getPosthog, getLoadedPosthog } from "@/lib/posthog-client";

export function ConsentBridge() {
  const { consents } = useConsentManager();
  // c15t's `measurement` category IS the analytics gate (ConsentState is keyed
  // by AllConsentNames: experience | functionality | marketing | measurement |
  // necessary). PostHog is measurement.
  const granted = Boolean(consents.measurement);

  useEffect(() => {
    setAnalyticsConsent(granted);
    // The first-touch `otd_src` cookie (6.6): written from a listed `?src=` on
    // the page only while measurement is granted, deleted on revoke. Every
    // decision is in `otdSrcCookieWrite`; this line only applies it.
    try {
      const write = otdSrcCookieWrite({
        granted,
        search: window.location.search,
        documentCookie: document.cookie,
        secure: window.location.protocol === "https:",
      });
      if (write !== null) document.cookie = write;
    } catch {
      // Attribution must never break the consent bridge.
    }
    if (granted) {
      // getPosthog now passes the gate → inits (or returns the live instance).
      void getPosthog().then((ph) => ph?.opt_in_capturing());
    } else {
      // getPosthog would return null post-revoke; reach the loaded instance
      // directly (no gate, no init) to opt out + drop the person.
      void getLoadedPosthog().then((ph) => {
        if (!ph) return;
        ph.opt_out_capturing();
        ph.reset();
      });
    }
  }, [granted]);

  return null;
}
