// Tests for exam actions. getExam must NEVER leak the answer key (correctIndex)
// to the client. (submitExam scoring is covered below in Task 3.3.)
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockAuth = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({ auth: () => mockAuth() }));

import { db } from "@/lib/db";
import { getExam } from "@/lib/actions/exam";

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
  await db.project.deleteMany({ where: { id: projectId } });
  await db.user.deleteMany({ where: { id: userId } });
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
