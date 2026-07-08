-- Billing phase 2: subscriptions, invoices, refunds. All ADDITIVE — three new
-- empty tables, two nullable Bundle columns, one new enum value. No existing row is
-- touched or rewritten. IF NOT EXISTS + guarded constraints keep re-runs safe.

-- New Entitlement source: an active recurring subscription mints/revokes a bundle
-- Entitlement carrying source SUBSCRIPTION (distinct from a one-time PURCHASE, so a
-- sub cancel never removes a purchased Pass). ADD VALUE is safe here: nothing in
-- this migration USES the new value (Postgres only forbids using an added enum
-- value in the same transaction, not adding it). Neon is PG15+, so ADD VALUE runs
-- inside the migration transaction fine.
ALTER TYPE "EntitlementSource" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION';

-- Recurring-price columns on the existing (all-access) Bundle. Null until
-- set-subscription-price.ts provisions the recurring Stripe price.
ALTER TABLE "Bundle" ADD COLUMN IF NOT EXISTS "subscriptionPriceId" TEXT;
ALTER TABLE "Bundle" ADD COLUMN IF NOT EXISTS "subscriptionPriceCents" INTEGER;

-- Subscription — mirror of a Stripe Subscription. Upserted by
-- customer.subscription.created|updated|deleted. `status` is Stripe's string
-- verbatim (no enum mirror). userId SET NULL so the audit row survives a hard
-- user delete.
CREATE TABLE IF NOT EXISTS "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "stripeSubscriptionId" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "stripePriceId" TEXT,
    "stripeProductId" TEXT,
    "status" TEXT NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");
CREATE INDEX IF NOT EXISTS "Subscription_userId_idx" ON "Subscription"("userId");
DO $$ BEGIN
  ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Invoice — a paid subscription invoice (invoice.paid only). Write-once. The FK to
-- Subscription is SET NULL and resolved lazily (an invoice.paid can arrive before
-- the subscription.created upsert); stripeSubscriptionId is indexed for the
-- backfill UPDATE the subscription upsert runs.
CREATE TABLE IF NOT EXISTS "Invoice" (
    "id" TEXT NOT NULL,
    "stripeInvoiceId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT,
    "subscriptionId" TEXT,
    "userId" TEXT,
    "stripeCustomerId" TEXT,
    "amountPaidCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "metadata" JSONB,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_stripeInvoiceId_key" ON "Invoice"("stripeInvoiceId");
CREATE INDEX IF NOT EXISTS "Invoice_userId_idx" ON "Invoice"("userId");
CREATE INDEX IF NOT EXISTS "Invoice_stripeSubscriptionId_idx" ON "Invoice"("stripeSubscriptionId");
DO $$ BEGIN
  ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Refund — one row per Stripe Refund (charge.refunded). purchaseId is a bare
-- soft-link (no FK); the Purchase is correlated via stripePaymentIntentId.
CREATE TABLE IF NOT EXISTS "Refund" (
    "id" TEXT NOT NULL,
    "stripeRefundId" TEXT NOT NULL,
    "stripeChargeId" TEXT NOT NULL,
    "purchaseId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Refund_stripeRefundId_key" ON "Refund"("stripeRefundId");
CREATE INDEX IF NOT EXISTS "Refund_stripeChargeId_idx" ON "Refund"("stripeChargeId");
CREATE INDEX IF NOT EXISTS "Refund_purchaseId_idx" ON "Refund"("purchaseId");
