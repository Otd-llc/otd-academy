// Tests for the createUploadUrl server action (Task 10.3).
//
// Mocks `@/lib/r2` so we can spy on the S3Client and intercept the
// `@aws-sdk/s3-request-presigner` getSignedUrl call. This keeps the test
// hermetic — no real R2 network call required — while still exercising the
// full action including ownerMatches, freeze, and size-cap checks.
//
// Live R2 round-trip lives in m8b-checkpoint.test.ts (Task 10.6); this file
// is the unit-level coverage.
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockAuth = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({
  auth: () => mockAuth(),
}));

// Capture every send() the action makes so we can assert R2 was (or was
// not) touched in each branch. Use vi.hoisted so the mock factory below
// (which itself gets hoisted before regular `const`) can see it.
const { r2SendMock } = vi.hoisted(() => ({
  r2SendMock: vi.fn(),
}));

vi.mock("@/lib/r2", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/r2")>("@/lib/r2");
  return {
    ...actual,
    r2: { send: r2SendMock },
  };
});

// Mock getSignedUrl so we get a deterministic URL back without contacting R2.
vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(async (_client, command) => {
    // The presigner inspects `command.input.Key` to build the canonical URL.
    // Use that to round-trip the key so tests can assert it's embedded.
    const key = (command as { input: { Key: string } }).input.Key;
    return `https://example.r2.cloudflarestorage.com/foundry-prod/${encodeURIComponent(key)}?X-Amz-Signature=stub`;
  }),
}));

import type { Stage } from "@prisma/client";
import {
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { db } from "@/lib/db";
import { createUploadUrl, recordArtifact } from "@/lib/actions/uploads";
import { MAX_UPLOAD_BYTES } from "@/lib/schemas/upload";

const SEED_EMAIL = "seed@example.com";
const SEED_PROJECT_SLUG = "esp32-sensor-breakout";

const createdBuildIds: string[] = [];
const createdRevisionIds: string[] = [];
const createdArtifactIds: string[] = [];

beforeAll(() => {
  mockAuth.mockImplementation(async () => ({
    user: { email: SEED_EMAIL },
  }));
});

beforeEach(() => {
  r2SendMock.mockReset();
});

afterAll(async () => {
  if (createdArtifactIds.length > 0) {
    await db.artifact.deleteMany({
      where: { id: { in: createdArtifactIds } },
    });
  }
  if (createdBuildIds.length > 0) {
    await db.build.deleteMany({ where: { id: { in: createdBuildIds } } });
  }
  if (createdRevisionIds.length > 0) {
    await db.revision.deleteMany({
      where: { id: { in: createdRevisionIds } },
    });
  }
});

async function seedUser() {
  return db.user.findUniqueOrThrow({ where: { email: SEED_EMAIL } });
}

async function makeRevAtStage(stage: Stage, label: string) {
  const user = await seedUser();
  const project = await db.project.findUniqueOrThrow({
    where: { slug: SEED_PROJECT_SLUG },
  });
  const rev = await db.revision.create({
    data: {
      projectId: project.id,
      label,
      currentStage: stage,
    },
  });
  createdRevisionIds.push(rev.id);
  await db.stageTransition.create({
    data: {
      revisionId: rev.id,
      fromStage: null,
      toStage: "REQUIREMENTS",
      direction: "INIT",
      gateSnapshot: {
        v: 1,
        kind: "init",
        ts: new Date().toISOString(),
      },
      transitionedBy: user.id,
    },
  });
  return rev;
}

async function makeBuild(revisionId: string, label: string) {
  const user = await seedUser();
  const build = await db.build.create({
    data: {
      revisionId,
      label,
      boardCount: 1,
      createdById: user.id,
    },
  });
  createdBuildIds.push(build.id);
  return build;
}

describe("createUploadUrl — rejection paths", () => {
  test("mismatched owner/subkind: rejected before any R2 call", async () => {
    const rev = await makeRevAtStage(
      "ORDERING",
      `t10.3-mismatch-${Date.now()}`,
    );

    await expect(
      createUploadUrl({
        filename: "order.pdf",
        mime: "application/pdf",
        sizeBytes: 1234,
        // PCB_ORDER is build-scoped; revision owner → mismatch.
        owner: { kind: "revision", id: rev.id },
        stage: "ORDERING",
        subkind: "PCB_ORDER",
      }),
    ).rejects.toThrow(/not valid for revision/i);

    // Critical assertion: the action bailed before any R2 SDK call.
    // (The presigner is mocked too, but `r2.send` is the catch-all proxy
    // for any sdk command the action would dispatch.)
    expect(r2SendMock).not.toHaveBeenCalled();
  });

  test("oversize (101 MB): rejected by Zod before action body runs", async () => {
    const rev = await makeRevAtStage(
      "REQUIREMENTS",
      `t10.3-oversize-${Date.now()}`,
    );

    await expect(
      createUploadUrl({
        filename: "huge.bin",
        mime: "application/octet-stream",
        sizeBytes: MAX_UPLOAD_BYTES + 1,
        owner: { kind: "revision", id: rev.id },
        stage: "REQUIREMENTS",
        subkind: "REQUIREMENTS_DOC",
      }),
    ).rejects.toThrow();
    expect(r2SendMock).not.toHaveBeenCalled();
  });

  test("frozen revision: rejected", async () => {
    const user = await seedUser();
    const rev = await makeRevAtStage(
      "REQUIREMENTS",
      `t10.3-frozen-${Date.now()}`,
    );
    await db.revision.update({
      where: { id: rev.id },
      data: { frozenAt: new Date(), frozenById: user.id },
    });

    await expect(
      createUploadUrl({
        filename: "spec.md",
        mime: "text/markdown",
        sizeBytes: 1000,
        owner: { kind: "revision", id: rev.id },
        stage: "REQUIREMENTS",
        subkind: "REQUIREMENTS_DOC",
      }),
    ).rejects.toThrow(/frozen/i);
    expect(r2SendMock).not.toHaveBeenCalled();
  });

  test("frozen build: rejected", async () => {
    const rev = await makeRevAtStage(
      "ORDERING",
      `t10.3-frozenbuild-${Date.now()}`,
    );
    const build = await makeBuild(rev.id, `BUILD-${Date.now()}`);
    await db.build.update({
      where: { id: build.id },
      data: { frozenAt: new Date() },
    });

    await expect(
      createUploadUrl({
        filename: "order.pdf",
        mime: "application/pdf",
        sizeBytes: 1000,
        owner: { kind: "build", id: build.id },
        stage: "ORDERING",
        subkind: "PCB_ORDER",
      }),
    ).rejects.toThrow(/frozen/i);
    expect(r2SendMock).not.toHaveBeenCalled();
  });
});

describe("createUploadUrl — happy path", () => {
  test("revision-scoped REQUIREMENTS_DOC: returns presigned URL with key embedded", async () => {
    const rev = await makeRevAtStage(
      "REQUIREMENTS",
      `t10.3-happy-${Date.now()}`,
    );

    const result = await createUploadUrl({
      filename: "Spec v1.md",
      mime: "text/markdown",
      sizeBytes: 4096,
      owner: { kind: "revision", id: rev.id },
      stage: "REQUIREMENTS",
      subkind: "REQUIREMENTS_DOC",
    });

    // Key shape per design §7: revisions/{revisionId}/{stage}/{cuid}-{slug}.
    expect(result.key).toMatch(
      new RegExp(`^revisions/${rev.id}/REQUIREMENTS/[a-z0-9]+-spec-v1\\.md$`),
    );
    expect(result.cuid).toBeTruthy();
    expect(result.uploadUrl).toContain(encodeURIComponent(result.key));
    expect(result.sizeBytes).toBe(4096);
    expect(result.mime).toBe("text/markdown");
    expect(result.subkind).toBe("REQUIREMENTS_DOC");
  });

  test("build-scoped PCB_ORDER: returns presigned URL with builds/ prefix", async () => {
    const rev = await makeRevAtStage(
      "ORDERING",
      `t10.3-buildhappy-${Date.now()}`,
    );
    const build = await makeBuild(rev.id, `BUILD-OK-${Date.now()}`);

    const result = await createUploadUrl({
      filename: "jlc-receipt.pdf",
      mime: "application/pdf",
      sizeBytes: 2048,
      owner: { kind: "build", id: build.id },
      stage: "ORDERING",
      subkind: "PCB_ORDER",
    });

    expect(result.key).toMatch(
      new RegExp(`^builds/${build.id}/ORDERING/[a-z0-9]+-jlc-receipt\\.pdf$`),
    );
    expect(result.uploadUrl).toContain(encodeURIComponent(result.key));
  });
});

// ─── recordArtifact ────────────────────────────────────

// `recordArtifact` HEADs R2 and inserts the Artifact row. We mock `r2.send`
// to return either a clean HEAD (size matches) or an oversize HEAD (and
// then verify the subsequent DeleteObjectCommand is dispatched).
describe("recordArtifact — HEAD-verified happy path + reject paths", () => {
  test("HEAD reports correct size → inserts FILE-kind Artifact row", async () => {
    const rev = await makeRevAtStage(
      "SCHEMATIC",
      `t10.4-record-ok-${Date.now()}`,
    );

    // Simulate a clean HEAD: actual size matches declared.
    r2SendMock.mockImplementation(async (cmd: unknown) => {
      if (cmd instanceof HeadObjectCommand) {
        return { ContentLength: 4096 };
      }
      throw new Error(
        `unexpected R2 command in happy-path test: ${(cmd as object).constructor.name}`,
      );
    });

    const artifact = await recordArtifact({
      cuid: "abc123",
      key: `revisions/${rev.id}/SCHEMATIC/abc123-spec.kicad-sch`,
      owner: { kind: "revision", id: rev.id },
      stage: "SCHEMATIC",
      subkind: "SCHEMATIC_FILE",
      title: "Schematic v1",
      mime: "application/octet-stream",
      sizeBytes: 4096,
      filename: "spec.kicad_sch",
    });
    createdArtifactIds.push(artifact.id);

    expect(artifact.kind).toBe("FILE");
    expect(artifact.subkind).toBe("SCHEMATIC_FILE");
    expect(artifact.revisionId).toBe(rev.id);
    expect(artifact.buildId).toBeNull();
    expect(artifact.fileKey).toBe(
      `revisions/${rev.id}/SCHEMATIC/abc123-spec.kicad-sch`,
    );
    expect(artifact.fileMime).toBe("application/octet-stream");
    expect(artifact.fileBytes).toBe(4096);
    expect(artifact.title).toBe("Schematic v1");

    // The action HEADed exactly once; no DeleteObjectCommand was sent.
    const calls = r2SendMock.mock.calls.map((c) => c[0]);
    expect(calls.filter((c) => c instanceof HeadObjectCommand)).toHaveLength(1);
    expect(calls.filter((c) => c instanceof DeleteObjectCommand)).toHaveLength(
      0,
    );
  });

  test("HEAD reports oversize → DeleteObject dispatched + reject", async () => {
    const rev = await makeRevAtStage(
      "SCHEMATIC",
      `t10.4-record-over-${Date.now()}`,
    );

    // Simulate an oversize PUT: actual ContentLength much bigger than declared.
    r2SendMock.mockImplementation(async (cmd: unknown) => {
      if (cmd instanceof HeadObjectCommand) {
        return { ContentLength: 99_999 };
      }
      if (cmd instanceof DeleteObjectCommand) {
        return {}; // R2 ack.
      }
      throw new Error(
        `unexpected R2 command in oversize test: ${(cmd as object).constructor.name}`,
      );
    });

    await expect(
      recordArtifact({
        cuid: "abc123",
        key: `revisions/${rev.id}/SCHEMATIC/abc123-spec.kicad-sch`,
        owner: { kind: "revision", id: rev.id },
        stage: "SCHEMATIC",
        subkind: "SCHEMATIC_FILE",
        title: "should fail",
        mime: "application/octet-stream",
        sizeBytes: 4096,
        filename: "spec.kicad_sch",
      }),
    ).rejects.toThrow(/exceeds declared size/i);

    const calls = r2SendMock.mock.calls.map((c) => c[0]);
    expect(calls.filter((c) => c instanceof HeadObjectCommand)).toHaveLength(1);
    // Critical: DeleteObject was dispatched to clean up the orphan R2 object.
    expect(calls.filter((c) => c instanceof DeleteObjectCommand)).toHaveLength(
      1,
    );
  });

  test("forged token (ownerMatches fails): rejected before HEAD", async () => {
    const rev = await makeRevAtStage(
      "ORDERING",
      `t10.4-record-forged-${Date.now()}`,
    );

    await expect(
      recordArtifact({
        cuid: "abc123",
        key: `revisions/${rev.id}/ORDERING/abc123-bogus.pdf`,
        // PCB_ORDER is build-scoped; revision owner → mismatch.
        owner: { kind: "revision", id: rev.id },
        stage: "ORDERING",
        subkind: "PCB_ORDER",
        title: "forged",
        mime: "application/pdf",
        sizeBytes: 1000,
        filename: "bogus.pdf",
      }),
    ).rejects.toThrow(/not valid for revision/i);

    // No R2 call at all — ownerMatches caught the forgery first.
    expect(r2SendMock).not.toHaveBeenCalled();
  });
});
