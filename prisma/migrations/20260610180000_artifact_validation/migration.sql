-- Content-validation result for a learner proof artifact. `valid` is set only
-- for subkinds that carry a validator (ERC_REPORT → errors == 0); NULL means not
-- validated (presence-only subkinds, or links we can't parse). `validationDetail`
-- carries a human-readable outcome ("5 errors, 5 warnings") surfaced in the gate
-- + the upload modal. Both nullable + additive → backward-compatible with code
-- that predates them. `IF NOT EXISTS` keeps re-runs safe.
ALTER TABLE "Artifact" ADD COLUMN IF NOT EXISTS "valid" BOOLEAN;
ALTER TABLE "Artifact" ADD COLUMN IF NOT EXISTS "validationDetail" TEXT;
