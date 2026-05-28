ALTER TABLE "Artifact"
ADD CONSTRAINT artifact_kind_payload_xor CHECK (
  (kind = 'FILE' AND "fileKey" IS NOT NULL AND "noteBody" IS NULL AND "linkUrl" IS NULL)
  OR (kind = 'NOTE' AND "noteBody" IS NOT NULL AND "fileKey" IS NULL AND "linkUrl" IS NULL)
  OR (kind = 'LINK' AND "linkUrl" IS NOT NULL AND "fileKey" IS NULL AND "noteBody" IS NULL)
);
