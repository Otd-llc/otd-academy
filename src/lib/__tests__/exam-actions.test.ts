// Tests for exam actions. getExam must NEVER leak the answer key (correctIndex)
// to the client. (submitExam scoring is covered below in Task 3.3.)
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

// Spy the funnel emitter rather than PostHog itself: `capture` is already a hard
// no-op without a key, so without this the assertions below would pass whether
// or not the call site exists. Hoisted so the mock factory can see it.
const { captureSpy } = vi.hoisted(() => ({ captureSpy: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ capture: captureSpy }));

import type { EnrollmentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getExam, submitExam } from "@/lib/actions/exam";

const EMAIL = "exam-viewer@example.com";
let userId = "";
let projectId = "";

beforeAll(async () => {
  await db.user.deleteMany({ where: { email: EMAIL } });
  const user = await db.user.create({
    data: { email: EMAIL, name: "Viewer", role: "LEARNER" },
  });
  userId = user.id;
  const project = await db.project.create({
    data: { slug: `exam-get-${Date.now()}`, name: "Exam", createdById: user.id },
  });
  projectId = project.id;
  await db.exam.create({
    data: {
      projectId: project.id,
      title: "WROOM final",
      passThreshold: 80,
      questions: [
        { id: "q1", prompt: "2+2?", options: ["3", "4", "5"], correctIndex: 1 },
        { id: "q2", prompt: "Sky?", options: ["blue", "green"], correctIndex: 0 },
      ],
    },
  });
  mockAuth.mockResolvedValue({ user: { email: EMAIL } });
});

afterAll(async () => {
  await db.enrollment.deleteMany({ where: { userId } });
  await db.project.deleteMany({ where: { createdById: userId } });
  await db.user.deleteMany({ where: { id: userId } });
});

// Build a project with an exam (threshold 80) and an enrollment for the caller
// parked at `status`. Two questions; correct answers are q1->1, q2->0.
let exseq = 0;
async function makeExamEnrollment(status: EnrollmentStatus): Promise<string> {
  exseq += 1;
  const project = await db.project.create({
    data: { slug: `exam-sub-${exseq}-${Date.now()}`, name: "Exam", createdById: userId },
  });
  const rev = await db.revision.create({
    data: { projectId: project.id, label: "v1" },
  });
  await db.exam.create({
    data: {
      projectId: project.id,
      title: "Final",
      passThreshold: 80,
      questions: [
        { id: "q1", prompt: "2+2?", options: ["3", "4", "5"], correctIndex: 1 },
        { id: "q2", prompt: "Sky?", options: ["blue", "green"], correctIndex: 0 },
      ],
    },
  });
  await db.enrollment.create({
    data: { userId, projectId: project.id, revisionId: rev.id, status },
  });
  return project.id;
}

async function enrollmentFor(projectId: string) {
  return db.enrollment.findUniqueOrThrow({
    where: { userId_projectId: { userId, projectId } },
  });
}

describe("getExam — premium entitlement gate", () => {
  // A PREMIUM course's exam bank is paid capstone content. getExam is a
  // directly-invocable server action, so the UI gate on the exam page is not
  // the real boundary — the action itself must refuse a non-entitled caller.
  let premiumId = "";
  beforeAll(async () => {
    const project = await db.project.create({
      data: {
        slug: `exam-prem-${Date.now()}`,
        name: "Premium exam",
        createdById: userId,
        accessTier: "PREMIUM",
      },
    });
    premiumId = project.id;
    await db.exam.create({
      data: {
        projectId: project.id,
        title: "Premium final",
        passThreshold: 80,
        questions: [
          { id: "q1", prompt: "2+2?", options: ["3", "4"], correctIndex: 1 },
        ],
      },
    });
  });

  test("returns null for a signed-in caller with no entitlement or enrollment", async () => {
    const res = await getExam(premiumId);
    expect(res).toBeNull();
  });

  test("returns the stripped bank once the caller is entitled", async () => {
    await db.entitlement.create({
      data: { userId, projectId: premiumId, source: "GRANT" },
    });
    const res = await getExam(premiumId);
    expect(res).not.toBeNull();
    expect(res!.questions[0]).not.toHaveProperty("correctIndex");
    await db.entitlement.deleteMany({ where: { userId, projectId: premiumId } });
  });

  test("returns the stripped bank for an enrolled caller", async () => {
    const rev = await db.revision.create({
      data: { projectId: premiumId, label: "vprem" },
    });
    await db.enrollment.create({
      data: { userId, projectId: premiumId, revisionId: rev.id },
    });
    const res = await getExam(premiumId);
    expect(res).not.toBeNull();
    await db.enrollment.deleteMany({ where: { userId, projectId: premiumId } });
  });
});

describe("submitExam", () => {
  test("above-threshold submission records passed:true and sets MASTERED", async () => {
    const pid = await makeExamEnrollment("COMPLETED");
    const res = await submitExam({ projectId: pid, answers: { q1: 1, q2: 0 } });
    expect(res).toEqual({ score: 2, total: 2, passed: true });

    const e = await enrollmentFor(pid);
    expect(e.status).toBe("MASTERED");
    expect(e.masteredAt).not.toBeNull();
    const result = await db.examResult.findFirstOrThrow({ where: { enrollmentId: e.id } });
    expect(result.passed).toBe(true);
  });

  test("below-threshold submission records passed:false and leaves status unchanged", async () => {
    const pid = await makeExamEnrollment("COMPLETED");
    const res = await submitExam({ projectId: pid, answers: { q1: 0, q2: 1 } });
    expect(res.passed).toBe(false);
    expect(res.score).toBe(0);

    const e = await enrollmentFor(pid);
    expect(e.status).toBe("COMPLETED");
    expect(e.masteredAt).toBeNull();
  });

  test("an IN_PROGRESS enrollment cannot submit (finish the board first)", async () => {
    const pid = await makeExamEnrollment("IN_PROGRESS");
    await expect(
      submitExam({ projectId: pid, answers: { q1: 1, q2: 0 } }),
    ).rejects.toThrow(/finish the board/i);
  });
});

// The beta needs a completion rate, and a completion rate needs the exam hop
// emitted. Before this, `submitExam` fired nothing at all: every learner who
// took the final and every learner who never opened it looked identical in the
// funnel. `certificate_shared` is not a substitute — it only fires if they
// choose to share.
describe("submitExam — funnel instrumentation", () => {
  test("a pass emits exam_submitted with passed:true, the score, and the slug", async () => {
    captureSpy.mockClear();
    const pid = await makeExamEnrollment("COMPLETED");
    const project = await db.project.findUniqueOrThrow({
      where: { id: pid },
      select: { slug: true },
    });

    await submitExam({ projectId: pid, answers: { q1: 1, q2: 0 } });

    const call = captureSpy.mock.calls.find((c) => c[0] === "exam_submitted");
    expect(call, "no exam_submitted event was emitted").toBeDefined();
    expect(call![1]).toMatchObject({
      projectSlug: project.slug,
      passed: true,
      score: 2,
      total: 2,
    });
    // Tied to the person, or it cannot be joined to the rest of their funnel.
    expect(call![2]).toBe(userId);
  });

  test("a FAIL is emitted too — the drop-off is the point of measuring", async () => {
    captureSpy.mockClear();
    const pid = await makeExamEnrollment("COMPLETED");

    await submitExam({ projectId: pid, answers: { q1: 0, q2: 1 } });

    const call = captureSpy.mock.calls.find((c) => c[0] === "exam_submitted");
    expect(call, "no exam_submitted event was emitted on a failing attempt").toBeDefined();
    expect(call![1]).toMatchObject({ passed: false, score: 0, total: 2 });
  });

  test("a refused submission emits nothing", async () => {
    captureSpy.mockClear();
    const pid = await makeExamEnrollment("IN_PROGRESS");
    await expect(
      submitExam({ projectId: pid, answers: { q1: 1, q2: 0 } }),
    ).rejects.toThrow();
    expect(captureSpy.mock.calls.filter((c) => c[0] === "exam_submitted")).toHaveLength(0);
  });
});

describe("getExam", () => {
  test("returns questions with prompt/options but never correctIndex", async () => {
    const exam = await getExam(projectId);
    expect(exam).not.toBeNull();
    expect(exam!.title).toBe("WROOM final");
    expect(exam!.passThreshold).toBe(80);
    expect(exam!.questions).toHaveLength(2);
    for (const q of exam!.questions) {
      expect(q.prompt).toBeTruthy();
      expect(Array.isArray(q.options)).toBe(true);
      expect((q as Record<string, unknown>).correctIndex).toBeUndefined();
    }
    // The full serialized payload must not contain the answer key field at all.
    expect(JSON.stringify(exam)).not.toContain("correctIndex");
  });

  test("returns null for a project with no exam", async () => {
    const other = await db.project.create({
      data: { slug: `exam-none-${Date.now()}`, name: "No exam", createdById: userId },
    });
    const exam = await getExam(other.id);
    expect(exam).toBeNull();
    await db.project.deleteMany({ where: { id: other.id } });
  });
});
