// Tests for the PartDatasheet upload server actions (Stage A Task 9).
//
// These actions are gated behind `env.R2_ENABLED` via `ensureR2Enabled()`
// (mirroring uploads.ts). To prove that gate DETERMINISTICALLY — regardless of
// whether the developer's `.env.local` has R2_ENABLED=true or CI has it off —
// we mock `@/env` to force `R2_ENABLED: false` while preserving every other
// real env var (so DATABASE_URL / DIRECT_URL still point at live Neon for the
// throwaway-part teardown).
//
// What this CAN cover without a live R2 object:
//   - createPartDatasheetUploadUrl and recordPartDatasheet THROW the friendly
//     R2-disabled error before any R2 SDK call (the gate is load-bearing).
//   - recordPartDatasheet writes NO PartDatasheet row when R2 is disabled.
//   - getPartDatasheetDownloadUrl returns `null` (graceful fallback) when R2 is
//     off, even with a PartDatasheet row present in the DB.
//
// What this CANNOT cover here: the recordPartDatasheet HEAD-check (object-exists
// + size verification) and the presigned PUT/GET round-trip. Those require a
// live R2 bucket and an actually-uploaded object; with R2 forced off the action
// short-circuits before HEAD. The HEAD-check logic is identical in shape to the
// exercised `recordArtifact` HEAD path (uploads-actions.test.ts) — the live R2
// round-trip belongs in an R2_ENABLED-gated checkpoint test, not here.
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
  createPartDatasheetUploadUrl,
  recordPartDatasheet,
  getPartDatasheetDownloadUrl,
} from "@/lib/actions/part-datasheet";

const SEED_EMAIL = "seed@example.com";
const TEST_MFR = "T9-DatasheetCo";

const createdPartIds: string[] = [];
const R2_DISABLED = /R2 file storage is not enabled/i;

beforeAll(() => {
  mockAuth.mockImplementation(async () => ({
    user: { email: SEED_EMAIL },
  }));
});

afterAll(async () => {
  // PartDatasheet rows cascade-delete with the Part, but be explicit so a
  // partial failure can't leave orphans behind.
  if (createdPartIds.length > 0) {
    await db.partDatasheet.deleteMany({
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
      mpn: `DS-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      description: "Task 9 throwaway part",
      createdById: user.id,
    },
  });
  createdPartIds.push(part.id);
  return part.id;
}

describe("createPartDatasheetUploadUrl — R2 gate", () => {
  test("throws the R2-disabled error when R2_ENABLED is off", async () => {
    const partId = await makePart();
    await expect(
      createPartDatasheetUploadUrl({
        partId,
        filename: "ap2112.pdf",
        byteSize: 4096,
        contentType: "application/pdf",
      }),
    ).rejects.toThrow(R2_DISABLED);
  });

  test("rejects a non-PDF contentType via Zod", async () => {
    const partId = await makePart();
    await expect(
      createPartDatasheetUploadUrl({
        partId,
        filename: "ap2112.png",
        byteSize: 4096,
        contentType: "image/png",
      }),
    ).rejects.toThrow();
  });
});

describe("recordPartDatasheet — R2 gate", () => {
  test("throws the R2-disabled error AND writes no PartDatasheet row", async () => {
    const partId = await makePart();

    await expect(
      recordPartDatasheet({
        partId,
        r2Key: `parts/${partId}/datasheet-stub.pdf`,
        filename: "ap2112.pdf",
        byteSize: 4096,
      }),
    ).rejects.toThrow(R2_DISABLED);

    // The gate fires before any DB write — no row should exist for this part.
    const row = await db.partDatasheet.findUnique({ where: { partId } });
    expect(row).toBeNull();
  });
});

describe("getPartDatasheetDownloadUrl — graceful fallback", () => {
  test("returns null when R2 is off, even with a PartDatasheet row present", async () => {
    const partId = await makePart();
    const user = await db.user.findUniqueOrThrow({
      where: { email: SEED_EMAIL },
    });
    // Insert a row directly (bypassing the gated record action) to prove the
    // download helper returns null on the disabled path rather than throwing.
    await db.partDatasheet.create({
      data: {
        partId,
        r2Key: `parts/${partId}/datasheet-stub.pdf`,
        filename: "ap2112.pdf",
        byteSize: 4096,
        createdById: user.id,
      },
    });

    await expect(getPartDatasheetDownloadUrl(partId)).resolves.toBeNull();
  });

  test("returns null when no PartDatasheet row exists", async () => {
    const partId = await makePart();
    await expect(getPartDatasheetDownloadUrl(partId)).resolves.toBeNull();
  });
});
