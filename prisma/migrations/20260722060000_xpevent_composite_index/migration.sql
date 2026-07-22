-- Covering composite for the per-answer firstEver guard (audit Phase 8): the XP
-- award path filters XpEvent by (userId, source, refId), but only (source,
-- refId) was indexed — a scan that widens with total answer history on a shared
-- refId (a questionKey answered by many learners). Plain CREATE INDEX (not
-- CONCURRENTLY — prisma migrate deploy applies each migration in a transaction;
-- the table is small so the brief lock is fine).
CREATE INDEX "XpEvent_userId_source_refId_idx"
  ON "XpEvent" ("userId", "source", "refId");
