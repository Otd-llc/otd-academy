import { afterAll, beforeAll, expect, test } from "vitest";
import { db } from "@/lib/db";

// BomLine requires real FKs (Revision, Part, User). Seed a minimal chain in
// beforeAll, tear it down in afterAll. The negative insert below tries to
// store refDes='C1,C2,C3' (count=3) with quantity=4 -- the CHECK should fire.

const USER_ID = "bom-refdes-user";
const PROJECT_ID = "bom-refdes-project";
const REVISION_ID = "bom-refdes-rev";
const PART_ID = "bom-refdes-part";
const BOMLINE_ID = "bom-refdes-line";

beforeAll(async () => {
  await db.$executeRawUnsafe(`
    INSERT INTO "User" (id, email, "createdAt")
    VALUES ('${USER_ID}', 'bom-refdes@test.local', NOW())
    ON CONFLICT (id) DO NOTHING;
  `);
  await db.$executeRawUnsafe(`
    INSERT INTO "Project" (id, slug, name, "createdById", "createdAt", "updatedAt")
    VALUES ('${PROJECT_ID}', 'bom-refdes-project', 'BomLine RefDes Project', '${USER_ID}', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  `);
  await db.$executeRawUnsafe(`
    INSERT INTO "Revision" (id, "projectId", label, "currentStage", "currentStageEnteredAt", "createdAt", "updatedAt")
    VALUES ('${REVISION_ID}', '${PROJECT_ID}', 'bom-refdes-v1', 'BOM_SOURCING', NOW(), NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  `);
  await db.$executeRawUnsafe(`
    INSERT INTO "Part" (id, mpn, manufacturer, description, lifecycle, "createdById", "createdAt", "updatedAt")
    VALUES ('${PART_ID}', 'BOM-REFDES-MPN', 'TestMfr', 'Test part for refdes count CHECK', 'ACTIVE', '${USER_ID}', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  `);
});

afterAll(async () => {
  // Clean any BomLine that might have inserted before the CHECK existed.
  await db.$executeRawUnsafe(`DELETE FROM "BomLine" WHERE id = '${BOMLINE_ID}';`);
  await db.$executeRawUnsafe(`DELETE FROM "Part" WHERE id = '${PART_ID}';`);
  await db.$executeRawUnsafe(`DELETE FROM "Revision" WHERE id = '${REVISION_ID}';`);
  await db.$executeRawUnsafe(`DELETE FROM "Project" WHERE id = '${PROJECT_ID}';`);
  await db.$executeRawUnsafe(`DELETE FROM "User" WHERE id = '${USER_ID}';`);
});

test("CHECK bomline_refdes_count: refDes='C1,C2,C3' with quantity=4 is rejected", async () => {
  await expect(
    db.$executeRawUnsafe(`
      INSERT INTO "BomLine" (id, "revisionId", "partId", "refDes", quantity, "createdById", "createdAt", "updatedAt")
      VALUES ('${BOMLINE_ID}', '${REVISION_ID}', '${PART_ID}', 'C1,C2,C3', 4, '${USER_ID}', NOW(), NOW());
    `),
  ).rejects.toThrow(/bomline_refdes_count|check/i);
});
