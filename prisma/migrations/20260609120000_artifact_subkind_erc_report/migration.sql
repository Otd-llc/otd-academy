-- Add ERC_REPORT to ArtifactSubkind. The SCHEMATIC stage now gates on a clean
-- ERC report (the schematic-stage analog of DRC_REPORT) instead of the schematic
-- file: ERC verifies electrical coherence, and a learner uploads the report as
-- proof. Placed after SCHEMATIC_FILE so the DB enum order tracks the schema.
-- `IF NOT EXISTS` keeps re-runs safe. (Postgres 12+ allows ADD VALUE inside the
-- migration transaction; the value is simply not used in this same migration.)
ALTER TYPE "ArtifactSubkind" ADD VALUE IF NOT EXISTS 'ERC_REPORT' AFTER 'SCHEMATIC_FILE';
