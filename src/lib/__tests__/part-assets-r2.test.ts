// Tests for the PartAsset R2 upload server actions (Stage C Task 5).
//
// These actions (createPartAssetUploadUrl / recordPartAsset /
// getPartAssetDownloadUrl) are gated behind `env.R2_ENABLED` via
// `ensureR2Enabled()` (mirroring part-datasheet.ts). To prove that gate
// DETERMINISTICALLY — regardless of whether the developer's `.env.local` has
// R2_ENABLED=true or CI has it off — we mock `@/env` to force
// `R2_ENABLED: false` while preserving every other real env var (so
// DATABASE_URL / DIRECT_URL still point at live Neon for the throwaway-part
// teardown).
//
// What this CAN cover without a live R2 object:
//   - createPartAssetUploadUrl THROWS the friendly R2-disabled error before any
//     R2 SDK call when R2 is off; AND — because the upload schema parses FIRST
//     (so its ext/cap `superRefine` runs before the R2 gate) — it REJECTS a
//     wrong extension and an over-cap byteSize even with R2 off.
//   - recordPartAsset THROWS the R2-disabled error AND writes NO PartAsset row.
//   - getPartAssetDownloadUrl returns `null` (graceful fallback) when R2 is off,
//     even with a PartAsset row present, and when no row exists.
//
// What this CANNOT cover here: the recordPartAsset HEAD-check (object-exists +
// size verification) and the presigned PUT/GET round-trip. Those require a live
// R2 bucket and an actually-uploaded object; with R2 forced off the action
// short-circuits before HEAD. The live R2 round-trip belongs in an
// R2_ENABLED-gated checkpoint test / the manual demo, not here.
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  test,
  vi,
} from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockAuth = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({
  auth: () => mockAuth(),
}));

// Force R2 OFF deterministically. Spread the real env so the Neon connection
// strings (and everything else) stay intact for the live-DB assertions.
vi.mock("@/env", async () => {
  const actual = await vi.importActual<typeof import("@/env")>("@/env");
  return { env: { ...actual.env, R2_ENABLED: false } };
});

import { db } from "@/lib/db";
import {
  createPartAssetUploadUrl,
  recordPartAsset,
  getPartAssetDownloadUrl,
} from "@/lib/actions/part-assets";
import { presignGetInline } from "@/lib/part-r2";

const SEED_EMAIL = "seed@example.com";
const TEST_MFR = "T5-AssetCo";

const createdPartIds: string[] = [];
const R2_DISABLED = /R2 file storage is not enabled/i;

beforeAll(() => {
  mockAuth.mockImplementation(async () => ({
    user: { email: SEED_EMAIL },
  }));
});

afterAll(async () => {
  // PartAsset rows cascade-delete with the Part, but be explicit so a partial
  // failure can't leave orphans behind.
  if (createdPartIds.length > 0) {
    await db.partAsset.deleteMany({
      where: { partId: { in: createdPartIds } },
    });
    await db.part.deleteMany({ where: { id: { in: createdPartIds } } });
  }
  // Sweep any stray rows carrying the test manufacturer prefix.
  await db.part.deleteMany({ where: { manufacturer: TEST_MFR } });
});

async function makePart(): Promise<string> {
  const user = await db.user.findUniqueOrThrow({
    where: { email: SEED_EMAIL },
  });
  const part = await db.part.create({
    data: {
      manufacturer: TEST_MFR,
      mpn: `AS-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      description: "Task 5 throwaway part",
      createdById: user.id,
    },
  });
  createdPartIds.push(part.id);
  return part.id;
}

describe("createPartAssetUploadUrl — R2 gate + schema", () => {
  test("throws the R2-disabled error when R2_ENABLED is off", async () => {
    const partId = await makePart();
    await expect(
      createPartAssetUploadUrl({
        partId,
        kind: "SYMBOL",
        filename: "esp32.kicad_sym",
        byteSize: 1000,
      }),
    ).rejects.toThrow(R2_DISABLED);
  });

  test("rejects a wrong extension via the schema superRefine (R2 off, Zod first)", async () => {
    const partId = await makePart();
    await expect(
      createPartAssetUploadUrl({
        partId,
        kind: "SYMBOL",
        filename: "x.png",
        byteSize: 1000,
      }),
    ).rejects.toThrow();
  });

  test("rejects an over-cap byteSize via the schema superRefine (R2 off, Zod first)", async () => {
    const partId = await makePart();
    await expect(
      createPartAssetUploadUrl({
        partId,
        kind: "SYMBOL",
        filename: "x.kicad_sym",
        byteSize: 6 * 1024 * 1024, // > the 5 MB SYMBOL cap
      }),
    ).rejects.toThrow();
  });
});

describe("recordPartAsset — R2 gate", () => {
  test("throws the R2-disabled error AND writes no PartAsset row", async () => {
    const partId = await makePart();

    await expect(
      recordPartAsset({
        partId,
        kind: "SYMBOL",
        r2Key: `parts/${partId}/symbol-stub.kicad_sym`,
        filename: "esp32.kicad_sym",
        byteSize: 1000,
      }),
    ).rejects.toThrow(R2_DISABLED);

    // The gate fires before any DB write — no row should exist for this part.
    const row = await db.partAsset.findUnique({
      where: { partId_kind: { partId, kind: "SYMBOL" } },
    });
    expect(row).toBeNull();
  });
});

describe("getPartAssetDownloadUrl — graceful fallback", () => {
  test("returns null when R2 is off, even with a PartAsset row present", async () => {
    const partId = await makePart();
    const user = await db.user.findUniqueOrThrow({
      where: { email: SEED_EMAIL },
    });
    // Insert a row directly (bypassing the gated record action) to prove the
    // download helper returns null on the disabled path rather than throwing.
    await db.partAsset.create({
      data: {
        partId,
        kind: "SYMBOL",
        r2Key: `parts/${partId}/symbol-stub.kicad_sym`,
        filename: "esp32.kicad_sym",
        byteSize: 1000,
        contentType: "text/plain",
        createdById: user.id,
      },
    });

    await expect(getPartAssetDownloadUrl(partId, "SYMBOL")).resolves.toBeNull();
  });

  test("returns null when no PartAsset row exists", async () => {
    const partId = await makePart();
    await expect(getPartAssetDownloadUrl(partId, "SYMBOL")).resolves.toBeNull();
  });
});

describe("presignGetInline — no Content-Disposition (inline .glb fetch)", () => {
  test("presignGetInline omits response-content-disposition", async () => {
    const url = await presignGetInline("parts/x/model_3d_render-abc.glb");
    expect(url).toContain("X-Amz-Signature");
    expect(url.toLowerCase()).not.toContain("response-content-disposition");
  });
});
