// Tests for the PartFact server actions — the verification GATE (design §4).
//
// This is the trust foundation: every fact-group moves through
// `UNVERIFIED → VERIFIED → FLAGGED` only via these deliberate server actions,
// each behind `requireUser` + (for mutations) optimistic concurrency. The
// guarantees under test:
//   - `createFact` validates the provenance ENVELOPE strictly (a typo'd key
//     like `sourcePag` is REJECTED, not silently dropped) AND validates `data`
//     via `factDataSchema(group, part.category)`; defaults trust UNVERIFIED.
//   - `verifyFact` enforces the per-`sourceKind` VERIFIED precondition
//     (DATASHEET ⇒ source + a page anchor; MANUAL ⇒ a stated basis) and allows
//     self-verification.
//   - `editFact` is FIELD-GRANULAR auto-demote: a change to `data` OR a ROW
//     provenance anchor (partDatasheetId/sourcePage/sourceUrl/sourceKind)
//     demotes VERIFIED → UNVERIFIED + clears the verifier; a `sourceNote`-only
//     edit does NOT demote.
//   - Optimistic concurrency: a stale `updatedAt` on edit/verify is rejected
//     ("reload") and NO write happens.
//   - `flagFact` → FLAGGED (and `lookupPart` then excludes it); `clearFlag`
//     → UNVERIFIED only (NEVER straight to VERIFIED).
//   - `shouldDemote` pure-function unit cases.
//
// Exercises the real Neon DB. Mocks `next/cache` + `@/auth` exactly like
// `guide-save-card.test.ts` — `requireUser()` resolves the mocked session email
// to the seeded User row. Isolation: ONE throwaway Part (cascading its
// PartFacts) created in `beforeAll`, torn down in `afterAll` (which asserts zero
// leftover rows). The real curriculum / seed data is never touched.
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockAuth = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({
  auth: () => mockAuth(),
}));

import { db } from "@/lib/db";
import {
  clearFlag,
  createFact,
  editFact,
  flagFact,
  shouldDemote,
  verifyFact,
} from "@/lib/actions/part-facts";
import { lookupPart } from "@/lib/parts-knowledge/query";

const SEED_EMAIL = "seed@example.com";
const TEST_MFR = "PartFactsActions-TestCo";
const TEST_MPN = `PFA-${Date.now()}`;

let seedUserId: string;
let throwawayPartId: string;

beforeAll(async () => {
  mockAuth.mockImplementation(async () => ({
    user: { email: SEED_EMAIL },
  }));

  const seedUser = await db.user.findUniqueOrThrow({
    where: { email: SEED_EMAIL },
    select: { id: true },
  });
  seedUserId = seedUser.id;

  // The part under test — MLCC_CAPACITOR so PARAMETRICS carries the
  // capacitance/voltage/dielectric required-key refinement.
  const part = await db.part.create({
    data: {
      manufacturer: TEST_MFR,
      mpn: TEST_MPN,
      description: "part-facts actions test part",
      category: "MLCC_CAPACITOR",
      createdById: seedUserId,
    },
    select: { id: true },
  });
  throwawayPartId = part.id;
});

afterAll(async () => {
  // Part delete cascades its PartFacts. Sweep by id and by test-manufacturer.
  if (throwawayPartId) {
    await db.part.deleteMany({ where: { id: throwawayPartId } }).catch(() => {});
  }
  await db.part.deleteMany({ where: { manufacturer: TEST_MFR } }).catch(() => {});

  const leftoverParts = throwawayPartId
    ? await db.part.count({ where: { id: throwawayPartId } })
    : 0;
  const leftoverFacts = throwawayPartId
    ? await db.partFact.count({ where: { partId: throwawayPartId } })
    : 0;
  expect(leftoverParts).toBe(0);
  expect(leftoverFacts).toBe(0);
});

// Helper: a valid MLCC PARAMETRICS payload satisfying the required-key refinement.
function validParametricsData() {
  return {
    entries: [
      { label: "capacitance", value: "10uF" },
      { label: "voltage", value: "10V" },
      { label: "dielectric", value: "X5R" },
    ],
  };
}

// Helper: delete a fact by id (between tests that reuse a group on the part —
// `@@unique([partId, group])` only allows one row per group).
async function deleteFact(id: string) {
  await db.partFact.deleteMany({ where: { id } }).catch(() => {});
}

// ─── shouldDemote (pure) ────────────────────────────────────────────────────
describe("shouldDemote (pure)", () => {
  const base = {
    data: { entries: [{ label: "capacitance", value: "10uF" }] },
    partDatasheetId: null as string | null,
    sourcePage: 4 as number | null,
    sourceUrl: null as string | null,
    sourceKind: "DATASHEET" as const,
  };

  test("a data change demotes", () => {
    expect(
      shouldDemote(base, {
        ...base,
        data: { entries: [{ label: "capacitance", value: "22uF" }] },
      }),
    ).toBe(true);
  });

  test("a sourcePage change demotes", () => {
    expect(shouldDemote(base, { ...base, sourcePage: 5 })).toBe(true);
  });

  test("a sourceUrl change demotes", () => {
    expect(
      shouldDemote(base, { ...base, sourceUrl: "https://example.com/ds.pdf" }),
    ).toBe(true);
  });

  test("a sourceKind change demotes", () => {
    expect(shouldDemote(base, { ...base, sourceKind: "MANUAL" })).toBe(true);
  });

  test("a partDatasheetId change demotes", () => {
    expect(shouldDemote(base, { ...base, partDatasheetId: "ds_123" })).toBe(
      true,
    );
  });

  test("a sourceNote-only change does NOT demote", () => {
    // sourceNote isn't part of the demote-relevant field set, so even with a
    // brand-new note the stored vs next comparison is a no-op.
    expect(shouldDemote(base, { ...base })).toBe(false);
  });

  test("identical data + anchors is a no-op (no demote)", () => {
    // Deep-equal `data` (different object identity, same content) → no demote.
    expect(
      shouldDemote(base, {
        ...base,
        data: { entries: [{ label: "capacitance", value: "10uF" }] },
      }),
    ).toBe(false);
  });
});

// ─── createFact ─────────────────────────────────────────────────────────────
describe("createFact", () => {
  test("defaults trust UNVERIFIED and stamps createdById", async () => {
    const fact = await createFact({
      partId: throwawayPartId,
      group: "PARAMETRICS",
      data: validParametricsData(),
      sourceKind: "DATASHEET",
      sourcePage: 4,
    });
    try {
      expect(fact.trust).toBe("UNVERIFIED");
      expect(fact.createdById).toBe(seedUserId);
      expect(fact.group).toBe("PARAMETRICS");
    } finally {
      await deleteFact(fact.id);
    }
  });

  test("rejects bad `data` for the category (missing required parametric)", async () => {
    await expect(
      createFact({
        partId: throwawayPartId,
        group: "PARAMETRICS",
        // Missing voltage + dielectric → MLCC required-key refinement fails.
        data: { entries: [{ label: "capacitance", value: "10uF" }] },
        sourceKind: "DATASHEET",
        sourcePage: 4,
      }),
    ).rejects.toThrow();
    // No row leaked.
    const count = await db.partFact.count({
      where: { partId: throwawayPartId, group: "PARAMETRICS" },
    });
    expect(count).toBe(0);
  });

  test("rejects a typo'd provenance key via .strict() (sourcePag)", async () => {
    await expect(
      createFact({
        partId: throwawayPartId,
        group: "PARAMETRICS",
        data: validParametricsData(),
        sourceKind: "DATASHEET",
        // Typo: `sourcePag` instead of `sourcePage` — must be REJECTED, not
        // silently dropped (which would lose the provenance anchor).
        sourcePag: 4,
      } as unknown),
    ).rejects.toThrow();
    const count = await db.partFact.count({
      where: { partId: throwawayPartId, group: "PARAMETRICS" },
    });
    expect(count).toBe(0);
  });

  test("rejects a duplicate group with a friendly error", async () => {
    const first = await createFact({
      partId: throwawayPartId,
      group: "PINOUT",
      data: { pins: [{ number: "1", name: "VIN", function: "power" }] },
      sourceKind: "DATASHEET",
      sourcePage: 3,
    });
    try {
      await expect(
        createFact({
          partId: throwawayPartId,
          group: "PINOUT",
          data: { pins: [{ number: "2", name: "GND", function: "gnd" }] },
          sourceKind: "DATASHEET",
          sourcePage: 3,
        }),
      ).rejects.toThrow(/already/i);
    } finally {
      await deleteFact(first.id);
    }
  });
});

// ─── verifyFact — per-sourceKind precondition ──────────────────────────────
describe("verifyFact precondition", () => {
  test("DATASHEET with a ROW page anchor + source succeeds (self-verify allowed)", async () => {
    const fact = await createFact({
      partId: throwawayPartId,
      group: "PARAMETRICS",
      data: validParametricsData(),
      sourceKind: "DATASHEET",
      sourceUrl: "https://example.com/ds.pdf",
      sourcePage: 4,
    });
    try {
      const verified = await verifyFact({
        id: fact.id,
        updatedAt: fact.updatedAt,
      });
      expect(verified.trust).toBe("VERIFIED");
      expect(verified.verifiedById).toBe(seedUserId);
      expect(verified.verifiedAt).not.toBeNull();
      // Self-verification: verifier === creator is fine.
      expect(verified.verifiedById).toBe(verified.createdById);
    } finally {
      await deleteFact(fact.id);
    }
  });

  test("DATASHEET with an ELEMENT page anchor (no row page) succeeds", async () => {
    const fact = await createFact({
      partId: throwawayPartId,
      group: "PARAMETRICS",
      data: {
        entries: [
          { label: "capacitance", value: "10uF", sourcePage: 7 },
          { label: "voltage", value: "10V" },
          { label: "dielectric", value: "X5R" },
        ],
      },
      sourceKind: "DATASHEET",
      sourceUrl: "https://example.com/ds.pdf",
      // No row sourcePage — relies on the element anchor.
    });
    try {
      const verified = await verifyFact({
        id: fact.id,
        updatedAt: fact.updatedAt,
      });
      expect(verified.trust).toBe("VERIFIED");
    } finally {
      await deleteFact(fact.id);
    }
  });

  test("DATASHEET with NO page anchor (row or element) is rejected", async () => {
    const fact = await createFact({
      partId: throwawayPartId,
      group: "PARAMETRICS",
      data: validParametricsData(),
      sourceKind: "DATASHEET",
      sourceUrl: "https://example.com/ds.pdf",
      // No sourcePage, and no element carries one → reject.
    });
    try {
      await expect(
        verifyFact({ id: fact.id, updatedAt: fact.updatedAt }),
      ).rejects.toThrow();
      const row = await db.partFact.findUniqueOrThrow({
        where: { id: fact.id },
        select: { trust: true },
      });
      expect(row.trust).toBe("UNVERIFIED");
    } finally {
      await deleteFact(fact.id);
    }
  });

  test("DATASHEET with a page anchor but NO source (no datasheet/url) is rejected", async () => {
    const fact = await createFact({
      partId: throwawayPartId,
      group: "PARAMETRICS",
      data: validParametricsData(),
      sourceKind: "DATASHEET",
      sourcePage: 4,
      // No partDatasheetId, no sourceUrl → reject.
    });
    try {
      await expect(
        verifyFact({ id: fact.id, updatedAt: fact.updatedAt }),
      ).rejects.toThrow();
    } finally {
      await deleteFact(fact.id);
    }
  });

  test("MANUAL with a non-empty sourceNote succeeds; without it rejects", async () => {
    // MANUAL NOTES with a stated basis → verifiable.
    const withNote = await createFact({
      partId: throwawayPartId,
      group: "NOTES",
      data: { blocks: [{ type: "prose", md: "bypass rationale" }] },
      sourceKind: "MANUAL",
      sourceNote: "Reviewed against AN-1234, editorial sign-off.",
    });
    try {
      const verified = await verifyFact({
        id: withNote.id,
        updatedAt: withNote.updatedAt,
      });
      expect(verified.trust).toBe("VERIFIED");
    } finally {
      await deleteFact(withNote.id);
    }

    // MANUAL with no sourceNote → reject.
    const noNote = await createFact({
      partId: throwawayPartId,
      group: "NOTES",
      data: { blocks: [{ type: "prose", md: "bypass rationale" }] },
      sourceKind: "MANUAL",
    });
    try {
      await expect(
        verifyFact({ id: noNote.id, updatedAt: noNote.updatedAt }),
      ).rejects.toThrow();
    } finally {
      await deleteFact(noNote.id);
    }
  });
});

// ─── editFact — field-granular auto-demote ─────────────────────────────────
describe("editFact auto-demote", () => {
  test("editing `data` of a VERIFIED fact demotes to UNVERIFIED + clears verifier", async () => {
    const fact = await createFact({
      partId: throwawayPartId,
      group: "PARAMETRICS",
      data: validParametricsData(),
      sourceKind: "DATASHEET",
      sourceUrl: "https://example.com/ds.pdf",
      sourcePage: 4,
    });
    try {
      const v = await verifyFact({ id: fact.id, updatedAt: fact.updatedAt });
      expect(v.trust).toBe("VERIFIED");

      const edited = await editFact({
        id: v.id,
        updatedAt: v.updatedAt,
        group: "PARAMETRICS",
        data: {
          entries: [
            { label: "capacitance", value: "22uF" }, // changed
            { label: "voltage", value: "10V" },
            { label: "dielectric", value: "X5R" },
          ],
        },
        sourceKind: "DATASHEET",
        sourceUrl: "https://example.com/ds.pdf",
        sourcePage: 4,
      });
      expect(edited.trust).toBe("UNVERIFIED");
      expect(edited.verifiedById).toBeNull();
      expect(edited.verifiedAt).toBeNull();
      expect(edited.lastEditedById).toBe(seedUserId);
    } finally {
      await deleteFact(fact.id);
    }
  });

  test("changing sourcePage of a VERIFIED fact demotes", async () => {
    const fact = await createFact({
      partId: throwawayPartId,
      group: "PARAMETRICS",
      data: validParametricsData(),
      sourceKind: "DATASHEET",
      sourceUrl: "https://example.com/ds.pdf",
      sourcePage: 4,
    });
    try {
      const v = await verifyFact({ id: fact.id, updatedAt: fact.updatedAt });
      const edited = await editFact({
        id: v.id,
        updatedAt: v.updatedAt,
        group: "PARAMETRICS",
        data: validParametricsData(), // unchanged
        sourceKind: "DATASHEET",
        sourceUrl: "https://example.com/ds.pdf",
        sourcePage: 5, // anchor changed
      });
      expect(edited.trust).toBe("UNVERIFIED");
      expect(edited.verifiedById).toBeNull();
    } finally {
      await deleteFact(fact.id);
    }
  });

  test("changing ONLY sourceNote leaves a VERIFIED fact VERIFIED", async () => {
    const fact = await createFact({
      partId: throwawayPartId,
      group: "PARAMETRICS",
      data: validParametricsData(),
      sourceKind: "DATASHEET",
      sourceUrl: "https://example.com/ds.pdf",
      sourcePage: 4,
      sourceNote: "original note",
    });
    try {
      const v = await verifyFact({ id: fact.id, updatedAt: fact.updatedAt });
      expect(v.trust).toBe("VERIFIED");

      const edited = await editFact({
        id: v.id,
        updatedAt: v.updatedAt,
        group: "PARAMETRICS",
        data: validParametricsData(), // unchanged
        sourceKind: "DATASHEET",
        sourceUrl: "https://example.com/ds.pdf", // unchanged
        sourcePage: 4, // unchanged
        sourceNote: "revised cosmetic note", // ONLY this changed
      });
      // sourceNote is NOT a demote trigger → stays VERIFIED, verifier intact.
      expect(edited.trust).toBe("VERIFIED");
      expect(edited.verifiedById).toBe(seedUserId);
      expect(edited.sourceNote).toBe("revised cosmetic note");
    } finally {
      await deleteFact(fact.id);
    }
  });
});

// ─── Optimistic concurrency ─────────────────────────────────────────────────
describe("optimistic concurrency", () => {
  test("a stale updatedAt on editFact is rejected and the row is unchanged", async () => {
    const fact = await createFact({
      partId: throwawayPartId,
      group: "PARAMETRICS",
      data: validParametricsData(),
      sourceKind: "DATASHEET",
      sourcePage: 4,
    });
    try {
      const staleUpdatedAt = fact.updatedAt;
      // A concurrent edit moves updatedAt forward.
      const moved = await editFact({
        id: fact.id,
        updatedAt: fact.updatedAt,
        group: "PARAMETRICS",
        data: validParametricsData(),
        sourceKind: "DATASHEET",
        sourcePage: 9, // bump the page so the row genuinely changes
      });
      expect(moved.sourcePage).toBe(9);

      // Now a second edit carrying the STALE updatedAt must be rejected.
      await expect(
        editFact({
          id: fact.id,
          updatedAt: staleUpdatedAt,
          group: "PARAMETRICS",
          data: validParametricsData(),
          sourceKind: "DATASHEET",
          sourcePage: 99,
        }),
      ).rejects.toThrow(/reload|changed/i);

      // No write from the stale call: the page is still 9, not 99.
      const row = await db.partFact.findUniqueOrThrow({
        where: { id: fact.id },
        select: { sourcePage: true },
      });
      expect(row.sourcePage).toBe(9);
    } finally {
      await deleteFact(fact.id);
    }
  });

  test("a stale updatedAt on verifyFact is rejected and the row stays UNVERIFIED", async () => {
    const fact = await createFact({
      partId: throwawayPartId,
      group: "PARAMETRICS",
      data: validParametricsData(),
      sourceKind: "DATASHEET",
      sourceUrl: "https://example.com/ds.pdf",
      sourcePage: 4,
    });
    try {
      const staleUpdatedAt = fact.updatedAt;
      // A concurrent edit bumps updatedAt.
      await editFact({
        id: fact.id,
        updatedAt: fact.updatedAt,
        group: "PARAMETRICS",
        data: validParametricsData(),
        sourceKind: "DATASHEET",
        sourceUrl: "https://example.com/ds.pdf",
        sourcePage: 8,
      });

      await expect(
        verifyFact({ id: fact.id, updatedAt: staleUpdatedAt }),
      ).rejects.toThrow(/reload|changed/i);

      // Verify never stamped VERIFIED onto the row that changed underneath.
      const row = await db.partFact.findUniqueOrThrow({
        where: { id: fact.id },
        select: { trust: true, verifiedById: true },
      });
      expect(row.trust).toBe("UNVERIFIED");
      expect(row.verifiedById).toBeNull();
    } finally {
      await deleteFact(fact.id);
    }
  });
});

// ─── flagFact + clearFlag ───────────────────────────────────────────────────
describe("flagFact + clearFlag", () => {
  test("flagFact sets FLAGGED, and lookupPart then excludes the fact", async () => {
    const fact = await createFact({
      partId: throwawayPartId,
      group: "PARAMETRICS",
      data: validParametricsData(),
      sourceKind: "DATASHEET",
      sourceUrl: "https://example.com/ds.pdf",
      sourcePage: 4,
    });
    try {
      const v = await verifyFact({ id: fact.id, updatedAt: fact.updatedAt });
      expect(v.trust).toBe("VERIFIED");

      // Cross-check: while VERIFIED, lookupPart returns the PARAMETRICS group.
      const before = await lookupPart(db, { partId: throwawayPartId });
      expect(before.found).toBe(true);
      if (!before.found) throw new Error("expected found");
      expect(before.facts.map((f) => f.group)).toContain("PARAMETRICS");

      const flagged = await flagFact({ id: v.id, updatedAt: v.updatedAt });
      expect(flagged.trust).toBe("FLAGGED");

      // Task-3 cross-check: a FLAGGED fact is NEVER returned by lookupPart,
      // even with includeUnverified.
      const after = await lookupPart(db, {
        partId: throwawayPartId,
        includeUnverified: true,
      });
      expect(after.found).toBe(true);
      if (!after.found) throw new Error("expected found");
      expect(after.facts.map((f) => f.group)).not.toContain("PARAMETRICS");
      expect(
        (after.unverified ?? []).map((f) => f.group),
      ).not.toContain("PARAMETRICS");
    } finally {
      await deleteFact(fact.id);
    }
  });

  test("clearFlag moves FLAGGED → UNVERIFIED (never straight to VERIFIED)", async () => {
    const fact = await createFact({
      partId: throwawayPartId,
      group: "PARAMETRICS",
      data: validParametricsData(),
      sourceKind: "DATASHEET",
      sourcePage: 4,
    });
    try {
      const flagged = await flagFact({
        id: fact.id,
        updatedAt: fact.updatedAt,
      });
      expect(flagged.trust).toBe("FLAGGED");

      const cleared = await clearFlag({
        id: flagged.id,
        updatedAt: flagged.updatedAt,
      });
      expect(cleared.trust).toBe("UNVERIFIED");
      expect(cleared.verifiedById).toBeNull();
    } finally {
      await deleteFact(fact.id);
    }
  });

  test("clearFlag on a non-FLAGGED row is rejected", async () => {
    const fact = await createFact({
      partId: throwawayPartId,
      group: "PARAMETRICS",
      data: validParametricsData(),
      sourceKind: "DATASHEET",
      sourcePage: 4,
    });
    try {
      // Row is UNVERIFIED, not FLAGGED → clearFlag must reject.
      await expect(
        clearFlag({ id: fact.id, updatedAt: fact.updatedAt }),
      ).rejects.toThrow();
    } finally {
      await deleteFact(fact.id);
    }
  });
});
