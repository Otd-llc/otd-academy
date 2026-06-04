-- PartAsset: derived .glb render columns (the source file columns are unchanged).
ALTER TABLE "PartAsset" ADD COLUMN "renderKey"    TEXT;
ALTER TABLE "PartAsset" ADD COLUMN "renderBytes"  INTEGER;
ALTER TABLE "PartAsset" ADD COLUMN "renderMime"   TEXT;
ALTER TABLE "PartAsset" ADD COLUMN "renderBounds" JSONB;

-- Artifact: same derived-render columns (board stub) + the MODEL_3D subkind.
ALTER TABLE "Artifact" ADD COLUMN "renderKey"    TEXT;
ALTER TABLE "Artifact" ADD COLUMN "renderBytes"  INTEGER;
ALTER TABLE "Artifact" ADD COLUMN "renderMime"   TEXT;
ALTER TABLE "Artifact" ADD COLUMN "renderBounds" JSONB;

ALTER TYPE "ArtifactSubkind" ADD VALUE 'MODEL_3D';
