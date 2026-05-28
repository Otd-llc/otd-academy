import { afterAll, beforeAll, expect, test } from "vitest";
import { db } from "@/lib/db";
import { SILKSCREEN_HASH_RE } from "@/lib/constants";

// Board requires a real Build FK. Seed a minimal chain and tear it down.
// The bare regex constant is asserted at the JS level too so the SQL `~*`
// pattern and TS validation stay in lock-step.

const USER_ID = "board-silkscreen-user";
const PROJECT_ID = "board-silkscreen-project";
const REVISION_ID = "board-silkscreen-rev";
const BUILD_ID = "board-silkscreen-build";
const BOARD_REJECT_ID = "board-silkscreen-reject";
const BOARD_NULL_ID = "board-silkscreen-null";
const BOARD_VALID_ID = "board-silkscreen-valid";

beforeAll(async () => {
  await db.$executeRawUnsafe(`
    INSERT INTO "User" (id, email, "createdAt")
    VALUES ('${USER_ID}', 'board-silkscreen@test.local', NOW())
    ON CONFLICT (id) DO NOTHING;
  `);
  await db.$executeRawUnsafe(`
    INSERT INTO "Project" (id, slug, name, "createdById", "createdAt", "updatedAt")
    VALUES ('${PROJECT_ID}', 'board-silkscreen-project', 'Board Silkscreen Project', '${USER_ID}', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  `);
  await db.$executeRawUnsafe(`
    INSERT INTO "Revision" (id, "projectId", label, "currentStage", "currentStageEnteredAt", "createdAt", "updatedAt")
    VALUES ('${REVISION_ID}', '${PROJECT_ID}', 'board-silkscreen-v1', 'ASSEMBLY', NOW(), NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  `);
  await db.$executeRawUnsafe(`
    INSERT INTO "Build" (id, "revisionId", label, "boardCount", "createdById", "createdAt", "updatedAt")
    VALUES ('${BUILD_ID}', '${REVISION_ID}', 'board-silkscreen-build', 3, '${USER_ID}', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  `);
});

afterAll(async () => {
  await db.$executeRawUnsafe(
    `DELETE FROM "Board" WHERE id IN ('${BOARD_REJECT_ID}', '${BOARD_NULL_ID}', '${BOARD_VALID_ID}');`,
  );
  await db.$executeRawUnsafe(`DELETE FROM "Build" WHERE id = '${BUILD_ID}';`);
  await db.$executeRawUnsafe(`DELETE FROM "Revision" WHERE id = '${REVISION_ID}';`);
  await db.$executeRawUnsafe(`DELETE FROM "Project" WHERE id = '${PROJECT_ID}';`);
  await db.$executeRawUnsafe(`DELETE FROM "User" WHERE id = '${USER_ID}';`);
});

test("SILKSCREEN_HASH_RE matches the SQL CHECK pattern shape", () => {
  expect("g1ebc1cc").toMatch(SILKSCREEN_HASH_RE);
  expect("1ebc1cc").toMatch(SILKSCREEN_HASH_RE);
  expect("NOT_A_HASH").not.toMatch(SILKSCREEN_HASH_RE);
});

test("CHECK board_silkscreen_format: 'NOT_A_HASH' is rejected", async () => {
  await expect(
    db.$executeRawUnsafe(`
      INSERT INTO "Board" (id, "buildId", serial, "silkscreenHash", status, "createdAt", "updatedAt")
      VALUES ('${BOARD_REJECT_ID}', '${BUILD_ID}', 'B-REJECT', 'NOT_A_HASH', 'BARE', NOW(), NOW());
    `),
  ).rejects.toThrow(/board_silkscreen_format|check/i);
});

test("CHECK board_silkscreen_format: NULL silkscreenHash is accepted", async () => {
  const result = await db.$executeRawUnsafe(`
    INSERT INTO "Board" (id, "buildId", serial, "silkscreenHash", status, "createdAt", "updatedAt")
    VALUES ('${BOARD_NULL_ID}', '${BUILD_ID}', 'B-NULL', NULL, 'BARE', NOW(), NOW());
  `);
  expect(result).toBe(1);
});

test("CHECK board_silkscreen_format: 'g1ebc1cc' is accepted", async () => {
  const result = await db.$executeRawUnsafe(`
    INSERT INTO "Board" (id, "buildId", serial, "silkscreenHash", status, "createdAt", "updatedAt")
    VALUES ('${BOARD_VALID_ID}', '${BUILD_ID}', 'B-VALID', 'g1ebc1cc', 'BARE', NOW(), NOW());
  `);
  expect(result).toBe(1);
});
