// Tests for ProjectDependency server actions. Exercises real Neon DB; the
// seeded user `seed@example.com` is the authenticated principal via a mocked
// `auth()`. `next/cache` is no-op'd because there's no Next.js render context
// in a Vitest run.
//
// Task 12.3 covers `createProjectDependency`:
//   1) simple A→B succeeds and persists a row.
//   2) cycle detection rejects (A→B already exists, then B→A is attempted).
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

// Mock next/cache before importing the action (action layer may use it).
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock @/auth — control the session per-test by mutating the mock.
const mockAuth = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({
  auth: () => mockAuth(),
}));

import { db } from "@/lib/db";
import {
  createProjectDependency,
  deleteProjectDependency,
  editProjectDependency,
} from "@/lib/actions/project-dependencies";

const SEED_EMAIL = "seed@example.com";
const TEST_SLUG_PREFIX = "pd-actions-";

const createdProjectIds: string[] = [];
const createdEdgeIds: string[] = [];

async function getSeedUser() {
  return db.user.findUniqueOrThrow({ where: { email: SEED_EMAIL } });
}

beforeAll(() => {
  mockAuth.mockImplementation(async () => ({
    user: { email: SEED_EMAIL },
  }));
});

afterAll(async () => {
  if (createdEdgeIds.length > 0) {
    await db.projectDependency.deleteMany({
      where: { id: { in: createdEdgeIds } },
    });
  }
  if (createdProjectIds.length > 0) {
    await db.projectDependency.deleteMany({
      where: {
        OR: [
          { dependentProjectId: { in: createdProjectIds } },
          { dependsOnProjectId: { in: createdProjectIds } },
        ],
      },
    });
    await db.project.deleteMany({
      where: { id: { in: createdProjectIds } },
    });
  }
  // Sweep any stray rows whose slug matches the test prefix.
  await db.project.deleteMany({
    where: { slug: { startsWith: TEST_SLUG_PREFIX } },
  });
});

describe("createProjectDependency", () => {
  test("simple A→B succeeds", async () => {
    const user = await getSeedUser();
    const a = await db.project.create({
      data: {
        slug: `${TEST_SLUG_PREFIX}a-${Date.now()}`,
        name: "A",
        createdById: user.id,
      },
    });
    createdProjectIds.push(a.id);
    const b = await db.project.create({
      data: {
        slug: `${TEST_SLUG_PREFIX}b-${Date.now()}`,
        name: "B",
        createdById: user.id,
      },
    });
    createdProjectIds.push(b.id);

    const edge = await createProjectDependency({
      dependentProjectId: a.id,
      dependsOnProjectId: b.id,
      kind: "DE_RISK",
      dependentStageGated: "REQUIREMENTS",
      dependsOnStageRequired: "BRINGUP",
    });
    createdEdgeIds.push(edge.id);

    expect(edge.dependentProjectId).toBe(a.id);
    expect(edge.dependsOnProjectId).toBe(b.id);
    expect(edge.kind).toBe("DE_RISK");
    expect(edge.dependentStageGated).toBe("REQUIREMENTS");
    expect(edge.dependsOnStageRequired).toBe("BRINGUP");
    expect(edge.createdById).toBe(user.id);
  });

  test("editProjectDependency: updates notes", async () => {
    const user = await getSeedUser();
    const a = await db.project.create({
      data: {
        slug: `${TEST_SLUG_PREFIX}edit-a-${Date.now()}`,
        name: "A",
        createdById: user.id,
      },
    });
    createdProjectIds.push(a.id);
    const b = await db.project.create({
      data: {
        slug: `${TEST_SLUG_PREFIX}edit-b-${Date.now()}`,
        name: "B",
        createdById: user.id,
      },
    });
    createdProjectIds.push(b.id);

    const edge = await createProjectDependency({
      dependentProjectId: a.id,
      dependsOnProjectId: b.id,
      kind: "DE_RISK",
      dependentStageGated: "REQUIREMENTS",
      dependsOnStageRequired: "BRINGUP",
      notes: "initial note",
    });
    createdEdgeIds.push(edge.id);

    const updated = await editProjectDependency({
      id: edge.id,
      notes: "updated note",
    });
    expect(updated.notes).toBe("updated note");

    const refetched = await db.projectDependency.findUnique({
      where: { id: edge.id },
    });
    expect(refetched?.notes).toBe("updated note");
  });

  test("deleteProjectDependency: removes row", async () => {
    const user = await getSeedUser();
    const a = await db.project.create({
      data: {
        slug: `${TEST_SLUG_PREFIX}del-a-${Date.now()}`,
        name: "A",
        createdById: user.id,
      },
    });
    createdProjectIds.push(a.id);
    const b = await db.project.create({
      data: {
        slug: `${TEST_SLUG_PREFIX}del-b-${Date.now()}`,
        name: "B",
        createdById: user.id,
      },
    });
    createdProjectIds.push(b.id);

    const edge = await createProjectDependency({
      dependentProjectId: a.id,
      dependsOnProjectId: b.id,
      kind: "DE_RISK",
      dependentStageGated: "REQUIREMENTS",
      dependsOnStageRequired: "BRINGUP",
    });
    // Intentionally do NOT push to createdEdgeIds — we're deleting it here.

    await deleteProjectDependency(edge.id);

    const refetched = await db.projectDependency.findUnique({
      where: { id: edge.id },
    });
    expect(refetched).toBeNull();
  });

  test("concurrent createProjectDependency: only one survives", async () => {
    const user = await getSeedUser();
    const a = await db.project.create({
      data: {
        slug: `${TEST_SLUG_PREFIX}conc-a-${Date.now()}`,
        name: "A",
        createdById: user.id,
      },
    });
    createdProjectIds.push(a.id);
    const b = await db.project.create({
      data: {
        slug: `${TEST_SLUG_PREFIX}conc-b-${Date.now()}`,
        name: "B",
        createdById: user.id,
      },
    });
    createdProjectIds.push(b.id);

    const results = await Promise.allSettled([
      createProjectDependency({
        dependentProjectId: a.id,
        dependsOnProjectId: b.id,
        kind: "DE_RISK",
        dependentStageGated: "REQUIREMENTS",
        dependsOnStageRequired: "BRINGUP",
      }),
      createProjectDependency({
        dependentProjectId: b.id,
        dependsOnProjectId: a.id,
        kind: "DE_RISK",
        dependentStageGated: "REQUIREMENTS",
        dependsOnStageRequired: "BRINGUP",
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter(
      (r) => r.status === "rejected",
    ) as PromiseRejectedResult[];

    // Exactly one transaction must commit; the other must fail.
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    // The advisory lock keyed on the sorted endpoint pair serializes the two
    // inserts. The loser runs the cycle CTE after the winner committed and
    // detects the cycle. SSI serialization_failure or a unique-constraint
    // violation are also acceptable outcomes under contention.
    const errMsg = String(
      rejected[0].reason?.message ?? rejected[0].reason,
    );
    expect(errMsg).toMatch(/cycle|serialization_failure|40001|unique/i);

    // Steady-state invariant: exactly one edge exists between A and B.
    const edges = await db.projectDependency.findMany({
      where: {
        OR: [
          { dependentProjectId: a.id, dependsOnProjectId: b.id },
          { dependentProjectId: b.id, dependsOnProjectId: a.id },
        ],
      },
    });
    expect(edges).toHaveLength(1);
    createdEdgeIds.push(...edges.map((e) => e.id));
  });

  test("rejects cycle (A→B then B→A)", async () => {
    const user = await getSeedUser();
    const a = await db.project.create({
      data: {
        slug: `${TEST_SLUG_PREFIX}cyc-a-${Date.now()}`,
        name: "A",
        createdById: user.id,
      },
    });
    createdProjectIds.push(a.id);
    const b = await db.project.create({
      data: {
        slug: `${TEST_SLUG_PREFIX}cyc-b-${Date.now()}`,
        name: "B",
        createdById: user.id,
      },
    });
    createdProjectIds.push(b.id);

    const e1 = await createProjectDependency({
      dependentProjectId: a.id,
      dependsOnProjectId: b.id,
      kind: "DE_RISK",
      dependentStageGated: "REQUIREMENTS",
      dependsOnStageRequired: "BRINGUP",
    });
    createdEdgeIds.push(e1.id);

    await expect(
      createProjectDependency({
        dependentProjectId: b.id,
        dependsOnProjectId: a.id,
        kind: "DE_RISK",
        dependentStageGated: "REQUIREMENTS",
        dependsOnStageRequired: "BRINGUP",
      }),
    ).rejects.toThrow(/cycle/i);
  });
});
