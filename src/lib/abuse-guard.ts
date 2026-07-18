// The cheap Layer-0 bot signals that ride alongside Turnstile (design §9): a
// honeypot field and a minimum form-dwell. Both cost an honest user nothing and
// catch naive bots. This module is the shared CONTRACT (field names + the pure
// check) used by the client fields (AbuseFields) and the server locus
// (sendVerificationRequest), so the two can never drift.

/** Turnstile's token field. @marsidev/react-turnstile names its hidden input this. */
export const TURNSTILE_FIELD = "cf-turnstile-response";

/** Honeypot: a hidden field a human never fills. A naive bot fills every field. */
export const HONEYPOT_FIELD = "hp_url";

/** Dwell: elapsed ms from FIRST interaction to submit. Empty = no interaction. */
export const DWELL_FIELD = "dwell_ms";

/**
 * Minimum plausible dwell. A human takes well over this to focus and type an
 * email; a bot submits instantly. Empty dwell (a pre-filled fast path with no
 * interaction — C1 welcome-back, B1 resend, a reopened modal) is EXEMPT (design
 * N3): we only reject a dwell that is present AND implausibly short.
 */
export const DWELL_MIN_MS = 800;

/**
 * True when the honeypot/dwell signals indicate a bot. PURE. A secondary signal
 * to Turnstile: bypassable (a bot can omit the fields), so it only ever ADDS a
 * denial, never gates a real send by itself.
 */
export function isBotSubmission(body: Record<string, unknown>): boolean {
  const hp = body[HONEYPOT_FIELD];
  if (typeof hp === "string" && hp.trim() !== "") return true;

  const dwellRaw = body[DWELL_FIELD];
  if (typeof dwellRaw === "string" && dwellRaw !== "") {
    const dwell = Number(dwellRaw);
    if (Number.isFinite(dwell) && dwell >= 0 && dwell < DWELL_MIN_MS) return true;
  }
  return false;
}
