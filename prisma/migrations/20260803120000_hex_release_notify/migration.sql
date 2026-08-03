-- "Tell me when the next hex release lands." Anonymous email capture, offered
-- AFTER a printables download has already started, never before it.
--
-- The ordering is the design, not a nicety. The files are CC BY 4.0 and the
-- `Source:` URL inside every published LICENSE.txt points at /hex, so a large
-- share of arrivals are following an attribution link from somebody else's
-- remix. Meeting them with a form would be hostile to the licence's own
-- purpose, and gating a set that is already one public URL away would be
-- theatre. So the download stays ungated and the ask lives on the far side.
--
-- Shaped after PassWaitlist, which solves the same problem (anonymous capture,
-- idempotent on email, userId stamped when a session happens to exist).
--
-- `release` records WHICH release was being downloaded at signup, so a future
-- "the new set is out" send can tell a first-timer from somebody already on
-- their third. `notifiedAt` is the once-only ledger for that send, the same
-- shape WaitlistSignup already uses: NULL = owed, set = sent.

CREATE TABLE "HexReleaseNotify" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "release" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "HexReleaseNotify_pkey" PRIMARY KEY ("id")
);

-- Unique on email, which is what makes the upsert in `notifyOnHexRelease` a
-- no-op for a repeat submit rather than a duplicate row or a thrown error.
CREATE UNIQUE INDEX "HexReleaseNotify_email_key" ON "HexReleaseNotify"("email");

-- The send scans for owed rows. Partial, because the rows that matter are the
-- unnotified ones and that set shrinks to nothing after each send.
CREATE INDEX "HexReleaseNotify_notifiedAt_idx" ON "HexReleaseNotify"("notifiedAt")
    WHERE "notifiedAt" IS NULL;
