# Stripe Payments Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task.

**Goal:** Real one-time purchases — paywall Buy button → Hosted Stripe Checkout → webhook grants a `PURCHASE` entitlement. Built + verified in **Stripe TEST mode**; user reviews, adds live keys, merges.

**Architecture:** Auth.js stays; User↔Stripe via `stripeCustomerId`. `createCheckoutSession` (Server Action, `requireUser`) → hosted Checkout with `metadata {userId, projectId}`. `/api/stripe/webhook` verifies the signature and, on `checkout.session.completed`, upserts the Phase-2 `Entitlement(source: PURCHASE)` — idempotently, never trusting the client redirect. Waitlist stays as the fallback when a project has no price.

**Tech Stack:** Next.js 16 App Router (RSC + Server Actions), Auth.js v5, Prisma 7 + Neon, `stripe` Node SDK, Vitest 4.

**Design doc:** `docs/plans/2026-06-08-stripe-payments-design.md`.

> **PREREQUISITES (user-provided): a Stripe account + `STRIPE_SECRET_KEY` (test) + `STRIPE_WEBHOOK_SECRET` (Stripe CLI for local, dashboard endpoint for prod).** Build off the post-Phase-2 `main`.
>
> **BUILD-SAFETY (hard rule — learned from the Phase 1 sitemap CI break):** the Stripe client MUST be lazily constructed (never throw at import), and `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` are **optional** env vars. A `next build` / CI with no keys must still pass. The checkout/webhook routes are dynamic (request + secrets) so they won't be prerendered. Honor the schema-change discipline (full tsc + full vitest after the migration).

---

# PR A — Payments core

## Task A1: schema + env
**Files:** `prisma/schema.prisma`; `prisma/migrations/<ts>_stripe_payments/migration.sql`; `src/env.ts`
- `User.stripeCustomerId String? @unique`; `Project.stripePriceId String?` + `priceCents Int?`; new `model ProcessedStripeEvent { eventId String @id; type String; createdAt DateTime @default(now()) }`.
- Hand-author the migration SQL (add columns + the table + the unique index on `stripeCustomerId`). `prisma migrate deploy` to prod Neon → `prisma generate`.
- `env.ts`: add `STRIPE_SECRET_KEY: z.string().optional()` and `STRIPE_WEBHOOK_SECRET: z.string().optional()` (server). Do NOT make them required.
- **Discipline:** full `tsc` + full `pnpm vitest run` (green). **Commit.**

## Task A2: lazy Stripe client + customer
**Files:** `src/lib/stripe.ts`; `src/lib/__tests__/stripe.test.ts`
- `getStripe(): Stripe` — lazily `new Stripe(env.STRIPE_SECRET_KEY)`, **throwing a clear "Payments are not configured" only when CALLED** without a key (never at import). Cache the instance.
- `ensureStripeCustomer(user): Promise<string>` — return existing `stripeCustomerId`, else create a Stripe Customer (email + `metadata.userId`) and persist it.
- **TDD:** `getStripe()` throws a friendly error when the key is unset (mock env); returns a singleton when set. `ensureStripeCustomer` reuses an existing id (mock the stripe client). **Commit.**

## Task A3: createCheckoutSession action
**Files:** `src/lib/actions/checkout.ts`; `src/lib/__tests__/checkout-actions.test.ts`
- `createCheckoutSession({ projectId })` — `requireUser`; load the project; refuse if not `PREMIUM` or `stripePriceId` is null ("not purchasable"); `ensureStripeCustomer`; `getStripe().checkout.sessions.create({ mode: "payment", line_items: [{ price: stripePriceId, quantity: 1 }], customer, success_url, cancel_url, metadata: { userId, projectId } })`; return `{ url }`.
- **TDD** (mock `getStripe` + `requireUser`): refuses non-PREMIUM / no-price; passes the right `price`, `customer`, and `metadata`; returns the session url. **Commit.**

## Task A4: webhook + grant (idempotent)
**Files:** `src/app/api/stripe/webhook/route.ts`; `src/lib/stripe-webhook.ts` (pure helper) + test
- Pure `entitlementFromCheckoutSession(session): { userId, projectId } | null` — read `metadata`; null if missing. **TDD** it.
- Route `POST`: read the **raw body** + `stripe-signature` header; `getStripe().webhooks.constructEvent(raw, sig, env.STRIPE_WEBHOOK_SECRET)` (400 on failure / missing secret); if `event.type === "checkout.session.completed"`: idempotency — `ProcessedStripeEvent.create({ eventId: event.id })` in a try/catch (a unique-violation = already processed → 200 no-op); then `entitlementFromCheckoutSession` → `entitlement.upsert({ userId_projectId }, source: PURCHASE)`. Always 200 on handled/ignored events. (Use `export const runtime = "nodejs"` + raw body via `await req.text()`.)
- **TDD** the route where practical (construct a signed test event via the Stripe SDK's test helper, or unit-test the handler logic with the verify mocked): valid event grants once; a redelivered event id is a no-op; a bad signature → 400. **Commit.**

## Task A5: setProjectPrice admin action
**Files:** `src/lib/actions/project-price.ts`; test
- `setProjectPrice({ projectId, priceCents })` — `requireAdmin`; Zod (`priceCents` positive int); create a Stripe Product + a one-time `Price` (currency usd, `unit_amount: priceCents`); store `stripePriceId` + `priceCents` on the project; `revalidatePath`. (Idempotent-ish: if a price already exists you may create a new one and overwrite the stored id — fine for v1.)
- **TDD** (mock stripe + requireAdmin): admin-gated; creates a price and stores the id. **Commit.**

## Task A6: PR A verify
Full `tsc` + full `vitest`. **Commit/checkpoint.**

---

# PR B — Buy UI + price admin + success

## Task B1: BuyButton + Paywall wiring
**Files:** `src/components/learn/BuyButton.tsx`; `src/components/learn/Paywall.tsx`
- `BuyButton` (client island): props `{ projectId, priceCents }`; on click → `createCheckoutSession({ projectId })` (transition) → `window.location.href = url`; error state.
- `Paywall`: accept `stripePriceId?` + `priceCents?`; render `<BuyButton>` ("Unlock $X.XX") when a price exists, else the existing `<WaitlistForm>`. The card page already renders `<Paywall>` on the `paywall` decision — thread the project's `stripePriceId`/`priceCents` to it. **Verify tsc + commit.**

## Task B2: success route + price display
**Files:** a success target (e.g. `src/app/learn/page.tsx` banner on `?purchased=`, or a small `/purchase/success` page)
- After Checkout redirect, show a confirmation; the page re-checks access (the webhook has/will grant). Keep it simple. **Commit.**

## Task B3: "Set price" admin control
**Files:** the project admin page (`src/app/projects/[slug]/page.tsx`) + a small client form
- An admin-only "Set price" input (dollars) → `setProjectPrice`. Shows the current price. (This page is already admin-gated by the route guard.) **Verify tsc + commit.**

## Task B4: verify + manual (TEST mode) + ship
- Full `tsc` + full `vitest`.
- **Manual, TEST mode:** set `STRIPE_SECRET_KEY` (sk_test) locally; run `stripe listen --forward-to localhost:3000/api/stripe/webhook` → put its `whsec_` in `STRIPE_WEBHOOK_SECRET`; flag a throwaway project PREMIUM + `setProjectPrice`; click Buy → pay with `4242 4242 4242 4242` → confirm an `Entitlement(PURCHASE)` row appears and the premium cards unlock; redeliver the event (Stripe CLI) → confirm no double-grant.
- Open the PR. **The user reviews, adds live keys + the prod dashboard webhook, and merges/goes live.**

---

## Notes / risks
- `main` auto-deploys to prod — but with no live keys set, the payment paths are inert (the actions throw "not configured"); safe to merge before go-live.
- The webhook endpoint must be added in the Stripe **dashboard** for prod (the CLI is local-only) and its `whsec_` set in Vercel env.
- Idempotency is double-layered: the `ProcessedStripeEvent` id + the `Entitlement` `[userId, projectId]` unique.
- Out of scope: subscriptions, refunds/cancellation, multi-currency, tax (Stripe Tax) — later.
