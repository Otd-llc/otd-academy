// Tests for recordQuizPass after the per-enrollment re-key. A full score upserts
// a QuizPass on (enrollmentId, stage); a partial score is refused; recording
// against another user's enrollment is forbidden.
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockAuth = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({ auth: () => mockAuth() }));

import { db } from "@/lib/db";
import { recordQuizPass } from "@/lib/actions/quiz";

const CALLER = "quiz-learner@example.com";
const OTHER = "quiz-other@example.com";
let callerId = "";
let otherId = "";
let enrollmentId = "";
let otherEnrollmentId = "";

async function makeEnrollment(userId: string, slug: string): Promise<string> {
  const project = await db.project.create({
    data: { slug, name: "Quiz", createdById: userId },
  });
  const rev = await db.revision.create({
    data: { projectId: project.id, label: "v1" },
  });
  const e = await db.enrollment.create({
    data: { userId, projectId: project.id, revisionId: rev.id },
  });
  return e.id;
}

beforeAll(async () => {
  await db.user.deleteMany({ where: { email: { in: [CALLER, OTHER] } } });
  const caller = await db.user.create({
    data: { email: CALLER, name: "Caller", role: "LEARNER" },
  });
  const other = await db.user.create({
    data: { email: OTHER, name: "Other", role: "LEARNER" },
  });
  callerId = caller.id;
  otherId = other.id;
  enrollmentId = await makeEnrollment(caller.id, `quiz-caller-${Date.now()}`);
  otherEnrollmentId = await makeEnrollment(other.id, `quiz-other-${Date.now()}`);
  mockAuth.mockResolvedValue({ user: { email: CALLER } });
});

afterAll(async () => {
  await db.enrollment.deleteMany({ where: { userId: { in: [callerId, otherId] } } });
  await db.project.deleteMany({ where: { createdById: { in: [callerId, otherId] } } });
  await db.user.deleteMany({ where: { id: { in: [callerId, otherId] } } });
});

describe("recordQuizPass", () => {
  test("full score upserts a QuizPass on (enrollmentId, stage)", async () => {
    const res = await recordQuizPass({
      enrollmentId,
      stage: "REQUIREMENTS",
      score: 5,
      total: 5,
    });
    expect(res.ok).toBe(true);
    const row = await db.quizPass.findUnique({
      where: { enrollmentId_stage: { enrollmentId, stage: "REQUIREMENTS" } },
    });
    expect(row).not.toBeNull();
  });

  test("partial score is refused and records nothing", async () => {
    const res = await recordQuizPass({
      enrollmentId,
      stage: "SCHEMATIC",
      score: 2,
      total: 5,
    });
    expect(res.ok).toBe(false);
    const row = await db.quizPass.findUnique({
      where: { enrollmentId_stage: { enrollmentId, stage: "SCHEMATIC" } },
    });
    expect(row).toBeNull();
  });

  test("re-pass is idempotent (still one row)", async () => {
    await recordQuizPass({ enrollmentId, stage: "REQUIREMENTS", score: 5, total: 5 });
    const count = await db.quizPass.count({
      where: { enrollmentId, stage: "REQUIREMENTS" },
    });
    expect(count).toBe(1);
  });

  test("cannot record against another user's enrollment", async () => {
    await expect(
      recordQuizPass({
        enrollmentId: otherEnrollmentId,
        stage: "REQUIREMENTS",
        score: 5,
        total: 5,
      }),
    ).rejects.toThrow(/forbidden/i);
  });
});
