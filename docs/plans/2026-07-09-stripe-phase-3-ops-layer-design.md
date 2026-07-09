# Stripe phase 3 — the human + ops layer (design)

- **Date:** 2026-07-09
- **Status:** validated (brainstorm complete), ready for an implementation plan
- **Canonical status doc:** `docs/state-of-stripe.md` (currently on PR #271, unmerged)
- **Phase 1–2 design (why the schema is shaped this way):** `docs/plans/2026-07-07-billing-audit-schema.md`
- **Branch:** `feat/stripe-phase-3` off `main` (one branch, batched execution, one PR)

---

## Context and the load-bearing decision

Phases 1–2 (merged: #266/#268/#269/#270) made the billing system **record every
dollar and act on access correctly** — a signature-verified webhook is the only
writer, our DB is the single source of truth, idempotency is double-layered. What is
missing is the **human-facing + ops layer**: a self-service portal, dunning, admin
visibility, and revenue reporting.

**The reframing that shapes this whole design (from Josh, 2026-07-09):** the recurring
**subscription is NOT for courses or the All-Access Pass.** It is for a *future*
academy-system program (learners tracking their own custom-created projects) that does
not exist yet. Therefore:

- The `/pricing` storefront's emphatic **"pay once, no subscription"** positioning is
  correct and **stays untouched.** There is no positioning conflict to resolve, because
  we are **not** adding a public subscribe button to the course storefront.
- This round finishes the **billing machinery** so it is 100% ready the day that future
  program ships ("I want all the stripe shit done"). Every piece here is built to be
  **program-agnostic** — it serves today's one-time Pass buyers AND tomorrow's
  subscribers with no rework.

## Scope (validated)

**Build:** Customer Portal · Dunning · Admin billing view · Revenue reporting.
**Subscribe path:** no public button; verify the existing action + a hidden admin test
harness (prove sub → portal → dunning end to end before the program exists).

Explicitly **out of scope** this round: tax/VAT, our-own email receipts, promo-code
usage reporting, time-series revenue charts. (All noted in `state-of-stripe.md` as
later polish.)

---

## The five pieces

### 1. Customer billing portal (Stripe-hosted)

- **Approach:** Stripe **Customer Portal** (`billingPortal.sessions.create`), not a
  custom-built billing UI. *Why:* Stripe maintains the PCI-compliant surface for
  viewing invoices, updating the card, and self-cancelling; a custom equivalent is pure
  liability and re-implements Stripe's hosted flow for no gain.
- **New action:** `createBillingPortalSession()` in a new `src/lib/actions/billing.ts`
  ("use server", exports only async functions). Requires a signed-in user; calls
  `ensureStripeCustomer(user)` is **not** appropriate here (do not create a customer
  just to open a portal) — instead read the user's **own** `stripeCustomerId` from
  their `User` row and, if absent, the button never renders. The customer id is read
  server-side from the authenticated user, **never from client input** (no IDOR).
  `return_url = ${siteUrl()}/account`. If the Stripe Portal config is missing, the
  action throws `billingPortal ... No configuration` → the button surfaces that as an
  inline error (does not crash).
- **UI:** a new "Billing" `Section` on `/account` (`src/app/account/page.tsx`), shown
  **only when `stripeCustomerId != null`** (i.e., the user has ever transacted). It
  holds a "Manage billing" client button (mirrors `PassButtons` look: gold command
  button, `useTransition` pending state, inline error → `window.location.href = url`).
- **One-time manual step (Josh):** the Stripe **Dashboard → Customer Portal config**
  must be enabled/configured once (allowed actions: update payment method, view
  invoices, cancel subscription). The action fails with a clear error until then; this
  is a live-dashboard step, documented in the runbook, not code.

### 2. Dunning (email + banner)

**Email (always sends):**
- New pure-function builder `subscriptionPaymentFailedEmail({ portalUrl, host })` in a
  new `src/lib/subscription-dunning-email.ts`, reusing the dark table-email shell
  pattern from `field-guide-email.ts` (inline styles, bulletproof button, real
  text/plain alternative, academy tokens). House voice, no em-dash.
- **Transactional, therefore NOT `emailConsent`-gated** (same class as the magic-link
  and field-guide emails — a billing failure notice is not marketing). Sent via
  `POST https://api.resend.com/emails` with `AUTH_RESEND_KEY` / `AUTH_RESEND_FROM`
  (the transactional identity, not `LIFECYCLE_RESEND_FROM`).
- **Where it fires:** the webhook's `invoice.payment_failed` branch
  (`src/app/api/stripe/webhook/route.ts`, currently log-only in the block that groups
  `payment_failed || payment_action_required || payment_attempt_required`).
  - **Email on `invoice.payment_failed` ONLY.** `payment_action_required` (SCA / 3DS
    authentication needed) and `payment_attempt_required` are a *different* message (the
    customer must authenticate, which the billing portal does not fix) and are rare for
    our card flow — keep them **log-only** this round. Split the grouped branch so only
    `payment_failed` triggers the email; the other two stay as the existing warn.
  - Wrap the `payment_failed` handling in the existing `claimAndWrite(event.id,
    event.type, …)` so the `ProcessedStripeEvent` claim makes a **redelivered** event a
    P2002 → 200 no-op (no duplicate email). The `work` records nothing new (access
    already follows `Subscription.status`); the claim IS the idempotency point. Match
    the dispute-branch shape: `const early = await claimAndWrite(...); if (early) return
    early; await sendDunning(...)`.
  - **Send the email AFTER `claimAndWrite` returns success** (post-commit, exactly like
    `capture()` telemetry) — a network call must never hold the txn connection open.
  - **On Resend failure: LOG, do NOT throw.** The claim has already committed, so a
    thrown 500 makes Stripe retry the event → the retry hits the claim's P2002 → 200
    no-op → the email is never re-sent anyway. Throwing gains nothing and misreports the
    webhook as failing. (This is the OPPOSITE of the lifecycle sender, which throws
    because its claim row is the only guard; here the event claim already guards.)
  - **Recipient resolution:** `User` where `stripeCustomerId === invoice.customer`
    (handle Stripe's `string | {id} | null` customer field like the existing warn does).
    If no user row (deleted / never persisted), log and skip (nothing to email).
  - **Cadence:** Stripe fires `payment_failed` once per retry attempt (distinct event
    ids, ~4 over ~2 weeks) → the customer gets one email per real attempt. Correct
    dunning rhythm; no extra throttle needed.

**In-app banner (scoped: `/account` + learner home only):**
- A shared server helper `pastDueSubscription(userId)` → returns the user's
  `Subscription` whose `status ∈ { past_due, unpaid, incomplete }`, else null. Derived
  live from the mirror; **no new DB state.**
- A `<DunningBanner>` component: a hairline **alert-red** panel (token-only color, no
  filled box, no big radius, no em-dash in the copy, per otd-frontend-design +
  otd-content-writing) with a short "Your last payment did not go through" line and a
  "Manage billing" link that opens the portal action. Rendered on
  `src/app/account/page.tsx` and the learner home `src/app/learn/page.tsx`. **Not**
  global — deliberately quieter than an app-shell banner.
- **Not dismissible.** It is derived from live status, so it clears itself the moment
  the subscription leaves `past_due/unpaid/incomplete` (payment recovered or sub
  canceled). A dismiss control would just hide an unresolved billing problem.

### 3. Admin billing view (per learner)

- A new read-only "Billing" `Section` on `src/app/admin/students/[id]/page.tsx`,
  slotted beside the existing Account/Profile/Access/Progress sections (same `Section`
  + `Field` primitives already in that file).
- Surfaces, for that user: **Subscriptions** (status, current-period-end,
  cancel-at-period-end), **Invoices** (amountPaid, paidAt), **Purchases**
  (amountTotal, refundedCents, date), **Refunds** (amount, status), **Disputes**
  (status). All already recorded; just not surfaced.
- **Refund / Dispute correlation:** neither model has a `userId`. Both carry a soft
  `purchaseId` (set by the webhook when it can correlate) and a `stripeChargeId`. Query
  them by `purchaseId ∈ {the user's Purchase ids}` (fall back to `stripeChargeId ∈ {the
  user's Purchase charge ids}` for any row the webhook could not soft-link). Do **not**
  correlate by `stripePaymentIntentId` — Refund/Dispute do not carry it.
- Pure read (`db.*.findMany` scoped to the user), `force-dynamic` already set on the
  page. No new actions.

### 4. Revenue reporting

- A new admin-gated page `src/app/admin/billing/page.tsx` (`requireAdmin()`,
  `force-dynamic`), added to the admin navigation by appending
  `{ href: "/admin/billing", label: "Billing" }` to `ADMIN_LINKS` in
  `src/components/UserMenu.tsx`.
- **Metrics math lives in a PURE helper** `src/lib/billing-metrics.ts` (mirrors the
  `pass-pricing` / `pass-upgrade` split): functions that take plain rows and return the
  computed numbers, so the aggregation is unit-testable with **no DB**. The page just
  queries rows and passes them in.
- **Depth (validated):** headline **stat tiles** + a **recent-activity table**. No
  charts / time-series this round (near-empty until real volume; YAGNI).
  - **Recurring revenue (MRR):** `count(Subscription where status ∈ {active,trialing})
    × Bundle.subscriptionPriceCents`. The recurring **amount** comes from
    `Bundle.subscriptionPriceCents` (the Subscription mirror stores no amount). CAVEAT:
    the billing **interval is not stored in our DB** — `set-subscription-price.ts`
    provisions it (default `month`, env `SUBSCRIPTION_INTERVAL`). We assume **monthly**
    (the provisioned default). If it is ever provisioned as `year`, divide by 12. Label
    the tile honestly (e.g. "Recurring / mo") and leave a code comment on the
    assumption.
  - **Gross revenue:** `sum(Purchase.amountTotalCents - refundedCents)` +
    `sum(Invoice.amountPaidCents)`. VERIFIED disjoint: the webhook writes a Purchase
    only for `mode === "payment"` sessions, so a subscription payment is an Invoice and
    never also a Purchase — no double-count.
  - **Active subscriptions:** count of active/trialing subs.
  - **Refund rate:** `sum(Purchase.refundedCents) / sum(Purchase.amountTotalCents)`
    (guard divide-by-zero → 0).
  - **Dispute rate:** `count(Dispute) / count(Purchase)` (guard divide-by-zero → 0).
  - **Recent activity:** the last N Purchases/Invoices/Refunds/Disputes normalized to a
    common `{ type, amountCents, at, who }` shape (a pure mapper in `billing-metrics.ts`)
    and merged by date.
- **Empty state is the DEFAULT reality:** until content is published + the sub program
  ships there will be ~zero rows. Every tile must render `0` / `—` cleanly and the
  activity table must show a quiet "No activity yet" — not crash or divide-by-zero.
- Follow the `dataviz` skill's stat-tile conventions for the tiles; `otd-frontend-design`
  for the page chrome (deep-space, hairlines, mono numerals, no gradient chrome).

### 5. Subscribe verification harness (no public button)

- **No `/pricing` change.** The `createSubscriptionCheckoutSession` action already
  exists and is correct.
- **Hidden admin trigger:** a small admin-only "Start test subscription" button on
  `/admin/billing` (admin-gated) that calls `createSubscriptionCheckoutSession` so the
  full loop is exercisable without a public storefront button. NOTE: the action throws
  "The subscription isn't available yet" until `Bundle.subscriptionPriceId` is
  provisioned — until then the button surfaces that inline (expected). It subscribes the
  **admin's own** account, so in LIVE mode it would charge the admin's real card — do
  the verification in **test mode** (a Stripe test clock + a failing test card exercises
  the whole dunning path with no real money).
- **Activation (manual co-step with Josh, needs the live key):**
  1. Swap `.env.local` `STRIPE_SECRET_KEY` to `sk_live_…`, run
     `scripts/set-subscription-price.ts`, then **reset to `sk_test_…`** (a live key in
     local dev = accidental real charges — runbook rule).
  2. Confirm the live webhook endpoint has the subscription/invoice events enabled
     (per `state-of-stripe.md` they already are).
  3. E2E: start a sub via the admin trigger → confirm the mirror + entitlement →
     open the portal → force a failed renewal (Stripe test clock / failing card) →
     confirm the dunning email + banner → cancel via the portal → confirm revoke.
- The **build** is the hidden trigger; the **verify** is a manual E2E we do together.

---

## Cross-cutting constraints (do not violate)

- **Our DB is the source of truth** for access; the portal is Stripe-hosted display +
  self-service only. A cancel / card update in the portal **round-trips through the
  webhook** (Stripe fires `customer.subscription.*` → our webhook updates the mirror +
  entitlement) — the portal never writes our DB directly. This preserves principle 2
  ("the signature-verified webhook is the ONLY writer of Stripe-originated rows").
- Access still flows exclusively through the webhook + entitlements.
- **"use server" rule:** `billing.ts` exports only async functions (no type re-exports).
- **Build-safety:** `getStripe()` only inside action/handler bodies, never at import.
- **`.env.local` `DATABASE_URL` is PROD.** This round needs **no schema migration**
  (every table + column already exists) — if that changes, it needs Josh's explicit go.
- **No public subscribe button; no `/pricing` copy change.**
- **House voice** on every rendered/emailed string (no em-dash; answer-first).
- **Verify against real behavior** before claiming done (`/verify` skill), and
  **update `docs/state-of-stripe.md`** in the same PR (change log + roadmap ticks).

## Success criteria

1. A Pass buyer (has `stripeCustomerId`) sees "Manage billing" on `/account` and it
   opens the Stripe portal; a user with no customer id sees nothing.
2. A failed subscription renewal sends exactly one house-voice email per attempt and
   shows the banner on `/account` + learner home; a redelivered event sends nothing new.
3. An admin sees a learner's subs/invoices/refunds/disputes/purchases on the student
   detail page, and MRR/revenue/refund-rate/dispute-rate + recent activity on
   `/admin/billing`.
4. The subscribe → portal → dunning → cancel loop is proven E2E against live Stripe.
5. `pnpm build` + full `pnpm test` green; `state-of-stripe.md` updated.

## Delivery

One branch `feat/stripe-phase-3` off `main`, executed in reviewable batches:
**(1) portal → (2) dunning → (3) admin view → (4) reporting → (5) harness**, one PR at
the end. Do **not** merge without Josh's explicit go (standing no-auto-merge rule).

---

## Validation log (recursive audit to dry — 2026-07-09)

Method (per Josh): general pass, then rotate lenses, then a general pass again; a
"dry" pass = zero new material findings. Every finding below was verified against the
actual code, not assumed, and folded into the design above.

**Round 1 — General / architecture.** Coherent; five pieces are all program-agnostic
as intended. Findings: (G1) MRR amount source was vague ("the sub's price"); (G2) admin
nav location unspecified. Resolved: (G1) `Bundle.subscriptionPriceCents` exists
(schema:208); (G2) `ADMIN_LINKS` in `UserMenu.tsx`. *Not dry.*

**Round 2 — Correctness / Stripe API.** (C1) MRR interval is not stored in our DB, only
the cents → assume monthly (provisioned default), note + normalize-if-year. (C2) the
webhook groups `payment_failed | payment_action_required | payment_attempt_required`;
SCA (`action_required`) is a different message the portal does not fix → email on
`payment_failed` ONLY, keep the others log-only. (C3) dunning email-send failure must
LOG not throw (the event claim already committed; a thrown 500 → Stripe retry → P2002
no-op → no resend anyway). All applied. *Not dry.*

**Round 3 — Data model / query correctness.** (D1) `Refund` / `Dispute` carry no
`userId`; correlate via soft `purchaseId ∈ user's Purchases` (fallback `stripeChargeId`),
NOT `paymentIntentId` (they don't carry it) — doc corrected. (D2) Revenue double-count
risk between Purchase and Invoice — **verified in code**: `checkout.session.completed`
writes a Purchase only when `session.mode === "payment"` (route.ts:146), so a
subscription payment is an Invoice and never also a Purchase. Disjoint. *Not dry.*

**Round 4 — Security / authz / privacy.** (S1) portal customer id is read server-side
from the authenticated user's own `User` row, never client input (no IDOR) — documented
as an invariant. (S2) the admin test-trigger subscribes the admin's own account →
charges real money in live mode → verify in test mode only. (S3) portal cancel/update
round-trips through the webhook, never writes our DB directly (preserves principle 2).
`/admin/billing` is double-gated (middleware `/admin/*` + `requireAdmin()`). Applied.
*Not dry.*

**Round 5 — House voice / design system / UX.** (U1) DunningBanner = alert-red hairline
panel, token-only, no filled box / big radius, no em-dash. (U2) banner NOT dismissible
(clears when status recovers). (U3) tiles via `dataviz`, chrome via `otd-frontend-design`,
email/UI copy via `otd-content-writing`. (U4) removed an em-dash from the banner copy
example in this very doc. Applied. *Not dry.*

**Round 6 — Build-safety / test / CI.** (B1) NO schema migration this round (every table
+ column already on PROD) → the test pool cannot drift, no `db:migrate` needed. (B2)
extract the reporting aggregation into a PURE `billing-metrics.ts` (rows in, numbers
out) so it is unit-testable with no DB — mirrors `pass-pricing`/`pass-upgrade`. (B3)
`getStripe()` only inside bodies (import-safe). (B4) the webhook test file must be
updated for the new `claimAndWrite` on `payment_failed`. (B5) the dunning email builder
is a pure function → unit-test like `auth-magic-link-email.test.ts`. Applied. *Not dry.*

**Round 7 — Consistency with the 7 `state-of-stripe` principles.** Walked all seven.
DB-source-of-truth (portal is display/self-service), webhook-is-only-writer (portal
round-trips; test-trigger only starts a checkout), idempotency (claim-based dunning),
amounts-from-Stripe (unchanged), Neon Pool (unchanged), Basil+ fields (unchanged),
card-only (unchanged). All compliant. *Dry for this lens.*

**Round 8 — Ops / activation / runbook.** One-time Stripe **Portal config** (dashboard)
is a manual prerequisite; live **sub-price provisioning** is a manual live-key step.
Both must land in the `state-of-stripe.md` runbook + change log in this PR. Applied.
*Not dry (added the runbook obligation).*

**Round 9 — Failure modes / resilience.** Resend down → banner still shows (status is
independent); portal misconfigured → inline error; user deleted before the email → skip.
All already covered by the applied findings. *Dry for this lens.*

**Round 10 — General re-sweep.** One new material finding: (R10-1) zero/near-zero volume
is the DEFAULT reality until content ships — every tile + the activity table must render
empty/zero cleanly and guard divide-by-zero. Applied. Confirmed the `/account` portal
button is correctly shown to one-time Pass buyers too (view invoices / update card), and
the banner stays dormant (no subs) until the program ships — both intended. *Not dry
(one finding).*

**Round 11 — General re-sweep (dry check).** Re-read the whole design against every lens
above. No new material findings. **DRY.** Design validated → proceed to worktree + plan
+ implementation.

**Audit summary:** 11 rounds, final pass dry, every lens clean, ~15 material findings
all resolved into the design. Zero schema changes; zero new Stripe principles violated.
