-- Logbook: XP ledger + milestones + locks + badges + feedback (design 2026-07-11)

CREATE TYPE "XpSource" AS ENUM ('QUIZ_CORRECT','LESSON_COMPLETE','CLUSTER_COMPLETE','LIBRARY_COMPLETE','FEEDBACK_SUBMIT','FEEDBACK_USEFUL');
CREATE TYPE "FeedbackStatus" AS ENUM ('NEW','USEFUL','DISMISSED');

ALTER TABLE "User"
  ADD COLUMN "xpTotal" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "level" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "currentThrough" DATE,
  ADD COLUMN "logbookIntroSeenAt" TIMESTAMP(3);

CREATE TABLE "XpEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "source" "XpSource" NOT NULL,
  "amount" INTEGER NOT NULL,
  "refId" TEXT,
  "earnedOn" DATE NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "XpEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "XpEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "XpEvent_dedupeKey_key" ON "XpEvent"("dedupeKey");
CREATE INDEX "XpEvent_userId_idx" ON "XpEvent"("userId");
CREATE INDEX "XpEvent_source_refId_idx" ON "XpEvent"("source", "refId");

CREATE TABLE "LessonCompletion" (
  "userId" TEXT NOT NULL,
  "lessonSlug" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LessonCompletion_pkey" PRIMARY KEY ("userId","lessonSlug"),
  CONSTRAINT "LessonCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "QuizLock" (
  "userId" TEXT NOT NULL,
  "questionKey" TEXT NOT NULL,
  "lockedOn" DATE NOT NULL,
  CONSTRAINT "QuizLock_pkey" PRIMARY KEY ("userId","questionKey","lockedOn"),
  CONSTRAINT "QuizLock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "BadgeEarned" (
  "userId" TEXT NOT NULL,
  "badgeKey" TEXT NOT NULL,
  "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "meta" JSONB,
  CONSTRAINT "BadgeEarned_pkey" PRIMARY KEY ("userId","badgeKey"),
  CONSTRAINT "BadgeEarned_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "LessonFeedback" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "pageRef" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LessonFeedback_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LessonFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "LessonFeedback_status_idx" ON "LessonFeedback"("status");
CREATE INDEX "LessonFeedback_userId_pageRef_idx" ON "LessonFeedback"("userId","pageRef");
