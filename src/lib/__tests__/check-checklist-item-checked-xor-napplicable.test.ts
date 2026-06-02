// Negative-insert test for raw CHECK `checklist_item_checked_xor_napplicable`
// (Task 16.3).
//
// The CHECK forbids any `ChecklistItem` row from being both `checked = true`
// and `notApplicable = true` simultaneously. The Zod refinement on
// `editChecklistItemSchema` is the action-layer guard; this test exercises
// the DB-side belt to its braces by attempting a raw SQL insert that bypasses
// the action layer entirely.
//
// Uses the seeded `seed@example.com` user (Wave 1 review baseline) — no
// ad-hoc upserts.
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { db } from "@/lib/db";

const SEED_EMAIL = "seed@example.com";
const TEST_SLUG_PREFIX = "cxn-";

const createdProjectIds: string[] = [];
const createdRevisionIds: string[] = [];
const createdChecklistIds: string[] = [];

let userId: string;
let checklistId: string;

beforeAll(async () => {
  const user = await db.user.findUniqueOrThrow({
    where: { email: SEED_EMAIL },
  });
  userId = user.id;

  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const project = await db.project.create({
    data: {
      slug: `${TEST_SLUG_PREFIX}${stamp}`,
      name: "checklist item CHECK fixture",
      createdById: userId,
    },
  });
  createdProjectIds.push(project.id);

  const revision = await db.revision.create({
    data: { projectId: project.id, label: "v1" },
  });
  createdRevisionIds.push(revision.id);

  const checklist = await db.checklist.create({
    data: {
      revisionId: revision.id,
      stage: "REQUIREMENTS",
      subkind: "GENERIC",
      title: "cxn fixture",
      createdById: userId,
    },
  });
  checklistId = checklist.id;
  createdChecklistIds.push(checklist.id);
});

afterAll(async () => {
  if (createdChecklistIds.length > 0) {
    await db.checklist.deleteMany({
      where: { id: { in: createdChecklistIds } },
    });
  }
  if (createdRevisionIds.length > 0) {
    await db.revision.deleteMany({
      where: { id: { in: createdRevisionIds } },
    });
  }
  if (createdProjectIds.length > 0) {
    await db.project.deleteMany({
      where: { id: { in: createdProjectIds } },
    });
  }
});

describe("CHECK checklist_item_checked_xor_napplicable", () => {
  test("rejects an item with checked=true AND notApplicable=true", async () => {
    const id = `cxn-bad-${Date.now()}`;
    await expect(
      db.$executeRawUnsafe(`
        INSERT INTO "ChecklistItem" (id, "checklistId", ordinal, label, checked, "notApplicable")
        VALUES ('${id}', '${checklistId}', 99, 'bad', true, true)
      `),
    ).rejects.toThrow(/checklist_item_checked_xor_napplicable|check/i);
  });

  test("allows checked=true, notApplicable=false", async () => {
    const id = `cxn-ok-c-${Date.now()}`;
    await db.$executeRawUnsafe(`
      INSERT INTO "ChecklistItem" (id, "checklistId", ordinal, label, checked, "notApplicable")
      VALUES ('${id}', '${checklistId}', 100, 'ok-c', true, false)
    `);
    await db.checklistItem.delete({ where: { id } });
  });

  test("allows checked=false, notApplicable=true", async () => {
    const id = `cxn-ok-na-${Date.now()}`;
    await db.$executeRawUnsafe(`
      INSERT INTO "ChecklistItem" (id, "checklistId", ordinal, label, checked, "notApplicable")
      VALUES ('${id}', '${checklistId}', 101, 'ok-na', false, true)
    `);
    await db.checklistItem.delete({ where: { id } });
  });
});
