-- AlterTable: public-facing copy for the skill tree (both nullable, no backfill)
ALTER TABLE "Project" ADD COLUMN "publicTitle" TEXT;
ALTER TABLE "Project" ADD COLUMN "tagline" TEXT;
