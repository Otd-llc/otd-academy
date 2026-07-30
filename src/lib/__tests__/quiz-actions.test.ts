// Tests for recordQuizPass — SERVER-SIDE scored. The client submits its picked
// `answers`; the action re-scores them against the card's real answer keys (loaded
// from the DB guide content) and writes a QuizPass only on a genuine full-correct.
// A fabricated score is no longer possible (there is no `score` input); wrong or
// mis-counted answers are refused; recording against another user's enrollment is
// forbidden; a stage with no quiz is refused.
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

// next/cache is stubbed WHOLESALE, so this factory must carry every export anything
// in this module graph touches — a missing one fails the import with "No X export is
// defined on the next/cache mock", which reads like a mock problem rather than the
// real cause. cacheLife/cacheTag are no-ops here: without the Next compiler the
// `use cache` directive is an inert string, so cached loaders simply run uncached.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));

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

// Move an enrollment's own currentStage. recordQuizPass only accepts a pass for the
// stage the learner is ON, so a test that exercises any OTHER refusal reason has to
// put the learner there first — otherwise it passes for the wrong reason.
async function setStage(id: string, stage: Stage) {
  await db.enrollment.update({ where: { id }, data: { currentStage: stage } });
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
    // setStage + the message assertion together stop this passing for the wrong
    // reason: without them the action refuses because the learner isn't on
    // SCHEMATIC, and the wrong-answer path would go untested.
    await setStage(enrollmentId, "SCHEMATIC");
    const res = await recordQuizPass({
      enrollmentId,
      stage: "SCHEMATIC",
      answers: [0, 0, 0, 0, 0],
    });
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/not fully correct/i);
    const row = await db.quizPass.findUnique({
      where: { enrollmentId_stage: { enrollmentId, stage: "SCHEMATIC" } },
    });
    expect(row).toBeNull();
    await setStage(enrollmentId, "REQUIREMENTS");
  });

  test("a mis-counted answer array can't sneak a pass", async () => {
    await setStage(enrollmentId, "SCHEMATIC");
    const res = await recordQuizPass({
      enrollmentId,
      stage: "SCHEMATIC",
      answers: [2, 2], // SCHEMATIC has 5 questions
    });
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/not fully correct/i);
    await setStage(enrollmentId, "REQUIREMENTS");
  });

  test("re-pass is idempotent (still one row)", async () => {
    await recordQuizPass({ enrollmentId, stage: "REQUIREMENTS", answers: [1, 0, 2] });
    const count = await db.quizPass.count({
      where: { enrollmentId, stage: "REQUIREMENTS" },
    });
    expect(count).toBe(1);
  });

  test("a stage with no quiz on the card is refused", async () => {
    // On LAYOUT, so the refusal is provably about the missing quiz rather than
    // about the learner being on a different stage.
    await setStage(enrollmentId, "LAYOUT");
    const res = await recordQuizPass({
      enrollmentId,
      stage: "LAYOUT", // no LAYOUT card on this enrollment's guide
      answers: [0],
    });
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/no quiz/i);
    await setStage(enrollmentId, "REQUIREMENTS");
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

describe("recordQuizPass — a pass only counts at the stage you're ON", () => {
  // Every stage card is publicly readable and this action used to accept ANY stage,
  // so a learner could clear all eight quizzes before starting and then advance
  // straight through. The pass has to be earned at the point of learning.
  test("refuses a stage AHEAD of the learner's currentStage, and records nothing", async () => {
    await setStage(enrollmentId, "REQUIREMENTS");
    const res = await recordQuizPass({
      enrollmentId,
      stage: "SCHEMATIC", // correct answers, but the learner is still on REQUIREMENTS
      answers: [2, 2, 2, 2, 2],
    });
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/not at this stage/i);
    const row = await db.quizPass.findUnique({
      where: { enrollmentId_stage: { enrollmentId, stage: "SCHEMATIC" } },
    });
    expect(row).toBeNull();
  });

  test("accepts the very same submission once the learner IS on that stage", async () => {
    // Same enrollment, same answers as the refusal above — only currentStage moved.
    // That isolates the gate to the stage check and nothing else.
    await setStage(enrollmentId, "SCHEMATIC");
    const res = await recordQuizPass({
      enrollmentId,
      stage: "SCHEMATIC",
      answers: [2, 2, 2, 2, 2],
    });
    expect(res.ok).toBe(true);
    await db.quizPass.deleteMany({ where: { enrollmentId, stage: "SCHEMATIC" } });
    await setStage(enrollmentId, "REQUIREMENTS");
  });

  test("refuses a stage BEHIND the learner too (re-passing a cleared stage)", async () => {
    await setStage(enrollmentId, "SCHEMATIC");
    const res = await recordQuizPass({
      enrollmentId,
      stage: "REQUIREMENTS",
      answers: [1, 0, 2],
    });
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/not at this stage/i);
    await setStage(enrollmentId, "REQUIREMENTS");
  });
});

describe("recordQuizPass — gate selection (WI-2)", () => {
  // Cards with TWO quiz blocks whose key LENGTHS differ, so the block that actually
  // scores is provable: an answer array of the wrong length can never pass a block,
  // so ok:true pins down exactly which block was scored.
  let flaggedEnrollmentId = ""; // practice(1 key) FIRST, flagged gate(2 keys) SECOND
  let unflaggedEnrollmentId = ""; // two blocks, NEITHER flagged → first(1 key) is gate

  beforeAll(async () => {
    const flagged = await db.project.create({
      data: { slug: `quiz-gate-${Date.now()}`, name: "Gate", createdById: callerId },
    });
    const fr = await db.revision.create({ data: { projectId: flagged.id, label: "v1" } });
    const fg = await db.guide.create({
      data: { revisionId: fr.id, title: "g", createdById: callerId },
    });
    await db.guideCard.create({
      data: {
        guideId: fg.id, stage: "REQUIREMENTS", ordinal: 0, eyebrow: "e", title: "t",
        contentBlocks: [
          { type: "quiz", questions: [{ q: "practice?", options: ["A", "B"], answer: 0 }] },
          { type: "quiz", gate: true, questions: [
            { q: "gate one?", options: ["A", "B"], answer: 1 },
            { q: "gate two?", options: ["A", "B"], answer: 1 },
          ] },
        ],
      },
    });
    flaggedEnrollmentId = (await db.enrollment.create({
      data: { userId: callerId, projectId: flagged.id, revisionId: fr.id },
    })).id;

    const plain = await db.project.create({
      data: { slug: `quiz-fallback-${Date.now()}`, name: "Fallback", createdById: callerId },
    });
    const pr = await db.revision.create({ data: { projectId: plain.id, label: "v1" } });
    const pg = await db.guide.create({
      data: { revisionId: pr.id, title: "g", createdById: callerId },
    });
    await db.guideCard.create({
      data: {
        guideId: pg.id, stage: "REQUIREMENTS", ordinal: 0, eyebrow: "e", title: "t",
        contentBlocks: [
          { type: "quiz", questions: [{ q: "first?", options: ["A", "B"], answer: 0 }] },
          { type: "quiz", questions: [
            { q: "second one?", options: ["A", "B"], answer: 1 },
            { q: "second two?", options: ["A", "B"], answer: 1 },
          ] },
        ],
      },
    });
    unflaggedEnrollmentId = (await db.enrollment.create({
      data: { userId: callerId, projectId: plain.id, revisionId: pr.id },
    })).id;
  });

  test("scores the FLAGGED gate block, not the first quiz block", async () => {
    // The flagged gate (2nd, keys [1,1]) opens on its own answers.
    const pass = await recordQuizPass({
      enrollmentId: flaggedEnrollmentId, stage: "REQUIREMENTS", answers: [1, 1],
    });
    expect(pass.ok).toBe(true);
  });

  test("the FIRST (non-gate) block's answers do NOT open the flagged gate", async () => {
    // The first block's answers ([0], length 1) are the wrong length for the gate
    // block (length 2) — proving the first block is NOT the one scored.
    const res = await recordQuizPass({
      enrollmentId: flaggedEnrollmentId, stage: "REQUIREMENTS", answers: [0],
    });
    expect(res.ok).toBe(false);
  });

  test("falls back to the first quiz block when none is flagged", async () => {
    // First block (keys [0]) opens the gate…
    const pass = await recordQuizPass({
      enrollmentId: unflaggedEnrollmentId, stage: "REQUIREMENTS", answers: [0],
    });
    expect(pass.ok).toBe(true);
    // …and the SECOND block's answers ([1,1]) are the wrong length for the first,
    // so they never open the gate.
    const res = await recordQuizPass({
      enrollmentId: unflaggedEnrollmentId, stage: "REQUIREMENTS", answers: [1, 1],
    });
    expect(res.ok).toBe(false);
  });
});
