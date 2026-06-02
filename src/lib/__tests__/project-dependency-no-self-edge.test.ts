import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";

const SEED_EMAIL = "seed@example.com";

describe("CHECK project_dependency_no_self_edge", () => {
  let userId: string;
  let projectId: string;

  beforeAll(async () => {
    const u = await db.user.findUniqueOrThrow({
      where: { email: SEED_EMAIL },
    });
    userId = u.id;
    const p = await db.project.create({
      data: {
        slug: `test-pdne-${Date.now()}`,
        name: "self-edge test",
        createdById: userId,
      },
    });
    projectId = p.id;
  });

  afterAll(async () => {
    await db.projectDependency.deleteMany({
      where: { dependentProjectId: projectId },
    });
    await db.project.delete({ where: { id: projectId } });
  });

  test("rejects self-edge", async () => {
    await expect(
      db.$executeRawUnsafe(`
        INSERT INTO "ProjectDependency" (id, "dependentProjectId", "dependsOnProjectId", kind, "dependentStageGated", "dependsOnStageRequired", "createdById", "createdAt")
        VALUES ('test-pdne-1', '${projectId}', '${projectId}', 'DE_RISK', 'REQUIREMENTS', 'BRINGUP', '${userId}', NOW())
      `),
    ).rejects.toThrow(/project_dependency_no_self_edge|check/i);
  });
});
