// Tests for BomLine server actions (Task 5.4).
//
// We need a Revision that isn't BOM-frozen AND isn't Revision-frozen for
// the happy path. The seeded `v1` revision is at BRINGUP with bomFrozenAt
// set — perfect for the *rejection* tests but not for the create path.
// So for the create path we make a throwaway revision (no copy-forward,
// stays at REQUIREMENTS, bomFrozenAt=null, frozenAt=null).
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockAuth = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({
  auth: () => mockAuth(),
}));

import { db } from "@/lib/db";
import { createRevision } from "@/lib/actions/revisions";
import {
  createBomLine,
  deleteBomLine,
  editBomLine,
} from "@/lib/actions/bom-lines";

const SEED_EMAIL = "seed@example.com";
const SEED_PROJECT_SLUG = "esp32-sensor-breakout";

const createdRevisionIds: string[] = [];
const createdBomLineIds: string[] = [];
const createdPartIds: string[] = [];

beforeAll(() => {
  mockAuth.mockImplementation(async () => ({
    user: { email: SEED_EMAIL },
  }));
});

afterAll(async () => {
  if (createdBomLineIds.length > 0) {
    await db.bomLine.deleteMany({
      where: { id: { in: createdBomLineIds } },
    });
  }
  if (createdRevisionIds.length > 0) {
    await db.revision.deleteMany({
      where: { id: { in: createdRevisionIds } },
    });
  }
  if (createdPartIds.length > 0) {
    await db.part.deleteMany({
      where: { id: { in: createdPartIds } },
    });
  }
});

async function makeFreshPart(): Promise<{ id: string }> {
  const seedUser = await db.user.findUniqueOrThrow({
    where: { email: SEED_EMAIL },
  });
  const stamp = Date.now() + Math.floor(Math.random() * 1000);
  const part = await db.part.create({
    data: {
      manufacturer: "TestCo",
      mpn: `T-${stamp}`,
      description: "test part",
      createdById: seedUser.id,
    },
  });
  createdPartIds.push(part.id);
  return part;
}

async function makeFreshRevision(label: string) {
  const project = await db.project.findUniqueOrThrow({
    where: { slug: SEED_PROJECT_SLUG },
  });
  const rev = await createRevision({ projectId: project.id, label });
  createdRevisionIds.push(rev.id);
  return rev;
}

async function aPart() {
  const part = await db.part.findFirstOrThrow({});
  return part;
}

describe("createBomLine — Zod refdes-count invariant", () => {
  test("rejects when refDes count != quantity (caught by Zod before DB)", async () => {
    const rev = await makeFreshRevision(`t5.4-zod-${Date.now()}`);
    const part = await aPart();
    await expect(
      createBomLine({
        revisionId: rev.id,
        partId: part.id,
        refDes: "C1,C2",
        quantity: 3,
      }),
    ).rejects.toThrow();
  });

  test("happy path: matching count creates the row", async () => {
    const rev = await makeFreshRevision(`t5.4-create-${Date.now()}`);
    const part = await aPart();
    const line = await createBomLine({
      revisionId: rev.id,
      partId: part.id,
      refDes: "C1,C2,C3",
      quantity: 3,
    });
    createdBomLineIds.push(line.id);
    expect(line.refDes).toBe("C1,C2,C3");
    expect(line.quantity).toBe(3);
    expect(line.revisionId).toBe(rev.id);
  });
});

describe("createBomLine — freeze policy", () => {
  test("rejects when BOM is frozen (seeded v1 has bomFrozenAt set)", async () => {
    const project = await db.project.findUniqueOrThrow({
      where: { slug: SEED_PROJECT_SLUG },
    });
    const sourceRev = await db.revision.findFirstOrThrow({
      where: { projectId: project.id, label: { equals: "v1", mode: "insensitive" } },
    });
    expect(sourceRev.bomFrozenAt).not.toBeNull();

    // Use a freshly-minted Part so the `@@unique([revisionId, partId])`
    // doesn't compete with the assert — we want assertBomNotFrozen to fire
    // first, not the unique violation.
    const part = await makeFreshPart();

    await expect(
      createBomLine({
        revisionId: sourceRev.id,
        partId: part.id,
        refDes: "X1",
        quantity: 1,
      }),
    ).rejects.toThrow(/BOM is frozen/i);
  });

  test("rejects when revision is frozen", async () => {
    const rev = await makeFreshRevision(`t5.4-frz-${Date.now()}`);
    const seedUser = await db.user.findUniqueOrThrow({
      where: { email: SEED_EMAIL },
    });
    await db.revision.update({
      where: { id: rev.id },
      data: { frozenAt: new Date(), frozenById: seedUser.id },
    });
    const part = await aPart();
    await expect(
      createBomLine({
        revisionId: rev.id,
        partId: part.id,
        refDes: "X1",
        quantity: 1,
      }),
    ).rejects.toThrow(/frozen/i);
  });
});

describe("editBomLine + deleteBomLine — normal CRUD", () => {
  test("edit updates refDes + quantity together", async () => {
    const rev = await makeFreshRevision(`t5.4-edit-${Date.now()}`);
    const part = await aPart();
    const line = await createBomLine({
      revisionId: rev.id,
      partId: part.id,
      refDes: "R1",
      quantity: 1,
    });
    createdBomLineIds.push(line.id);

    const updated = await editBomLine({
      id: line.id,
      refDes: "R1,R2",
      quantity: 2,
    });
    expect(updated.refDes).toBe("R1,R2");
    expect(updated.quantity).toBe(2);
  });

  test("edit rejects mismatched refDes/quantity update", async () => {
    const rev = await makeFreshRevision(`t5.4-edit-bad-${Date.now()}`);
    const part = await aPart();
    const line = await createBomLine({
      revisionId: rev.id,
      partId: part.id,
      refDes: "R1",
      quantity: 1,
    });
    createdBomLineIds.push(line.id);

    await expect(
      editBomLine({ id: line.id, refDes: "R1,R2", quantity: 3 }),
    ).rejects.toThrow();
  });

  test("delete removes the row", async () => {
    const rev = await makeFreshRevision(`t5.4-del-${Date.now()}`);
    const part = await aPart();
    const line = await createBomLine({
      revisionId: rev.id,
      partId: part.id,
      refDes: "R1",
      quantity: 1,
    });
    await deleteBomLine({ id: line.id });
    const fresh = await db.bomLine.findUnique({ where: { id: line.id } });
    expect(fresh).toBeNull();
  });
});
