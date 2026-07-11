-- Course XP (Logbook Phase 2): new XpSource enum values (design 2026-07-11).
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block, so this
-- migration contains ONLY these statements (no other DDL).

ALTER TYPE "XpSource" ADD VALUE 'STAGE_QUIZ_CORRECT';
ALTER TYPE "XpSource" ADD VALUE 'STAGE_CLEAR';
ALTER TYPE "XpSource" ADD VALUE 'COURSE_EXAM_PASS';
ALTER TYPE "XpSource" ADD VALUE 'COURSE_COMPLETE';
