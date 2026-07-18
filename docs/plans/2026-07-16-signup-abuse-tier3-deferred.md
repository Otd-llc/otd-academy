# Signup abuse defense — Tier 3

> **UPDATE 2026-07-18 — BUILT (commit `21b0be2`), no longer deferred.** Implemented
> exactly per the recipe below: the `checkout:user` rule + `userCheck` in
> `abuse-policy.ts`, `enforceCheckoutLimit(userId)` in `abuse-checkout.ts` (fail-open),
> wrapping all five `requireUser` actions. Kept as the record + rationale.
>
> Recorded as part of the signup-abuse-defense build (Task 10). The magic-link
> Tier-1 defense (Turnstile + rate limiter + kill switch) and the Tier-2 anonymous
> surfaces (waitlist, guest tip) shipped in that PR. Tier 3 is **deliberately
> deferred** — this note makes the remaining work actionable.

## What Tier 3 is

The **authenticated** (`requireUser`) Stripe checkout/portal actions. Deferring
them is correct: each is user-keyed (a cuid, no email/IP normalization), the
sessions are reversible (they expire), and there is no silent-success path. App
limiting them is **complementary** to Stripe's account-wide 100 req/s limit (a
flood degrades real buyers' checkout), not redundant — but it is a separate,
low-urgency PR, not part of the anonymous-abuse defense.

## The corrected inventory (verified against source)

The v2 plan's Tier-3 table was wrong twice; the confirmed set is **five**
`requireUser` actions, all of which one `checkout:user` rule (keyed on the user's
cuid) should wrap:

1. `createPassCheckoutSession` — `src/lib/actions/pass.ts` (public `/pricing`)
2. `createUpgradeCheckoutSession` — `src/lib/actions/pass.ts` (public `/pricing`)
3. `createSubscriptionCheckoutSession` — `src/lib/actions/pass.ts`
4. `createCheckoutSession` — `src/lib/actions/checkout.ts` (per-project purchase)
5. `createBillingPortalSession` — `src/lib/actions/billing.ts`

**Not here:** `createTipCheckout` (`src/lib/actions/tips.ts`) is GUEST-capable, so
it was reclassified Tier-2 and already limited per-IP (build Task 9), not deferred.

## The follow-up work

- Add a `checkout:user` rule to `RULES` in `src/lib/abuse-policy.ts` (a sensible
  per-user hourly cap, e.g. ~15/hr) + a `userCheck(userId)` helper (HMAC the cuid
  with the existing `hmacKey`).
- In each of the five actions, after `requireUser`, run
  `enforce([userCheck(user.id)], "open")` (Tier 3 is reversible → fail open) and
  throw on a deny; the callers already surface thrown errors.
- Gate on `defenseEnabled()` like the rest.

## Why not now

Scope discipline: the anonymous magic-link vector is the reputation risk the
campaign creates. The authenticated checkout actions require a logged-in account
and are individually reversible, so they carry none of the third-party-bombing or
sender-reputation harm the primary defense answers. See the design doc §2.
