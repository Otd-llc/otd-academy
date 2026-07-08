-- Billing: chargeback / dispute audit. One new empty table (charge.dispute.*).
-- Additive — no existing row is touched. IF NOT EXISTS keeps re-runs safe.
CREATE TABLE IF NOT EXISTS "Dispute" (
    "id" TEXT NOT NULL,
    "stripeDisputeId" TEXT NOT NULL,
    "stripeChargeId" TEXT NOT NULL,
    "purchaseId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Dispute_stripeDisputeId_key" ON "Dispute"("stripeDisputeId");
CREATE INDEX IF NOT EXISTS "Dispute_stripeChargeId_idx" ON "Dispute"("stripeChargeId");
CREATE INDEX IF NOT EXISTS "Dispute_purchaseId_idx" ON "Dispute"("purchaseId");
