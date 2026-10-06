// The one-hop hand-off that lets GA4 count a sign-up.
//
// The authoritative sign-up signal is server-side: Auth.js's `createUser` event
// (src/auth.ts), which already feeds PostHog. GA4 has no server path here (the
// Measurement Protocol needs the browser's `_ga` client id, which the auth
// callback does not have), so the event stamps this short-lived cookie and the
// browser reports `sign_up` on the next page (consumeSignupFlag, called from
// ConsentBridge once GA is live).
//
// It carries no identity, just "1", and it is only ever set for a browser whose
// request carries the `otd-measure` grant mirror (src/lib/consent-signal.ts).
// It is a measurement cookie, so a visitor who has not said yes never gets one.
// The hour is slack for the redirect chain, not a consent window.
export const SIGNUP_FLAG_COOKIE = "otd-signup";
export const SIGNUP_FLAG_MAX_AGE = 60 * 60;
