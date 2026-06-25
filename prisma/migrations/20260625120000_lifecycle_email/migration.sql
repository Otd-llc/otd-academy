-- Lifecycle email automation (consent + once-only send ledger).
-- Hand-authored, additive only. Apply with `prisma migrate deploy`.

-- Email consent (CAN-SPAM / GDPR). Existing rows default to opted-in: they
-- already hold an account here. The unsubscribe route flips emailConsent → false.
ALTER TABLE "User" ADD COLUMN "emailConsent" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "emailConsentUpdatedAt" TIMESTAMP(3);

-- One row per (user, lifecycle sequence) sent — the once-only idempotency ledger.
CREATE TABLE "LifecycleSend" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sequence" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LifecycleSend_pkey" PRIMARY KEY ("id")
);

-- @@unique([userId, sequence]) — makes a double-send a constraint error, not a dup row.
CREATE UNIQUE INDEX "LifecycleSend_userId_sequence_key" ON "LifecycleSend"("userId", "sequence");

-- @@index([userId])
CREATE INDEX "LifecycleSend_userId_idx" ON "LifecycleSend"("userId");

-- FK: LifecycleSend.userId → User.id, cascade on user delete.
ALTER TABLE "LifecycleSend" ADD CONSTRAINT "LifecycleSend_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
