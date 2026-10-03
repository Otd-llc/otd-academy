-- Interest in the molded line, two signals (hex-v2 next plan 1.2.2 / 1.2.3).
--
-- HexPartWaitlist: "tell me when one of these goes to the mold maker". One row
-- per address, the stems they chose as an array, the same double opt-in as the
-- other three captures (20261001130000): unconfirmed until the confirm page is
-- submitted, one confirmation mail, deleted after 7 days otherwise. The stems
-- UNION only once confirmed; before that a repeat submit replaces them, so a
-- stranger cannot pad someone else's list through the form.
--
-- HexPartInterest: the tap counter. One row per stem, incremented once per
-- IP-day as the rate limiter decides. The limiter runs CLOSED for this: with
-- no Redis, or a degraded Redis, a tap is DROPPED and counted in degradedDrops
-- instead, so "distinct IP-days" stays an honest number and the drop is
-- visible beside it rather than hidden in it.

CREATE TABLE "HexPartWaitlist" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "stems" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "confirmSentAt" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "HexPartWaitlist_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HexPartWaitlist_email_key" ON "HexPartWaitlist"("email");
-- Stored lowercase; the database refuses a case-variant (email_hygiene).
CREATE UNIQUE INDEX "HexPartWaitlist_lower_email_key" ON "HexPartWaitlist" (lower(email));
CREATE INDEX "HexPartWaitlist_userId_idx" ON "HexPartWaitlist"("userId");
CREATE INDEX "HexPartWaitlist_unconfirmed_idx" ON "HexPartWaitlist"("createdAt") WHERE "confirmedAt" IS NULL;

CREATE TABLE "HexPartInterest" (
    "stem" TEXT NOT NULL,
    "ipDays" INTEGER NOT NULL DEFAULT 0,
    "degradedDrops" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HexPartInterest_pkey" PRIMARY KEY ("stem")
);
