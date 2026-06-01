// Round-trip test for getDownloadUrl (Task 10.5).
//
// Runs against the live `foundry-prod` R2 bucket — there's no honest way to
// validate "the presigned URL actually fetches the bytes" without hitting
// real R2. Gated behind R2_ENABLED so CI without R2 creds skips cleanly.
//
// Flow:
//   1. PutObject a tiny synthetic body under a `tests/` prefix.
//   2. Insert an Artifact row that points fileKey at that object.
//   3. Call getDownloadUrl(artifactId) → presigned GET URL.
//   4. fetch() the URL and verify the body matches the bytes we PUT.
//   5. DeleteObject + delete the Artifact row in afterAll.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockAuth = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({
  auth: () => mockAuth(),
}));

import {
  DeleteObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { env } from "@/env";
import { db } from "@/lib/db";
import { r2 } from "@/lib/r2";
import { getDownloadUrl } from "@/lib/actions/uploads";

const SEED_EMAIL = "seed@example.com";
// Unique per test run so concurrent CI invocations can't collide.
const TEST_RUN_ID = `t10.5-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const TEST_KEY = `tests/${TEST_RUN_ID}/download-roundtrip.txt`;
const TEST_BODY = `download roundtrip ${TEST_RUN_ID}`;

const createdArtifactIds: string[] = [];

beforeAll(() => {
  mockAuth.mockImplementation(async () => ({
    user: { email: SEED_EMAIL },
  }));
});

afterAll(async () => {
  // 1. Clean up any DB rows we created.
  if (createdArtifactIds.length > 0) {
    await db.artifact.deleteMany({
      where: { id: { in: createdArtifactIds } },
    });
  }
  // 2. Clean up the R2 test object (best-effort).
  if (env.R2_ENABLED && env.R2_BUCKET) {
    try {
      await r2.send(
        new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: TEST_KEY }),
      );
    } catch {
      // Object may not exist if the upload step failed; ignore.
    }
  }
});

describe("getDownloadUrl — live R2 round-trip", () => {
  it.skipIf(!process.env.R2_ENABLED)(
    "PUTs a tiny object, fetches via presigned GET, verifies body matches",
    async () => {
      const user = await db.user.findUniqueOrThrow({
        where: { email: SEED_EMAIL },
      });
      const project = await db.project.findUniqueOrThrow({
        where: { slug: "esp32-sensor-breakout" },
      });
      const revision = await db.revision.findFirstOrThrow({
        where: { projectId: project.id },
      });

      // Step 1: PUT the bytes to R2 directly (bypasses the presign flow —
      // we're testing the GET half here, not the upload half).
      await r2.send(
        new PutObjectCommand({
          Bucket: env.R2_BUCKET!,
          Key: TEST_KEY,
          Body: TEST_BODY,
          ContentType: "text/plain",
          ContentLength: TEST_BODY.length,
        }),
      );

      // Step 2: Insert an Artifact row pointing at it.
      const artifact = await db.artifact.create({
        data: {
          revisionId: revision.id,
          stage: revision.currentStage,
          kind: "FILE",
          subkind: "GENERIC",
          title: `download roundtrip ${TEST_RUN_ID}`,
          fileKey: TEST_KEY,
          fileMime: "text/plain",
          fileBytes: TEST_BODY.length,
          createdBy: user.id,
        },
      });
      createdArtifactIds.push(artifact.id);

      // Step 3: Mint a presigned GET URL.
      const url = await getDownloadUrl(artifact.id);
      expect(url).toContain(TEST_KEY);

      // Step 4: Actually fetch and verify the body.
      const res = await fetch(url);
      expect(res.ok).toBe(true);
      const body = await res.text();
      expect(body).toBe(TEST_BODY);
    },
    60_000, // 60s timeout — live network round-trip.
  );

  it("rejects when the artifact isn't a FILE", async () => {
    const user = await db.user.findUniqueOrThrow({
      where: { email: SEED_EMAIL },
    });
    const project = await db.project.findUniqueOrThrow({
      where: { slug: "esp32-sensor-breakout" },
    });
    const revision = await db.revision.findFirstOrThrow({
      where: { projectId: project.id },
    });

    const noteArtifact = await db.artifact.create({
      data: {
        revisionId: revision.id,
        stage: revision.currentStage,
        kind: "NOTE",
        subkind: "GENERIC",
        title: `not-a-file ${TEST_RUN_ID}`,
        noteBody: "this is a note",
        createdBy: user.id,
      },
    });
    createdArtifactIds.push(noteArtifact.id);

    await expect(getDownloadUrl(noteArtifact.id)).rejects.toThrow(
      /not a file/i,
    );
  });
});
