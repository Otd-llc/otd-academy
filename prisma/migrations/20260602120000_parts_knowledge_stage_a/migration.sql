-- CreateEnum
CREATE TYPE "PartCategory" AS ENUM ('RF_MODULE', 'LDO_REGULATOR', 'USB_UART_IC', 'MLCC_CAPACITOR', 'USB_CONNECTOR', 'PASSIVE_RESISTOR');

-- CreateEnum
CREATE TYPE "PartFactGroup" AS ENUM ('PARAMETRICS', 'PINOUT', 'POWER', 'DERATING', 'MECHANICAL', 'NOTES');

-- CreateEnum
CREATE TYPE "FactTrust" AS ENUM ('UNVERIFIED', 'VERIFIED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "FactSourceKind" AS ENUM ('DATASHEET', 'MANUAL', 'API');

-- AlterTable
-- Migrate the existing free-text `Part.category` to the new `PartCategory` enum
-- IN PLACE (no DROP COLUMN — that would lose data). The parts library is
-- sparse/pilot-seeded; any existing value that is not one of the canonical
-- enum tokens is cast to NULL. The pilot seed (Task 10) writes canonical
-- tokens. The existing "Part_category_idx" btree index is preserved/rebuilt
-- automatically by the ALTER COLUMN TYPE, so it is NOT recreated here.
ALTER TABLE "Part" ALTER COLUMN "category" TYPE "PartCategory" USING (
  CASE
    WHEN "category" IN (
      'RF_MODULE', 'LDO_REGULATOR', 'USB_UART_IC',
      'MLCC_CAPACITOR', 'USB_CONNECTOR', 'PASSIVE_RESISTOR'
    ) THEN "category"::"PartCategory"
    ELSE NULL
  END
);

-- CreateTable
CREATE TABLE "PartDatasheet" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "r2Key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartDatasheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartFact" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "group" "PartFactGroup" NOT NULL,
    "data" JSONB NOT NULL,
    "trust" "FactTrust" NOT NULL DEFAULT 'UNVERIFIED',
    "sourceKind" "FactSourceKind" NOT NULL DEFAULT 'DATASHEET',
    "partDatasheetId" TEXT,
    "sourcePage" INTEGER,
    "sourceUrl" TEXT,
    "sourceNote" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "lastEditedById" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartFact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartDatasheet_partId_key" ON "PartDatasheet"("partId");

-- CreateIndex
CREATE INDEX "PartFact_trust_idx" ON "PartFact"("trust");

-- CreateIndex
CREATE UNIQUE INDEX "PartFact_partId_group_key" ON "PartFact"("partId", "group");

-- AddForeignKey
ALTER TABLE "PartDatasheet" ADD CONSTRAINT "PartDatasheet_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartFact" ADD CONSTRAINT "PartFact_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;
