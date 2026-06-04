-- CreateEnum
CREATE TYPE "NetClass" AS ENUM ('GROUND', 'POWER', 'SIGNAL');

-- CreateTable
CREATE TABLE "Net" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "netClass" "NetClass" NOT NULL,
    "trust" "FactTrust" NOT NULL DEFAULT 'UNVERIFIED',
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Net_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetNode" (
    "id" TEXT NOT NULL,
    "netId" TEXT NOT NULL,
    "refDes" TEXT NOT NULL,
    "pin" TEXT NOT NULL,

    CONSTRAINT "NetNode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Net_revisionId_idx" ON "Net"("revisionId");

-- CreateIndex
CREATE INDEX "Net_trust_idx" ON "Net"("trust");

-- CreateIndex
CREATE UNIQUE INDEX "Net_revisionId_name_key" ON "Net"("revisionId", "name");

-- CreateIndex
CREATE INDEX "NetNode_netId_idx" ON "NetNode"("netId");

-- CreateIndex
CREATE UNIQUE INDEX "NetNode_netId_refDes_pin_key" ON "NetNode"("netId", "refDes", "pin");

-- AddForeignKey
ALTER TABLE "Net" ADD CONSTRAINT "Net_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "Revision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Net" ADD CONSTRAINT "Net_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetNode" ADD CONSTRAINT "NetNode_netId_fkey" FOREIGN KEY ("netId") REFERENCES "Net"("id") ON DELETE CASCADE ON UPDATE CASCADE;
