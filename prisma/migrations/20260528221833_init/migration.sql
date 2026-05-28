-- CreateEnum
CREATE TYPE "Stage" AS ENUM ('REQUIREMENTS', 'SCHEMATIC', 'BOM_SOURCING', 'LAYOUT', 'DRC_GERBER', 'ORDERING', 'ASSEMBLY', 'BRINGUP', 'REVISION');

-- CreateEnum
CREATE TYPE "TransitionDirection" AS ENUM ('INIT', 'ADVANCE', 'REGRESS');

-- CreateEnum
CREATE TYPE "ArtifactKind" AS ENUM ('FILE', 'NOTE', 'LINK');

-- CreateEnum
CREATE TYPE "ArtifactSubkind" AS ENUM ('GENERIC', 'REQUIREMENTS_DOC', 'SCHEMATIC_FILE', 'BOM_EXPORT', 'LAYOUT_FILE', 'DRC_REPORT', 'GERBER_ZIP', 'PCB_ORDER', 'PARTS_ORDER', 'ASSEMBLY_PROCEDURE', 'BENCH_PROCEDURE', 'BRINGUP_LOG', 'BRINGUP_COMPLETE');

-- CreateEnum
CREATE TYPE "BoardStatus" AS ENUM ('BARE', 'SCREENED', 'ASSEMBLED', 'POWERED', 'BROUGHT_UP', 'FAILED', 'QUARANTINED');

-- CreateEnum
CREATE TYPE "ChecklistSubkind" AS ENUM ('GENERIC', 'EQUIPMENT_PREFLIGHT', 'SCREENING_STEP_0', 'ASSEMBLY_STEPS', 'POST_ASSEMBLY_CONTINUITY', 'POLARITY_VERIFICATION');

-- CreateEnum
CREATE TYPE "MeasurementResult" AS ENUM ('PASS', 'FAIL', 'OBSERVED', 'PEND');

-- CreateEnum
CREATE TYPE "PartLifecycle" AS ENUM ('ACTIVE', 'NRND', 'EOL', 'OBSOLETE');

-- CreateEnum
CREATE TYPE "ErratumSeverity" AS ENUM ('BLOCKER', 'MAJOR', 'MINOR');

-- CreateEnum
CREATE TYPE "ErratumStatus" AS ENUM ('OPEN', 'FIXED_NEXT_REV', 'WONT_FIX');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetCost" DECIMAL(10,2),
    "repoUrl" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Revision" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "currentStage" "Stage" NOT NULL DEFAULT 'REQUIREMENTS',
    "currentStageEnteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bomFrozenAt" TIMESTAMP(3),
    "frozenAt" TIMESTAMP(3),
    "frozenById" TEXT,
    "schematicCommit" TEXT,
    "layoutCommit" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageTransition" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "fromStage" "Stage",
    "toStage" "Stage" NOT NULL,
    "direction" "TransitionDirection" NOT NULL,
    "gateSnapshot" JSONB NOT NULL,
    "notes" TEXT,
    "transitionedBy" TEXT NOT NULL,
    "transitionedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StageTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Artifact" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT,
    "buildId" TEXT,
    "stage" "Stage" NOT NULL,
    "kind" "ArtifactKind" NOT NULL,
    "subkind" "ArtifactSubkind" NOT NULL DEFAULT 'GENERIC',
    "title" TEXT NOT NULL,
    "fileKey" TEXT,
    "fileMime" TEXT,
    "fileBytes" INTEGER,
    "noteBody" TEXT,
    "linkUrl" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Artifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Build" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "boardCount" INTEGER NOT NULL,
    "pcbOrderRef" TEXT,
    "partsOrderRef" TEXT,
    "orderedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "assemblyStartedAt" TIMESTAMP(3),
    "frozenAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "Build_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Board" (
    "id" TEXT NOT NULL,
    "buildId" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "silkscreenHash" TEXT,
    "status" "BoardStatus" NOT NULL DEFAULT 'BARE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Board_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Checklist" (
    "id" TEXT NOT NULL,
    "buildId" TEXT,
    "boardId" TEXT,
    "stage" "Stage" NOT NULL,
    "subkind" "ChecklistSubkind" NOT NULL DEFAULT 'GENERIC',
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "Checklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "expectedValue" TEXT,
    "actualValue" TEXT,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Measurement" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "stage" "Stage" NOT NULL,
    "step" TEXT NOT NULL,
    "expectedValue" TEXT,
    "actualValue" TEXT NOT NULL,
    "unit" TEXT,
    "result" "MeasurementResult" NOT NULL DEFAULT 'PEND',
    "notes" TEXT,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "measuredById" TEXT NOT NULL,

    CONSTRAINT "Measurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Part" (
    "id" TEXT NOT NULL,
    "mpn" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "footprint" TEXT,
    "datasheetUrl" TEXT,
    "lifecycle" "PartLifecycle" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "Part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BomLine" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "refDes" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "BomLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Erratum" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "ErratumSeverity" NOT NULL,
    "status" "ErratumStatus" NOT NULL DEFAULT 'OPEN',
    "addressedByRevisionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "Erratum_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE INDEX "Project_archivedAt_idx" ON "Project"("archivedAt");

-- CreateIndex
CREATE INDEX "Revision_projectId_currentStage_idx" ON "Revision"("projectId", "currentStage");

-- CreateIndex
CREATE INDEX "StageTransition_revisionId_transitionedAt_idx" ON "StageTransition"("revisionId", "transitionedAt");

-- CreateIndex
CREATE INDEX "Artifact_revisionId_stage_idx" ON "Artifact"("revisionId", "stage");

-- CreateIndex
CREATE INDEX "Artifact_buildId_stage_idx" ON "Artifact"("buildId", "stage");

-- CreateIndex
CREATE INDEX "Artifact_buildId_subkind_idx" ON "Artifact"("buildId", "subkind");

-- CreateIndex
CREATE INDEX "Build_revisionId_frozenAt_createdAt_idx" ON "Build"("revisionId", "frozenAt", "createdAt");

-- CreateIndex
CREATE INDEX "Board_buildId_status_idx" ON "Board"("buildId", "status");

-- CreateIndex
CREATE INDEX "Checklist_buildId_stage_idx" ON "Checklist"("buildId", "stage");

-- CreateIndex
CREATE INDEX "Checklist_boardId_stage_idx" ON "Checklist"("boardId", "stage");

-- CreateIndex
CREATE INDEX "Checklist_stage_idx" ON "Checklist"("stage");

-- CreateIndex
CREATE INDEX "Checklist_buildId_subkind_idx" ON "Checklist"("buildId", "subkind");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistItem_checklistId_ordinal_key" ON "ChecklistItem"("checklistId", "ordinal");

-- CreateIndex
CREATE INDEX "Measurement_boardId_stage_idx" ON "Measurement"("boardId", "stage");

-- CreateIndex
CREATE INDEX "Measurement_boardId_step_idx" ON "Measurement"("boardId", "step");

-- CreateIndex
CREATE INDEX "Part_mpn_idx" ON "Part"("mpn");

-- CreateIndex
CREATE INDEX "Part_category_idx" ON "Part"("category");

-- CreateIndex
CREATE INDEX "Part_lifecycle_idx" ON "Part"("lifecycle");

-- CreateIndex
CREATE UNIQUE INDEX "Part_manufacturer_mpn_key" ON "Part"("manufacturer", "mpn");

-- CreateIndex
CREATE INDEX "BomLine_partId_idx" ON "BomLine"("partId");

-- CreateIndex
CREATE UNIQUE INDEX "BomLine_revisionId_partId_key" ON "BomLine"("revisionId", "partId");

-- CreateIndex
CREATE INDEX "Erratum_revisionId_status_idx" ON "Erratum"("revisionId", "status");

-- CreateIndex
CREATE INDEX "Erratum_addressedByRevisionId_idx" ON "Erratum"("addressedByRevisionId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Revision" ADD CONSTRAINT "Revision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Revision" ADD CONSTRAINT "Revision_frozenById_fkey" FOREIGN KEY ("frozenById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageTransition" ADD CONSTRAINT "StageTransition_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "Revision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageTransition" ADD CONSTRAINT "StageTransition_transitionedBy_fkey" FOREIGN KEY ("transitionedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "Revision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "Build"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Build" ADD CONSTRAINT "Build_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "Revision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Build" ADD CONSTRAINT "Build_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Board" ADD CONSTRAINT "Board_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "Build"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checklist" ADD CONSTRAINT "Checklist_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "Build"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checklist" ADD CONSTRAINT "Checklist_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checklist" ADD CONSTRAINT "Checklist_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "Checklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_measuredById_fkey" FOREIGN KEY ("measuredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Part" ADD CONSTRAINT "Part_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomLine" ADD CONSTRAINT "BomLine_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "Revision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomLine" ADD CONSTRAINT "BomLine_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomLine" ADD CONSTRAINT "BomLine_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Erratum" ADD CONSTRAINT "Erratum_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "Revision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Erratum" ADD CONSTRAINT "Erratum_addressedByRevisionId_fkey" FOREIGN KEY ("addressedByRevisionId") REFERENCES "Revision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Erratum" ADD CONSTRAINT "Erratum_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
