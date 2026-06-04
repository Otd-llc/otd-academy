-- CreateEnum
CREATE TYPE "PartAssetKind" AS ENUM ('SYMBOL', 'FOOTPRINT', 'MODEL_3D');

-- CreateTable
CREATE TABLE "PartAsset" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "kind" "PartAssetKind" NOT NULL,
    "r2Key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "ref" TEXT,
    "source" TEXT,
    "license" TEXT,
    "trust" "FactTrust" NOT NULL DEFAULT 'UNVERIFIED',
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "lastEditedById" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PartAsset_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "PartAsset_partId_kind_key" ON "PartAsset"("partId", "kind");
CREATE INDEX "PartAsset_trust_idx" ON "PartAsset"("trust");

-- FKs
ALTER TABLE "PartAsset" ADD CONSTRAINT "PartAsset_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartAsset" ADD CONSTRAINT "PartAsset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
