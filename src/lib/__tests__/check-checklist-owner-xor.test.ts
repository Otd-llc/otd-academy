import { afterAll, beforeAll, expect, test } from "vitest";
import { db } from "@/lib/db";

// Checklist requires createdById -> User. For the "both null" case we need
// a real User row so the User FK passes and the CHECK is what fires. For the
// "both set" case we additionally need a real Build (which needs a Revision,
// Project, and User) and a real Board.

const USER_ID = "checklist-owner-xor-user";
const PROJECT_ID = "checklist-owner-xor-project";
const REVISION_ID = "checklist-owner-xor-rev";
const BUILD_ID = "checklist-owner-xor-build";
const BOARD_ID = "checklist-owner-xor-board";

beforeAll(async () => {
  await db.$executeRawUnsafe(`
    INSERT INTO "User" (id, email, "createdAt")
    VALUES ('${USER_ID}', 'checklist-owner-xor@test.local', NOW())
    ON CONFLICT (id) DO NOTHING;
  `);
  await db.$executeRawUnsafe(`
    INSERT INTO "Project" (id, slug, name, "createdById", "createdAt", "updatedAt")
    VALUES ('${PROJECT_ID}', 'checklist-owner-xor-project', 'Checklist Owner XOR', '${USER_ID}', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  `);
  await db.$executeRawUnsafe(`
    INSERT INTO "Revision" (id, "projectId", label, "currentStage", "currentStageEnteredAt", "createdAt", "updatedAt")
    VALUES ('${REVISION_ID}', '${PROJECT_ID}', 'checklist-owner-xor-v1', 'REQUIREMENTS', NOW(), NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  `);
  await db.$executeRawUnsafe(`
    INSERT INTO "Build" (id, "revisionId", label, "boardCount", "createdById", "createdAt", "updatedAt")
    VALUES ('${BUILD_ID}', '${REVISION_ID}', 'checklist-owner-xor-build', 1, '${USER_ID}', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  `);
  await db.$executeRawUnsafe(`
    INSERT INTO "Board" (id, "buildId", serial, status, "createdAt", "updatedAt")
    VALUES ('${BOARD_ID}', '${BUILD_ID}', 'B-OWNERXOR', 'BARE', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  `);
});

afterAll(async () => {
  // Clean any rows that inserted successfully (e.g. before the CHECK existed).
  await db.$executeRawUnsafe(
    `DELETE FROM "Checklist" WHERE id IN ('checklist-owner-xor-both-null', 'checklist-owner-xor-both-set', 'checklist-owner-xor-rev-only', 'checklist-owner-xor-rev-build');`,
  );
  await db.$executeRawUnsafe(`DELETE FROM "Board" WHERE id = '${BOARD_ID}';`);
  await db.$executeRawUnsafe(`DELETE FROM "Build" WHERE id = '${BUILD_ID}';`);
  await db.$executeRawUnsafe(`DELETE FROM "Revision" WHERE id = '${REVISION_ID}';`);
  await db.$executeRawUnsafe(`DELETE FROM "Project" WHERE id = '${PROJECT_ID}';`);
  await db.$executeRawUnsafe(`DELETE FROM "User" WHERE id = '${USER_ID}';`);
});

test("CHECK checklist_owner_xor: both buildId and boardId null is rejected", async () => {
  await expect(
    db.$executeRawUnsafe(`
      INSERT INTO "Checklist" (id, stage, subkind, title, "createdById", "createdAt")
      VALUES ('checklist-owner-xor-both-null', 'ASSEMBLY', 'GENERIC', 'x', '${USER_ID}', NOW());
    `),
  ).rejects.toThrow(/checklist_owner_xor|check/i);
});

test("CHECK checklist_owner_xor: both buildId and boardId set is rejected", async () => {
  await expect(
    db.$executeRawUnsafe(`
      INSERT INTO "Checklist" (id, "buildId", "boardId", stage, subkind, title, "createdById", "createdAt")
      VALUES ('checklist-owner-xor-both-set', '${BUILD_ID}', '${BOARD_ID}', 'ASSEMBLY', 'GENERIC', 'x', '${USER_ID}', NOW());
    `),
  ).rejects.toThrow(/checklist_owner_xor|check/i);
});

// ─── m15: 3-way XOR (Revision XOR Build XOR Board) ─────────────────────

test("CHECK checklist_owner_xor: revision-only is now valid (3-way XOR)", async () => {
  // Insert a Checklist with only revisionId set; expect success (m15 widened
  // the CHECK from 2-way to 3-way).
  await db.$executeRawUnsafe(`
    INSERT INTO "Checklist" (id, "revisionId", stage, subkind, title, "createdById", "createdAt")
    VALUES ('checklist-owner-xor-rev-only', '${REVISION_ID}', 'REQUIREMENTS', 'GENERIC', 'rev-scoped', '${USER_ID}', NOW());
  `);
  const c = await db.checklist.findUnique({
    where: { id: "checklist-owner-xor-rev-only" },
  });
  expect(c).not.toBeNull();
  expect(c!.revisionId).toBe(REVISION_ID);
  expect(c!.buildId).toBeNull();
  expect(c!.boardId).toBeNull();
  // Clean up inline so the row doesn't survive past this test.
  await db.checklist.delete({ where: { id: "checklist-owner-xor-rev-only" } });
});

test("CHECK checklist_owner_xor: two owners set (revision + build) is still rejected", async () => {
  await expect(
    db.$executeRawUnsafe(`
      INSERT INTO "Checklist" (id, "revisionId", "buildId", stage, subkind, title, "createdById", "createdAt")
      VALUES ('checklist-owner-xor-rev-build', '${REVISION_ID}', '${BUILD_ID}', 'REQUIREMENTS', 'GENERIC', 'two-owner', '${USER_ID}', NOW());
    `),
  ).rejects.toThrow(/checklist_owner_xor|check/i);
});
