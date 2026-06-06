-- Data migration (no schema change).
--
-- L1 (true-beginner) guided builds now gate REQUIREMENTS on the requirements
-- artifact (+ the comprehension quiz), NOT the formal REQUIREMENTS_REVIEW
-- design-review checklist — see the REQUIREMENTS exit gate in src/lib/stages.ts.
-- Re-point existing L1 REQUIREMENTS guide cards' footer affordance
-- (`completionRef`) from the checklist to the artifact, so the footer matches
-- the gate. Newly-materialized L1 guides get this from composeGuide directly.
-- Idempotent: re-running sets the same value.
UPDATE "GuideCard" AS gc
SET "completionRef" = '{"kind":"artifact","subkinds":["REQUIREMENTS_DOC"]}'::jsonb
FROM "Guide" AS g
JOIN "Revision" AS r ON r.id = g."revisionId"
JOIN "Project" AS p ON p.id = r."projectId"
WHERE gc."guideId" = g.id
  AND gc.stage = 'REQUIREMENTS'
  AND p.level = 'L1';
