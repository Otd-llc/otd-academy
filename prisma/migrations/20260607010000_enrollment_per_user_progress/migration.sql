-- Per-user progress: Enrollment carries each learner's own currentStage.
-- QuizPass is re-keyed from (revisionId) to (enrollmentId). Existing per-revision
-- passes are migrated to an Enrollment owned by the project's creator (ADMIN)
-- against that revision, then re-pointed.

CREATE TYPE "EnrollmentStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'MASTERED');

CREATE TABLE "Enrollment" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "revisionId" TEXT NOT NULL REFERENCES "Revision"("id") ON DELETE RESTRICT,
  "currentStage" "Stage" NOT NULL DEFAULT 'REQUIREMENTS',
  "currentStageEnteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "EnrollmentStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "masteredAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "Enrollment_userId_projectId_key" ON "Enrollment"("userId", "projectId");
CREATE INDEX "Enrollment_userId_idx" ON "Enrollment"("userId");

ALTER TABLE "Project" ADD COLUMN "publishedRevisionId" TEXT;
ALTER TABLE "Project" ADD CONSTRAINT "Project_publishedRevisionId_fkey"
  FOREIGN KEY ("publishedRevisionId") REFERENCES "Revision"("id") ON DELETE SET NULL;
CREATE UNIQUE INDEX "Project_publishedRevisionId_key" ON "Project"("publishedRevisionId");

ALTER TABLE "Artifact" ADD COLUMN "enrollmentId" TEXT;
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE;
CREATE INDEX "Artifact_enrollmentId_idx" ON "Artifact"("enrollmentId");

-- ── QuizPass re-key ────────────────────────────────────────────────────────
ALTER TABLE "QuizPass" ADD COLUMN "enrollmentId" TEXT;

-- One Enrollment per (project creator, project) against the revision that holds
-- the existing passes. gen_random_uuid() is fine for a backfill PK.
INSERT INTO "Enrollment" ("id", "userId", "projectId", "revisionId", "currentStage", "status")
SELECT gen_random_uuid()::text, p."createdById", p."id", r."id", r."currentStage", 'IN_PROGRESS'
FROM (SELECT DISTINCT q."revisionId" FROM "QuizPass" q) src
JOIN "Revision" r ON r."id" = src."revisionId"
JOIN "Project"  p ON p."id" = r."projectId"
ON CONFLICT ("userId", "projectId") DO NOTHING;

UPDATE "QuizPass" q SET "enrollmentId" = e."id"
FROM "Revision" r
JOIN "Enrollment" e ON e."revisionId" = r."id"
WHERE q."revisionId" = r."id";

-- Drop any passes that could not be mapped (e.g. a project with passes on a
-- second revision, where ON CONFLICT skipped the enrollment).
DELETE FROM "QuizPass" WHERE "enrollmentId" IS NULL;

ALTER TABLE "QuizPass" ALTER COLUMN "enrollmentId" SET NOT NULL;
ALTER TABLE "QuizPass" ADD CONSTRAINT "QuizPass_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE;
DROP INDEX IF EXISTS "QuizPass_revisionId_stage_key";
DROP INDEX IF EXISTS "QuizPass_revisionId_idx";
ALTER TABLE "QuizPass" DROP COLUMN "revisionId";
CREATE UNIQUE INDEX "QuizPass_enrollmentId_stage_key" ON "QuizPass"("enrollmentId", "stage");
CREATE INDEX "QuizPass_enrollmentId_idx" ON "QuizPass"("enrollmentId");
