// Tests for completion-gated board availability over the ProjectDependency DAG.
// A board is available iff every prerequisite (dependsOn) project is at least
// COMPLETED by the learner; enroll refuses a locked board.
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockAuth = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({ auth: () => mockAuth() }));

import { db } from "@/lib/db";
import { learnerBoardAvailability } from "@/lib/learner-board-availability";
import { enroll } from "@/lib/actions/enrollment";

const EMAIL = "avail-learner@example.com";
let userId = "";
// Pair A: prereq NOT completed -> dependent locked.
let prereqA = "";
let dependentA = "";
// Pair B: prereq completed -> dependent available.
let prereqB = "";
let dependentB = "";

async function publishedProject(slug: string): Promise<{ id: string; revisionId: string }> {
  const project = await db.project.create({
    data: { slug, name: slug, createdById: userId },
  });
  const rev = await db.revision.create({ data: { projectId: project.id, label: "v1" } });
  await db.project.update({
    where: { id: project.id },
    data: { publishedRevisionId: rev.id },
  });
  return { id: project.id, revisionId: rev.id };
}

async function dependsOn(dependentId: string, dependsOnId: string) {
  await db.projectDependency.create({
    data: {
      dependentProjectId: dependentId,
      dependsOnProjectId: dependsOnId,
      dependentStageGated: "REQUIREMENTS",
      dependsOnStageRequired: "REVISION",
      createdById: userId,
    },
  });
}

beforeAll(async () => {
  await db.user.deleteMany({ where: { email: EMAIL } });
  const user = await db.user.create({
    data: { email: EMAIL, name: "Avail", role: "LEARNER" },
  });
  userId = user.id;
  const ts = Date.now();

  const pa = await publishedProject(`avl-prereqA-${ts}`);
  const da = await publishedProject(`avl-depA-${ts}`);
  prereqA = pa.id;
  dependentA = da.id;
  await dependsOn(dependentA, prereqA); // no enrollment in prereqA -> locked

  const pb = await publishedProject(`avl-prereqB-${ts}`);
  const dbp = await publishedProject(`avl-depB-${ts}`);
  prereqB = pb.id;
  dependentB = dbp.id;
  await dependsOn(dependentB, prereqB);
  // Learner COMPLETED the prereqB board.
  await db.enrollment.create({
    data: { userId, projectId: prereqB, revisionId: pb.revisionId, status: "COMPLETED" },
  });

  mockAuth.mockResolvedValue({ user: { email: EMAIL } });
});

afterAll(async () => {
  await db.enrollment.deleteMany({ where: { userId } });
  await db.projectDependency.deleteMany({ where: { createdById: userId } });
  await db.project.deleteMany({ where: { createdById: userId } });
  await db.user.deleteMany({ where: { id: userId } });
});

describe("learnerBoardAvailability", () => {
  test("locks a board whose prerequisite is not COMPLETED, listing the missing prereq", async () => {
    const all = await learnerBoardAvailability(userId);
    const dep = all.find((b) => b.projectId === dependentA);
    expect(dep?.available).toBe(false);
    expect(dep?.missingPrereqs.map((p) => p.id)).toContain(prereqA);
  });

  test("marks a board available when all prerequisites are COMPLETED/MASTERED", async () => {
    const all = await learnerBoardAvailability(userId);
    const dep = all.find((b) => b.projectId === dependentB);
    expect(dep?.available).toBe(true);
    expect(dep?.missingPrereqs).toHaveLength(0);
  });
});

describe("enroll prerequisite gating", () => {
  test("refuses to enroll in a locked board", async () => {
    await expect(enroll({ projectId: dependentA })).rejects.toThrow(
      /prerequisites not complete/i,
    );
  });

  test("allows enrolling once prerequisites are complete", async () => {
    const res = await enroll({ projectId: dependentB });
    expect(res.status).toBe("IN_PROGRESS");
  });
});
