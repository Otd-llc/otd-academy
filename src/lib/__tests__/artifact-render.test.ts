// Board stub (Task 8) — action-level coverage for the Artifact derived-.glb
// render trio. Mirrors uploads-actions.test.ts's hermetic R2 mocking: `@/lib/r2`
// is mocked so `r2.send` is a hoisted spy, and `@aws-sdk/s3-request-presigner`'s
// `getSignedUrl` is stubbed to a deterministic URL. We assert:
//   - recordArtifact PERSISTS renderKey/renderBytes/renderMime/renderBounds for a
//     MODEL_3D artifact when the render HEAD verifies, and
//   - leaves all render columns NULL when no render fields are passed (existing
//     FILE behavior unchanged), and
//   - getArtifactRenderUrl returns an inline URL for a render-bearing row, null
//     otherwise.
// Throwaway Revision + Build created in beforeAll; swept in afterAll asserting
// zero leftovers. Never touches curriculum/seed data.
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockAuth = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({
  auth: () => mockAuth(),
}));

// Hoisted so the mock factory (itself hoisted) can close over it.
const { r2SendMock } = vi.hoisted(() => ({
  r2SendMock: vi.fn(),
}));

vi.mock("@/lib/r2", async () => {
  const actual = await vi.importActual<typeof import("@/lib/r2")>("@/lib/r2");
  return {
    ...actual,
    r2: { send: r2SendMock },
  };
});

// Deterministic presigned URL without contacting R2; round-trips the Key so we
// can assert the render key is embedded in the GET URL.
vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(async (_client, command) => {
    const key = (command as { input: { Key: string } }).input.Key;
    return `https://example.r2.cloudflarestorage.com/foundry-prod/${encodeURIComponent(key)}?X-Amz-Signature=stub`;
  }),
}));

import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { db } from "@/lib/db";
import {
  recordArtifact,
  getArtifactRenderUrl,
} from "@/lib/actions/uploads";

const SEED_EMAIL = "seed@example.com";
const SEED_PROJECT_SLUG = "esp32-sensor-breakout";

const createdArtifactIds: string[] = [];
let revisionId: string;
let buildId: string;

beforeAll(async () => {
  mockAuth.mockImplementation(async () => ({ user: { email: SEED_EMAIL } }));

  const user = await db.user.findUniqueOrThrow({ where: { email: SEED_EMAIL } });
  const project = await db.project.findUniqueOrThrow({
    where: { slug: SEED_PROJECT_SLUG },
  });

  const rev = await db.revision.create({
    data: {
      projectId: project.id,
      label: `t8-render-${Date.now()}`,
      currentStage: "LAYOUT",
    },
  });
  revisionId = rev.id;
  await db.stageTransition.create({
    data: {
      revisionId: rev.id,
      fromStage: null,
      toStage: "REQUIREMENTS",
      direction: "INIT",
      gateSnapshot: { v: 1, kind: "init", ts: new Date().toISOString() },
      transitionedBy: user.id,
    },
  });

  const build = await db.build.create({
    data: {
      revisionId: rev.id,
      label: `BUILD-T8-${Date.now()}`,
      boardCount: 1,
      createdById: user.id,
    },
  });
  buildId = build.id;
});

beforeEach(() => {
  r2SendMock.mockReset();
});

afterAll(async () => {
  if (createdArtifactIds.length > 0) {
    await db.artifact.deleteMany({ where: { id: { in: createdArtifactIds } } });
  }
  if (buildId) await db.build.deleteMany({ where: { id: buildId } });
  if (revisionId) await db.revision.deleteMany({ where: { id: revisionId } });

  // Sweep assertion: zero leftovers.
  expect(
    await db.artifact.count({ where: { id: { in: createdArtifactIds } } }),
  ).toBe(0);
  expect(await db.build.count({ where: { id: buildId } })).toBe(0);
  expect(await db.revision.count({ where: { id: revisionId } })).toBe(0);
});

describe("recordArtifact render columns (board stub)", () => {
  test("persists the render trio for a MODEL_3D artifact when the render HEAD verifies", async () => {
    // Two HEADs: source file (4096) then render .glb (512). Both clean.
    r2SendMock.mockImplementation(async (cmd: unknown) => {
      if (cmd instanceof HeadObjectCommand) {
        const key = (cmd as HeadObjectCommand).input.Key ?? "";
        return { ContentLength: key.includes("render-") ? 512 : 4096 };
      }
      throw new Error(
        `unexpected R2 command: ${(cmd as object).constructor.name}`,
      );
    });

    const artifact = await recordArtifact({
      cuid: "m3d1",
      key: `revisions/${revisionId}/LAYOUT/m3d1-board.step`,
      owner: { kind: "revision", id: revisionId },
      stage: "LAYOUT",
      subkind: "MODEL_3D",
      title: "Board 3D",
      mime: "application/octet-stream",
      sizeBytes: 4096,
      filename: "board.step",
      renderKey: `revisions/${revisionId}/LAYOUT/render-m3d1.glb`,
      renderBytes: 512,
      renderBounds: { center: [0, 0, 0], radius: 3 },
    });
    createdArtifactIds.push(artifact.id);

    expect(artifact.subkind).toBe("MODEL_3D");
    expect(artifact.kind).toBe("FILE");
    expect(artifact.renderKey).toBe(
      `revisions/${revisionId}/LAYOUT/render-m3d1.glb`,
    );
    expect(artifact.renderBytes).toBe(512);
    expect(artifact.renderMime).toBe("model/gltf-binary");
    expect((artifact.renderBounds as { radius: number }).radius).toBe(3);

    // Two HEADs (source + render); no DeleteObject.
    const heads = r2SendMock.mock.calls
      .map((c) => c[0])
      .filter((c) => c instanceof HeadObjectCommand);
    expect(heads).toHaveLength(2);

    // getArtifactRenderUrl returns an inline GET with the render key embedded.
    const url = await getArtifactRenderUrl(artifact.id);
    expect(url).toContain(
      encodeURIComponent(`revisions/${revisionId}/LAYOUT/render-m3d1.glb`),
    );
    expect(url?.toLowerCase()).not.toContain("response-content-disposition");
  });

  test("leaves render columns null when no render fields are passed (existing FILE behavior)", async () => {
    // Single HEAD for the source; no render HEAD because no renderKey passed.
    r2SendMock.mockImplementation(async (cmd: unknown) => {
      if (cmd instanceof HeadObjectCommand) {
        return { ContentLength: 4096 };
      }
      throw new Error(
        `unexpected R2 command: ${(cmd as object).constructor.name}`,
      );
    });

    const artifact = await recordArtifact({
      cuid: "m3d2",
      key: `builds/${buildId}/BRINGUP/m3d2-board.step`,
      owner: { kind: "build", id: buildId },
      stage: "BRINGUP",
      subkind: "MODEL_3D",
      title: "Board 3D no-render",
      mime: "application/octet-stream",
      sizeBytes: 4096,
      filename: "board.step",
    });
    createdArtifactIds.push(artifact.id);

    expect(artifact.subkind).toBe("MODEL_3D");
    expect(artifact.renderKey).toBeNull();
    expect(artifact.renderBytes).toBeNull();
    expect(artifact.renderMime).toBeNull();
    expect(artifact.renderBounds).toBeNull();

    // Exactly one HEAD (source only) — the render path was never entered.
    const heads = r2SendMock.mock.calls
      .map((c) => c[0])
      .filter((c) => c instanceof HeadObjectCommand);
    expect(heads).toHaveLength(1);

    expect(await getArtifactRenderUrl(artifact.id)).toBeNull();
  });

  test("drops the render (columns null) when the render HEAD throws — source still records", async () => {
    // Source HEAD clean; render HEAD throws (object missing) → render dropped,
    // but the FILE artifact still records.
    r2SendMock.mockImplementation(async (cmd: unknown) => {
      if (cmd instanceof HeadObjectCommand) {
        const key = (cmd as HeadObjectCommand).input.Key ?? "";
        if (key.includes("render-")) throw new Error("render object missing");
        return { ContentLength: 4096 };
      }
      throw new Error(
        `unexpected R2 command: ${(cmd as object).constructor.name}`,
      );
    });

    const artifact = await recordArtifact({
      cuid: "m3d3",
      key: `revisions/${revisionId}/LAYOUT/m3d3-board.step`,
      owner: { kind: "revision", id: revisionId },
      stage: "LAYOUT",
      subkind: "MODEL_3D",
      title: "Board 3D bad-render",
      mime: "application/octet-stream",
      sizeBytes: 4096,
      filename: "board.step",
      renderKey: `revisions/${revisionId}/LAYOUT/render-m3d3.glb`,
      renderBytes: 512,
      renderBounds: { center: [0, 0, 0], radius: 3 },
    });
    createdArtifactIds.push(artifact.id);

    expect(artifact.renderKey).toBeNull();
    expect(artifact.renderBytes).toBeNull();
    expect(artifact.renderBounds).toBeNull();
  });
});
