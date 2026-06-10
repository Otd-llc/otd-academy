// Tests for recordQuizPass — SERVER-SIDE scored. The client submits its picked
// `answers`; the action re-scores them against the card's real answer keys (loaded
// from the DB guide content) and writes a QuizPass only on a genuine full-correct.
// A fabricated score is no longer possible (there is no `score` input); wrong or
// mis-counted answers are refused; recording against another user's enrollment is
// forbidden; a stage with no quiz is refused.
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockAuth = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({ auth: () => mockAuth() }));

import type { Stage } from "@prisma/client";
import { db } from "@/lib/db";
import { recordQuizPass } from "@/lib/actions/quiz";

const CALLER = "quiz-learner@example.com";
const OTHER = "quiz-other@example.com";
let callerId = "";
let otherId = "";
let enrollmentId = "";
let otherEnrollmentId = "";

// A quiz content block whose per-question correct-answer indices are `answers`.
function quizBlock(answers: number[]) {
  return {
    type: "quiz",
    prompt: "Quick check",
    questions: answers.map((a, i) => ({
      q: `Q${i + 1}?`,
      options: ["A", "B", "C"],
      answer: a,
      explain: "because",
    })),
  };
}

// project + revision + guide (+ a quiz card per entry) + enrollment for `userId`.
async function makeEnrollment(
  userId: string,
  slug: string,
  quizzes: { stage: Stage; answers: number[] }[],
): Promise<string> {
  const project = await db.project.create({
    data: { slug, name: "Quiz", createdById: userId },
  });
  const rev = await db.revision.create({
    data: { projectId: project.id, label: "v1" },
  });
  const guide = await db.guide.create({
    data: { revisionId: rev.id, title: "Quiz guide", createdById: userId },
  });
  let ordinal = 0;
  for (const { stage, answers } of quizzes) {
    await db.guideCard.create({
      data: {
        guideId: guide.id,
        stage,
        ordinal: ordinal++,
        eyebrow: "e",
        title: "t",
        contentBlocks: [quizBlock(answers)],
      },
    });
  }
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
  enrollmentId = await makeEnrollment(caller.id, `quiz-caller-${Date.now()}`, [
    { stage: "REQUIREMENTS", answers: [1, 0, 2] },
    { stage: "SCHEMATIC", answers: [2, 2, 2, 2, 2] },
  ]);
  otherEnrollmentId = await makeEnrollment(other.id, `quiz-other-${Date.now()}`, [
    { stage: "REQUIREMENTS", answers: [1, 0, 2] },
  ]);
  mockAuth.mockResolvedValue({ user: { email: CALLER } });
});

afterAll(async () => {
  await db.enrollment.deleteMany({ where: { userId: { in: [callerId, otherId] } } });
  await db.project.deleteMany({ where: { createdById: { in: [callerId, otherId] } } });
  await db.user.deleteMany({ where: { id: { in: [callerId, otherId] } } });
});

describe("recordQuizPass — server-scored", () => {
  test("all-correct answers upsert a QuizPass on (enrollmentId, stage)", async () => {
    const res = await recordQuizPass({
      enrollmentId,
      stage: "REQUIREMENTS",
      answers: [1, 0, 2],
    });
    expect(res.ok).toBe(true);
    const row = await db.quizPass.findUnique({
      where: { enrollmentId_stage: { enrollmentId, stage: "REQUIREMENTS" } },
    });
    expect(row).not.toBeNull();
  });

  test("wrong answers are refused and record nothing", async () => {
    const res = await recordQuizPass({
      enrollmentId,
      stage: "SCHEMATIC",
      answers: [0, 0, 0, 0, 0],
    });
    expect(res.ok).toBe(false);
    const row = await db.quizPass.findUnique({
      where: { enrollmentId_stage: { enrollmentId, stage: "SCHEMATIC" } },
    });
    expect(row).toBeNull();
  });

  test("a mis-counted answer array can't sneak a pass", async () => {
    const res = await recordQuizPass({
      enrollmentId,
      stage: "SCHEMATIC",
      answers: [2, 2], // SCHEMATIC has 5 questions
    });
    expect(res.ok).toBe(false);
  });

  test("re-pass is idempotent (still one row)", async () => {
    await recordQuizPass({ enrollmentId, stage: "REQUIREMENTS", answers: [1, 0, 2] });
    const count = await db.quizPass.count({
      where: { enrollmentId, stage: "REQUIREMENTS" },
    });
    expect(count).toBe(1);
  });

  test("a stage with no quiz on the card is refused", async () => {
    const res = await recordQuizPass({
      enrollmentId,
      stage: "LAYOUT", // no LAYOUT card on this enrollment's guide
      answers: [0],
    });
    expect(res.ok).toBe(false);
  });

  test("cannot record against another user's enrollment", async () => {
    const res = await recordQuizPass({
      enrollmentId: otherEnrollmentId,
      stage: "REQUIREMENTS",
      answers: [1, 0, 2],
    });
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/forbidden/i);
  });
});
