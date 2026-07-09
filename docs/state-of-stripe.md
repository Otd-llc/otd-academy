# State of Stripe

The single source of truth for the OTD Academy billing system: what exists, how it
works, what's live, and what's next. Keep this current — update it in the same PR
whenever you change a webhook branch, a table, a checkout action, or an activation
step.

- **Last reconciled:** 2026-07-09 (phase 3 built on `feat/stripe-phase-3`)
- **Design doc (validated, detailed rationale):** `docs/plans/2026-07-07-billing-audit-schema.md`
- **Phase 3 design + plan:** `docs/plans/2026-07-09-stripe-phase-3-ops-layer-design.md`,
  `docs/plans/2026-07-09-stripe-phase-3-implementation.md`
- **Stripe API version (pinned):** `2026-05-27.dahlia` (postdates "basil")

---

## TL;DR — where we are

The **recording + access + lifecycle layer is complete and on PROD.** Every dollar
(one-time, subscription, refund, chargeback, promo) is captured, and access is
granted/revoked correctly. The **human + ops layer (phase 3) is now BUILT** on
`feat/stripe-phase-3` (portal, dunning, admin views, reporting, subscribe test
harness) — pending Josh's review + merge, plus two manual **activation** steps.

**Key framing (2026-07-09):** the recurring **subscription is NOT for courses / the
Pass.** It is for a *future* academy-system program (learners tracking their own
custom projects). So there is deliberately **no public subscribe button** and the
`/pricing` "pay once, no subscription" positioning is untouched; phase 3 finishes the
billing *machinery* so it is ready when that program ships.

| Layer | Status |
| --- | --- |
| Schema / data model | ✅ on PROD (phase 3 adds NO schema) |
| Webhook recording + access logic | ✅ merged (deploys from `main`) |
| Checkout actions (course / Pass / upgrade / subscription) | ✅ built |
| Price provisioning (course + Pass) | ✅ live |
| Subscription price provisioning | 🔜 script ready, not run (test mode for harness) |
| Course/Pass **buyable** (content published) | ⬜ blocked on content |
| Customer portal | ✅ built (needs 1-time Stripe Portal dashboard config) |
| Dunning (email + banner) | ✅ built |
| Admin billing views + revenue reporting | ✅ built (`/admin/billing`) |
| Public subscribe UI | ⛔ intentionally none (sub = future program, not courses) |

---

## Principles (load-bearing — do not violate)

1. **Our DB is the single source of truth.** App code never reads Stripe to make an
   access decision. The one read-only exception is the `/checkout/success` page,
   which retrieves the session to *display* a receipt (never to grant).
2. **The signature-verified webhook is the ONLY writer** of Stripe-originated rows.
   The one non-webhook writer is `pass.ts`, which writes a `$0` Purchase for the
   zero-charge upgrade grant (no Stripe object exists for it).
3. **Idempotency is double-layered:** (a) `ProcessedStripeEvent.create({ eventId })`
   — the event id is the `@id`, so a redelivery hits P2002; (b) unique-keyed
   `upsert`s. The claim + all writes for an event run in **one `db.$transaction`**,
   so a crash can't half-process an event (Stripe retries the whole thing). The
   P2002 catch is OUTSIDE the txn; `capture()` telemetry fires AFTER commit.
4. **Amounts always come from Stripe, never the client.** `null`-guarded.
5. **Neon WebSocket Pool required.** `db.ts` uses `PrismaNeon` (WebSocket Pool),
   which supports interactive `$transaction(async tx => …)`. **Do NOT switch to the
   HTTP `neon()` driver** — it silently removes atomicity.
6. **Basil+ field moves** (API `2026-05-27.dahlia`): subscription
   `current_period_end` lives on `items.data[i]` (take the max); the invoice's
   subscription id lives at `invoice.parent.subscription_details.subscription`.
7. **Card-only.** Async payment methods deliver `checkout.session.completed` as
   `unpaid` and settle later via `async_payment_succeeded` (unhandled). Known
   limitation.

---

## What we have (built + shipped)

Shipped to `main` across #266, #268, #269, #270 (deploys to prod on the next Vercel
build from `main`).

### Data model (all tables on PROD)

| Table | Purpose | Key facts |
| --- | --- | --- |
| `ProcessedStripeEvent` | Idempotency ledger | `eventId` `@id`; one row per handled event |
| `Entitlement` | **Access** | `userId` + (`projectId` XOR `bundleId`); `source` = `GRANT` \| `PURCHASE` \| `SUBSCRIPTION`; uniques on `(userId,projectId)` and `(userId,bundleId)` |
| `Purchase` | One-time payment audit | session/paymentIntent/charge/customer/price/product ids, amount, discount, `refundedCents`, promo, metadata; `userId` SetNull |
| `Subscription` | Stripe sub mirror | `status` verbatim, `currentPeriodEnd`, `cancelAtPeriodEnd`; `userId` SetNull |
| `Invoice` | Paid subscription invoices | write-once; `invoice.paid` / `payment_succeeded` only |
| `Refund` | Itemized refund ledger | one row per Stripe Refund; correlated by `payment_intent` |
| `Dispute` | Chargeback lifecycle | one row per Stripe Dispute; **record-only** |
| `Tip` | Support tips | not a purchase; grants nothing |
| `Bundle` | All-Access | one-time Pass price (+ launch window) **and** recurring `subscriptionPriceId` |

Audit rows (`Purchase`/`Subscription`/`Invoice`/`Tip`) survive a hard user delete
(`userId → NULL`) as a lawful financial-record retention; their `metadata` holds
only our own ids (`userId`/`projectId`/`kind`), never customer PII.

### Webhook event coverage (`src/app/api/stripe/webhook/route.ts`)

Every event enabled on the live endpoint is handled.

| Event(s) | Behavior |
| --- | --- |
| `checkout.session.completed` | Grant Entitlement + write `Purchase` (course/Pass), or `Tip`. Accepts `paid` and `no_payment_required` (100%-off promo). |
| `charge.refunded` | `Refund` rows (from the charge list) + `Purchase.refundedCents` SET to cumulative + **full-refund revoke** of the entitlement; refunded tip no-ops. |
| `refund.created` | Guaranteed itemized `Refund` row (charge list may be unexpanded). Ledger only. |
| `invoice.paid`, `invoice.payment_succeeded` | Write-once `Invoice` (resolve/backfill the subscription FK). |
| `invoice.payment_failed`, `payment_action_required`, `payment_attempt_required` | **Log-only** (access follows `Subscription.status`; dunning email is phase 3). |
| `customer.subscription.*` (created/updated/deleted/paused/resumed/pending_update_applied/expired/trial_will_end) | Upsert the mirror + **mint/revoke** the all-access Entitlement (source `SUBSCRIPTION`) by status. Status-driven, one branch. |
| `charge.dispute.*` (created/updated/closed/funds_withdrawn/funds_reinstated) | Upsert `Dispute` (lifecycle status), correlated to the Purchase. **Record-only.** |

### Checkout actions

| Action | File | Mode |
| --- | --- | --- |
| `createCheckoutSession` (course) | `lib/actions/checkout.ts` | payment |
| `createPassCheckoutSession` (Pass) | `lib/actions/pass.ts` | payment |
| `createUpgradeCheckoutSession` (pay-the-difference; $0-grants if covered) | `lib/actions/pass.ts` | payment |
| `createSubscriptionCheckoutSession` | `lib/actions/pass.ts` | subscription |

All set `allow_promotion_codes` and `success_url → /checkout/success?session_id=…`.

### Other surfaces

- **`/checkout/success`** — public post-checkout confirmation page (course / Pass /
  subscription), reads the session for a display-only receipt.
- **`deleteStudent`** cancels active Stripe subscriptions BEFORE the row delete
  (throws on failure, so a charging sub is never orphaned).
- **Provisioning scripts** (run manually, mode-verified): `set-prices.ts` (16
  courses), `set-pass-price.ts` (Pass + launch), `set-subscription-price.ts`
  (recurring).

### Key decisions (the "why")

- **Grandfathering:** upgrade credit = sum of `Purchase.amountTotalCents` (net
  `refundedCents`), frozen at purchase time — never the current catalog price.
- **Subscription access:** a sub grants the SAME all-access bundle as the one-time
  Pass; the `source` column (`SUBSCRIPTION` vs `PURCHASE`) distinguishes them, and a
  sub cancel's `deleteMany` is scoped to `source: SUBSCRIPTION`, so a purchased Pass
  is never wiped. Keeps `hasProjectEntitlement` a single indexed lookup.
- **Refund → access:** full refund revokes the entitlement; partial keeps it.
- **Dispute → access:** record-only, **no auto-revoke** (education chargebacks are
  often won; pull-then-restore is worse than an admin decision). Auto-revoke is a
  one-line add in the webhook if the policy changes.

---

## Activation state — what it takes to actually sell

| Product | Prices | Endpoint | Blocker |
| --- | --- | --- | --- |
| Courses (16 premium) | ✅ live | ✅ | **Publish content** (buy buttons render only on a published project) |
| All-Access Pass | ✅ live ($399 / $299 launch to 2027-01-01) | ✅ | **Publish content** to deliver |
| Subscription | ⬜ not provisioned | ✅ | Gated on the **future academy-projects program** (not courses). Machinery is built + testable (admin harness). No public subscribe UI by design. |

- **Live webhook endpoint:** configured with every event this doc lists.
- **Vercel prod env:** live `STRIPE_SECRET_KEY` + endpoint `STRIPE_WEBHOOK_SECRET`.
- **Live-verified:** a real $1 test charge granted + wrote a Purchase end-to-end
  (2026-07-08), then cleaned up.

---

## Roadmap — phase 3 (the human + ops layer)

Phases 1–2 recorded every dollar and act on access. Phase 3 makes it a *product* people
can see and manage. **BUILT on `feat/stripe-phase-3` (2026-07-09)** — pending review + merge.

**Subscriber-facing:**
- ✅ **Customer billing portal** — Stripe Customer Portal (`createBillingPortalSession`
  in `lib/actions/billing.ts`) + a "Manage billing" button on `/account` (shown only
  when the user has a `stripeCustomerId`). Needs a **one-time Stripe Dashboard → Customer
  Portal config** (see runbook) before it opens.
- ⛔ **Public subscribe UI — intentionally none.** The subscription is for a FUTURE
  academy-projects program, not courses; the action (`createSubscriptionCheckoutSession`)
  is verified via an admin-only test harness on `/admin/billing`. The future program
  wires its own CTA.
- ✅ **Dunning** — house-voice email on `invoice.payment_failed` (webhook post-commit,
  claim-guarded so one email per real attempt, redelivery-safe, never throws) + a
  non-dismissible past-due banner on `/account` + the learner home. `payment_action_required`
  / `payment_attempt_required` stay log-only (SCA is a different message).

**Admin / ops:**
- ✅ **Per-learner billing view** — subscriptions / invoices / purchases / refunds /
  disputes on `/admin/students/[id]` (read-only).
- ✅ **Revenue reporting** — `/admin/billing`: MRR (assumes monthly), gross revenue,
  active subs, refund rate, dispute rate + a recent-activity feed. Math in the pure,
  unit-tested `lib/billing-metrics.ts`.

**Compliance / polish (if selling broadly) — still open:**
- ⬜ **Tax** — Stripe Tax / VAT (checkouts don't collect tax today).
- ⬜ **Email receipts** — Stripe-sent or our own.
- ⬜ **Promo-code tracking** — `allow_promotion_codes` is on, but
  `stripePromotionCodeId` isn't populated + there's no usage reporting.
- ⬜ **Revenue time-series charts** — tiles + feed only for now (YAGNI until volume).

---

## Runbook / gotchas

- **`.env.local` `DATABASE_URL` is PROD.** Scripts + `pnpm db:migrate` mutate the
  production Neon DB.
- **Migrations are hand-authored + additive.** Apply with `pnpm db:migrate`
  (`prisma migrate deploy`, never `migrate dev`) — it also refreshes the test pool.
- **Live provisioning:** the scripts read `STRIPE_SECRET_KEY` via `getStripe()`.
  Swap `.env.local` to your `sk_live_…` FIRST, run the script, then **reset to
  `sk_test_…`** (a live key in local dev = accidental real charges). The Stripe
  **CLI's** live key is a restricted `rk_live_…` that CANNOT create
  checkout/webhook objects — the scripts use the full `sk_live` instead.
- **Test pool:** `pnpm test` leases per-file Neon branches; a vitest guardrail
  fast-fails if the pool is behind a migration. `pnpm test:pool:refresh` catches it
  up (and `pnpm db:migrate` does it for you).
- **Deploys:** prod builds from `main`. Merging a webhook change deploys it; the
  migration is applied separately via `pnpm db:migrate`.
- **Customer Portal config (phase 3, one-time):** the portal button fails until the
  Stripe **Dashboard → Settings → Billing → Customer portal** is enabled/configured
  (allow: update payment method, view invoices, cancel subscription). Do it once per
  Stripe mode (test + live). The action surfaces the "No configuration" error inline
  until then.
- **Subscribe harness E2E (test mode):** provision the recurring price in TEST mode
  (`SUBSCRIPTION_PRICE_CENTS=... tsx scripts/set-subscription-price.ts` with a
  `sk_test_…` key), then use the **Start test subscription** button on `/admin/billing`.
  Force a failed renewal with a Stripe **test clock** + a failing test card to exercise
  the dunning email + banner; cancel via the portal to confirm the revoke. No real money.
- **MRR assumes a MONTHLY interval.** `Bundle.subscriptionPriceCents` stores the amount
  but not the interval; `set-subscription-price.ts` defaults to `month`. If ever
  provisioned as `year`, normalize before it feeds `/admin/billing` (see
  `lib/billing-metrics.ts`).

---

## Change log

| Date | PR | Change |
| --- | --- | --- |
| 2026-07-08 | #266 | Day-1: `Purchase` table + transactional webhook grant + grandfathering fix + 2 pre-existing bug fixes |
| 2026-07-08 | #268 | `/checkout/success` confirmation page |
| 2026-07-08 | #269 | Removed the dead `?purchased` learner-home banner |
| 2026-07-08 | #270 | Phase-2: Subscription/Invoice/Refund/Dispute + full webhook event coverage + subscription checkout + `deleteStudent` sub-cancel + promo widening + `set-subscription-price.ts` |
| 2026-07-09 | (this PR) | Phase-3 human/ops layer: customer portal + dunning (email + banner) + per-learner admin billing view + `/admin/billing` revenue reporting + subscribe test harness. No schema change. |
