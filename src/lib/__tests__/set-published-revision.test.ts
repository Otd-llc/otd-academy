// Tests for the admin setPublishedRevision action: admin-only; the revision must
// belong to the project AND have a Guide (learners follow that guide).
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockAuth = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({ auth: () => mockAuth() }));

import { db } from "@/lib/db";
import { setPublishedRevision } from "@/lib/actions/projects";

const SEED_EMAIL = "seed@example.com";
const LEARNER_EMAIL = "setpub-learner@example.com";

let seedUserId = "";
let projectId = "";
let revWithGuide = "";
let revNoGuide = "";
let otherProjectId = "";
let otherRevId = "";

beforeAll(async () => {
  const seed = await db.user.findUniqueOrThrow({ where: { email: SEED_EMAIL } });
  seedUserId = seed.id;
  await db.user.deleteMany({ where: { email: LEARNER_EMAIL } });
  await db.user.create({
    data: { email: LEARNER_EMAIL, name: "Learner", role: "LEARNER" },
  });

  const ts = Date.now();
  const project = await db.project.create({
    data: { slug: `setpub-${ts}`, name: "SetPub", createdById: seedUserId },
  });
  projectId = project.id;
  const rg = await db.revision.create({ data: { projectId: project.id, label: "v1" } });
  revWithGuide = rg.id;
  await db.guide.create({
    data: { revisionId: rg.id, title: "Guide v1", createdById: seedUserId },
  });
  const rn = await db.revision.create({ data: { projectId: project.id, label: "v2" } });
  revNoGuide = rn.id;

  const other = await db.project.create({
    data: { slug: `setpub-other-${ts}`, name: "Other", createdById: seedUserId },
  });
  otherProjectId = other.id;
  const ro = await db.revision.create({ data: { projectId: other.id, label: "v1" } });
  otherRevId = ro.id;

  mockAuth.mockResolvedValue({ user: { email: SEED_EMAIL } });
});

afterAll(async () => {
  await db.project.deleteMany({ where: { id: { in: [projectId, otherProjectId] } } });
  await db.user.deleteMany({ where: { email: LEARNER_EMAIL } });
});

describe("setPublishedRevision", () => {
  test("rejects a non-admin (learner)", async () => {
    mockAuth.mockResolvedValueOnce({ user: { email: LEARNER_EMAIL } });
    await expect(
      setPublishedRevision({ projectId, revisionId: revWithGuide }),
    ).rejects.toThrow(/Forbidden/);
  });

  test("refuses a revision with no guide", async () => {
    await expect(
      setPublishedRevision({ projectId, revisionId: revNoGuide }),
    ).rejects.toThrow(/guide/i);
  });

  test("refuses a revision that belongs to another project", async () => {
    await expect(
      setPublishedRevision({ projectId, revisionId: otherRevId }),
    ).rejects.toThrow(/belong/i);
  });

  test("publishes a revision that belongs to the project and has a guide", async () => {
    const res = await setPublishedRevision({ projectId, revisionId: revWithGuide });
    expect(res.publishedRevisionId).toBe(revWithGuide);
    const project = await db.project.findUniqueOrThrow({ where: { id: projectId } });
    expect(project.publishedRevisionId).toBe(revWithGuide);
  });
});
