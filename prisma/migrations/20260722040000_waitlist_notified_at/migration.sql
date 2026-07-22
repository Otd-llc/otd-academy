-- Waitlist launch-notify (audit Phase 3 / Task 3.4). The course pages promise
-- "we'll email you the moment it goes live", but WaitlistSignup rows were a
-- dead store no send path ever read. notifiedAt is the once-only ledger for
-- that promised email: null = owed when the course publishes, timestamp = sent.
ALTER TABLE "WaitlistSignup" ADD COLUMN "notifiedAt" TIMESTAMP(3);
