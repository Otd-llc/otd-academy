// Tests for learner enrollment actions. A LEARNER enrolls in a board whose
// publishedRevisionId is set; re-enroll is idempotent; an unpublished board is
// refused. Isolated fixtures so they never collide with the seed enrollment.
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockAuth = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({ auth: () => mockAuth() }));

import { db } from "@/lib/db";
import { enroll } from "@/lib/actions/enrollment";

const EMAIL = "enroll-learner@example.com";
let userId = "";
let publishedProjectId = "";
let unpublishedProjectId = "";

beforeAll(async () => {
  await db.user.deleteMany({ where: { email: EMAIL } });
  const user = await db.user.create({
    data: { email: EMAIL, name: "Enroll", role: "LEARNER" },
  });
  userId = user.id;

  const published = await db.project.create({
    data: { slug: `enr-pub-${Date.now()}`, name: "Published", createdById: user.id },
  });
  const rev = await db.revision.create({
    data: { projectId: published.id, label: "v1" },
  });
  await db.project.update({
    where: { id: published.id },
    data: { publishedRevisionId: rev.id },
  });
  publishedProjectId = published.id;

  const unpublished = await db.project.create({
    data: { slug: `enr-unp-${Date.now()}`, name: "Unpublished", createdById: user.id },
  });
  unpublishedProjectId = unpublished.id;

  mockAuth.mockResolvedValue({ user: { email: EMAIL } });
});

afterAll(async () => {
  await db.enrollment.deleteMany({ where: { userId } });
  await db.project.deleteMany({
    where: { id: { in: [publishedProjectId, unpublishedProjectId] } },
  });
  await db.user.deleteMany({ where: { id: userId } });
});

describe("enroll", () => {
  test("creates an Enrollment at REQUIREMENTS / IN_PROGRESS for a published board", async () => {
    const result = await enroll({ projectId: publishedProjectId });
    expect(result.status).toBe("IN_PROGRESS");

    const row = await db.enrollment.findUniqueOrThrow({
      where: { userId_projectId: { userId, projectId: publishedProjectId } },
    });
    expect(row.currentStage).toBe("REQUIREMENTS");
    expect(row.id).toBe(result.id);
  });

  test("is idempotent — re-enroll returns the same row", async () => {
    const first = await enroll({ projectId: publishedProjectId });
    const second = await enroll({ projectId: publishedProjectId });
    expect(second.id).toBe(first.id);
    const count = await db.enrollment.count({
      where: { userId, projectId: publishedProjectId },
    });
    expect(count).toBe(1);
  });

  test("refuses a board with no publishedRevisionId", async () => {
    await expect(
      enroll({ projectId: unpublishedProjectId }),
    ).rejects.toThrow(/not open for enrollment/i);
  });
});
