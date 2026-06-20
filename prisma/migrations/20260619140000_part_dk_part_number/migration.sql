-- DigiKey part number (e.g. "1050-1050-ND") captured from the watchdog's v4
-- search response. Enables building a FastAdd cart URL (which keys on DigiKey
-- part numbers, not MPNs). Nullable: backfilled by the next availability run.
-- AlterTable
ALTER TABLE "Part" ADD COLUMN IF NOT EXISTS "dkPartNumber" TEXT;
