-- All-Access Pass / bundle (GTM monetization). Additive: one new table, no
-- change to existing rows. A bundle purchase grants an Entitlement carrying a
-- non-null `bundleId` (the owner-XOR alternative to projectId, already allowed by
-- the existing `entitlement_owner_xor` CHECK and the nullable Entitlement.bundleId
-- column) which `hasProjectEntitlement` reads as access to every project.
--
-- `key` is the stable lookup ("all-access"). The matching Stripe Product carries
-- up to two one-time prices (standard + a time-boxed launch price); we store both
-- cents amounts plus the active Stripe price id. IF NOT EXISTS keeps re-runs safe.
CREATE TABLE IF NOT EXISTS "Bundle" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stripePriceId" TEXT,
    "priceCents" INTEGER,
    "launchPriceCents" INTEGER,
    "launchEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Bundle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Bundle_key_key" ON "Bundle"("key");
