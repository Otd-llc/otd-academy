// Integration test for loadLearnerGateContext: loads an enrollment's proof
// artifacts + its quiz-pass Set (the inputs to learnerExitGate). Isolated
// fixtures (own user/project/revision/enrollment) so it never collides with the
// shared seed enrollment (unique on userId+projectId).
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { db } from "@/lib/db";
import { loadLearnerGateContext } from "@/lib/load-learner-gate-context";

const EMAIL = "load-lgc@example.com";
let enrollmentId = "";
let userId = "";
let projectId = "";

beforeAll(async () => {
  await db.user.deleteMany({ where: { email: EMAIL } });
  const user = await db.user.create({
    data: { email: EMAIL, name: "LGC", role: "LEARNER" },
  });
  userId = user.id;
  const project = await db.project.create({
    data: { slug: `llgc-${Date.now()}`, name: "LGC", createdById: user.id },
  });
  projectId = project.id;
  const revision = await db.revision.create({
    data: { projectId: project.id, label: "v1" },
  });
  const enrollment = await db.enrollment.create({
    data: { userId: user.id, projectId: project.id, revisionId: revision.id },
  });
  enrollmentId = enrollment.id;
  await db.artifact.create({
    data: {
      enrollmentId: enrollment.id,
      stage: "SCHEMATIC",
      kind: "NOTE",
      subkind: "ERC_REPORT",
      title: "my erc report",
      noteBody: "x",
      createdBy: user.id,
    },
  });
  await db.quizPass.create({
    data: { enrollmentId: enrollment.id, stage: "SCHEMATIC", score: 5, total: 5 },
  });
});

afterAll(async () => {
  if (enrollmentId) await db.enrollment.deleteMany({ where: { id: enrollmentId } });
  if (projectId) await db.project.deleteMany({ where: { id: projectId } });
  if (userId) await db.user.deleteMany({ where: { id: userId } });
});

describe("loadLearnerGateContext", () => {
  test("returns the enrollment's proof artifacts and quiz-pass Set", async () => {
    const ctx = await loadLearnerGateContext(db, enrollmentId);
    expect(ctx.enrollmentArtifacts).toEqual([{ subkind: "ERC_REPORT" }]);
    expect(ctx.quizPasses.has("SCHEMATIC")).toBe(true);
    expect(ctx.quizPasses.size).toBe(1);
  });
});
