// Tests for the PartAsset server actions — the verification GATE (design §4,
// Stage C). A near-clone of `part-facts-actions.test.ts` over `PartAsset`.
//
// PartAsset moves through `UNVERIFIED → VERIFIED → FLAGGED` only via these
// deliberate server actions, each behind `requireUser` + (for mutations)
// optimistic concurrency. The guarantees under test:
//   - `verifyPartAsset` precondition: a non-empty `source` ⇒ VERIFIED (+ the
//     verifier stamp); an empty/absent `source` ⇒ rejected; self-verify allowed;
//     a FLAGGED row can't be verified directly.
//   - `editPartAsset` auto-demote: a `ref` OR `source` change demotes
//     VERIFIED → UNVERIFIED + clears the verifier; a `license`-only change stays
//     VERIFIED; `.strict()` rejects a typo'd key; an omitted field CLEARS it.
//   - Optimistic concurrency: a stale `updatedAt` on edit/verify/unverify is
//     rejected ("reload") and NO write happens.
//   - `flagPartAsset` → FLAGGED; `clearPartAssetFlag` → UNVERIFIED only;
//     `unverifyPartAsset` → VERIFIED→UNVERIFIED (clears verifier), rejects
//     non-VERIFIED, does NOT un-flag FLAGGED.
//   - `shouldDemoteAsset` pure-function unit cases.
//
// Exercises the real Neon DB. Mocks `next/cache` + `@/auth` exactly like
// `part-facts-actions.test.ts` — `requireUser()` resolves the mocked session
// email to the seeded User row. Isolation: ONE throwaway Part (cascading its
// PartAssets) created in `beforeAll`, torn down in `afterAll` (which asserts
// zero leftover rows). The real curriculum / seed data is never touched.
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockAuth = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({
  auth: () => mockAuth(),
}));

// `recordPartAsset` / `getPartAssetRenderUrl` HEAD/presign/delete R2. Stub the
// R2 helper layer so these tests never touch the real bucket — the HEAD echoes
// the declared bytes, the presigns return fixed URLs, and DeleteObject is a
// no-op. (`ensureR2Enabled` no-op = R2 "on" regardless of env.)
vi.mock("@/lib/part-r2", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/part-r2")>();
  return {
    ...actual,
    ensureR2Enabled: vi.fn(),                                   // no-op (R2 "on")
    presignPut: vi.fn(async () => "https://r2.example/put"),
    presignGet: vi.fn(async () => "https://r2.example/get"),
    presignGetInline: vi.fn(async () => "https://r2.example/inline"),
    headVerifySize: vi.fn(async (_k: string, declared: number) => declared), // echo bytes
    deleteR2Object: vi.fn(async () => {}),
  };
});

import type { PartAssetKind } from "@prisma/client";

import { db } from "@/lib/db";
import {
  clearPartAssetFlag,
  deletePartAsset,
  editPartAsset,
  flagPartAsset,
  recordPartAsset,
  getPartAssetRenderUrl,
  unverifyPartAsset,
  verifyPartAsset,
} from "@/lib/actions/part-assets";
// `shouldDemoteAsset` is the pure auto-demote decision from the schema module
// (the "use server" action module may only export async functions).
import { shouldDemoteAsset } from "@/lib/schemas/part-asset";

const SEED_EMAIL = "seed@example.com";
const TEST_MFR = "PartAssetsActions-TestCo";
const TEST_MPN = `PAA-${Date.now()}`;

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

  const part = await db.part.create({
    data: {
      manufacturer: TEST_MFR,
      mpn: TEST_MPN,
      description: "part-assets actions test part",
      category: "LDO_REGULATOR",
      createdById: seedUserId,
    },
    select: { id: true },
  });
  throwawayPartId = part.id;
});

afterAll(async () => {
  // Part delete cascades its PartAssets. Sweep by id and by test-manufacturer.
  if (throwawayPartId) {
    await db.part.deleteMany({ where: { id: throwawayPartId } }).catch(() => {});
  }
  await db.part.deleteMany({ where: { manufacturer: TEST_MFR } }).catch(() => {});

  const leftoverParts = throwawayPartId
    ? await db.part.count({ where: { id: throwawayPartId } })
    : 0;
  const leftoverAssets = throwawayPartId
    ? await db.partAsset.count({ where: { partId: throwawayPartId } })
    : 0;
  expect(leftoverParts).toBe(0);
  expect(leftoverAssets).toBe(0);
});

// Helper: create a PartAsset row directly (bypasses the not-yet-built R2 record
// action). Defaults give a minimal valid SYMBOL row; override per-test.
async function createAsset(overrides: {
  kind?: PartAssetKind;
  ref?: string | null;
  source?: string | null;
  license?: string | null;
} = {}) {
  const kind = overrides.kind ?? "SYMBOL";
  return db.partAsset.create({
    data: {
      partId: throwawayPartId,
      kind,
      r2Key: `parts/${throwawayPartId}/${kind.toLowerCase()}-test.kicad_sym`,
      filename: "test.kicad_sym",
      byteSize: 123,
      contentType: "text/plain",
      ref: overrides.ref ?? null,
      source: overrides.source ?? null,
      license: overrides.license ?? null,
      createdById: seedUserId,
    },
  });
}

// Helper: delete an asset by id (between tests that reuse a kind on the part —
// `@@unique([partId, kind])` only allows one row per kind).
async function deleteAsset(id: string) {
  await db.partAsset.deleteMany({ where: { id } }).catch(() => {});
}

// ─── shouldDemoteAsset (pure) ────────────────────────────────────────────────
describe("shouldDemoteAsset (pure)", () => {
  const stored = { ref: "MyComponent", source: "SnapEDA" };

  test("a ref change demotes", () => {
    expect(shouldDemoteAsset(stored, { ref: "Other", source: "SnapEDA" })).toBe(
      true,
    );
  });

  test("a source change demotes", () => {
    expect(
      shouldDemoteAsset(stored, { ref: "MyComponent", source: "SamacSys" }),
    ).toBe(true);
  });

  test("a license-only change does NOT demote", () => {
    // license isn't in the demote-relevant set; ref+source identical → no-op.
    expect(
      shouldDemoteAsset(stored, { ref: "MyComponent", source: "SnapEDA" }),
    ).toBe(false);
  });

  test("clearing a field (null vs empty) is normalized — no spurious demote", () => {
    expect(shouldDemoteAsset({ ref: "", source: null }, {})).toBe(false);
    expect(
      shouldDemoteAsset({ ref: null, source: null }, { ref: "", source: "" }),
    ).toBe(false);
  });
});

// ─── verifyPartAsset — source precondition ──────────────────────────────────
describe("verifyPartAsset precondition", () => {
  test("a non-empty source verifies (self-verify allowed) + stamps verifier", async () => {
    const asset = await createAsset({ kind: "SYMBOL", source: "SnapEDA" });
    try {
      const verified = await verifyPartAsset({
        id: asset.id,
        updatedAt: asset.updatedAt,
      });
      expect(verified.trust).toBe("VERIFIED");
      expect(verified.verifiedById).toBe(seedUserId);
      expect(verified.verifiedAt).not.toBeNull();
      // Self-verification: verifier === creator is fine.
      expect(verified.verifiedById).toBe(verified.createdById);
    } finally {
      await deleteAsset(asset.id);
    }
  });

  test("an empty/absent source is rejected and the row stays UNVERIFIED", async () => {
    const asset = await createAsset({ kind: "FOOTPRINT", source: null });
    try {
      await expect(
        verifyPartAsset({ id: asset.id, updatedAt: asset.updatedAt }),
      ).rejects.toThrow();
      const row = await db.partAsset.findUniqueOrThrow({
        where: { id: asset.id },
        select: { trust: true },
      });
      expect(row.trust).toBe("UNVERIFIED");
    } finally {
      await deleteAsset(asset.id);
    }
  });

  test("a whitespace-only source is rejected (trim)", async () => {
    const asset = await createAsset({ kind: "MODEL_3D", source: "   " });
    try {
      await expect(
        verifyPartAsset({ id: asset.id, updatedAt: asset.updatedAt }),
      ).rejects.toThrow();
    } finally {
      await deleteAsset(asset.id);
    }
  });

  test("a FLAGGED asset can't be verified directly AND stays FLAGGED", async () => {
    const asset = await createAsset({ kind: "SYMBOL", source: "SnapEDA" });
    try {
      const flagged = await flagPartAsset({
        id: asset.id,
        updatedAt: asset.updatedAt,
      });
      expect(flagged.trust).toBe("FLAGGED");

      await expect(
        verifyPartAsset({ id: flagged.id, updatedAt: flagged.updatedAt }),
      ).rejects.toThrow(/flag/i);

      const row = await db.partAsset.findUniqueOrThrow({
        where: { id: asset.id },
        select: { trust: true, verifiedById: true },
      });
      expect(row.trust).toBe("FLAGGED");
      expect(row.verifiedById).toBeNull();
    } finally {
      await deleteAsset(asset.id);
    }
  });
});

// ─── deletePartAsset — deliberate removal (optimistic-lock fenced) ───────────
// Any signed-in user may delete from ANY trust state (UNVERIFIED/VERIFIED/
// FLAGGED) — the deliberate confirm lives in the UI, not a server precondition.
// The optimistic lock on `updatedAt` still applies: a stale fence is rejected
// (CONFLICT) and the row stays put. R2 cleanup is best-effort — the throwaway
// rows' r2Key never exists in R2, and the action swallows the DeleteObject error.
describe("deletePartAsset", () => {
  test("deletes the row", async () => {
    const asset = await createAsset({ kind: "SYMBOL", source: "SnapEDA" });
    await deletePartAsset({ id: asset.id, updatedAt: asset.updatedAt });
    const row = await db.partAsset.findUnique({ where: { id: asset.id } });
    expect(row).toBeNull();
  });

  test("a stale updatedAt is rejected (CONFLICT) and the row is still present", async () => {
    const asset = await createAsset({ kind: "FOOTPRINT", source: "SnapEDA" });
    try {
      const staleUpdatedAt = asset.updatedAt;
      // A concurrent license-only edit bumps updatedAt forward (no demote).
      await editPartAsset({
        id: asset.id,
        updatedAt: asset.updatedAt,
        source: "SnapEDA",
        license: "MIT",
      });

      await expect(
        deletePartAsset({ id: asset.id, updatedAt: staleUpdatedAt }),
      ).rejects.toThrow(/reload|changed/i);

      // The stale delete did NOT remove the row.
      const row = await db.partAsset.findUnique({ where: { id: asset.id } });
      expect(row).not.toBeNull();
    } finally {
      await deleteAsset(asset.id);
    }
  });

  test("deleting a VERIFIED asset is allowed", async () => {
    const asset = await createAsset({ kind: "MODEL_3D", source: "SnapEDA" });
    const v = await verifyPartAsset({
      id: asset.id,
      updatedAt: asset.updatedAt,
    });
    expect(v.trust).toBe("VERIFIED");

    await deletePartAsset({ id: v.id, updatedAt: v.updatedAt });
    const row = await db.partAsset.findUnique({ where: { id: asset.id } });
    expect(row).toBeNull();
  });
});

// ─── editPartAsset — auto-demote + strict envelope + clear-on-omit ───────────
describe("editPartAsset", () => {
  test("editing `ref` of a VERIFIED asset demotes to UNVERIFIED + clears verifier", async () => {
    const asset = await createAsset({
      kind: "SYMBOL",
      ref: "OldRef",
      source: "SnapEDA",
    });
    try {
      const v = await verifyPartAsset({
        id: asset.id,
        updatedAt: asset.updatedAt,
      });
      expect(v.trust).toBe("VERIFIED");

      const edited = await editPartAsset({
        id: v.id,
        updatedAt: v.updatedAt,
        ref: "NewRef", // changed
        source: "SnapEDA",
      });
      expect(edited.trust).toBe("UNVERIFIED");
      expect(edited.verifiedById).toBeNull();
      expect(edited.verifiedAt).toBeNull();
      expect(edited.lastEditedById).toBe(seedUserId);
      expect(edited.ref).toBe("NewRef");
    } finally {
      await deleteAsset(asset.id);
    }
  });

  test("editing `source` of a VERIFIED asset demotes", async () => {
    const asset = await createAsset({
      kind: "FOOTPRINT",
      ref: "Ref",
      source: "SnapEDA",
    });
    try {
      const v = await verifyPartAsset({
        id: asset.id,
        updatedAt: asset.updatedAt,
      });
      const edited = await editPartAsset({
        id: v.id,
        updatedAt: v.updatedAt,
        ref: "Ref", // unchanged
        source: "SamacSys", // changed
      });
      expect(edited.trust).toBe("UNVERIFIED");
      expect(edited.verifiedById).toBeNull();
    } finally {
      await deleteAsset(asset.id);
    }
  });

  test("a license-only change leaves a VERIFIED asset VERIFIED", async () => {
    const asset = await createAsset({
      kind: "MODEL_3D",
      ref: "Ref",
      source: "SnapEDA",
      license: "CC-BY",
    });
    try {
      const v = await verifyPartAsset({
        id: asset.id,
        updatedAt: asset.updatedAt,
      });
      expect(v.trust).toBe("VERIFIED");

      const edited = await editPartAsset({
        id: v.id,
        updatedAt: v.updatedAt,
        ref: "Ref", // unchanged
        source: "SnapEDA", // unchanged
        license: "MIT", // ONLY this changed
      });
      // license is NOT a demote trigger → stays VERIFIED, verifier intact.
      expect(edited.trust).toBe("VERIFIED");
      expect(edited.verifiedById).toBe(seedUserId);
      expect(edited.license).toBe("MIT");
    } finally {
      await deleteAsset(asset.id);
    }
  });

  test("omitting a field CLEARS it (?? null contract)", async () => {
    const asset = await createAsset({
      kind: "SYMBOL",
      ref: "Ref",
      source: "SnapEDA",
      license: "CC-BY",
    });
    try {
      // Send only ref+source; omit license → it is cleared to null.
      const edited = await editPartAsset({
        id: asset.id,
        updatedAt: asset.updatedAt,
        ref: "Ref",
        source: "SnapEDA",
      });
      expect(edited.license).toBeNull();
    } finally {
      await deleteAsset(asset.id);
    }
  });

  test(".strict() rejects a typo'd key (reff)", async () => {
    const asset = await createAsset({ kind: "FOOTPRINT", source: "SnapEDA" });
    try {
      await expect(
        editPartAsset({
          id: asset.id,
          updatedAt: asset.updatedAt,
          reff: "typo", // not a recognized key → rejected, not dropped
        } as unknown),
      ).rejects.toThrow();
    } finally {
      await deleteAsset(asset.id);
    }
  });
});

// ─── Optimistic concurrency ─────────────────────────────────────────────────
describe("optimistic concurrency", () => {
  test("a stale updatedAt on editPartAsset is rejected and the row is unchanged", async () => {
    const asset = await createAsset({ kind: "SYMBOL", ref: "A", source: "X" });
    try {
      const staleUpdatedAt = asset.updatedAt;
      // A concurrent edit moves updatedAt forward (license-only → no demote).
      const moved = await editPartAsset({
        id: asset.id,
        updatedAt: asset.updatedAt,
        ref: "A",
        source: "X",
        license: "GPL",
      });
      expect(moved.license).toBe("GPL");

      await expect(
        editPartAsset({
          id: asset.id,
          updatedAt: staleUpdatedAt,
          ref: "A",
          source: "X",
          license: "MIT",
        }),
      ).rejects.toThrow(/reload|changed/i);

      // No write from the stale call: license is still GPL.
      const row = await db.partAsset.findUniqueOrThrow({
        where: { id: asset.id },
        select: { license: true },
      });
      expect(row.license).toBe("GPL");
    } finally {
      await deleteAsset(asset.id);
    }
  });

  test("a stale updatedAt on verifyPartAsset is rejected and the row stays UNVERIFIED", async () => {
    const asset = await createAsset({ kind: "FOOTPRINT", source: "SnapEDA" });
    try {
      const staleUpdatedAt = asset.updatedAt;
      // A concurrent license-only edit bumps updatedAt.
      await editPartAsset({
        id: asset.id,
        updatedAt: asset.updatedAt,
        source: "SnapEDA",
        license: "CC0",
      });

      await expect(
        verifyPartAsset({ id: asset.id, updatedAt: staleUpdatedAt }),
      ).rejects.toThrow(/reload|changed/i);

      const row = await db.partAsset.findUniqueOrThrow({
        where: { id: asset.id },
        select: { trust: true, verifiedById: true },
      });
      expect(row.trust).toBe("UNVERIFIED");
      expect(row.verifiedById).toBeNull();
    } finally {
      await deleteAsset(asset.id);
    }
  });
});

// ─── flagPartAsset + clearPartAssetFlag ─────────────────────────────────────
describe("flagPartAsset + clearPartAssetFlag", () => {
  test("flagPartAsset sets FLAGGED", async () => {
    const asset = await createAsset({ kind: "SYMBOL", source: "SnapEDA" });
    try {
      const flagged = await flagPartAsset({
        id: asset.id,
        updatedAt: asset.updatedAt,
      });
      expect(flagged.trust).toBe("FLAGGED");
    } finally {
      await deleteAsset(asset.id);
    }
  });

  test("clearPartAssetFlag moves FLAGGED → UNVERIFIED (never straight to VERIFIED)", async () => {
    const asset = await createAsset({ kind: "FOOTPRINT", source: "SnapEDA" });
    try {
      const flagged = await flagPartAsset({
        id: asset.id,
        updatedAt: asset.updatedAt,
      });
      expect(flagged.trust).toBe("FLAGGED");

      const cleared = await clearPartAssetFlag({
        id: flagged.id,
        updatedAt: flagged.updatedAt,
      });
      expect(cleared.trust).toBe("UNVERIFIED");
      expect(cleared.verifiedById).toBeNull();
    } finally {
      await deleteAsset(asset.id);
    }
  });

  test("clearPartAssetFlag on a non-FLAGGED row is rejected", async () => {
    const asset = await createAsset({ kind: "MODEL_3D", source: "SnapEDA" });
    try {
      // Row is UNVERIFIED, not FLAGGED → must reject.
      await expect(
        clearPartAssetFlag({ id: asset.id, updatedAt: asset.updatedAt }),
      ).rejects.toThrow();
    } finally {
      await deleteAsset(asset.id);
    }
  });

  test("a stale updatedAt on flagPartAsset is rejected and the row is not flagged", async () => {
    const asset = await createAsset({ kind: "SYMBOL", source: "SnapEDA" });
    try {
      const staleUpdatedAt = asset.updatedAt;
      // A concurrent license-only edit bumps updatedAt forward.
      await editPartAsset({
        id: asset.id,
        updatedAt: asset.updatedAt,
        source: "SnapEDA",
        license: "MIT",
      });

      await expect(
        flagPartAsset({ id: asset.id, updatedAt: staleUpdatedAt }),
      ).rejects.toThrow(/reload|changed/i);

      const row = await db.partAsset.findUniqueOrThrow({
        where: { id: asset.id },
        select: { trust: true },
      });
      expect(row.trust).toBe("UNVERIFIED");
    } finally {
      await deleteAsset(asset.id);
    }
  });
});

// ─── unverifyPartAsset — undo an accidental verify ──────────────────────────
describe("unverifyPartAsset", () => {
  test("moves VERIFIED → UNVERIFIED and clears the verifier", async () => {
    const asset = await createAsset({ kind: "SYMBOL", source: "SnapEDA" });
    try {
      const v = await verifyPartAsset({
        id: asset.id,
        updatedAt: asset.updatedAt,
      });
      expect(v.trust).toBe("VERIFIED");
      expect(v.verifiedById).toBe(seedUserId);

      const un = await unverifyPartAsset({ id: v.id, updatedAt: v.updatedAt });
      expect(un.trust).toBe("UNVERIFIED");
      expect(un.verifiedById).toBeNull();
      expect(un.verifiedAt).toBeNull();
    } finally {
      await deleteAsset(asset.id);
    }
  });

  test("rejects a non-VERIFIED (UNVERIFIED) row and leaves it untouched", async () => {
    const asset = await createAsset({ kind: "FOOTPRINT", source: "SnapEDA" });
    try {
      await expect(
        unverifyPartAsset({ id: asset.id, updatedAt: asset.updatedAt }),
      ).rejects.toThrow();
      const row = await db.partAsset.findUniqueOrThrow({
        where: { id: asset.id },
        select: { trust: true },
      });
      expect(row.trust).toBe("UNVERIFIED");
    } finally {
      await deleteAsset(asset.id);
    }
  });

  test("does NOT un-flag a FLAGGED row (FLAGGED stays put)", async () => {
    const asset = await createAsset({ kind: "MODEL_3D", source: "SnapEDA" });
    try {
      const flagged = await flagPartAsset({
        id: asset.id,
        updatedAt: asset.updatedAt,
      });
      expect(flagged.trust).toBe("FLAGGED");
      await expect(
        unverifyPartAsset({ id: flagged.id, updatedAt: flagged.updatedAt }),
      ).rejects.toThrow();
      const row = await db.partAsset.findUniqueOrThrow({
        where: { id: asset.id },
        select: { trust: true },
      });
      expect(row.trust).toBe("FLAGGED");
    } finally {
      await deleteAsset(asset.id);
    }
  });

  test("a stale updatedAt is rejected and the row stays VERIFIED", async () => {
    const asset = await createAsset({ kind: "SYMBOL", source: "SnapEDA" });
    try {
      const v = await verifyPartAsset({
        id: asset.id,
        updatedAt: asset.updatedAt,
      });
      const staleUpdatedAt = v.updatedAt;
      // A concurrent license-only edit bumps updatedAt while STAYING VERIFIED.
      await editPartAsset({
        id: v.id,
        updatedAt: v.updatedAt,
        source: "SnapEDA",
        license: "touched to bump updatedAt",
      });

      await expect(
        unverifyPartAsset({ id: asset.id, updatedAt: staleUpdatedAt }),
      ).rejects.toThrow(/reload|changed/i);

      const row = await db.partAsset.findUniqueOrThrow({
        where: { id: asset.id },
        select: { trust: true, verifiedById: true },
      });
      expect(row.trust).toBe("VERIFIED");
      expect(row.verifiedById).toBe(seedUserId);
    } finally {
      await deleteAsset(asset.id);
    }
  });
});

// ─── recordPartAsset render columns (derived .glb) ──────────────────────────
// The `@/lib/part-r2` mock stubs the HEAD (echoes declared bytes), the presigns,
// and DeleteObject — so `recordPartAsset` persists the render trio and the stale-
// render cleanup is a no-op delete. `getPartAssetRenderUrl` returns the stubbed
// inline URL when a renderKey is present.
describe("recordPartAsset render columns", () => {
  test("records the render trio on a fresh MODEL_3D upload", async () => {
    const r = await recordPartAsset({
      partId: throwawayPartId,
      kind: "MODEL_3D",
      r2Key: `parts/${throwawayPartId}/model_3d-a.step`,
      filename: "a.step",
      byteSize: 2000,
      renderKey: `parts/${throwawayPartId}/model_3d_render-a.glb`,
      renderBytes: 500,
      renderBounds: { center: [0, 0, 0], radius: 3 },
    });
    try {
      expect(r.renderKey).toContain("model_3d_render");
      expect(r.renderMime).toBe("model/gltf-binary");
      expect(await getPartAssetRenderUrl(throwawayPartId)).toBe("https://r2.example/inline");
    } finally {
      await deleteAsset(r.id);
    }
  });

  test("a replace WITHOUT a render clears the render columns + cleans up the old .glb", async () => {
    await recordPartAsset({
      partId: throwawayPartId, kind: "MODEL_3D",
      r2Key: `parts/${throwawayPartId}/model_3d-b.step`, filename: "b.step", byteSize: 2000,
      renderKey: `parts/${throwawayPartId}/model_3d_render-b.glb`, renderBytes: 500,
      renderBounds: { center: [0, 0, 0], radius: 3 },
    });
    const second = await recordPartAsset({ // conversion failed → no render fields
      partId: throwawayPartId, kind: "MODEL_3D",
      r2Key: `parts/${throwawayPartId}/model_3d-b2.step`, filename: "b2.step", byteSize: 2100,
    });
    try {
      expect(second.renderKey).toBeNull();
      expect(second.renderBytes).toBeNull();
    } finally {
      await deleteAsset(second.id);
    }
  });
});
