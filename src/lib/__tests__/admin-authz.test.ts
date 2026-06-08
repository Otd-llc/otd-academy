// Authorization sweep guard: curriculum/parts-authoring mutations must reject a
// LEARNER with Forbidden. Representative mutation per major area is enough to
// lock the rule (the existing *-actions tests run as the ADMIN seed user and
// verify we did not OVER-gate; this verifies we did not UNDER-gate).
//
// Every action validates input (`parse`) BEFORE the auth check, so each call
// passes schema-valid input to reach `requireAdmin`. A real fixture cuid is
// reused for all cuid fields — the action throws Forbidden before it ever looks
// the entity up, so the cuid only needs to be format-valid.
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockAuth = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({ auth: () => mockAuth() }));

import { db } from "@/lib/db";
import { createProject } from "@/lib/actions/projects";
import { createRevision } from "@/lib/actions/revisions";
import { advanceStage } from "@/lib/actions/stages";
import { verifyPartAsset } from "@/lib/actions/part-assets";

const LEARNER_EMAIL = "admin-authz-learner@example.com";
let cuid = "";

// Sweep any rows a pre-fix (red) run may have written before the gate was in
// place — a stray project (FK: Project.createdById → the learner) and a stray
// revision (+ its INIT StageTransition, FK: transitionedBy → the learner) on
// the fixture project — THEN the learner user itself. Dependents must go first
// or deleting the user violates those FKs. Keeps the shared fixture pristine.
async function cleanup() {
  const fixture = await db.project.findUnique({
    where: { slug: "esp32-sensor-breakout" },
    select: { id: true },
  });
  if (fixture) {
    const strays = await db.revision.findMany({
      where: { projectId: fixture.id, label: "authztest" },
      select: { id: true },
    });
    for (const r of strays) {
      await db.stageTransition.deleteMany({ where: { revisionId: r.id } });
      await db.revision.delete({ where: { id: r.id } });
    }
  }
  await db.project.deleteMany({ where: { slug: { startsWith: "authz-test-" } } });
  await db.user.deleteMany({ where: { email: LEARNER_EMAIL } });
}

beforeAll(async () => {
  await cleanup();
  await db.user.create({
    data: { email: LEARNER_EMAIL, name: "Authz Learner", role: "LEARNER" },
  });
  // A real cuid (format-valid) for any cuid-typed input field.
  const project = await db.project.findUniqueOrThrow({
    where: { slug: "esp32-sensor-breakout" },
    select: { id: true },
  });
  cuid = project.id;
  mockAuth.mockResolvedValue({ user: { email: LEARNER_EMAIL } });
});

afterAll(cleanup);

describe("admin authorization sweep — learner is Forbidden", () => {
  test("createProject (projects) rejects a learner", async () => {
    await expect(
      createProject({ slug: `authz-test-${Date.now()}`, name: "x" }),
    ).rejects.toThrow(/Forbidden/);
  });

  test("createRevision (revisions) rejects a learner", async () => {
    await expect(
      createRevision({ projectId: cuid, label: "authztest" }),
    ).rejects.toThrow(/Forbidden/);
  });

  test("advanceStage (stages) rejects a learner", async () => {
    await expect(advanceStage({ revisionId: cuid })).rejects.toThrow(
      /Forbidden/,
    );
  });

  test("verifyPartAsset (part-assets) rejects a learner", async () => {
    await expect(
      verifyPartAsset({ id: cuid, updatedAt: new Date() }),
    ).rejects.toThrow(/Forbidden/);
  });
});
