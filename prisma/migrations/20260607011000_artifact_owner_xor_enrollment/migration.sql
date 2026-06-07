-- Extend the Artifact owner XOR to three mutually-exclusive owners:
-- exactly one of (revisionId, buildId, enrollmentId) is non-null.
-- Learner proof artifacts are enrollment-owned (revisionId + buildId both null),
-- which keeps them out of the author/reference revision queries entirely
-- (loadGateContext filters by revisionId) — the "two worlds" stay separated.
ALTER TABLE "Artifact" DROP CONSTRAINT "artifact_owner_xor";
ALTER TABLE "Artifact" ADD CONSTRAINT "artifact_owner_xor" CHECK (
  (("revisionId" IS NOT NULL)::int
   + ("buildId" IS NOT NULL)::int
   + ("enrollmentId" IS NOT NULL)::int) = 1
);
