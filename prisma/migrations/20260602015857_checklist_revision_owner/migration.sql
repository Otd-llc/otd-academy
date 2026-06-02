-- AlterTable
ALTER TABLE "Checklist" ADD COLUMN     "revisionId" TEXT;

-- CreateIndex
CREATE INDEX "Checklist_revisionId_stage_idx" ON "Checklist"("revisionId", "stage");

-- CreateIndex
CREATE INDEX "Checklist_revisionId_subkind_idx" ON "Checklist"("revisionId", "subkind");

-- AddForeignKey
ALTER TABLE "Checklist" ADD CONSTRAINT "Checklist_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "Revision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
