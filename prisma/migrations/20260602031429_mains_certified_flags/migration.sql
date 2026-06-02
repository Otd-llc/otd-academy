-- AlterTable
ALTER TABLE "Part" ADD COLUMN     "isCertifiedModule" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "hasMainsNet" BOOLEAN NOT NULL DEFAULT false;
