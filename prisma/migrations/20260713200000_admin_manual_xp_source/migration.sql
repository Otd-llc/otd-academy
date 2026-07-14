-- Admin manual XP source (2026-07-13). ALTER TYPE ... ADD VALUE cannot run inside a
-- transaction block, so this migration contains ONLY this statement (no other DDL).

ALTER TYPE "XpSource" ADD VALUE 'MANUAL_ADJUST';
