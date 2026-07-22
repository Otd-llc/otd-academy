-- Review deck models (step 4, 2026-07-21): the QuizItem registry (a forward-only
-- snapshot of reviewable questions) and the per-user ReviewSchedule. Additive, no
-- backfill (start-fresh: schedules are created going forward from the stage-quiz
-- answer path). See docs/plans/2026-07-21-review-deck-design.md.

-- CreateTable
CREATE TABLE "QuizItem" (
    "reviewItemId" TEXT NOT NULL,
    "projectSlug" TEXT NOT NULL,
    "stage" "Stage" NOT NULL,
    "q" TEXT NOT NULL,
    "options" TEXT[],
    "answer" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizItem_pkey" PRIMARY KEY ("reviewItemId")
);

-- CreateIndex
CREATE INDEX "QuizItem_projectSlug_idx" ON "QuizItem"("projectSlug");

-- CreateTable
CREATE TABLE "ReviewSchedule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reviewItemId" TEXT NOT NULL,
    "dueOn" DATE NOT NULL,
    "intervalDays" INTEGER NOT NULL DEFAULT 1,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "suspended" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenOn" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReviewSchedule_userId_reviewItemId_key" ON "ReviewSchedule"("userId", "reviewItemId");

-- CreateIndex
CREATE INDEX "ReviewSchedule_userId_dueOn_idx" ON "ReviewSchedule"("userId", "dueOn");

-- AddForeignKey
ALTER TABLE "ReviewSchedule" ADD CONSTRAINT "ReviewSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewSchedule" ADD CONSTRAINT "ReviewSchedule_reviewItemId_fkey" FOREIGN KEY ("reviewItemId") REFERENCES "QuizItem"("reviewItemId") ON DELETE CASCADE ON UPDATE CASCADE;
