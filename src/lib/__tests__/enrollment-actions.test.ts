// Tests for learner enrollment actions. A LEARNER enrolls in a board whose
// publishedRevisionId is set; re-enroll is idempotent; an unpublished board is
// refused. Isolated fixtures so they never collide with the seed enrollment.
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockAuth = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({ auth: () => mockAuth() }));

import type { Stage } from "@prisma/client";
import { db } from "@/lib/db";
import {
  enroll,
  advanceEnrollment,
  submitEnrollmentProof,
  createEnrollmentProofUploadUrl,
} from "@/lib/actions/enrollment";
import { QUIZ_NOT_PASSED_MSG } from "@/lib/learner-gates";

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
  // Delete enrollments first (Enrollment.revisionId is ON DELETE RESTRICT), then
  // every project this user created (cascades revisions), then the user.
  await db.enrollment.deleteMany({ where: { userId } });
  await db.project.deleteMany({ where: { createdById: userId } });
  await db.user.deleteMany({ where: { id: userId } });
});

// Build an isolated published board + an Enrollment parked at `stage`.
let seq = 0;
async function enrollmentAt(stage: Stage): Promise<string> {
  seq += 1;
  const project = await db.project.create({
    data: { slug: `adv-${seq}-${Date.now()}`, name: "Adv", createdById: userId },
  });
  const rev = await db.revision.create({
    data: { projectId: project.id, label: "v1" },
  });
  await db.project.update({
    where: { id: project.id },
    data: { publishedRevisionId: rev.id },
  });
  await db.enrollment.create({
    data: { userId, projectId: project.id, revisionId: rev.id, currentStage: stage },
  });
  return project.id;
}

async function enrollmentRow(projectId: string) {
  return db.enrollment.findUniqueOrThrow({
    where: { userId_projectId: { userId, projectId } },
  });
}

async function addQuizPass(projectId: string, stage: Stage) {
  const e = await enrollmentRow(projectId);
  await db.quizPass.create({
    data: { enrollmentId: e.id, stage, score: 5, total: 5 },
  });
}

describe("advanceEnrollment", () => {
  test("blocked when the current stage's quiz isn't passed", async () => {
    const projectId = await enrollmentAt("REQUIREMENTS");
    const r = await advanceEnrollment({ projectId });
    expect(r.ok).toBe(false);
    expect((r as { reasons: string[] }).reasons).toEqual([QUIZ_NOT_PASSED_MSG]);
  });

  test("blocked at SCHEMATIC without a proof artifact (quiz passed)", async () => {
    const projectId = await enrollmentAt("SCHEMATIC");
    await addQuizPass(projectId, "SCHEMATIC");
    const r = await advanceEnrollment({ projectId });
    expect(r.ok).toBe(false);
    expect((r as { reasons: string[] }).reasons.some((x) => /schematic/i.test(x))).toBe(true);
  });

  test("advances REQUIREMENTS → BOM_SOURCING on the quiz alone (no proof artifact)", async () => {
    const projectId = await enrollmentAt("REQUIREMENTS");
    await addQuizPass(projectId, "REQUIREMENTS");
    const r = await advanceEnrollment({ projectId });
    expect(r).toEqual({ ok: true, toStage: "BOM_SOURCING" });
    expect((await enrollmentRow(projectId)).currentStage).toBe("BOM_SOURCING");
  });

  test("advancing into REVISION marks the enrollment COMPLETED", async () => {
    const projectId = await enrollmentAt("BRINGUP");
    await addQuizPass(projectId, "BRINGUP"); // BRINGUP is quiz-only (no proof)
    const r = await advanceEnrollment({ projectId });
    expect(r).toEqual({ ok: true, toStage: "REVISION" });
    const row = await enrollmentRow(projectId);
    expect(row.currentStage).toBe("REVISION");
    expect(row.status).toBe("COMPLETED");
    expect(row.completedAt).not.toBeNull();
  });

  test("refuses to advance past the terminal stage", async () => {
    const projectId = await enrollmentAt("REVISION");
    await expect(advanceEnrollment({ projectId })).rejects.toThrow(/final stage/i);
  });
});

describe("submitEnrollmentProof", () => {
  test("creates the stage's proof artifact (LINK) on the enrollment", async () => {
    const projectId = await enrollmentAt("SCHEMATIC");
    const res = await submitEnrollmentProof({
      projectId,
      stage: "SCHEMATIC",
      linkUrl: "https://example.com/my-schematic.pdf",
    });
    expect(res.ok).toBe(true);
    const e = await enrollmentRow(projectId);
    const arts = await db.artifact.findMany({ where: { enrollmentId: e.id } });
    expect(arts).toHaveLength(1);
    expect(arts[0]!.subkind).toBe("ERC_REPORT");
    expect(arts[0]!.kind).toBe("LINK");
  });

  test("is idempotent — a second submit does not duplicate the proof", async () => {
    const projectId = await enrollmentAt("SCHEMATIC");
    await submitEnrollmentProof({ projectId, stage: "SCHEMATIC", linkUrl: "https://example.com/a" });
    await submitEnrollmentProof({ projectId, stage: "SCHEMATIC", linkUrl: "https://example.com/b" });
    const e = await enrollmentRow(projectId);
    const count = await db.artifact.count({ where: { enrollmentId: e.id, subkind: "ERC_REPORT" } });
    expect(count).toBe(1);
  });

  test("proof + quiz together unblock advanceEnrollment at SCHEMATIC", async () => {
    const projectId = await enrollmentAt("SCHEMATIC");
    await submitEnrollmentProof({ projectId, stage: "SCHEMATIC", linkUrl: "https://example.com/s" });
    await addQuizPass(projectId, "SCHEMATIC");
    const r = await advanceEnrollment({ projectId });
    expect(r).toEqual({ ok: true, toStage: "LAYOUT" });
  });
});

// Guard tests for the upload presign (the R2 round-trip itself is verified
// manually with R2 on, like the author uploads suite). These reject BEFORE any
// R2 call, so they run in CI without R2.
describe("createEnrollmentProofUploadUrl guards", () => {
  test("refuses a stage that takes no proof artifact", async () => {
    const projectId = await enrollmentAt("ORDERING");
    await expect(
      createEnrollmentProofUploadUrl({
        projectId,
        stage: "ORDERING",
        filename: "x.pdf",
        mime: "application/pdf",
        sizeBytes: 100,
      }),
    ).rejects.toThrow(/does not take a proof/i);
  });

  test("refuses when the caller has no enrollment on the board", async () => {
    const orphan = await db.project.create({
      data: { slug: `proof-orphan-${Date.now()}`, name: "Orphan", createdById: userId },
    });
    await expect(
      createEnrollmentProofUploadUrl({
        projectId: orphan.id,
        stage: "SCHEMATIC",
        filename: "x.pdf",
        mime: "application/pdf",
        sizeBytes: 100,
      }),
    ).rejects.toThrow();
  });
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

// Access-tier guard (Task A4): PREMIUM boards require an Entitlement before the
// learner may enroll; the free-preview first card does NOT grant enrollment.
// FREE/PUBLIC boards enroll without one. Each fixture is its own published
// board so they never collide.
describe("enroll access-tier guard", () => {
  async function publishedTierProject(
    accessTier: "PUBLIC" | "FREE" | "PREMIUM",
  ): Promise<string> {
    seq += 1;
    const project = await db.project.create({
      data: {
        slug: `tier-${accessTier.toLowerCase()}-${seq}-${Date.now()}`,
        name: `Tier ${accessTier}`,
        createdById: userId,
        accessTier,
      },
    });
    const rev = await db.revision.create({
      data: { projectId: project.id, label: "v1" },
    });
    await db.project.update({
      where: { id: project.id },
      data: { publishedRevisionId: rev.id },
    });
    return project.id;
  }

  test("rejects enrolling in a PREMIUM board with no entitlement", async () => {
    const projectId = await publishedTierProject("PREMIUM");
    await expect(enroll({ projectId })).rejects.toThrow(/premium/i);
    const count = await db.enrollment.count({ where: { userId, projectId } });
    expect(count).toBe(0);
  });

  test("enrolls in a PREMIUM board when a GRANT entitlement exists", async () => {
    const projectId = await publishedTierProject("PREMIUM");
    await db.entitlement.create({
      data: { userId, projectId, source: "GRANT" },
    });
    const result = await enroll({ projectId });
    expect(result.status).toBe("IN_PROGRESS");
    const count = await db.enrollment.count({ where: { userId, projectId } });
    expect(count).toBe(1);
  });

  test("enrolls in a FREE board without an entitlement", async () => {
    const projectId = await publishedTierProject("FREE");
    const result = await enroll({ projectId });
    expect(result.status).toBe("IN_PROGRESS");
  });

  test("enrolls in a PUBLIC board without an entitlement", async () => {
    const projectId = await publishedTierProject("PUBLIC");
    const result = await enroll({ projectId });
    expect(result.status).toBe("IN_PROGRESS");
  });
});
