-- Email hygiene across the four tables that hold an address outside User.
--
-- An email address is case-insensitive in practice and case-sensitive in these
-- columns: `Ravi@x.com` and `ravi@x.com` were two PassWaitlist rows, two
-- HexReleaseNotify rows, two WaitlistSignup rows for the same course, and the
-- "one row per address" promise every upsert in src/lib/actions makes was only
-- true for people who type consistently. Downstream that is one person getting
-- two digests, one unsubscribe removing half their rows, and one account
-- delete missing the capitalised copy.
--
-- Three steps per table, in this order, so the index can be created at all:
--   1. merge case-duplicates into the EARLIEST row (smallest createdAt; ties by
--      id): userId and notifiedAt take any non-null value across the group,
--      release stays the earliest row's. Then delete the later rows.
--   2. lowercase every address.
--   3. a UNIQUE index on lower(email) (plus projectId for WaitlistSignup), so a
--      future write path that forgets to lowercase is refused by the database
--      rather than quietly re-creating the pair. The plain unique index on
--      `email` stays: Prisma's findUnique/upsert key on it.
--
-- Tip is lowercased only. Its key is stripeSessionId and one address may tip
-- more than once; a unique on the address would be wrong there.
--
-- Hand-authored, applied with `prisma migrate deploy` (never `migrate dev`).
-- Exercised on a local copy of production with planted duplicates before it
-- was applied to production; production itself held zero duplicates and zero
-- mixed-case rows on 2026-10-01, so steps 1 and 2 are a no-op there and step 3
-- is the point.
--
-- The functional indexes are invisible to the Prisma schema (it cannot express
-- lower()). They are documented beside each model in schema.prisma; nothing in
-- this repo diffs the schema against the database, so they are not at risk of
-- being "corrected" away.

-- ── PassWaitlist ───────────────────────────────────────────────────────────

WITH ranked AS (
  SELECT id, lower(email) AS k, "userId",
         row_number() OVER (PARTITION BY lower(email) ORDER BY "createdAt", id) AS rn
  FROM "PassWaitlist"
),
merged AS (
  SELECT k, max("userId") AS "userId" FROM ranked GROUP BY k
)
UPDATE "PassWaitlist" p
SET "userId" = COALESCE(p."userId", m."userId")
FROM ranked r JOIN merged m ON m.k = r.k
WHERE p.id = r.id AND r.rn = 1;

DELETE FROM "PassWaitlist" p
USING (
  SELECT id, row_number() OVER (PARTITION BY lower(email) ORDER BY "createdAt", id) AS rn
  FROM "PassWaitlist"
) r
WHERE p.id = r.id AND r.rn > 1;

UPDATE "PassWaitlist" SET email = lower(email) WHERE email <> lower(email);

CREATE UNIQUE INDEX "PassWaitlist_lower_email_key" ON "PassWaitlist" (lower(email));

-- deleteStudent removes a learner's capture rows by userId as well as by
-- address; both tables carried the column with no index on it.
CREATE INDEX "PassWaitlist_userId_idx" ON "PassWaitlist"("userId");

-- ── HexReleaseNotify ───────────────────────────────────────────────────────

WITH ranked AS (
  SELECT id, lower(email) AS k, "userId", "notifiedAt",
         row_number() OVER (PARTITION BY lower(email) ORDER BY "createdAt", id) AS rn
  FROM "HexReleaseNotify"
),
merged AS (
  SELECT k, max("userId") AS "userId", max("notifiedAt") AS "notifiedAt" FROM ranked GROUP BY k
)
UPDATE "HexReleaseNotify" h
SET "userId"     = COALESCE(h."userId", m."userId"),
    "notifiedAt" = COALESCE(h."notifiedAt", m."notifiedAt")
FROM ranked r JOIN merged m ON m.k = r.k
WHERE h.id = r.id AND r.rn = 1;

DELETE FROM "HexReleaseNotify" h
USING (
  SELECT id, row_number() OVER (PARTITION BY lower(email) ORDER BY "createdAt", id) AS rn
  FROM "HexReleaseNotify"
) r
WHERE h.id = r.id AND r.rn > 1;

UPDATE "HexReleaseNotify" SET email = lower(email) WHERE email <> lower(email);

CREATE UNIQUE INDEX "HexReleaseNotify_lower_email_key" ON "HexReleaseNotify" (lower(email));

CREATE INDEX "HexReleaseNotify_userId_idx" ON "HexReleaseNotify"("userId");

-- ── WaitlistSignup (keyed per course) ──────────────────────────────────────

WITH ranked AS (
  SELECT id, lower(email) AS k, "projectId", "notifiedAt",
         row_number() OVER (PARTITION BY lower(email), "projectId" ORDER BY "createdAt", id) AS rn
  FROM "WaitlistSignup"
),
merged AS (
  SELECT k, "projectId", max("notifiedAt") AS "notifiedAt" FROM ranked GROUP BY k, "projectId"
)
UPDATE "WaitlistSignup" w
SET "notifiedAt" = COALESCE(w."notifiedAt", m."notifiedAt")
FROM ranked r JOIN merged m ON m.k = r.k AND m."projectId" = r."projectId"
WHERE w.id = r.id AND r.rn = 1;

DELETE FROM "WaitlistSignup" w
USING (
  SELECT id, row_number() OVER (PARTITION BY lower(email), "projectId" ORDER BY "createdAt", id) AS rn
  FROM "WaitlistSignup"
) r
WHERE w.id = r.id AND r.rn > 1;

UPDATE "WaitlistSignup" SET email = lower(email) WHERE email <> lower(email);

CREATE UNIQUE INDEX "WaitlistSignup_lower_email_projectId_key"
  ON "WaitlistSignup" (lower(email), "projectId");

-- ── Tip ────────────────────────────────────────────────────────────────────

UPDATE "Tip" SET email = lower(email) WHERE email IS NOT NULL AND email <> lower(email);
