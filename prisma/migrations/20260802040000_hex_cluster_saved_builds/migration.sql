-- Saved hex-cluster builds. A student names a configuration, saves it to their
-- account, recalls it, and prints a build sheet whose drawing number and
-- revision reference a real record rather than a hardcoded constant.
--
-- Parent/child, because paper cites "OTD-HEX-1042 Rev C": the number survives
-- across saves and a revision is never UPDATEd. Design:
-- docs/plans/2026-08-01-hex-cluster-saved-builds-design.md sections 4 and 8.
--
-- The payload is stored OPAQUE. Its schema, validator and migrate() chokepoint
-- live in the configurator on a different deploy cadence, so the academy is a
-- pipe: bytes in, bytes out, transport prefix included. There is deliberately
-- no server-side decompression path, and never a "migrate the saved rows" job --
-- migration is read-time and owned by the reader.
--
-- IF NOT EXISTS + guarded constraints keep re-runs safe.

CREATE TABLE IF NOT EXISTS "HexCluster" (
    "id" TEXT NOT NULL,
    -- nullable + SET NULL below: deleteStudent hard-deletes users, and a printed
    -- sheet's QR must not 404 because an account was cleaned up
    "userId" TEXT,
    "drawingNo" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    -- soft delete, named for Project.archivedAt; /c/ resolves an archived
    -- cluster to "removed by its owner"
    "archivedAt" TIMESTAMP(3),
    CONSTRAINT "HexCluster_pkey" PRIMARY KEY ("id"),
    -- a drawing name reaches paper and the public /c/ page; bound it here as
    -- well as in the action, because the action is not the only writer forever
    CONSTRAINT "hexcluster_name_len" CHECK (char_length("name") BETWEEN 1 AND 120),
    -- the register starts at 1001 so no printed number is ever three digits;
    -- see the ALTER SEQUENCE below
    CONSTRAINT "hexcluster_drawingno_floor" CHECK ("drawingNo" >= 1001)
);

-- Start the register at 1001. Postgres allocates SERIAL at INSERT, so numbers
-- are atomic and gaps are expected -- a gap means a save was rolled back, not
-- that a drawing was lost.
ALTER SEQUENCE "HexCluster_drawingNo_seq" RESTART WITH 1001;

CREATE UNIQUE INDEX IF NOT EXISTS "HexCluster_drawingNo_key" ON "HexCluster"("drawingNo");
-- the account list orders by updatedAt
CREATE INDEX IF NOT EXISTS "HexCluster_userId_updatedAt_idx" ON "HexCluster"("userId", "updatedAt");
-- the active/archived split, and the quota counts that ride on it
CREATE INDEX IF NOT EXISTS "HexCluster_userId_archivedAt_idx" ON "HexCluster"("userId", "archivedAt");

CREATE TABLE IF NOT EXISTS "HexClusterRevision" (
    "id" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "revNo" INTEGER NOT NULL,
    -- public token for /c/<shareCode>: 22-char base62 from crypto.randomBytes,
    -- never cuid() -- cuid v1 is timestamp + counter + fingerprint and is not
    -- unguessable, and this token is the only thing protecting an unlisted page
    "shareCode" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "summary" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HexClusterRevision_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "hexrev_revno_positive" CHECK ("revNo" >= 1),
    -- a single upper bound is writable because the action refuses to save from
    -- a non-compressing browser outright, rather than admitting a larger
    -- uncompressed ceiling: on that path the QR is unscannable from ~19 cells
    CONSTRAINT "hexrev_payload_len" CHECK (char_length("payload") BETWEEN 4 AND 16384),
    -- "h1:" + 64 hex, with room for a longer algorithm tag later
    CONSTRAINT "hexrev_hash_len" CHECK (char_length("payloadHash") BETWEEN 11 AND 80),
    CONSTRAINT "hexrev_schema_ver" CHECK ("schemaVersion" >= 1),
    -- 12288, not the action's 8192: Prisma Json maps to JSONB, and jsonb::text
    -- re-serialises with a space after every ':' and ',', so a summary the
    -- action validates at <= 8192 compact can exceed an 8192 CHECK and throw a
    -- raw constraint error instead of returning summary-invalid. Measured: a
    -- 25-byte compact object is 31 bytes as jsonb::text.
    CONSTRAINT "hexrev_summary_len" CHECK (length("summary"::text) <= 12288)
);

CREATE UNIQUE INDEX IF NOT EXISTS "HexClusterRevision_shareCode_key" ON "HexClusterRevision"("shareCode");
-- the backstop for the revNo race the advisory lock in saveHexCluster is the
-- primary defence against
CREATE UNIQUE INDEX IF NOT EXISTS "HexClusterRevision_clusterId_revNo_key" ON "HexClusterRevision"("clusterId", "revNo");
CREATE INDEX IF NOT EXISTS "HexClusterRevision_clusterId_createdAt_idx" ON "HexClusterRevision"("clusterId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "HexCluster" ADD CONSTRAINT "HexCluster_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "HexClusterRevision" ADD CONSTRAINT "HexClusterRevision_clusterId_fkey"
    FOREIGN KEY ("clusterId") REFERENCES "HexCluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
