// Analytics-consent signal — the c15t-agnostic bridge between the consent UI
// (a React provider/hook) and the NON-React analytics loader (getPosthog, a
// plain module that can't call a hook).
//
// c15t (offline mode) owns the source of truth in localStorage; the React
// ConsentBridge mirrors "analytics granted?" into BOTH a module flag (fast, for
// the current session) and a localStorage key (so a cold getPosthog() call on
// the next page load — before the bridge mounts — reads the last decision
// instead of defaulting to init). Default is DENIED until an explicit grant, so
// an EU visitor is never tracked pre-consent.
//
// This file is import-safe on the server (guards `window`), so getPosthog can
// import it unconditionally.
const MIRROR_KEY = "otd:analytics-consent";

let granted = false;
let hydrated = false;

/** True iff the user has consented to analytics. Reads the localStorage mirror
 *  once on the first client call so a fresh page load respects the prior
 *  decision before the React bridge remounts. */
export function analyticsConsentGranted(): boolean {
  if (!hydrated && typeof window !== "undefined") {
    try {
      granted = window.localStorage.getItem(MIRROR_KEY) === "1";
    } catch {
      /* private mode → stay denied */
    }
    hydrated = true;
  }
  return granted;
}

/** Called by the React ConsentBridge whenever c15t's analytics decision changes. */
export function setAnalyticsConsent(next: boolean): void {
  granted = next;
  hydrated = true;
  if (typeof window !== "undefined") {
    try {
      if (next) window.localStorage.setItem(MIRROR_KEY, "1");
      else window.localStorage.removeItem(MIRROR_KEY);
    } catch {
      /* best-effort */
    }
  }
}
