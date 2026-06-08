# Stripe Payments — Design (Phase 3 of the GTM roadmap)

_2026-06-08. Validated design. Phase 3 turns admin-granted entitlements into real
one-time purchases: Hosted Stripe Checkout → webhook grants a `PURCHASE`
entitlement. Built + verified entirely in **Stripe TEST mode**; the user reviews,
adds live keys, and merges/goes live._

> **Decision basis:** Hosted Stripe Checkout is the industry-standard, lowest-PCI,
> highest-conversion choice (Stripe's own default) for one-time digital unlocks.
> Clerk Billing was researched and rejected for Foundry: it's **subscriptions
> only** (no one-time) and adds a 0.7% surcharge + vendor lock-in — it's a tool
> for a *future subscription project*, not this per-project one-time model. Keep
> Auth.js (Google); link to Stripe via a Customer record.

## Decisions baked in
- **Hosted Stripe Checkout**, `mode: "payment"` (one-time, lifetime).
- **Webhook is the source of truth** for granting — never grant on the client redirect.
- **Auth stays Auth.js**; map User↔Stripe via `User.stripeCustomerId`.
- **Waitlist = fallback:** Buy button when the project has a price; the Phase 2
  `WaitlistForm` when it doesn't.
- **Price setup = admin action** (creates the Stripe Product/Price, stores the id).
- **Build/verify in TEST mode; user merges + sets live keys.**
- **Build-safety:** the Stripe client is lazily initialized and the keys are
  OPTIONAL env vars — a build/CI with no keys must still pass (lesson from the
  Phase 1 sitemap CI break). Actions throw a clear "payments not configured" if
  called without keys.

## Flow
1. Paywall (premium card ≥1, non-entitled) renders a **Buy "$X"** button when
   `project.stripePriceId` is set (else the waitlist).
2. Buy → `createCheckoutSession` server action (`requireUser` — must be signed in
   so there's a User to grant to): ensure a Stripe Customer for the user (store
   `stripeCustomerId`), create a Checkout Session (`line_items: [{ price, qty 1 }]`,
   `mode: payment`, `customer`, `success_url`, `cancel_url`, `metadata: {userId,
   projectId}`) → redirect to Stripe.
3. User pays on Stripe's hosted page → redirected to a success route.
4. **Stripe fires `checkout.session.completed` → `/api/stripe/webhook`**: verify
   signature (`STRIPE_WEBHOOK_SECRET`, raw body), idempotency-check the event id,
   then upsert `Entitlement(userId, projectId, source: PURCHASE)` from `metadata`.
   Return 200. (Reuses the Phase 2 `Entitlement` model + `[userId, projectId]`
   unique; the lesson page already unlocks once entitled.)

## Schema (migration to prod Neon)
- `User.stripeCustomerId String? @unique`
- `Project.stripePriceId String?` + `priceCents Int?` (display price; SSR-safe).
- `ProcessedStripeEvent { eventId String @id, type String, createdAt }` — webhook
  idempotency (dedupe redelivered events).
- _(Optional)_ a `Payment` audit row (userId, projectId, stripeSessionId, amount,
  status) — nice-to-have; not required for granting.

## Server pieces
- `src/lib/stripe.ts` — lazily-constructed server Stripe client (`STRIPE_SECRET_KEY`).
- `ensureStripeCustomer(user)` — create-or-reuse the Customer, persist `stripeCustomerId`.
- `createCheckoutSession({ projectId })` action — `requireUser`; refuses if the
  project isn't PREMIUM / has no `stripePriceId`; returns the session URL.
- `src/app/api/stripe/webhook/route.ts` — `POST`, raw-body signature verify,
  idempotency, grant. A pure helper `entitlementFromCheckoutSession(session)` →
  `{ userId, projectId } | null` is unit-tested.
- `setProjectPrice({ projectId, priceCents })` admin action (`requireAdmin`) —
  creates a Stripe Product + one-time Price, stores `stripePriceId`/`priceCents`.
- Env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (both **optional** in `env.ts`).

## UI
- `BuyButton` client island on the Paywall (replaces the waitlist CTA when a
  price exists) → calls `createCheckoutSession` → `window.location` to the URL.
- A success route (e.g. `/learn?purchased={slug}` or a small thank-you) after
  redirect — the entitlement is already granted by the webhook by the time they
  land (or shortly after; the page re-checks access).
- A "Set price" control on the project admin page (`setProjectPrice`).

## Testing
- Pure `entitlementFromCheckoutSession` (metadata → grant; missing metadata → null).
- `createCheckoutSession` with a **mocked** Stripe client (refuses non-PREMIUM /
  no-price; passes correct line item + metadata).
- Webhook route: signature-verify failure rejected; valid event grants once;
  redelivered event is idempotent (no double grant).
- Schema change → full tsc + full vitest.
- **Manual (TEST mode):** Stripe CLI `stripe listen --forward-to
  localhost:3000/api/stripe/webhook` + test card `4242 4242 4242 4242` →
  entitlement appears → premium cards unlock.

## What the user provides (execution prerequisite)
1. A Stripe account (free).
2. **Test** secret key (`sk_test_…`) → `STRIPE_SECRET_KEY`.
3. Webhook signing secret: local = the Stripe CLI's `whsec_…`; prod = a dashboard
   webhook endpoint at `/api/stripe/webhook` (event `checkout.session.completed`)
   → its `whsec_…`. → `STRIPE_WEBHOOK_SECRET`.
4. (Go-live, later) live keys + the prod webhook endpoint.
I create Products/Prices via the admin action — you just enter a dollar amount.

## Delivery
One cohesive PR (built + verified in test mode) for the user's review + go-live —
or split A (schema + stripe client + checkout + webhook + grant) / B (Buy UI +
price admin + success). Out of scope: subscriptions (a future project — Clerk
Billing or Stripe subscriptions then), refunds/cancellation UI, multi-currency.
