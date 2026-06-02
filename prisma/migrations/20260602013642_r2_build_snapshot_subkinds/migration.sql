-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ArtifactSubkind" ADD VALUE 'BOM_CSV_AS_ORDERED';
ALTER TYPE "ArtifactSubkind" ADD VALUE 'ASSEMBLY_PHOTO';
ALTER TYPE "ArtifactSubkind" ADD VALUE 'BRINGUP_MEASUREMENTS_CSV';
