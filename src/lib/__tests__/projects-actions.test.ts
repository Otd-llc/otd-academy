// Tests for project server actions. These exercise the real Neon DB; the
// seeded user `seed@example.com` is the only User row and is used as the
// authenticated principal via a mocked `auth()`.
//
// `revalidatePath` is no-op'd because there's no Next.js render context in a
// Vitest run.
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

// Mock next/cache before importing the action (which imports it transitively).
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock @/auth — we control the session per-test by mutating the mock.
const mockAuth = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({
  auth: () => mockAuth(),
}));

import { db } from "@/lib/db";
import {
  archiveProject,
  createProject,
  editProject,
  unarchiveProject,
} from "@/lib/actions/projects";

const SEED_EMAIL = "seed@example.com";
const TEST_SLUG_PREFIX = "phase4-test-";

const createdProjectIds: string[] = [];

beforeAll(() => {
  mockAuth.mockImplementation(async () => ({
    user: { email: SEED_EMAIL },
  }));
});

afterAll(async () => {
  if (createdProjectIds.length > 0) {
    await db.project.deleteMany({
      where: { id: { in: createdProjectIds } },
    });
  }
  // Sweep any stray rows whose slug matches the test prefix in case a test
  // failed before recording the id.
  await db.project.deleteMany({
    where: { slug: { startsWith: TEST_SLUG_PREFIX } },
  });
});

describe("createProject", () => {
  test("rejects malformed slug (regex violation)", async () => {
    await expect(
      createProject({ slug: "Has Spaces", name: "x" }),
    ).rejects.toThrow();
  });

  test("rejects when no session", async () => {
    mockAuth.mockResolvedValueOnce(null);
    await expect(
      createProject({
        slug: `${TEST_SLUG_PREFIX}no-session-${Date.now()}`,
        name: "no session",
      }),
    ).rejects.toThrow(/unauthorized/i);
  });

  test("writes createdById to the seeded user", async () => {
    const seedUser = await db.user.findUniqueOrThrow({
      where: { email: SEED_EMAIL },
    });

    const slug = `${TEST_SLUG_PREFIX}createdby-${Date.now()}`;
    const project = await createProject({
      slug,
      name: "audit row check",
      description: "phase 4 test",
    });
    createdProjectIds.push(project.id);

    expect(project.createdById).toBe(seedUser.id);
    expect(project.slug).toBe(slug);
    expect(project.archivedAt).toBeNull();
  });
});

describe("editProject", () => {
  test("updates name and leaves slug intact when slug omitted", async () => {
    const slug = `${TEST_SLUG_PREFIX}edit-${Date.now()}`;
    const project = await createProject({ slug, name: "before" });
    createdProjectIds.push(project.id);

    const updated = await editProject({ id: project.id, name: "after" });
    expect(updated.name).toBe("after");
    expect(updated.slug).toBe(slug);
  });
});

describe("archiveProject / unarchiveProject", () => {
  test("archive sets archivedAt; unarchive clears it", async () => {
    const slug = `${TEST_SLUG_PREFIX}archive-${Date.now()}`;
    const project = await createProject({ slug, name: "archive test" });
    createdProjectIds.push(project.id);

    await archiveProject(project.id);
    const archived = await db.project.findUniqueOrThrow({
      where: { id: project.id },
    });
    expect(archived.archivedAt).not.toBeNull();

    await unarchiveProject(project.id);
    const unarchived = await db.project.findUniqueOrThrow({
      where: { id: project.id },
    });
    expect(unarchived.archivedAt).toBeNull();
  });
});

describe("createProject curriculum metadata", () => {
  test("accepts curriculum metadata fields", async () => {
    const slug = `${TEST_SLUG_PREFIX}curriculum-${Date.now()}`;
    const project = await createProject({
      slug,
      name: "Test curriculum",
      track: "SENSE",
      level: "L1",
      criticalPath: false,
      disciplineTaught: "precision SPI ADC layout",
      requiresStripboard: true,
    });
    createdProjectIds.push(project.id);

    expect(project.track).toBe("SENSE");
    expect(project.level).toBe("L1");
    expect(project.criticalPath).toBe(false);
    expect(project.disciplineTaught).toBe("precision SPI ADC layout");
    expect(project.requiresStripboard).toBe(true);
  });

  test("rejects invalid track value", async () => {
    await expect(
      createProject({
        slug: `${TEST_SLUG_PREFIX}bad-track-${Date.now()}`,
        name: "x",
        track: "NOTATRACK",
      } as unknown),
    ).rejects.toThrow();
  });

  // m18: hasMainsNet flag flows through the Zod schema and is persisted.
  // Drives the BOM_SOURCING certified-module gate branch (proposal §3 #5).
  test("createProject: accepts hasMainsNet", async () => {
    const slug = `${TEST_SLUG_PREFIX}mains-${Date.now()}`;
    const project = await createProject({
      slug,
      name: "mains-net project",
      hasMainsNet: true,
    });
    createdProjectIds.push(project.id);
    expect(project.hasMainsNet).toBe(true);
  });

  test("createProject: hasMainsNet defaults to false when omitted", async () => {
    const slug = `${TEST_SLUG_PREFIX}mains-default-${Date.now()}`;
    const project = await createProject({
      slug,
      name: "default mains-net",
    });
    createdProjectIds.push(project.id);
    expect(project.hasMainsNet).toBe(false);
  });
});
