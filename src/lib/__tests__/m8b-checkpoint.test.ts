// M8b checkpoint (Task 10.6).
//
// End-to-end demo against the live `foundry-prod` R2 bucket and the seeded
// "esp32-sensor-breakout" v1 revision. Exercises the full design §7 flow
// from the action layer down to actual R2 PUT/HEAD/GET/DELETE:
//
//   1. Upload a small synthetic "PDF" (~5 KB of bytes — we don't need a
//      real PDF, the server doesn't sniff MIME) as a SCHEMATIC_FILE on the
//      seeded v1 revision: createUploadUrl → fetch PUT → recordArtifact.
//   2. Verify the Artifact row in the DB has the right fileKey/fileMime/
//      fileBytes.
//   3. Mint a presigned GET via getDownloadUrl, download via fetch, verify
//      the bytes round-trip.
//   4. Attempt createUploadUrl with subkind=SCHEMATIC_FILE but
//      owner.kind="build" → rejected by ownerMatches.
//   5. Clean up the test R2 object + Artifact row in afterAll.
//
// Skips entirely when R2_ENABLED is unset so CI without R2 creds doesn't
// fail. The seeded revision is also reverted to SCHEMATIC stage if we
// have to bump it forward to make SCHEMATIC_FILE acceptable.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockAuth = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({
  auth: () => mockAuth(),
}));

import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import type { Stage } from "@prisma/client";
import { env } from "@/env";
import { db } from "@/lib/db";
import { r2 } from "@/lib/r2";
import {
  createUploadUrl,
  getDownloadUrl,
  recordArtifact,
} from "@/lib/actions/uploads";

const SEED_EMAIL = "seed@example.com";
const SEED_PROJECT_SLUG = "esp32-sensor-breakout";
const TEST_RUN_ID = `m8b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// Synthetic "PDF" — actual %PDF- header so MIME tools don't get angry, but
// the server doesn't inspect content so it's purely cosmetic.
const TEST_BYTES = new Uint8Array(5_000);
TEST_BYTES.set(new TextEncoder().encode("%PDF-1.4 m8b-checkpoint "));
for (let i = 24; i < TEST_BYTES.length; i++) {
  TEST_BYTES[i] = 65 + (i % 26); // A–Z filler.
}

const createdArtifactIds: string[] = [];
const createdRevisionIds: string[] = [];
const uploadedR2Keys: string[] = [];

// Track whether we created a sibling revision so we can clean up.
let testRevisionId: string | null = null;
let testBuildId: string | null = null;

beforeAll(async () => {
  mockAuth.mockImplementation(async () => ({
    user: { email: SEED_EMAIL },
  }));

  // We need a SCHEMATIC-stage revision so SCHEMATIC_FILE is allowed. Rather
  // than mutating the seeded v1 (which lives at BRINGUP), spin up a sibling
  // revision under the same project, parked at SCHEMATIC. This also avoids
  // tripping over the seed-injected BRINGUP_COMPLETE on v1's BUILD-001.
  const project = await db.project.findUniqueOrThrow({
    where: { slug: SEED_PROJECT_SLUG },
  });
  const user = await db.user.findUniqueOrThrow({
    where: { email: SEED_EMAIL },
  });

  const rev = await db.revision.create({
    data: {
      projectId: project.id,
      label: `m8b-rev-${TEST_RUN_ID}`,
      currentStage: "SCHEMATIC",
    },
  });
  createdRevisionIds.push(rev.id);
  testRevisionId = rev.id;
  await db.stageTransition.create({
    data: {
      revisionId: rev.id,
      fromStage: null,
      toStage: "SCHEMATIC",
      direction: "INIT",
      gateSnapshot: {
        v: 1,
        kind: "init",
        ts: new Date().toISOString(),
      },
      transitionedBy: user.id,
    },
  });

  // Also create a build for the owner-mismatch step (we need a real build
  // id so the Zod cuid check passes; ownerMatches is what rejects).
  const build = await db.build.create({
    data: {
      revisionId: rev.id,
      label: `m8b-build-${TEST_RUN_ID}`,
      boardCount: 1,
      createdById: user.id,
    },
  });
  testBuildId = build.id;
});

afterAll(async () => {
  // 1. Artifact rows.
  if (createdArtifactIds.length > 0) {
    await db.artifact.deleteMany({
      where: { id: { in: createdArtifactIds } },
    });
  }
  // 2. R2 objects (best-effort).
  if (env.R2_ENABLED && env.R2_BUCKET) {
    for (const key of uploadedR2Keys) {
      try {
        await r2.send(
          new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: key }),
        );
      } catch {
        // Already gone or never landed; ignore.
      }
    }
  }
  // 3. Build then revision (FK cascade handles transitions/builds).
  if (testBuildId) {
    await db.build.deleteMany({ where: { id: testBuildId } });
  }
  if (createdRevisionIds.length > 0) {
    await db.revision.deleteMany({
      where: { id: { in: createdRevisionIds } },
    });
  }
});

describe("M8b checkpoint — live R2 round-trip on seeded project", () => {
  it.skipIf(!process.env.R2_ENABLED)(
    "uploads SCHEMATIC_FILE → record → download → bytes match",
    async () => {
      if (!testRevisionId) throw new Error("test revision not set up");

      // Step 1a: createUploadUrl
      const token = await createUploadUrl({
        filename: "test-schematic.pdf",
        mime: "application/pdf",
        sizeBytes: TEST_BYTES.length,
        owner: { kind: "revision", id: testRevisionId },
        stage: "SCHEMATIC",
        subkind: "SCHEMATIC_FILE",
      });
      uploadedR2Keys.push(token.key);
      expect(token.uploadUrl).toMatch(/^https:\/\//);
      expect(token.key).toMatch(
        new RegExp(`^revisions/${testRevisionId}/SCHEMATIC/`),
      );

      // Step 1b: client PUT to R2.
      const putRes = await fetch(token.uploadUrl, {
        method: "PUT",
        body: TEST_BYTES,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Length": String(TEST_BYTES.length),
        },
      });
      expect(putRes.ok).toBe(true);

      // Step 1c: recordArtifact (server HEADs + inserts the row).
      const artifact = await recordArtifact({
        cuid: token.cuid,
        key: token.key,
        owner: token.owner,
        stage: token.stage as Stage,
        subkind: "SCHEMATIC_FILE",
        title: `m8b schematic ${TEST_RUN_ID}`,
        mime: "application/pdf",
        sizeBytes: TEST_BYTES.length,
        filename: "test-schematic.pdf",
      });
      createdArtifactIds.push(artifact.id);

      // Step 2: verify the row.
      const fromDb = await db.artifact.findUniqueOrThrow({
        where: { id: artifact.id },
      });
      expect(fromDb.kind).toBe("FILE");
      expect(fromDb.subkind).toBe("SCHEMATIC_FILE");
      expect(fromDb.revisionId).toBe(testRevisionId);
      expect(fromDb.buildId).toBeNull();
      expect(fromDb.fileKey).toBe(token.key);
      expect(fromDb.fileMime).toBe("application/pdf");
      expect(fromDb.fileBytes).toBe(TEST_BYTES.length);

      // Step 3: presigned GET + verify bytes.
      const downloadUrl = await getDownloadUrl(artifact.id);
      const getRes = await fetch(downloadUrl);
      expect(getRes.ok).toBe(true);
      const buf = new Uint8Array(await getRes.arrayBuffer());
      expect(buf.length).toBe(TEST_BYTES.length);
      // Spot-check the header + a tail byte to confirm content fidelity.
      expect(
        new TextDecoder().decode(buf.slice(0, 8)),
      ).toBe("%PDF-1.4");
      expect(buf[24]).toBe(TEST_BYTES[24]);
      expect(buf[buf.length - 1]).toBe(TEST_BYTES[TEST_BYTES.length - 1]);
    },
    120_000, // 2 min — live R2 PUT + GET + DB.
  );

  it("rejects subkind=SCHEMATIC_FILE with owner.kind=build (owner mismatch)", async () => {
    if (!testBuildId) throw new Error("test build not set up");

    await expect(
      createUploadUrl({
        filename: "wrong-owner.pdf",
        mime: "application/pdf",
        sizeBytes: TEST_BYTES.length,
        // SCHEMATIC_FILE is revision-scoped per ARTIFACT_SUBKIND_OWNER.
        owner: { kind: "build", id: testBuildId },
        stage: "SCHEMATIC",
        subkind: "SCHEMATIC_FILE",
      }),
    ).rejects.toThrow(/not valid for build/i);
  });
});
