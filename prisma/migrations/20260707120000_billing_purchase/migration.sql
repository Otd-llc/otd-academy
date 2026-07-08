-- Billing audit: Purchase — one row per completed Stripe payment that grants
-- access (course, Pass, pay-the-difference upgrade). Written by the webhook in the
-- SAME transaction as the grant, plus a $0 row for the zero-charge upgrade grant.
-- The audit bridge from Entitlement → Stripe and the frozen record of what was
-- actually paid (grandfathering credit reads amountTotalCents, never the current
-- catalog price). `userId` is nullable + ON DELETE SET NULL so the accounting row
-- survives a hard user delete (financial-record retention; see admin-students.ts).
-- Phase-2 columns (refundedCents, stripePromotionCodeId, stripeChargeId) ship now
-- so enabling refunds / promo codes later is code-only. IF NOT EXISTS + guarded
-- constraints keep re-runs safe.
CREATE TABLE IF NOT EXISTS "Purchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "projectId" TEXT,
    "bundleId" TEXT,
    "entitlementId" TEXT,
    "stripeSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "stripeChargeId" TEXT,
    "stripeCustomerId" TEXT,
    "stripePriceId" TEXT,
    "stripeProductId" TEXT,
    "amountTotalCents" INTEGER NOT NULL,
    "amountDiscountCents" INTEGER NOT NULL DEFAULT 0,
    "stripePromotionCodeId" TEXT,
    "refundedCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id"),
    -- every Purchase grants exactly one of a course or a bundle (mirrors entitlement_owner_xor)
    CONSTRAINT "purchase_owner_xor" CHECK (("projectId" IS NOT NULL) <> ("bundleId" IS NOT NULL)),
    -- amounts non-negative; cumulative refund never exceeds the charge
    CONSTRAINT "purchase_amount_nonneg" CHECK ("amountTotalCents" >= 0 AND "refundedCents" >= 0 AND "refundedCents" <= "amountTotalCents")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Purchase_stripeSessionId_key" ON "Purchase"("stripeSessionId");
CREATE INDEX IF NOT EXISTS "Purchase_userId_idx" ON "Purchase"("userId");
CREATE INDEX IF NOT EXISTS "Purchase_entitlementId_idx" ON "Purchase"("entitlementId");

DO $$ BEGIN
  ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Bundle idempotency (closes a pre-existing double-grant hole). One bundle
-- Entitlement per (user, bundle). FULL unique index: bundleId is null for project
-- entitlements and Postgres treats NULLs as distinct, so this does NOT constrain
-- per-project rows — it only bites when bundleId is non-null. Mirrors the
-- @@unique([userId, bundleId]) added to the Prisma model (same index name), and
-- gives the webhook / pass.ts an idempotent `upsert` target on `userId_bundleId`.
-- Verified safe on live data: PROD has 0 bundle entitlement rows, so no
-- dedup/backfill is needed and this cannot collide with existing data.
CREATE UNIQUE INDEX IF NOT EXISTS "Entitlement_userId_bundleId_key" ON "Entitlement"("userId", "bundleId");
