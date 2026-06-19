-- AlterTable
ALTER TABLE "Part" ADD COLUMN IF NOT EXISTS "dkStockQty" INTEGER,
ADD COLUMN IF NOT EXISTS "dkUnitPriceCents" INTEGER,
ADD COLUMN IF NOT EXISTS "dkInStock" BOOLEAN,
ADD COLUMN IF NOT EXISTS "dkLifecycle" TEXT,
ADD COLUMN IF NOT EXISTS "dkProductUrl" TEXT,
ADD COLUMN IF NOT EXISTS "dkCheckedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PartAvailabilityEvent" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fromValue" TEXT,
    "toValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PartAvailabilityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PartAvailabilityEvent_partId_createdAt_idx" ON "PartAvailabilityEvent"("partId", "createdAt");
CREATE INDEX IF NOT EXISTS "PartAvailabilityEvent_createdAt_idx" ON "PartAvailabilityEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "PartAvailabilityEvent" ADD CONSTRAINT "PartAvailabilityEvent_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;
