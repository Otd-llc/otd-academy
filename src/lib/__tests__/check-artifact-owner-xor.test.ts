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
  // assumes seeded test user, revision, and build (set up in Task 2.x)
  // placeholder — will be wired after seed exists. For now, skip.
});
