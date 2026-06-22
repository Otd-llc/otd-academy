-- CreateEnum
CREATE TYPE "MiniLessonLinkRole" AS ENUM ('SUPPORTING', 'DOWN_FUNNEL');

-- CreateTable
CREATE TABLE "MiniLesson" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "contentBlocks" JSONB NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "accessTier" "AccessTier" NOT NULL DEFAULT 'PUBLIC',
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "byline" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "MiniLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMiniLesson" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "miniLessonId" TEXT NOT NULL,
    "role" "MiniLessonLinkRole" NOT NULL DEFAULT 'SUPPORTING',
    "ordinal" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMiniLesson_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MiniLesson_slug_key" ON "MiniLesson"("slug");

-- CreateIndex
CREATE INDEX "MiniLesson_published_idx" ON "MiniLesson"("published");

-- CreateIndex
CREATE INDEX "ProjectMiniLesson_miniLessonId_idx" ON "ProjectMiniLesson"("miniLessonId");

-- CreateIndex
CREATE INDEX "ProjectMiniLesson_projectId_idx" ON "ProjectMiniLesson"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMiniLesson_projectId_miniLessonId_role_key" ON "ProjectMiniLesson"("projectId", "miniLessonId", "role");

-- AddForeignKey
ALTER TABLE "MiniLesson" ADD CONSTRAINT "MiniLesson_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMiniLesson" ADD CONSTRAINT "ProjectMiniLesson_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMiniLesson" ADD CONSTRAINT "ProjectMiniLesson_miniLessonId_fkey" FOREIGN KEY ("miniLessonId") REFERENCES "MiniLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
