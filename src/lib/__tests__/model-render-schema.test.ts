// Proves the render columns exist + round-trip on PartAsset, and that the
// MODEL_3D ArtifactSubkind enum value is present. Real Neon; one throwaway Part.
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { ArtifactSubkind } from "@prisma/client";
import { db } from "@/lib/db";

const SEED_EMAIL = "seed@example.com";
const TEST_MFR = "ModelRenderSchema-TestCo";
let seedUserId: string;
let partId: string;

beforeAll(async () => {
  const u = await db.user.findUniqueOrThrow({
    where: { email: SEED_EMAIL },
    select: { id: true },
  });
  seedUserId = u.id;
  const part = await db.part.create({
    data: {
      manufacturer: TEST_MFR,
      mpn: `MRS-${Date.now()}`,
      description: "render schema test part",
      createdById: seedUserId,
    },
    select: { id: true },
  });
  partId = part.id;
});

afterAll(async () => {
  await db.part.deleteMany({ where: { manufacturer: TEST_MFR } }).catch(() => {});
  expect(await db.part.count({ where: { id: partId } })).toBe(0);
});

test("PartAsset render columns round-trip", async () => {
  const a = await db.partAsset.create({
    data: {
      partId,
      kind: "MODEL_3D",
      r2Key: `parts/${partId}/model_3d-test.step`,
      filename: "test.step",
      byteSize: 1000,
      contentType: "application/octet-stream",
      renderKey: `parts/${partId}/model_3d_render-test.glb`,
      renderBytes: 250,
      renderMime: "model/gltf-binary",
      renderBounds: { center: [0, 0, 0], radius: 5 },
      createdById: seedUserId,
    },
  });
  expect(a.renderKey).toContain("model_3d_render");
  expect(a.renderMime).toBe("model/gltf-binary");
  expect((a.renderBounds as { radius: number }).radius).toBe(5);
});

test("MODEL_3D is a valid ArtifactSubkind", () => {
  expect(ArtifactSubkind.MODEL_3D).toBe("MODEL_3D");
});
