// Tests for Part server actions (Task 5.5).
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockAuth = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({
  auth: () => mockAuth(),
}));

import { db } from "@/lib/db";
import { createPart } from "@/lib/actions/parts";

const SEED_EMAIL = "seed@example.com";
const TEST_MFR = "T5.5-TestCo";

const createdPartIds: string[] = [];

beforeAll(() => {
  mockAuth.mockImplementation(async () => ({
    user: { email: SEED_EMAIL },
  }));
});

afterAll(async () => {
  if (createdPartIds.length > 0) {
    await db.part.deleteMany({
      where: { id: { in: createdPartIds } },
    });
  }
  // Sweep stray rows with the test manufacturer prefix.
  await db.part.deleteMany({
    where: { manufacturer: TEST_MFR },
  });
});

describe("createPart", () => {
  test("valid input creates the row with createdBy set", async () => {
    const seedUser = await db.user.findUniqueOrThrow({
      where: { email: SEED_EMAIL },
    });
    const mpn = `MPN-${Date.now()}`;
    const part = await createPart({
      manufacturer: TEST_MFR,
      mpn,
      description: "Phase 5.5 test part",
      // category is now constrained to the PartCategory enum (Task 5); a
      // canonical token round-trips, free text is rejected (see below).
      category: "MLCC_CAPACITOR",
      lifecycle: "ACTIVE",
    });
    createdPartIds.push(part.id);

    expect(part.manufacturer).toBe(TEST_MFR);
    expect(part.mpn).toBe(mpn);
    expect(part.description).toBe("Phase 5.5 test part");
    expect(part.category).toBe("MLCC_CAPACITOR");
    expect(part.createdById).toBe(seedUser.id);
    expect(part.lifecycle).toBe("ACTIVE");
  });

  // Task 5: category is constrained to the PartCategory enum at the schema
  // boundary; a non-canonical free-text value is a ZodError, not a silent NULL.
  test("rejects a non-PartCategory category via Zod", async () => {
    await expect(
      createPart({
        manufacturer: TEST_MFR,
        mpn: `BADCAT-${Date.now()}`,
        description: "bad category",
        category: "TEST",
      }),
    ).rejects.toThrow();
  });

  test("duplicate (manufacturer, mpn) returns a clean error", async () => {
    const mpn = `DUP-${Date.now()}`;
    const first = await createPart({
      manufacturer: TEST_MFR,
      mpn,
      description: "first",
    });
    createdPartIds.push(first.id);

    await expect(
      createPart({
        manufacturer: TEST_MFR,
        mpn,
        description: "second attempt",
      }),
    ).rejects.toThrow(/already exists/i);
  });

  test("rejects missing required fields via Zod", async () => {
    await expect(
      createPart({
        manufacturer: TEST_MFR,
        // mpn missing
        description: "missing mpn",
      }),
    ).rejects.toThrow();
  });

  test("lifecycle defaults to ACTIVE when not supplied", async () => {
    const mpn = `DEF-${Date.now()}`;
    const part = await createPart({
      manufacturer: TEST_MFR,
      mpn,
      description: "default lifecycle",
    });
    createdPartIds.push(part.id);
    expect(part.lifecycle).toBe("ACTIVE");
  });

  // m18: isCertifiedModule flag fulfills the BOM_SOURCING mains-net gate
  // when project.hasMainsNet === true (proposal §3 #5).
  test("createPart: accepts isCertifiedModule", async () => {
    const mpn = `CERT-${Date.now()}`;
    const part = await createPart({
      manufacturer: TEST_MFR,
      mpn,
      description: "certified module",
      isCertifiedModule: true,
    });
    createdPartIds.push(part.id);
    expect(part.isCertifiedModule).toBe(true);
  });

  test("createPart: isCertifiedModule defaults to false when omitted", async () => {
    const mpn = `CERT-DEF-${Date.now()}`;
    const part = await createPart({
      manufacturer: TEST_MFR,
      mpn,
      description: "default cert flag",
    });
    createdPartIds.push(part.id);
    expect(part.isCertifiedModule).toBe(false);
  });
});

// ─── Phase B — categoryId picker ────────────────────────────────────────────
describe("createPart category picker (categoryId)", () => {
  test("links categoryId and dual-writes the legacy enum for an enum-token leaf", async () => {
    const mlcc = await db.category.findUniqueOrThrow({
      where: { slug: "MLCC_CAPACITOR" },
      select: { id: true },
    });
    const part = await createPart({
      manufacturer: TEST_MFR,
      mpn: `CATID-${Date.now()}`,
      description: "linked via categoryId",
      categoryId: mlcc.id,
    });
    createdPartIds.push(part.id);
    expect(part.categoryId).toBe(mlcc.id);
    // Dual-write: the leaf slug IS an enum token, so the legacy column is set.
    expect(part.category).toBe("MLCC_CAPACITOR");
  });

  test("a categoryId whose slug is NOT an enum token leaves the legacy enum NULL", async () => {
    const slug = `nonenum-leaf-${Date.now()}`;
    const cat = await db.category.create({
      data: { slug, name: "Non-enum Leaf", path: slug, depth: 0, order: 99 },
      select: { id: true },
    });
    try {
      const part = await createPart({
        manufacturer: TEST_MFR,
        mpn: `CATID-NOENUM-${Date.now()}`,
        description: "linked to a non-enum leaf",
        categoryId: cat.id,
      });
      createdPartIds.push(part.id);
      expect(part.categoryId).toBe(cat.id);
      expect(part.category).toBeNull();
    } finally {
      await db.part.deleteMany({ where: { categoryId: cat.id } }).catch(() => {});
      await db.category.deleteMany({ where: { id: cat.id } }).catch(() => {});
    }
  });

  test("an unknown categoryId is rejected", async () => {
    await expect(
      createPart({
        manufacturer: TEST_MFR,
        mpn: `CATID-BAD-${Date.now()}`,
        description: "bad categoryId",
        categoryId: "cat_does_not_exist",
      }),
    ).rejects.toThrow(/category/i);
  });
});
