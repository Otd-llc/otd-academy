import { afterAll, beforeAll, expect, test } from "vitest";
import { db } from "@/lib/db";

// These tests rely on a real Revision row so the Artifact FK passes and the
// CHECK constraint is the first thing that fires. Minimal User → Project →
// Revision chain is created in beforeAll and torn down in afterAll.

const USER_ID = "payload-xor-user";
const PROJECT_ID = "payload-xor-project";
const REVISION_ID = "payload-xor-rev";

beforeAll(async () => {
  await db.$executeRawUnsafe(`
    INSERT INTO "User" (id, email, "createdAt")
    VALUES ('${USER_ID}', 'payload-xor@test.local', NOW())
    ON CONFLICT (id) DO NOTHING;
  `);
  await db.$executeRawUnsafe(`
    INSERT INTO "Project" (id, slug, name, "createdById", "createdAt", "updatedAt")
    VALUES ('${PROJECT_ID}', 'payload-xor-project', 'Payload XOR Project', '${USER_ID}', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  `);
  await db.$executeRawUnsafe(`
    INSERT INTO "Revision" (id, "projectId", label, "currentStage", "currentStageEnteredAt", "createdAt", "updatedAt")
    VALUES ('${REVISION_ID}', '${PROJECT_ID}', 'payload-xor-v1', 'REQUIREMENTS', NOW(), NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  `);
});

afterAll(async () => {
  await db.$executeRawUnsafe(`DELETE FROM "Revision" WHERE id = '${REVISION_ID}';`);
  await db.$executeRawUnsafe(`DELETE FROM "Project" WHERE id = '${PROJECT_ID}';`);
  await db.$executeRawUnsafe(`DELETE FROM "User" WHERE id = '${USER_ID}';`);
});

test("CHECK artifact_kind_payload_xor: FILE with noteBody set is rejected", async () => {
  await expect(
    db.$executeRawUnsafe(`
      INSERT INTO "Artifact" (id, "revisionId", stage, kind, title, "fileKey", "noteBody", "createdBy", "createdAt")
      VALUES ('payload-xor-file', '${REVISION_ID}', 'REQUIREMENTS', 'FILE', 'x', 'k', 'body', '${USER_ID}', NOW());
    `),
  ).rejects.toThrow(/artifact_kind_payload_xor|check/i);
});

test("CHECK artifact_kind_payload_xor: NOTE with fileKey set is rejected", async () => {
  await expect(
    db.$executeRawUnsafe(`
      INSERT INTO "Artifact" (id, "revisionId", stage, kind, title, "fileKey", "noteBody", "createdBy", "createdAt")
      VALUES ('payload-xor-note', '${REVISION_ID}', 'REQUIREMENTS', 'NOTE', 'x', 'k', 'body', '${USER_ID}', NOW());
    `),
  ).rejects.toThrow(/artifact_kind_payload_xor|check/i);
});

test("CHECK artifact_kind_payload_xor: LINK with noteBody set is rejected", async () => {
  await expect(
    db.$executeRawUnsafe(`
      INSERT INTO "Artifact" (id, "revisionId", stage, kind, title, "linkUrl", "noteBody", "createdBy", "createdAt")
      VALUES ('payload-xor-link', '${REVISION_ID}', 'REQUIREMENTS', 'LINK', 'x', 'https://example.com', 'body', '${USER_ID}', NOW());
    `),
  ).rejects.toThrow(/artifact_kind_payload_xor|check/i);
});
