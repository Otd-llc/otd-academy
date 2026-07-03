// Tests for saveResume (guide-pacing plan, Task 7). Isolated throwaway rows so
// they never touch the seed fixture's real curriculum. Verifies the per-stage
// upsert, that a second stage doesn't clobber the first, and the silent no-ops
// (signed out / not enrolled).
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

const mockAuth = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({ auth: () => mockAuth() }));

import { db } from "@/lib/db";
import { saveResume } from "@/lib/actions/resume";
import type { ResumeRecord } from "@/lib/resume-position";

const EMAIL = "resume-learner@example.com";
let userId = "";
let projectId = "";

const rec = (anchorId: string, visited: string[]): ResumeRecord => ({ anchorId, visited, ts: Date.now() });

async function resumeState(): Promise<Record<string, ResumeRecord>> {
  const e = await db.enrollment.findUniqueOrThrow({
    where: { userId_projectId: { userId, projectId } },
    select: { resumeState: true },
  });
  return (e.resumeState ?? {}) as unknown as Record<string, ResumeRecord>;
}

beforeAll(async () => {
  await db.user.deleteMany({ where: { email: EMAIL } });
  const user = await db.user.create({ data: { email: EMAIL, name: "Resume", role: "LEARNER" } });
  userId = user.id;

  const project = await db.project.create({ data: { slug: `resume-${Date.now()}`, name: "Resume", createdById: userId } });
  const rev = await db.revision.create({ data: { projectId: project.id, label: "v1" } });
  await db.project.update({ where: { id: project.id }, data: { publishedRevisionId: rev.id } });
  await db.enrollment.create({ data: { userId, projectId: project.id, revisionId: rev.id } });
  projectId = project.id;

  mockAuth.mockResolvedValue({ user: { email: EMAIL } });
});

afterAll(async () => {
  await db.enrollment.deleteMany({ where: { userId } });
  await db.project.deleteMany({ where: { createdById: userId } });
  await db.user.deleteMany({ where: { id: userId } });
});

describe("saveResume", () => {
  test("writes the per-stage record into the caller's enrollment", async () => {
    mockAuth.mockResolvedValue({ user: { email: EMAIL } });
    const r = rec("island-04", ["island-01", "island-02", "island-03"]);
    await saveResume(projectId, "SCHEMATIC", r);
    expect((await resumeState()).SCHEMATIC).toEqual(r);
  });

  test("upserts a second stage without clobbering the first", async () => {
    const r2 = rec("island-06", ["island-05"]);
    await saveResume(projectId, "LAYOUT", r2);
    const state = await resumeState();
    expect(state.LAYOUT).toEqual(r2);
    expect(state.SCHEMATIC?.anchorId).toBe("island-04");
  });

  test("silent no-op when signed out", async () => {
    mockAuth.mockResolvedValueOnce(null);
    await saveResume(projectId, "BRINGUP", rec("island-02", []));
    expect((await resumeState()).BRINGUP).toBeUndefined();
  });

  test("silent no-op when not enrolled on the board", async () => {
    mockAuth.mockResolvedValue({ user: { email: EMAIL } });
    const orphan = await db.project.create({ data: { slug: `resume-orphan-${Date.now()}`, name: "Orphan", createdById: userId } });
    await saveResume(orphan.id, "SCHEMATIC", rec("island-01", []));
    expect(await db.enrollment.count({ where: { userId, projectId: orphan.id } })).toBe(0);
  });
});
