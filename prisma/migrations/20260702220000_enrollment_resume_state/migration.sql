-- Cross-device resume position on Enrollment (guide-pacing plan, Task 7).
-- Nullable/additive → safe to deploy against prod with no backfill.
ALTER TABLE "Enrollment" ADD COLUMN "resumeState" JSONB;
