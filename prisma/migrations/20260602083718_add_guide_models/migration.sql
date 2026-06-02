-- CreateTable
CREATE TABLE "Guide" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "trackSnapshot" "CurriculumTrack",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "Guide_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuideCard" (
    "id" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "stage" "Stage" NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "eyebrow" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "lead" TEXT,
    "contentBlocks" JSONB NOT NULL,
    "isGate" BOOLEAN NOT NULL DEFAULT false,
    "completionRef" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuideCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Guide_revisionId_key" ON "Guide"("revisionId");

-- CreateIndex
CREATE INDEX "GuideCard_guideId_idx" ON "GuideCard"("guideId");

-- CreateIndex
CREATE UNIQUE INDEX "GuideCard_guideId_ordinal_key" ON "GuideCard"("guideId", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "GuideCard_guideId_stage_key" ON "GuideCard"("guideId", "stage");

-- AddForeignKey
ALTER TABLE "Guide" ADD CONSTRAINT "Guide_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "Revision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guide" ADD CONSTRAINT "Guide_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuideCard" ADD CONSTRAINT "GuideCard_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "Guide"("id") ON DELETE CASCADE ON UPDATE CASCADE;
