// Pure tip-amount config + validation for the one-time "Support the Academy"
// tip. Shared by the UI (presets) and the server action (which re-validates the
// client-supplied amount before creating the Stripe session). No Stripe, no db —
// import-safe and unit-tested.
export const TIP_MIN_CENTS = 100; // $1
export const TIP_MAX_CENTS = 50_000; // $500
export const TIP_PRESETS_CENTS = [300, 500, 1000] as const; // $3 / $5 / $10

/**
 * Validate a tip amount in cents: a whole number within [TIP_MIN, TIP_MAX].
 * Throws a learner-facing message on any violation. The webhook — not this —
 * is the source of truth for the recorded amount; this only gates the session.
 */
export function parseTipAmountCents(input: unknown): number {
  const n = typeof input === "number" ? input : Number(input);
  if (!Number.isInteger(n)) {
    throw new Error("Enter a whole-dollar (or cent) amount.");
  }
  if (n < TIP_MIN_CENTS) throw new Error("The minimum tip is $1.");
  if (n > TIP_MAX_CENTS) throw new Error("The maximum tip is $500.");
  return n;
}
