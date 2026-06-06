-- CreateTable
CREATE TABLE "QuizPass" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "stage" "Stage" NOT NULL,
    "score" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "passedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizPass_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QuizPass_revisionId_stage_key" ON "QuizPass"("revisionId", "stage");

-- CreateIndex
CREATE INDEX "QuizPass_revisionId_idx" ON "QuizPass"("revisionId");

-- AddForeignKey
ALTER TABLE "QuizPass" ADD CONSTRAINT "QuizPass_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "Revision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
