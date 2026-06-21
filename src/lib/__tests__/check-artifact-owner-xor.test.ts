import { expect, test } from "vitest";
import { db } from "@/lib/db";

test("CHECK artifact_owner_xor: both revisionId and buildId null is rejected", async () => {
  await expect(
    db.$executeRawUnsafe(`
      INSERT INTO "Artifact" (id, stage, kind, title, "createdBy", "createdAt")
      VALUES ('test1', 'REQUIREMENTS', 'NOTE', 'x', 'fake-user', NOW());
    `),
  ).rejects.toThrow(/artifact_owner_xor|check/i);
});

test("CHECK artifact_owner_xor: both revisionId and buildId set is rejected", async () => {
  // The CHECK is evaluated during the insert (before the FK triggers fire — see
  // the both-null case above, which also uses placeholder ids), so a row with
  // BOTH owners set trips artifact_owner_xor regardless of FK validity.
  await expect(
    db.$executeRawUnsafe(`
      INSERT INTO "Artifact" (id, stage, kind, title, "revisionId", "buildId", "createdBy", "createdAt")
      VALUES ('test-xor-both', 'REQUIREMENTS', 'NOTE', 'x', 'rev-fake', 'build-fake', 'fake-user', NOW());
    `),
  ).rejects.toThrow(/artifact_owner_xor|check/i);
});
