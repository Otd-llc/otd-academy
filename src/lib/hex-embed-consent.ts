// The academy's half of the embed consent handshake (owner decision 1.14).
//
// The configurator, when embedded, shows no banner of its own: the academy
// already asked, with the c15t banner, and a second one inside a frame would be
// asking the same visitor the same question twice. So the academy TELLS the
// child what the visitor decided -- on `ready`, and with `set-consent` whenever
// the decision changes while the frame is alive.
//
// A PLAIN MODULE, not part of the component, so the two rules that matter can be
// tested without a DOM (this suite runs in `node`):
//   1. Only an explicit c15t `measurement: true` is a grant. Denied, not yet
//      decided, a missing category and any non-boolean all read as `false`.
//      Consent fails CLOSED or it is not consent.
//   2. A change is relayed only once the child has been told something, and only
//      when it differs from what it was told. Before the handshake there is no one
//      to tell -- `ready` carries the value read at send time, so nothing is lost.
//
// NOT consent, and never read as consent: `ph_did`. The distinct id the frame
// hands the configurator is an IDENTITY for joining the two properties' funnels.
// Nothing here looks at it.

/** Is c15t's `measurement` category granted? Only a literal `true` counts. */
export function measurementGranted(consents: unknown): boolean {
  if (typeof consents !== "object" || consents === null) return false;
  return (consents as Record<string, unknown>).measurement === true;
}

/** What the child has been told so far. `null` = no handshake yet. */
export type ConsentTold = { told: boolean | null };

export function createConsentTold(): ConsentTold {
  return { told: null };
}

/**
 * The consent field for a `ready` envelope, and a record that the child has now
 * been told it.
 *
 * ALWAYS PRESENT, always a boolean. The protocol reads an absent field as "not
 * granted", so omitting `false` would be equivalent on the wire -- but an
 * explicit `false` says the parent knows the answer, which is the truth.
 */
export function readyConsent(
  state: ConsentTold,
  granted: boolean,
): { analyticsConsent: boolean } {
  const analyticsConsent = granted === true;
  state.told = analyticsConsent;
  return { analyticsConsent };
}

/**
 * The `set-consent` body to post for a change, or null when there is nothing to
 * say: no handshake yet (the next `ready` carries it), or the child already
 * holds this value.
 */
export function consentChange(
  state: ConsentTold,
  granted: boolean,
): { type: "set-consent"; analyticsConsent: boolean } | null {
  const analyticsConsent = granted === true;
  if (state.told === null || state.told === analyticsConsent) return null;
  state.told = analyticsConsent;
  return { type: "set-consent", analyticsConsent };
}
