# Billing audit schema — Purchase / Subscription / Invoice (design)

Status: DESIGN — no migration applied. Responds to senior-dev review of the
Stripe integration (2026-07-07), under the assumption that subscriptions ship
eventually (platform access, custom lessons).

## Findings this fixes (from the audit)

1. A purchased `Entitlement` stores `source: "PURCHASE"` + timestamp and
   nothing else — no session ID, payment-intent ID, or amount. Entitlements
   cannot be traced to a Stripe payment from our DB.
2. Pay-the-difference upgrade credit reads the **current** `Project.priceCents`
   (`src/lib/actions/pass.ts`), not the price actually paid. A catalog price
   change retroactively changes every past buyer's Pass credit. Nothing records
   what a learner actually paid (tips excepted).
3. Product IDs are never stored; session metadata is read on the webhook and
   discarded; no coupon/discount fields exist; no subscription or invoice
   tables exist.

## Principles (per the review)

- **Our DB is the single source of truth.** App code never reads Stripe at
  request time. The webhook (signature-verified) is the ONLY writer for
  Stripe-originated rows. One exception: the zero-charge upgrade grant has no
  Stripe object at all, so `pass.ts` writes its $0 Purchase itself, in the
  same transaction as the entitlement it grants.
- **Every Stripe ID lands in our DB**: customer, session, payment intent,
  price, product, subscription, invoice, promotion code. Metadata snapshots
  stored too.
- **Invoice rows are written only on Stripe's invoice-paid event.**

## New models

```prisma
// One row per completed Stripe payment that grants access (course, Pass,
// pay-the-difference upgrade). Written ONLY by the webhook on a paid
// checkout.session.completed. The audit bridge from Entitlement to Stripe,
// and the frozen record of what was actually paid (grandfathering).
model Purchase {
  id                    String   @id @default(cuid())
  userId                String?
  user                  User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  projectId             String?  // XOR bundleId, like Entitlement
  bundleId              String?
  // Soft reference (indexed, NOT unique, no FK): two completed sessions CAN
  // legitimately point at one entitlement (double-tab checkout = double
  // charge; both payments must be recorded — the duplicate is refund
  // evidence, not noise). No FK because Entitlement cascades on user delete
  // while Purchase must survive it.
  entitlementId         String?
  // Nullable: the zero-charge "already covered" upgrade grant writes a $0
  // Purchase with NO Stripe session. Its idempotency guard is a findFirst on
  // (entitlementId, stripeSessionId: null) inside the grant transaction.
  // Postgres allows multiple NULLs under a unique, so webhook idempotency on
  // real sessions is unaffected.
  stripeSessionId       String?  @unique
  stripePaymentIntentId String?
  // The Charge id — a DISTINCT Stripe id from the PaymentIntent. Completes the
  // id chain ("all stripe ids", per the review). NOT the primary refund key:
  // it is not on the bare Checkout Session (needs `payment_intent.latest_charge`
  // expanded or a backfill), so refund correlation stays on payment_intent
  // (always present on the refund event's charge — no extra API call). Filled
  // opportunistically (expand at insert, or backfill on the first charge event);
  // null-tolerant. See findings 27 + 38.
  stripeChargeId        String?
  stripeCustomerId      String?
  stripePriceId         String?
  stripeProductId       String?
  amountTotalCents      Int      // session.amount_total — never the client
  amountDiscountCents   Int      @default(0) // session.total_details.amount_discount
  stripePromotionCodeId String?  // coupon/promo audit when we enable them
  refundedCents         Int      @default(0) // maintained by charge.refunded (phase 2)
  currency              String   @default("usd")
  metadata              Json?    // session.metadata snapshot
  createdAt             DateTime @default(now())

  @@index([userId])
  @@index([entitlementId])
}

// Mirror of a Stripe Subscription (future: platform access, custom lessons).
// Upserted by customer.subscription.created/updated/deleted webhook events.
// `status` is Stripe's status string VERBATIM (no Prisma enum mirror — those
// drift silently when Stripe adds states; see schema-change-tsc-check memory).
// userId is nullable + SetNull (NOT Restrict): admin-students.ts hard-deletes
// User rows, and an audit row must survive that, same as Purchase/Tip.
model Subscription {
  id                   String    @id @default(cuid())
  userId               String?
  user                 User?     @relation(fields: [userId], references: [id], onDelete: SetNull)
  stripeSubscriptionId String    @unique
  stripeCustomerId     String
  stripePriceId        String?
  stripeProductId      String?
  status               String    // active | trialing | past_due | canceled | ...
  currentPeriodEnd     DateTime?
  cancelAtPeriodEnd    Boolean   @default(false)
  metadata             Json?
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt
  invoices             Invoice[]

  @@index([userId])
}

// Correlates internal data with a subscription + Stripe invoice. Written ONLY
// when Stripe fires invoice.paid (per review). One-time payments do NOT create
// invoices (invoice_creation off) — Purchase covers those.
model Invoice {
  id                   String        @id @default(cuid())
  stripeInvoiceId      String        @unique
  stripeSubscriptionId String?
  subscriptionId       String?
  subscription         Subscription? @relation(fields: [subscriptionId], references: [id], onDelete: SetNull)
  userId               String?
  stripeCustomerId     String?
  amountPaidCents      Int
  currency             String        @default("usd")
  periodStart          DateTime?
  periodEnd            DateTime?
  metadata             Json?
  paidAt               DateTime      // from invoice.status_transitions.paid_at
  createdAt            DateTime      @default(now())

  @@index([userId])
}

// Phase-2 refund audit (written on charge.refunded). One row per Stripe Refund
// object, so "which refund reduced this Purchase, when, why" is answerable from
// our DB — the "all stripe ids" completeness the review asked for. Purchase
// carries the cumulative refundedCents (the fast read); this is the itemized
// ledger behind it. Not built day-1 (refunds are phase-2), but specified now so
// the columns/relations are designed, not retrofitted.
model Refund {
  id              String   @id @default(cuid())
  stripeRefundId  String   @unique
  stripeChargeId  String
  purchaseId      String?  // soft link (Purchase found via stripeChargeId)
  amountCents     Int      // this refund's amount (smallest unit)
  reason          String?  // Stripe's refund.reason (requested_by_customer, ...)
  status          String   // succeeded | pending | failed | canceled
  createdAt       DateTime @default(now())

  @@index([stripeChargeId])
  @@index([purchaseId])
}
```

`User` model gains the REQUIRED back-relation fields (Prisma fails to generate
without the opposite side of every `user User?` relation above — the codebase
already does this for `tips Tip[]`, `entitlements Entitlement[]`, etc.):

```prisma
// added to model User
purchases     Purchase[]
subscriptions Subscription[]
invoices      Invoice[]
```

Other existing models unchanged: `User.stripeCustomerId`,
`Project/Bundle.stripePriceId`, `ProcessedStripeEvent` (idempotency layer 1
stays generic), `Tip` (already session-keyed accounting; not folded into
Purchase to avoid churn). `Refund.purchaseId` is a bare scalar (soft link, no
`@relation`), which Prisma permits — no back-relation needed there.

### Migration also fixes a pre-existing bundle-idempotency hole

`Entitlement` has ONE unique: `Entitlement_userId_projectId_key` on
`(userId, projectId)`. A bundle grant sets `projectId = NULL`, and Postgres
treats NULLs as DISTINCT in a unique index, so that constraint does NOT prevent
two bundle entitlements for one user. Both existing bundle-grant paths — the
webhook (`route.ts:135-147`) and the `pass.ts` upgrade (`pass.ts:126-133`) —
lean on an application `findFirst`-then-`create`, which double-grants under
concurrency (two upgrade clicks, or two distinct webhook events racing). The
webhook's `ProcessedStripeEvent` claim only dedups the SAME event id, not this.

This design's "$0 Purchase idempotent via entitlementId" story rests on that
missing guarantee, so the migration adds it:

```sql
CREATE UNIQUE INDEX "Entitlement_userId_bundleId_key"
  ON "Entitlement" ("userId", "bundleId") WHERE "bundleId" IS NOT NULL;
```

With it, both bundle-grant paths become `create` + catch-P2002 (true
idempotency), and the $0 Purchase keys reliably off the resulting entitlement.

### Migration CHECK + integrity constraints (repo convention)

Match the established belt-to-braces pattern (`entitlement_owner_xor`,
`artifact_owner_xor`, `checklist_owner_xor`):

```sql
-- every Purchase grants exactly one of a course or a bundle
ALTER TABLE "Purchase" ADD CONSTRAINT "purchase_owner_xor"
  CHECK (("projectId" IS NOT NULL) <> ("bundleId" IS NOT NULL));
ALTER TABLE "Purchase" ADD CONSTRAINT "purchase_amount_nonneg"
  CHECK ("amountTotalCents" >= 0 AND "refundedCents" >= 0
         AND "refundedCents" <= "amountTotalCents");
CREATE INDEX "Invoice_stripeSubscriptionId_idx"
  ON "Invoice" ("stripeSubscriptionId");  -- the FK-backfill UPDATE keys on it
```

`amountTotalCents` is Stripe's smallest currency unit (USD-only today; the
`format-money.ts` `/100` display assumes a 2-decimal currency — revisit before
selling in a zero-decimal currency like JPY).

## Webhook changes (`src/app/api/stripe/webhook/route.ts`)

- `checkout.session.completed` (paid): after the existing grant, insert
  `Purchase` in the same handler, guarded on `session.mode === "payment"` —
  future subscription-mode checkouts fire this same event and must NOT create
  a Purchase row (their money lands in `Invoice`). Course sessions stamp
  `stripePriceId` into metadata at creation (`checkout.ts` already has the
  price id in hand). Pass/upgrade sessions use inline `price_data` — there IS
  no Stripe price/product id for them; those columns stay null and
  `Bundle.stripePriceId` is informational only. `entitlementId` back-links
  the grant.
- Zero-charge upgrade (`alreadyCovered` in `pass.ts`): grants directly with no
  Stripe round-trip, so the webhook never sees it. `pass.ts` writes the $0
  Purchase row itself (null `stripeSessionId`, `amountTotalCents: 0`,
  idempotent via `entitlementId`), keeping "every PURCHASE entitlement traces
  to a Purchase row" true.
- `customer.subscription.created|updated|deleted`: upsert `Subscription` by
  `stripeSubscriptionId`. **Basil+ API note (we pin `2026-05-27.dahlia`,
  which postdates basil 2025-03-31): `current_period_start/end` no longer
  exist on the Subscription object — read them from
  `subscription.items.data[0]`.** Resolve `userId` by `stripeCustomerId` →
  `User.stripeCustomerId` lookup (subscription events carry no session
  metadata); when subs ship, also stamp `subscription_data.metadata.userId`
  at checkout creation as a belt-and-braces.
- `invoice.paid`: insert `Invoice` (upsert on `stripeInvoiceId`; update {} —
  write-once). No other invoice.* events touch the table. **Basil+ note: the
  invoice's subscription id lives at
  `invoice.parent.subscription_details.subscription`, not
  `invoice.subscription`.** `invoice.paid` may arrive before the
  `customer.subscription.created` upsert — store the raw
  `stripeSubscriptionId` always, resolve the `subscriptionId` FK when the row
  exists, and backfill the link during the subscription upsert.
- **Claim + writes become ONE `db.$transaction`.** The current handler claims
  `ProcessedStripeEvent` and then upserts separately — a crash between the two
  loses the grant forever (the redelivery hits the claim's P2002 and no-ops).
  Latent today, and the surface triples with the new branches. Each event
  branch wraps its claim + all its writes in a single transaction, so a
  half-processed event stays unclaimed and Stripe's retry re-runs it whole.
  **`capture()` telemetry stays OUTSIDE the transaction** (after commit): a
  PostHog network call inside a Prisma interactive transaction holds the
  connection and risks the 5s txn timeout, and a telemetry failure must never
  roll back a real grant. Same for the `pass.ts` $0-grant transaction.

## Grandfathering fix (`pass.ts` / `pass-upgrade.ts`)

Upgrade credit = sum of the learner's `Purchase.amountTotalCents` where
`projectId != null` (minus `refundedCents`), replacing the current
`Project.priceCents` join. What you paid is what you're credited, frozen at
purchase time. `quoteUpgrade()` math unchanged; only the input feed changes.

## Sequencing — ship BEFORE Stripe goes live

Stripe is still in test mode; there are no real payments to backfill. Landing
this before live activation means the audit trail is complete from the first
real dollar. (Historical test-mode entitlements stay unlinked; acceptable.)

1. Migration (hand-authored SQL, `pnpm db:migrate` = deploy + test-pool refresh).
2. Webhook + checkout metadata stamping + upgrade-credit switch, with tests.
   NOTE this is a test-mock REWRITE, not an extension — see finding 18: the
   `@/lib/db` mock in `stripe-webhook.test.ts` is a bare object with no
   `$transaction`, and every route assertion reads `db.entitlement.upsert` /
   `db.processedStripeEvent.create` directly. Wrapping claim+writes in a
   transaction moves those calls onto `tx`, so the mock must model
   `$transaction(async (tx) => cb(tx))`. `pass-upgrade.test.ts` is PURE and
   does NOT change (see finding 23) — the grandfathering switch lands in the
   `pass.ts` action, which is currently untested at the DB layer and needs a
   NEW integration test proving credit sums Purchase rows.
3. Full `tsc` + full vitest (schema-change rule).
4. Coupons/promo codes (`allow_promotion_codes`) and refund tracking
   (`charge.refunded` → `refundedCents`) are phase 2 — columns exist from day 1
   so enabling them is code-only.

## Validation findings (2026-07-07, design review pass)

Fixes folded into the sections above:

1. `Subscription.userId` was `Restrict` — would block the admin student
   manager's hard `db.user.delete` (`admin-students.ts:173`) for any user who
   ever subscribed. Now nullable + `SetNull` (audit row survives), matching
   Purchase/Tip.
2. Pass + upgrade checkouts use inline `price_data`, not `Bundle.stripePriceId`
   (`pass.ts:74-83, 142-150`) — no price/product id exists to stamp for them.
   Purchase price/product columns are null there by design.
3. The zero-charge `alreadyCovered` upgrade grant never touches Stripe, so the
   webhook can't record it — without a fix it would recreate the untraceable
   source:PURCHASE entitlement this design exists to eliminate. Fixed:
   `pass.ts` writes a $0 Purchase (null session id) at grant time.
4. Pinned API `2026-05-27.dahlia` postdates basil (2025-03-31):
   `current_period_*` moved to subscription items; the invoice's subscription
   id moved to `invoice.parent.subscription_details`. Webhook reads updated
   accordingly (docs.stripe.com/changelog/basil).
5. Subscription-mode checkout sessions also fire `checkout.session.completed`;
   the Purchase insert is guarded on `mode === "payment"` so day-1 code
   survives subscriptions shipping.

### Second validation pass (same day) — concurrency + failure-ordering lenses

6. `Purchase.entitlementId` was `@unique` — a double-tab double-checkout (two
   completed sessions, one entitlement, user charged twice) would make the
   second Purchase insert throw P2002, 500 the webhook, and Stripe would
   retry it forever. Now a plain indexed soft reference; both payments are
   recorded, and the duplicate row IS the refund evidence. The $0-grant
   idempotency moved to a findFirst guard inside the grant transaction.
7. **Pre-existing webhook bug, fix in this build:** the event-id claim and the
   grant writes are separate statements today — a crash between them loses the
   purchase permanently (redelivery no-ops on the claim's P2002). Every
   branch's claim + writes now share one `db.$transaction`.
8. The `pass.ts` $0 grant is also transactional: entitlement + $0 Purchase
   atomically, or the untraceable-entitlement hole reopens on a mid-write
   crash.
9. No FK on `Purchase.entitlementId`: `Entitlement` cascades away on user
   delete; the audit row must survive with the dangling id (userId goes
   SetNull the same way).
10. Cutover behavior change, accepted: existing test-mode PURCHASE
    entitlements have no Purchase rows, so their upgrade credit drops to 0.
    Test mode only; nobody real is affected. Do not carry the old
    `Project.priceCents` fallback — it would resurrect the grandfathering bug.
11. Phase-2 promo-code warning: a 100%-off code completes Checkout with NO
    PaymentIntent (Stripe-documented: docs.stripe.com/payments/checkout/
    no-cost-orders), and the session's `payment_status` is then
    `no_payment_required`, not `paid` — the current `!== "paid"` guard
    silently drops the event and the customer gets nothing. When
    `allow_promotion_codes` ships, the guard must accept both statuses, and
    `stripePaymentIntentId` will be legitimately null on such Purchases.
12. Mixed-interval subscriptions (Stripe 2025-07-30+) can carry items with
    different periods; `items.data[0]` is arbitrary. Fine for our
    single-price subs; take the max period end if plans ever mix.

### Third validation pass (same day) — migration mechanics + GDPR lenses

13. **Strongest finding — pre-existing bundle-idempotency hole this design
    leans on.** `@@unique([userId, projectId])` does NOT constrain bundle
    entitlements (projectId NULL, Postgres NULLs distinct), verified against
    `20260625120000_bundle` which adds no bundle uniqueness. Both bundle-grant
    paths double-grant under concurrency. The design's "$0 Purchase idempotent
    via entitlementId" assumed a uniqueness that doesn't exist. Fixed in the
    migration: partial unique index on `(userId, bundleId) WHERE bundleId IS
    NOT NULL`, turning both paths into `create`+catch-P2002.
14. `Purchase` needs its own `purchase_owner_xor` CHECK (course XOR bundle) +
    non-negative/refund-bound CHECKs — the repo's belt-to-braces DB pattern,
    previously only implied by a comment. Added to the migration.
15. `capture()` telemetry must stay OUTSIDE the new `db.$transaction` (network
    call in a Prisma interactive txn = held connection + 5s-timeout risk; a
    telemetry failure must never roll back a grant). Folded into the webhook
    section.
16. **GDPR retention must be a DELIBERATE, documented decision.** These audit
    rows keep `stripeCustomerId` + `metadata` and outlive user deletion
    (userId→SetNull), in a codebase with active consent machinery (#253/#254).
    Retaining payment-linked identifiers past a deletion request is lawful as a
    financial-record legal obligation, but: (a) note it at the
    `admin-students.ts` hard-delete site (Purchase/Invoice/Subscription
    intentionally survive), and (b) the `metadata` snapshot stores ONLY our own
    keys (`userId`, `projectId`, `kind`) — never customer email/PII — to keep
    the retained blob minimal.
17. Minor integrity: `Invoice.stripeSubscriptionId` indexed for the backfill
    UPDATE; `amountTotalCents` documented as Stripe smallest-unit (the
    `format-money.ts` `/100` assumes 2-decimal — revisit before any zero-decimal
    currency). Both folded into the migration block.

### Fourth validation pass (same day) — test seams + driver mechanics

Verified against `src/lib/db.ts` and `stripe-webhook.test.ts`, not assumed.

18. **Material build blocker: finding-7's transaction wrapping breaks every
    existing webhook route test.** The `@/lib/db` mock is a bare object
    (`stripe-webhook.test.ts:143-149`) with `processedStripeEvent.create`,
    `entitlement.upsert`, `tip.upsert` and NO `$transaction`; the assertions
    call those directly on `db`. Moving claim+writes into
    `db.$transaction(async (tx) => …)` relocates every call onto `tx`, so the
    mock must be rebuilt to model `$transaction` (invoke the callback with a
    `tx` exposing the same sub-mocks incl. `purchase.create`), and assertions
    re-pointed to `tx`. Budget this as a mock-architecture change.
19. **Positive verification (load-bearing): interactive transactions DO work on
    this stack.** `db.ts` uses `PrismaNeon({ connectionString })` — the
    `@neondatabase/serverless` **Pool** (WebSocket), which supports
    `$transaction(async tx => …)`. The HTTP `neon()` single-shot driver would
    NOT (batched-array form only). So finding-7's fix is viable; DO NOT
    "optimize" the client to the HTTP driver — it silently removes atomicity.
    The webhook is `runtime = "nodejs"`, so the WebSocket pool is available.
20. The P2002 redelivery catch stays OUTSIDE the `$transaction`: a duplicate
    event aborts+rolls back the txn, then the outer catch maps P2002 → 200
    no-op and any other error → rethrow (keeps `stripe-webhook.test.ts:328`
    "rethrows a non-P2002" green).
21. `session.total_details.amount_discount` is absent/0 on a normal paid
    session (only meaningful once discounts ship) — read as `?? 0` into
    `amountDiscountCents`.

Convergence note: passes 1-3 found design/schema defects; pass 4 found only
implementation-mechanics + test-seam items (one material: 18). The design
itself is stable; remaining risk is build execution. One more pass (probing the
$0-grant test seam + the metadata-PII scrub) would likely reach dry.

### Fifth validation pass (same day) — deletion × subscription lifecycle

Verified against `admin-students.ts` and `pass-upgrade.test.ts`.

22. **Material operational gap this design creates: `deleteStudent` orphans a
    live Stripe subscription.** `deleteStudent` (`admin-students.ts:164-184`)
    does a bare `db.user.delete` with no Stripe call. Harmless for one-time
    purchases, but the moment subscriptions ship, hard-deleting a subscribed
    user leaves the subscription ACTIVE in Stripe — still charging a card for a
    vanished account. Our DB SetNulls `Subscription.userId` (audit survives),
    but Stripe is never told. Required when subs ship: cancel the user's active
    subscriptions (and delete/detach the Stripe customer) BEFORE the row
    delete. Also update the delete's cascade comment (`:156-158`) — Purchase /
    Subscription / Invoice now SetNull-survive, so "permanently delete" is no
    longer literal (financial records persist; ties to the finding-16 GDPR
    decision, whose concrete enforcement site is HERE).
23. Correction to finding-18's note: `pass-upgrade.test.ts` is PURE
    (`(number|null)[]` in, no source coupling) and is UNAFFECTED by the credit
    switch. The switch lands in the `pass.ts` `createUpgradeCheckoutSession`
    action, which has NO DB-layer test today — so grandfathering ships into
    untested code. Add an integration test asserting credit derives from
    `Purchase.amountTotalCents` (minus `refundedCents`), not `Project.priceCents`.

Still not dry: pass 5 produced one material finding (22, a lifecycle gap the
subscription assumption introduced). The tail is now firmly operational
(deletion/cancellation, GDPR enforcement site) rather than schema. A pass 6
would probe refund handling (`charge.refunded` → does an entitlement get
REVOKED, or only `refundedCents` recorded?) and the subscription
access-gating read path (nothing reads `Subscription.status` for access yet).

### Sixth validation pass (same day) — access-consequence lens

Verified against `entitlements.ts`, `admin-students.ts`, `lifecycle-triggers.ts`.

24. **Material design gap: this design RECORDS money movement but nothing ACTS
    on it.** `hasProjectEntitlement` (`entitlements.ts:15-33`) grants access on
    the mere EXISTENCE of an Entitlement row — it never reads
    `Purchase.refundedCents` or `Subscription.status`. Two consequences:
    - **Refund ≠ revocation.** When phase-2 `charge.refunded` handling lands
      and writes `refundedCents`, the entitlement row still exists, so a fully
      refunded buyer keeps access forever. The design must pair refund
      recording with an access consequence: on full refund, DELETE the
      Entitlement (reuse `revokeEntitlement`, finding 25), or teach
      `hasProjectEntitlement` to exclude fully-refunded purchases. Decide + write.
    - **Subscription status never gates.** `hasProjectEntitlement` has no
      `status IN (active, trialing)` branch, so a `canceled` / `past_due`
      subscriber whose entitlement exists keeps access. When subs grant access,
      pick ONE model: (a) the subscription webhook mints/revokes an Entitlement
      row on each status transition (keeps the read path as-is, one source of
      truth), or (b) `hasProjectEntitlement` joins `Subscription.status`.
      Model (a) is preferred — it keeps the hot read a single indexed lookup.
    This is the "records but doesn't act" hole; naming the revocation
    requirement is in scope even though implementation is phased.
25. The revocation primitive already exists — `revokeEntitlement`
    (`admin-students.ts:118-128`) deletes the row. The refund handler should
    reuse it. This also validates finding 9's no-FK choice: a revoke deletes
    the Entitlement while the `Purchase` row (and its now-dangling
    `entitlementId`) survives as the audit record — exactly the intended
    asymmetry, no FK error.
26. Checked-benign (not a finding): the $0 bundle grant writes
    `source: "PURCHASE"` with `projectId = null`. Lifecycle segmentation
    (`lifecycle-triggers.ts:173`) requires `projectId: { not: null }`, so a
    Pass-only buyer is correctly NOT counted as a course purchaser; the
    "never purchased" segment (`:245`) correctly excludes them. No collision.

Not dry: pass 6 produced a material design finding (24 — access has no refund /
subscription-status consequence). This is the first genuinely NEW design-level
hole since pass 3; the subscription assumption keeps surfacing gating questions
the one-time-payment code never had to answer. Pass 7 target: the
`charge.refunded` event shape (partial vs full refund detection) + whether
`ProcessedStripeEvent` (event-id keyed) correctly dedups refund events that
share a charge.

### Seventh validation pass (same day) — refund correlation mechanics

Web-verified against the Stripe Charge object docs (amount_refunded is the
CUMULATIVE total in smallest unit; payment_intent is the correlation id).

27. **Refund correlation key must be populated at PURCHASE time, or refunds
    can't find their row.** `charge.refunded` carries a Charge
    (`payment_intent`, `amount`, `amount_refunded`) — NOT a checkout session.
    The handler locates the Purchase by `stripePaymentIntentId ===
    charge.payment_intent`. So the `checkout.session.completed` Purchase insert
    MUST read and store `session.payment_intent` (payment-mode sessions carry
    it). The column exists; the write step never said to fill it — add it.
    Null on $0 grants, which can't be refunded, so no correlation needed there.
28. **`refundedCents` is SET to `charge.amount_refunded` (absolute), never
    `+=`.** Stripe reports the cumulative refunded total, and a charge can be
    partially refunded multiple times (distinct event ids, each passing the
    `ProcessedStripeEvent` claim). An increment would double-count across
    partials or a reprocessed event; a SET to Stripe's cumulative value is
    idempotent and self-healing. Same "amount from Stripe, never computed" rule
    as `Tip`.
29. **Full-refund revocation threshold.** Revoke the Entitlement (finding 24/25)
    only when `charge.amount_refunded === charge.amount` (full). A partial
    refund records `refundedCents` and KEEPS access. Define this boundary in
    the handler so it isn't ambiguous. (A refund handler keyed on the Charge
    also needs its OWN `ProcessedStripeEvent` claim + transaction, per finding
    7 — it mutates access.)

Not dry: pass 7 produced three findings elaborating the phase-2 refund path
(one, 27, would be a silent correctness bug — refunds unable to locate their
Purchase). All three are self-consistent with the earlier idempotency/audit
principles. Pass 8 target: whether the migration is truly additive/safe on the
live pool + the `describe_table_schema` reality of the `Entitlement` partial
index (does the existing data violate the new `(userId,bundleId)` unique?).

### Eighth validation pass (same day) — migration safety on live data — DRY

Empirically checked PROD (read-only `scripts/_check-bundle-dupes.ts`), plus
closed the two lingering flags. NO material findings this pass.

30. **Positive verification — the migration is additive + safe on the live
    pool.** PROD has **0** bundle entitlement rows (Stripe never left test
    mode, no Pass sold), so the one touch on a pre-existing populated table —
    `CREATE UNIQUE INDEX Entitlement(userId,bundleId) WHERE bundleId IS NOT
    NULL` (finding 13) — cannot collide with existing data; no dedup/backfill
    step. Purchase / Subscription / Invoice are brand-new empty tables, so all
    their constraints + indexes create cleanly. The grandfathering switch is
    code-only (no Project schema change). Total blast radius on populated data:
    one guaranteed-safe partial index.
31. **Closed (benign) — metadata is PII-free by construction.** Every session
    we create stamps only our own ids: `checkout.ts` → `{userId, projectId}`,
    `pass.ts` → `{kind, userId, bundleKey}`. No customer email/PII enters
    `Purchase.metadata`; the one email we store (tips) lives in `Tip.email`
    deliberately. Finding-16's "metadata scrub" is satisfied by what we
    control. Currency is uniformly `"usd"` across sessions + column defaults —
    no mixing.
32. **Non-material housekeeping (not a blocker):** `ProcessedStripeEvent` grows
    unbounded (one row per event forever). Not a correctness issue; a future
    prune (>90d) is optional. Recorded so it isn't silently ignored.

**DRY.** Pass 8 probed a genuinely new lens (live-data migration safety) and the
design held with zero material findings; the two open flags (metadata PII,
currency) closed benign. Per the board-protocol DRY definition (a pass with
zero new material findings), this is the first dry pass.

---

## Convergence summary (8 passes)

| Pass | Lens | Material | Total |
| --- | --- | --- | --- |
| 1 | schema semantics, deletion cascade, API-version | 3 | 5 |
| 2 | concurrency, failure-ordering, promo codes | 2 | 7 |
| 3 | migration SQL, XOR/CHECK, GDPR | 1 | 5 |
| 4 | test seams, Neon driver mechanics | 1 | 4 |
| 5 | deletion × subscription lifecycle | 1 | 2 |
| 6 | access-consequence read path | 1 | 3 |
| 7 | refund correlation mechanics | 1 | 3 |
| 8 | live-data migration safety | 0 | 0 (DRY) |

Material findings walked steadily outward — schema → concurrency → migration →
test seams → lifecycle → access → refund → (dry). The design is stable; every
open item is phased implementation (refund/subscription access consequences are
phase-2, gated behind features not yet live), not a hole in the day-1
one-time-payment slice.

### Day-1 build scope (validated, ready)

Purchase table (+ `User.purchases` back-relation, finding 39) + webhook Purchase
insert (reading `payment_intent` + `stripeChargeId` opportunistically + `price`;
`amount_total` WITH a null-guard, finding 33) + the `Entitlement(userId,bundleId)`
partial unique index + `purchase_owner_xor`/amount CHECKs +
claim-and-writes-in-one-transaction (fixing the pre-existing atomicity bug) + the
grandfathering credit switch, with the reworked webhook test mock and a new
upgrade-action integration test.

### Phase-2 (write when the feature lands, columns already exist)

Subscription + Invoice tables and their webhook branches; `charge.refunded` →
`refundedCents` (SET, not +=) + full-refund revocation; promo-code guard
widening; `deleteStudent` Stripe-subscription cancellation.

### Ninth validation pass (same day) — GENERAL completeness critic

Not a narrow lens: step back and ask what the 8 targeted passes ASSUMED. Two
were assumed by every pass and one is a day-1 guard they all missed.

33. **Day-1 data-integrity guard the focused passes missed:
    `session.amount_total` is `number | null` in Stripe's types.** Every prior
    pass wrote `amountTotalCents: session.amount_total` as if non-null.
    Recording `0` for a genuinely paid session is corrupt audit data AND zeroes
    that buyer's future grandfathering credit. The Purchase insert must guard
    null explicitly (a paid session with null total is anomalous — log + refuse
    or record with a flag, never silently 0). The `Tip` helper already guards
    this (`tipFromCheckoutSession` → null on non-positive); Purchase must match.
    → Folded into day-1 scope.
34. **Operational prerequisite that silently breaks all of phase-2: the Stripe
    webhook ENDPOINT must be configured to SEND the new event types.**
    `customer.subscription.*`, `invoice.paid`, `charge.refunded` only reach the
    handler if the endpoint's enabled-events list (Stripe Dashboard / API)
    includes them. Code is necessary, not sufficient — every phase-2 handler
    no-ops silently until the endpoint subscribes to its event. No targeted
    pass caught this because each assumed its event arrives.
35. Phase-2 edge: the refund handler correlates by `payment_intent`, but a
    refunded **tip** is also a charge and matches NO Purchase. It must no-op
    gracefully on "no matching Purchase" — a throw would 500 the webhook into
    infinite Stripe retry.
36. Known limitation to state, not fix: the whole billing path is **card-only.**
    Async payment methods deliver `checkout.session.completed` as `unpaid` and
    settle later via `async_payment_succeeded` (unhandled), so async-settled
    payments get neither Entitlement nor Purchase. Pre-existing (route.ts:69-77);
    this design inherits it. Acknowledge explicitly.

Also verified benign: `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` are
`.optional()` in `env.ts` (keyless build stays green); no new env var for the
day-1 slice; grandfathering credit correctly uses post-discount `amount_total`.

Honest status: pass 8 was dry ON ITS LENS, but the GENERAL pass found one day-1
guard (33) the targeted passes overlooked — the exact failure mode a
completeness critic exists to catch (targeted review assumes the happy-path
field shape). Day-1 scope updated to include the `amount_total` null guard.
Remaining items (34-36) are phase-2 operational/edge. The core schema + grant
mechanics remain unchanged since pass 3 — the design is stable; pass 9 hardened
the day-1 write, not the model.

### Tenth validation pass (general) — requirement completeness re-audit

Re-audited the design against the senior dev's LITERAL asks (price/plan id,
coupons/discounts/grandfathering, customer/product/price/subscription/invoice
ids, metadata-in-db, single-source-of-truth, invoice-on-invoice.paid). Seven of
eight fully covered. One gap:

37. **"Keep ALL stripe id's" — the design missed the Charge id and Refund id.**
    It captured customer / session / paymentIntent / price / product /
    subscription / invoice ids, but not the **Charge id** (distinct from the
    PaymentIntent) nor the **Refund id**. Both are real ids in the payment
    lifecycle and the review said "all." Two fixes, folded in:
    - `Purchase.stripeChargeId` (day-1): completes the id chain. (Correlation
      key reconciled in finding 38 — payment_intent stays primary; charge id is
      completeness-only.)
    - A `Refund` model (phase-2): one row per Stripe Refund (`stripeRefundId`,
      `stripeChargeId`, amount, reason, status), so "which refund reduced this
      Purchase, when, why" is answerable from our DB. `Purchase.refundedCents`
      stays the fast cumulative read; `Refund` is the itemized ledger behind it.

Also confirmed benign (cross-path race hardening): the finding-13 partial unique
index on `(userId, bundleId)` ALSO protects the race between the `pass.ts` $0
grant (server action) and a real Pass webhook — the second create hits P2002 and
is caught. The index earns its place beyond same-path idempotency.

Not dry: pass 10 found a real completeness gap (37) against the stated
requirement — one day-1 column + one phase-2 table. A general pass caught what
the mechanics-focused passes did not: whether every literal ask is satisfied.

### Eleventh validation pass (general) — internal consistency of the edited spec

A spec edited across 10 passes can contradict itself; the plan IS the build
spec, so an ambiguous instruction ships as an arbitrary implementer choice.

38. **Findings 27 and 37 named two different refund-correlation keys.** 27 said
    correlate via `payment_intent`; 37 said via `stripeChargeId` and called it
    "simpler." But the Charge id is NOT on the bare Checkout Session — getting
    it at insert needs `payment_intent.latest_charge` expanded (an extra
    synchronous Stripe call in the hot webhook path) or a backfill. Reconciled:
    **`payment_intent` is the PRIMARY refund-correlation key** (always present
    on the refund event's charge, zero extra calls); `stripeChargeId` is
    completeness-only, filled opportunistically, null-tolerant. An implementer
    following the un-reconciled spec would have added a needless blocking API
    call or stored a null charge id and been confused. Both the model comment
    and finding 37 corrected.

Not dry: pass 11 was a doc-consistency fix (38), not a new design defect — but a
real build-spec ambiguity that would have produced wrong code. The MODEL is
unchanged; the instruction was clarified.

### Twelfth validation pass (general) — Prisma schema-validity

Does the schema as written actually `prisma generate`? Checked the relation
graph against Prisma's rules and the existing `User` model.

39. **Build-blocker: the new models declare `user User?` but the design never
    added the opposite relation fields to `User` — `prisma validate`/`generate`
    fails.** Prisma requires BOTH sides of every relation; the codebase already
    honors this (`User.tips Tip[]`, `User.entitlements Entitlement[]`, etc.).
    Purchase / Subscription / Invoice each need a `User` back-relation
    (`purchases Purchase[]`, `subscriptions Subscription[]`,
    `invoices Invoice[]`). Added to the model section. (`Refund.purchaseId` is a
    bare scalar soft-link, no `@relation`, so it needs no back-relation — valid
    Prisma.) Without this the migration+generate step fails immediately, before
    any test runs.

Not dry: pass 12 found a concrete build-blocker (39) — the schema would not have
generated. This is the kind of defect only a schema-validity lens catches, and
it is genuinely NEW (no prior pass checked the relation graph).

### Thirteenth validation pass (general) — schema-identity / collision — DRY

Probed the remaining schema-validity angles against the live `schema.prisma`
(41 existing models):

- **No model-name collision.** `Purchase` / `Subscription` / `Invoice` /
  `Refund` do not exist; `Subscription` is distinct from the existing auth
  `Session` model (line 100) — no clash. `Payment` / `Order` / `Charge` also
  free, so the chosen names are unambiguous.
- **No reserved-word hazard** (`Purchase`/`Refund` are safe table identifiers;
  Prisma quotes anyway). `cuid()` id default matches the codebase convention.
- **`ProcessedStripeEvent` needs no change** — all new event types
  (subscription / invoice / refund) claim into the same event-id-keyed table.

Zero material findings. Cross-checked the full design one last time end to end
(schema generates, webhook transactional + guarded, idempotency via unique
indexes, grandfathering from Purchase amounts, deletion survival, phased access
revocation, migration verified safe on live data, every requirement + all Stripe
ids covered) — no new gap.

**DRY (general).** After four productive general passes (9-12: amount_total
guard, charge/refund ids, correlation-key reconcile, missing back-relations),
pass 13 probed a genuinely new lens and the design held clean.

---

## Convergence summary (13 passes)

| Pass | Kind | Lens | Material | Total |
| --- | --- | --- | --- | --- |
| 1 | targeted | schema semantics, deletion, API-version | 3 | 5 |
| 2 | targeted | concurrency, failure-ordering, promo | 2 | 7 |
| 3 | targeted | migration SQL, XOR/CHECK, GDPR | 1 | 5 |
| 4 | targeted | test seams, Neon driver | 1 | 4 |
| 5 | targeted | deletion × subscription | 1 | 2 |
| 6 | targeted | access-consequence read path | 1 | 3 |
| 7 | targeted | refund correlation | 1 | 3 |
| 8 | targeted | live-data migration safety | 0 | 0 (dry) |
| 9 | general | completeness critic (amount_total) | 1 | 1 |
| 10 | general | requirement re-audit (charge/refund id) | 1 | 1 |
| 11 | general | internal spec consistency | 0* | 1 |
| 12 | general | Prisma schema-validity (back-relations) | 1 | 1 |
| 13 | general | schema identity / collision | 0 | 0 (DRY) |

*11 was a build-spec ambiguity fix, not a new model defect.

Two dry passes reached (8 targeted, 13 general). The model has not changed since
pass 3; passes 4-13 hardened mechanics, lifecycle, edges, spec clarity, and
schema validity. Design is validated to dry.

Known pre-existing edge (NOT this design's scope, flag for GTM): a
pay-the-difference charge below Stripe's 50¢ minimum (credit within 49¢ of the
Pass price) makes `checkout.sessions.create` throw. Whole-dollar catalog
prices make it unlikely; the clean fix is treating charge < 50¢ as
`alreadyCovered`.
