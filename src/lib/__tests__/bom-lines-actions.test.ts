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
  importBomCsv,
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

// ─── WS1: second-source alt-MPN fields ─────────────────────────────────────

describe("BomLine alt-MPN (WS1)", () => {
  test("create carries altMpn + altManufacturer; edit updates altMpn alone", async () => {
    const rev = await makeFreshRevision(`t-ws1-alt-${Date.now()}`);
    const part = await aPart();

    const line = await createBomLine({
      revisionId: rev.id,
      partId: part.id,
      refDes: "U9",
      quantity: 1,
      altMpn: "ALT-123",
      altManufacturer: "AltCorp",
    });
    createdBomLineIds.push(line.id);
    expect(line.altMpn).toBe("ALT-123");
    expect(line.altManufacturer).toBe("AltCorp");

    const edited = await editBomLine({ id: line.id, altMpn: "ALT-456" });
    expect(edited.altMpn).toBe("ALT-456");
    // untouched field preserved
    expect(edited.altManufacturer).toBe("AltCorp");
  });

  test("alt fields default to null when omitted", async () => {
    const rev = await makeFreshRevision(`t-ws1-alt-null-${Date.now()}`);
    const part = await aPart();
    const line = await createBomLine({
      revisionId: rev.id,
      partId: part.id,
      refDes: "U10",
      quantity: 1,
    });
    createdBomLineIds.push(line.id);
    expect(line.altMpn).toBeNull();
    expect(line.altManufacturer).toBeNull();
  });
});

// ─── WS3: per-line unit price ──────────────────────────────────────────────

describe("BomLine unitPriceCents (WS3)", () => {
  test("create carries unitPriceCents; edit updates it; omitted → null", async () => {
    const rev = await makeFreshRevision(`t-ws3-price-${Date.now()}`);
    const part = await aPart();

    const line = await createBomLine({
      revisionId: rev.id,
      partId: part.id,
      refDes: "U11",
      quantity: 1,
      unitPriceCents: 123,
    });
    createdBomLineIds.push(line.id);
    expect(line.unitPriceCents).toBe(123);

    const edited = await editBomLine({ id: line.id, unitPriceCents: 456 });
    expect(edited.unitPriceCents).toBe(456);

    const rev2 = await makeFreshRevision(`t-ws3-price-null-${Date.now()}`);
    const line2 = await createBomLine({
      revisionId: rev2.id,
      partId: part.id,
      refDes: "U12",
      quantity: 1,
    });
    createdBomLineIds.push(line2.id);
    expect(line2.unitPriceCents).toBeNull();
  });
});

// ─── WS3: CSV import (strict-match upsert) ─────────────────────────────────

describe("importBomCsv (WS3)", () => {
  test("matched rows create, re-import updates; unmatched reported; frozen rejected", async () => {
    const rev = await makeFreshRevision(`t-ws3-import-${Date.now()}`);
    const part = await aPart(); // existing curated part with known manufacturer+mpn

    const csv =
      "refDes,manufacturer,mpn,quantity,unitPrice\n" +
      `R1,${part.manufacturer},${part.mpn},1,0.05\n` +
      "U1,NoSuch,NS-404,1,9.99";

    const r1 = await importBomCsv({ revisionId: rev.id, csv });
    // track the created line for cleanup
    const created1 = await db.bomLine.findFirst({
      where: { revisionId: rev.id, partId: part.id },
    });
    if (created1) createdBomLineIds.push(created1.id);
    expect(r1.created).toBe(1);
    expect(r1.updated).toBe(0);
    expect(r1.unmatched).toHaveLength(1);
    expect(r1.unmatched[0]!.mpn).toBe("NS-404");

    // re-import the matched row with a new price → update, not duplicate
    const r2 = await importBomCsv({
      revisionId: rev.id,
      csv: `refDes,manufacturer,mpn,quantity,unitPrice\nR1,${part.manufacturer},${part.mpn},1,0.07`,
    });
    expect(r2.created).toBe(0);
    expect(r2.updated).toBe(1);
    const line = await db.bomLine.findFirstOrThrow({
      where: { revisionId: rev.id, partId: part.id },
    });
    expect(line.unitPriceCents).toBe(7);

    // freeze the BOM → import rejected
    await db.revision.update({
      where: { id: rev.id },
      data: { bomFrozenAt: new Date() },
    });
    await expect(
      importBomCsv({
        revisionId: rev.id,
        csv: `refDes,manufacturer,mpn,quantity\nR2,${part.manufacturer},${part.mpn},1`,
      }),
    ).rejects.toThrow(/frozen/i);
  });
});
