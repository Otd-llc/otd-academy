-- CreateEnum
CREATE TYPE "ProjectDepKind" AS ENUM ('DE_RISK', 'FOUNDATION', 'SHARED_BLOCK');

-- CreateTable
CREATE TABLE "ProjectDependency" (
    "id" TEXT NOT NULL,
    "dependentProjectId" TEXT NOT NULL,
    "dependsOnProjectId" TEXT NOT NULL,
    "kind" "ProjectDepKind" NOT NULL DEFAULT 'DE_RISK',
    "dependentStageGated" "Stage" NOT NULL,
    "dependsOnStageRequired" "Stage" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "ProjectDependency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectDependency_dependentProjectId_idx" ON "ProjectDependency"("dependentProjectId");

-- CreateIndex
CREATE INDEX "ProjectDependency_dependsOnProjectId_idx" ON "ProjectDependency"("dependsOnProjectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectDependency_dependentProjectId_dependsOnProjectId_dep_key" ON "ProjectDependency"("dependentProjectId", "dependsOnProjectId", "dependentStageGated");

-- AddForeignKey
ALTER TABLE "ProjectDependency" ADD CONSTRAINT "ProjectDependency_dependentProjectId_fkey" FOREIGN KEY ("dependentProjectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDependency" ADD CONSTRAINT "ProjectDependency_dependsOnProjectId_fkey" FOREIGN KEY ("dependsOnProjectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDependency" ADD CONSTRAINT "ProjectDependency_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
