-- GDPR: marketing/lifecycle email consent must be opt-in, not opt-out.
--
-- 1. New users default to NO consent. They opt in explicitly via the account
--    "Email" toggle (which stamps emailConsentUpdatedAt).
ALTER TABLE "User" ALTER COLUMN "emailConsent" SET DEFAULT false;

-- 2. Re-consent existing users. Every current `true` was an implied default-opt-in,
--    which is not valid GDPR consent, so reset those rows to false and clear the
--    timestamp (null = "no choice made yet"). Rows already at false (people who
--    unsubscribed) keep their state and their recorded opt-out time.
UPDATE "User"
SET "emailConsent" = false,
    "emailConsentUpdatedAt" = NULL
WHERE "emailConsent" = true;
