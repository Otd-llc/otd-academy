-- m15 Task 15.2: widen `checklist_owner_xor` CHECK from 2-way (Build XOR Board)
-- to 3-way (Revision XOR Build XOR Board). The new constraint accepts exactly
-- one of (revisionId, buildId, boardId) being non-null.

ALTER TABLE "Checklist" DROP CONSTRAINT checklist_owner_xor;

ALTER TABLE "Checklist" ADD CONSTRAINT checklist_owner_xor CHECK (
  (CASE WHEN "revisionId" IS NULL THEN 0 ELSE 1 END
   + CASE WHEN "buildId"    IS NULL THEN 0 ELSE 1 END
   + CASE WHEN "boardId"    IS NULL THEN 0 ELSE 1 END) = 1
);
