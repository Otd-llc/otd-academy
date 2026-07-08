-- MiniLesson clustering: which Field Guide a lesson belongs to (`cluster`) and its
-- order within that cluster (`clusterOrdinal`). Additive + nullable/defaulted, so
-- non-breaking. The backfill UPDATEs below run IN this migration (NOT a seed
-- script) on purpose: `prisma migrate deploy` runs against prod, the test pool,
-- and CI's per-branch migrate uniformly, so the eeg-bci cluster values reach all
-- three. A seed script would touch prod only, leaving every non-prod DB with
-- cluster=null and contradicting "clusterOrdinal is the single source of truth".
ALTER TABLE "MiniLesson" ADD COLUMN "cluster" TEXT;
ALTER TABLE "MiniLesson" ADD COLUMN "clusterOrdinal" INTEGER NOT NULL DEFAULT 0;

-- Backfill the 12 existing EEG/BCI lessons: cluster = 'eeg-bci', clusterOrdinal
-- 0..11 copied VERBATIM from the curated narrative arc (formerly
-- LIBRARY_NARRATIVE_ORDER in src/lib/library/narrative-order.ts, retired by this
-- change). After this, clusterOrdinal is the single source of truth for
-- within-cluster order. One UPDATE per slug, in arc sequence.
UPDATE "MiniLesson" SET "cluster" = 'eeg-bci', "clusterOrdinal" = 0  WHERE "slug" = 'what-is-a-bci';
UPDATE "MiniLesson" SET "cluster" = 'eeg-bci', "clusterOrdinal" = 1  WHERE "slug" = 'what-is-eeg';
UPDATE "MiniLesson" SET "cluster" = 'eeg-bci', "clusterOrdinal" = 2  WHERE "slug" = 'eeg-bci-guide';
UPDATE "MiniLesson" SET "cluster" = 'eeg-bci', "clusterOrdinal" = 3  WHERE "slug" = 'eeg-frequency-bands';
UPDATE "MiniLesson" SET "cluster" = 'eeg-bci', "clusterOrdinal" = 4  WHERE "slug" = 'motor-imagery-bci';
UPDATE "MiniLesson" SET "cluster" = 'eeg-bci', "clusterOrdinal" = 5  WHERE "slug" = 'eeg-electrodes-10-20-system';
UPDATE "MiniLesson" SET "cluster" = 'eeg-bci', "clusterOrdinal" = 6  WHERE "slug" = 'eeg-safety-and-isolation';
UPDATE "MiniLesson" SET "cluster" = 'eeg-bci', "clusterOrdinal" = 7  WHERE "slug" = 'biopotential-afe';
UPDATE "MiniLesson" SET "cluster" = 'eeg-bci', "clusterOrdinal" = 8  WHERE "slug" = 'ads1299-explained';
UPDATE "MiniLesson" SET "cluster" = 'eeg-bci', "clusterOrdinal" = 9  WHERE "slug" = 'eeg-noise-and-right-leg-drive';
UPDATE "MiniLesson" SET "cluster" = 'eeg-bci', "clusterOrdinal" = 10 WHERE "slug" = 'eeg-classification-csp-eegnet';
UPDATE "MiniLesson" SET "cluster" = 'eeg-bci', "clusterOrdinal" = 11 WHERE "slug" = 'control-a-drone-with-your-brain';
