import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";

// The CHECK predicates on HexCluster / HexClusterRevision.
//
// These are the last line, not the first: the action validates the same things
// and returns typed error codes. They exist because the action will not be the
// only writer forever — a seed script, a backfill, or a future admin tool all
// reach the table directly, and a drawing with an empty name or a payload that
// cannot be scanned is wrong however it got there.
//
// Raw SQL throughout: Prisma would reject most of these before Postgres saw
// them, which would test Prisma rather than the constraint.

const USER_ID = "hex-check-user";
const CLUSTER_ID = "hex-check-cluster";

const SUMMARY = JSON.stringify({
  nameAtSave: "check",
  cells: 1,
  caps: 0,
  spikes: 0,
  pieces: 1,
  envelope: null,
  bom: [{ item: 1, qty: 1, label: "x", dims: null, sourceFile: "x" }],
  details: [],
});

beforeAll(async () => {
  await db.$executeRawUnsafe(`
    INSERT INTO "User" (id, email, "createdAt")
    VALUES ('${USER_ID}', 'hex-check@test.local', NOW())
    ON CONFLICT (id) DO NOTHING;
  `);
  await db.$executeRawUnsafe(`
    INSERT INTO "HexCluster" (id, "userId", name, "createdAt", "updatedAt")
    VALUES ('${CLUSTER_ID}', '${USER_ID}', 'check cluster', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  `);
});

afterAll(async () => {
  await db.$executeRawUnsafe(
    `DELETE FROM "HexCluster" WHERE "userId" = '${USER_ID}';`,
  );
  await db.$executeRawUnsafe(`DELETE FROM "User" WHERE id = '${USER_ID}';`);
});

/** Insert a revision with one column overridden. Returns the rejection. */
async function insertRevision(over: {
  id: string;
  revNo?: number;
  shareCode?: string;
  payload?: string;
  payloadHash?: string;
  schemaVersion?: number;
  summary?: string;
}): Promise<string | null> {
  const {
    id,
    revNo = 1,
    shareCode = id.padEnd(22, "z"),
    payload = "s=abcdef",
    payloadHash = `h1:${"a".repeat(64)}`,
    schemaVersion = 1,
    summary = SUMMARY,
  } = over;
  try {
    await db.$executeRawUnsafe(`
      INSERT INTO "HexClusterRevision"
        (id, "clusterId", "revNo", "shareCode", payload, "payloadHash", "schemaVersion", summary, "createdAt")
      VALUES ('${id}', '${CLUSTER_ID}', ${revNo}, '${shareCode}', '${payload}',
              '${payloadHash}', ${schemaVersion}, '${summary}'::jsonb, NOW());
    `);
    await db.$executeRawUnsafe(
      `DELETE FROM "HexClusterRevision" WHERE id = '${id}';`,
    );
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

describe("HexCluster CHECKs", () => {
  it("refuses an empty name", async () => {
    await expect(
      db.$executeRawUnsafe(`
        INSERT INTO "HexCluster" (id, "userId", name, "createdAt", "updatedAt")
        VALUES ('hex-check-empty', '${USER_ID}', '', NOW(), NOW());
      `),
    ).rejects.toThrow(/hexcluster_name_len/);
  });

  it("refuses a name past the column bound", async () => {
    await expect(
      db.$executeRawUnsafe(`
        INSERT INTO "HexCluster" (id, "userId", name, "createdAt", "updatedAt")
        VALUES ('hex-check-long', '${USER_ID}', '${"x".repeat(121)}', NOW(), NOW());
      `),
    ).rejects.toThrow(/hexcluster_name_len/);
  });

  it("refuses a drawing number below the register floor", async () => {
    // The floor is what keeps every printed number four digits.
    await expect(
      db.$executeRawUnsafe(`
        INSERT INTO "HexCluster" (id, "userId", "drawingNo", name, "createdAt", "updatedAt")
        VALUES ('hex-check-floor', '${USER_ID}', 7, 'low', NOW(), NOW());
      `),
    ).rejects.toThrow(/hexcluster_drawingno_floor/);
  });
});

describe("HexClusterRevision CHECKs", () => {
  it("accepts a well-formed revision", async () => {
    expect(await insertRevision({ id: "hex-check-ok" })).toBeNull();
  });

  it("refuses revNo below 1", async () => {
    expect(await insertRevision({ id: "hex-check-rev0", revNo: 0 })).toMatch(
      /hexrev_revno_positive/,
    );
  });

  it("refuses an empty or oversized payload", async () => {
    expect(
      await insertRevision({ id: "hex-check-pshort", payload: "s" }),
    ).toMatch(/hexrev_payload_len/);
    expect(
      await insertRevision({
        id: "hex-check-plong",
        payload: `s=${"a".repeat(16_400)}`,
      }),
    ).toMatch(/hexrev_payload_len/);
  });

  it("refuses a hash that is not a plausible wire form", async () => {
    expect(
      await insertRevision({ id: "hex-check-hash", payloadHash: "h1:short" }),
    ).toMatch(/hexrev_hash_len/);
  });

  it("refuses a schema version below 1", async () => {
    expect(
      await insertRevision({ id: "hex-check-ver", schemaVersion: 0 }),
    ).toMatch(/hexrev_schema_ver/);
  });

  it("bounds the summary as jsonb::text, not as the compact JSON the action sees", async () => {
    // 12288 rather than the action's 8192: jsonb::text re-serialises with a
    // space after every ':' and ',', so a summary the action passes at 8192
    // compact can still exceed an 8192 CHECK — and would throw a raw
    // constraint error instead of returning summary-invalid.
    const fat = JSON.stringify({
      nameAtSave: "x",
      cells: 1,
      caps: 0,
      spikes: 0,
      pieces: 1,
      envelope: null,
      bom: [
        {
          item: 1,
          qty: 1,
          label: "x".repeat(13_000),
          dims: null,
          sourceFile: "x",
        },
      ],
      details: [],
    });
    expect(await insertRevision({ id: "hex-check-sum", summary: fat })).toMatch(
      /hexrev_summary_len/,
    );
  });

  it("keeps share codes unique across the whole table", async () => {
    // The token is the only gate on an unlisted public page.
    await db.$executeRawUnsafe(`
      INSERT INTO "HexClusterRevision"
        (id, "clusterId", "revNo", "shareCode", payload, "payloadHash", "schemaVersion", summary, "createdAt")
      VALUES ('hex-check-uniq-a', '${CLUSTER_ID}', 50, 'hexcheckuniqueaaaaaaaa', 's=abcdef',
              'h1:${"a".repeat(64)}', 1, '${SUMMARY}'::jsonb, NOW());
    `);
    await expect(
      db.$executeRawUnsafe(`
        INSERT INTO "HexClusterRevision"
          (id, "clusterId", "revNo", "shareCode", payload, "payloadHash", "schemaVersion", summary, "createdAt")
        VALUES ('hex-check-uniq-b', '${CLUSTER_ID}', 51, 'hexcheckuniqueaaaaaaaa', 's=abcdef',
                'h1:${"a".repeat(64)}', 1, '${SUMMARY}'::jsonb, NOW());
      `),
    ).rejects.toThrow(/shareCode/);
    await db.$executeRawUnsafe(
      `DELETE FROM "HexClusterRevision" WHERE id = 'hex-check-uniq-a';`,
    );
  });

  it("keeps (clusterId, revNo) unique — the backstop under the advisory lock", async () => {
    await db.$executeRawUnsafe(`
      INSERT INTO "HexClusterRevision"
        (id, "clusterId", "revNo", "shareCode", payload, "payloadHash", "schemaVersion", summary, "createdAt")
      VALUES ('hex-check-dup-a', '${CLUSTER_ID}', 60, 'hexcheckdupaaaaaaaaaaa', 's=abcdef',
              'h1:${"a".repeat(64)}', 1, '${SUMMARY}'::jsonb, NOW());
    `);
    await expect(
      db.$executeRawUnsafe(`
        INSERT INTO "HexClusterRevision"
          (id, "clusterId", "revNo", "shareCode", payload, "payloadHash", "schemaVersion", summary, "createdAt")
        VALUES ('hex-check-dup-b', '${CLUSTER_ID}', 60, 'hexcheckdupbbbbbbbbbbb', 's=abcdef',
                'h1:${"a".repeat(64)}', 1, '${SUMMARY}'::jsonb, NOW());
      `),
    ).rejects.toThrow();
    await db.$executeRawUnsafe(
      `DELETE FROM "HexClusterRevision" WHERE id = 'hex-check-dup-a';`,
    );
  });
});
