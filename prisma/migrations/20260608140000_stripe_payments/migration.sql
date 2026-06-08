ALTER TABLE "User" ADD COLUMN "stripeCustomerId" TEXT;
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");
ALTER TABLE "Project" ADD COLUMN "stripePriceId" TEXT;
ALTER TABLE "Project" ADD COLUMN "priceCents" INTEGER;
CREATE TABLE "ProcessedStripeEvent" (
  "eventId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProcessedStripeEvent_pkey" PRIMARY KEY ("eventId")
);
