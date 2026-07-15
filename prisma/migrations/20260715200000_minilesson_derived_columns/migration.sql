-- MiniLesson derived columns (2026-07-15): readingMinutes / questionCount /
-- diagramSrc, all derived from contentBlocks. Additive + defaulted, so it is safe
-- against the running deploy: existing code simply ignores the new columns.
--
-- The DEFAULTS ARE PLACEHOLDERS and must not be trusted. They are backfilled
-- immediately after this migration by:
--     pnpm exec tsx scripts/backfill-lesson-derived.ts
-- (the derivation is JS -- markdown word-counting and zod-validated quiz parsing --
-- so it cannot be expressed as a SQL DEFAULT or a generated column).
--
-- Thereafter the client extension in src/lib/db.ts keeps them fresh on every
-- create/update/upsert that carries contentBlocks, and a vitest drift guard fails
-- the build if any stored value stops matching a fresh derive.
--
-- See docs/plans/2026-07-15-library-derived-columns.md.

ALTER TABLE "MiniLesson" ADD COLUMN "readingMinutes" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "MiniLesson" ADD COLUMN "questionCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MiniLesson" ADD COLUMN "diagramSrc" TEXT;
