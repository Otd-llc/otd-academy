import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";

describe("CHECK project_dependency_no_self_edge", () => {
  let userId: string;
  let projectId: string;

  beforeAll(async () => {
    const u = await db.user.upsert({
      where: { email: "test-pdne@example.com" },
      update: {},
      create: { email: "test-pdne@example.com" },
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
    // Clean up any leftover dependency rows for this project from prior failed runs.
    await db.projectDependency.deleteMany({
      where: { dependentProjectId: projectId },
    });
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
