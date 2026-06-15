-- One-time "Support the Academy" tip (GTM). NOT a course purchase — grants no
-- entitlement; recorded by the Stripe webhook from a paid
-- checkout.session.completed carrying metadata.kind = 'tip'. The amount is taken
-- from Stripe (amount_total), never the client. `stripeSessionId` UNIQUE makes a
-- webhook redelivery a no-op; `userId` is nullable (guest tips) and ON DELETE SET
-- NULL keeps the accounting row if the user is deleted. IF NOT EXISTS / guarded
-- constraint keep re-runs safe.
CREATE TABLE IF NOT EXISTS "Tip" (
    "id" TEXT NOT NULL,
    "stripeSessionId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Tip_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Tip_stripeSessionId_key" ON "Tip"("stripeSessionId");
CREATE INDEX IF NOT EXISTS "Tip_userId_idx" ON "Tip"("userId");

DO $$ BEGIN
  ALTER TABLE "Tip" ADD CONSTRAINT "Tip_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
