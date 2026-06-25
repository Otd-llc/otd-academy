-- All-Access Pass waitlist (email capture while the Pass is pre-sale).
-- Hand-authored, additive only. Apply with `prisma migrate deploy`.

CREATE TABLE "PassWaitlist" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PassWaitlist_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PassWaitlist_email_key" ON "PassWaitlist"("email");
