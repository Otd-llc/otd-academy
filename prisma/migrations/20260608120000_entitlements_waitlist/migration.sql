-- GTM Phase 2: per-project access entitlements + anonymous premium waitlist.
-- Additive: two new tables + one enum, no change to existing rows.
CREATE TYPE "EntitlementSource" AS ENUM ('GRANT', 'PURCHASE');

CREATE TABLE "Entitlement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "bundleId" TEXT,
    "source" "EntitlementSource" NOT NULL DEFAULT 'GRANT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Entitlement_pkey" PRIMARY KEY ("id"),
    -- owner XOR: exactly one of projectId / bundleId is set (mirrors artifact-owner-xor)
    CONSTRAINT "entitlement_owner_xor" CHECK (("projectId" IS NOT NULL) <> ("bundleId" IS NOT NULL))
);

CREATE UNIQUE INDEX "Entitlement_userId_projectId_key" ON "Entitlement"("userId", "projectId");
CREATE INDEX "Entitlement_userId_idx" ON "Entitlement"("userId");

ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WaitlistSignup" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WaitlistSignup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WaitlistSignup_email_projectId_key" ON "WaitlistSignup"("email", "projectId");

ALTER TABLE "WaitlistSignup" ADD CONSTRAINT "WaitlistSignup_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
