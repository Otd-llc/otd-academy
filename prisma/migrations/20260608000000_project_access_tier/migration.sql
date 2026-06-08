-- Per-project access tier (GTM roadmap, Phase 1). Additive + reversible:
-- a new enum + a NOT NULL column with a safe default, plus flagging the WROOM
-- flagship PUBLIC (the first public/SEO surface).
CREATE TYPE "AccessTier" AS ENUM ('PUBLIC', 'FREE', 'PREMIUM');

ALTER TABLE "Project" ADD COLUMN "accessTier" "AccessTier" NOT NULL DEFAULT 'FREE';

UPDATE "Project" SET "accessTier" = 'PUBLIC' WHERE "slug" = 'foundry-l1-01-wroom-breakout';
