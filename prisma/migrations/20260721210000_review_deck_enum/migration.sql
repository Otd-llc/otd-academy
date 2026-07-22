-- Review deck XpSource value (step 4, 2026-07-21). ALTER TYPE ... ADD VALUE cannot
-- run inside a transaction block, so this migration contains ONLY this statement
-- (no other DDL). The tables live in the next migration.

ALTER TYPE "XpSource" ADD VALUE 'REVIEW_CORRECT';
