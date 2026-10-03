-- Double opt-in for the three anonymous email captures (hex-v2 next plan P.5;
-- owner R2-4 / R3-7: grandfather, inline send, feature-off switch, 7 d / 12 mo).
--
-- An address typed into a form is not yet a person who asked to hear from us:
-- anyone can type anyone's address. From here a new row starts UNCONFIRMED and
-- becomes a subscriber only when the confirmation link's page is submitted
-- (POST, never GET: mail scanners follow links). Until then nothing is sent to
-- it beyond the one confirmation, the lifecycle cron deletes it after 7 days,
-- and no digest or union across tables may include it.
--
--   confirmedAt    set by the confirm route; the gate every send checks.
--   confirmSentAt  ledger for the inline confirmation send, so a repeat submit
--                  within a day re-sends nothing (a per-address rate rule sits
--                  in front of it as well).
--
-- GRANDFATHERED: every row that exists at this migration is confirmed as of
-- its own createdAt. These people signed up under the single-step promise and
-- were already sent to on that basis; asking them to confirm now would read as
-- a bug and lose most of a list the site promised to honour. The retention
-- terms (unconfirmed 7 days, confirmed 12 months after their digest) apply to
-- them like everyone else.
--
-- Hand-authored, applied with `prisma migrate deploy`.

ALTER TABLE "WaitlistSignup"
  ADD COLUMN "confirmedAt"   TIMESTAMP(3),
  ADD COLUMN "confirmSentAt" TIMESTAMP(3);
UPDATE "WaitlistSignup" SET "confirmedAt" = "createdAt";

ALTER TABLE "PassWaitlist"
  ADD COLUMN "confirmedAt"   TIMESTAMP(3),
  ADD COLUMN "confirmSentAt" TIMESTAMP(3);
UPDATE "PassWaitlist" SET "confirmedAt" = "createdAt";

ALTER TABLE "HexReleaseNotify"
  ADD COLUMN "confirmedAt"   TIMESTAMP(3),
  ADD COLUMN "confirmSentAt" TIMESTAMP(3);
UPDATE "HexReleaseNotify" SET "confirmedAt" = "createdAt";

-- The sweep and every send look for the unconfirmed rows, which should be few
-- and short-lived: partial indexes, like HexReleaseNotify_notifiedAt_idx.
CREATE INDEX "WaitlistSignup_unconfirmed_idx"   ON "WaitlistSignup"("createdAt")   WHERE "confirmedAt" IS NULL;
CREATE INDEX "PassWaitlist_unconfirmed_idx"     ON "PassWaitlist"("createdAt")     WHERE "confirmedAt" IS NULL;
CREATE INDEX "HexReleaseNotify_unconfirmed_idx" ON "HexReleaseNotify"("createdAt") WHERE "confirmedAt" IS NULL;
