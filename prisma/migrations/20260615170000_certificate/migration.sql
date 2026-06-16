-- Issued completion/certificate records — what makes the printed verify code
-- checkable. Written idempotently (unique `code`) when a learner's share token is
-- minted; the /verify page looks a code up. Holds enough to re-render the
-- certificate (token re-signed from these fields). Additive; IF NOT EXISTS +
-- guarded FK keep re-runs safe.
CREATE TABLE IF NOT EXISTS "Certificate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "score" INTEGER,
    "total" INTEGER,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Certificate_code_key" ON "Certificate"("code");
CREATE INDEX IF NOT EXISTS "Certificate_userId_idx" ON "Certificate"("userId");
CREATE INDEX IF NOT EXISTS "Certificate_slug_idx" ON "Certificate"("slug");

DO $$ BEGIN
  ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
