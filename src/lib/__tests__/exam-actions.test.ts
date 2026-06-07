// Tests for exam actions. getExam must NEVER leak the answer key (correctIndex)
// to the client. (submitExam scoring is covered below in Task 3.3.)
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockAuth = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({ auth: () => mockAuth() }));

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
