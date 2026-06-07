-- Optional, server-scored board exam. Passing confers MASTERED on the
-- enrollment (Slice 3). The questions Json holds the answer key server-side;
-- getExam strips correctIndex before sending to the client.

CREATE TABLE "Exam" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL UNIQUE REFERENCES "Project"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "passThreshold" INTEGER NOT NULL,
  "questions" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "ExamResult" (
  "id" TEXT PRIMARY KEY,
  "examId" TEXT NOT NULL REFERENCES "Exam"("id") ON DELETE CASCADE,
  "enrollmentId" TEXT NOT NULL REFERENCES "Enrollment"("id") ON DELETE CASCADE,
  "score" INTEGER NOT NULL,
  "total" INTEGER NOT NULL,
  "passed" BOOLEAN NOT NULL,
  "answers" JSONB,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ExamResult_enrollmentId_idx" ON "ExamResult"("enrollmentId");
