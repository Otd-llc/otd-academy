ALTER TABLE "Artifact"
ADD CONSTRAINT artifact_owner_xor CHECK (
  ("revisionId" IS NOT NULL AND "buildId" IS NULL)
  OR ("revisionId" IS NULL AND "buildId" IS NOT NULL)
);
