// Tests for `dependentsAtRisk` (Task 12.7 / proposal §3.1).
//
// Inverse-direction advisory to the one-hop gate in Task 12.5.
// Given a project whose latest revision is being regressed
// `fromStage → toStage`, return inbound dependency edges
// (this project is the `dependsOnProject`) where the regress would
// cross below `dependsOnStageRequired` — i.e. the dependent project's
// gate was being satisfied before the regress, and won't be after.
//
// Live-DB cases follow the Task 12.5 sibling: prefixed slugs,
// inline seed inside each test, cleanup arrays in `afterAll`.
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { db } from "@/lib/db";
import { dependentsAtRisk } from "@/lib/dependents-at-risk";

const SEED_EMAIL = "seed@example.com";
const TEST_SLUG_PREFIX = "dar-";

const createdProjectIds: string[] = [];
const createdRevisionIds: string[] = [];
const createdEdgeIds: string[] = [];

async function getSeedUser() {
  return db.user.findUniqueOrThrow({ where: { email: SEED_EMAIL } });
}

beforeAll(async () => {
  // Sweep stray rows from prior failed runs.
  await db.projectDependency.deleteMany({
    where: {
      OR: [
        { dependentProject: { slug: { startsWith: TEST_SLUG_PREFIX } } },
        { dependsOnProject: { slug: { startsWith: TEST_SLUG_PREFIX } } },
      ],
    },
  });
  await db.revision.deleteMany({
    where: { project: { slug: { startsWith: TEST_SLUG_PREFIX } } },
  });
  await db.project.deleteMany({
    where: { slug: { startsWith: TEST_SLUG_PREFIX } },
  });
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
  }
  if (createdRevisionIds.length > 0) {
    await db.revision.deleteMany({
      where: { id: { in: createdRevisionIds } },
    });
  }
  if (createdProjectIds.length > 0) {
    await db.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  }
  await db.project.deleteMany({
    where: { slug: { startsWith: TEST_SLUG_PREFIX } },
  });
});

describe("dependentsAtRisk", () => {
  test("returns rows that would be invalidated by regress", async () => {
    const user = await getSeedUser();
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // A depends on B; A's gate fires from BRINGUP, requires B at BRINGUP.
    const aSlug = `${TEST_SLUG_PREFIX}risk-a-${stamp}`;
    const a = await db.project.create({
      data: {
        slug: aSlug,
        name: "A",
        createdById: user.id,
      },
    });
    createdProjectIds.push(a.id);
    const b = await db.project.create({
      data: {
        slug: `${TEST_SLUG_PREFIX}risk-b-${stamp}`,
        name: "B",
        createdById: user.id,
      },
    });
    createdProjectIds.push(b.id);

    // A has a REQUIREMENTS revision (just needs to exist as a dependent).
    const aRev = await db.revision.create({
      data: {
        projectId: a.id,
        label: "v1",
        currentStage: "REQUIREMENTS",
      },
    });
    createdRevisionIds.push(aRev.id);

    // B at BRINGUP — currently satisfies the edge.
    const bRev = await db.revision.create({
      data: {
        projectId: b.id,
        label: "v1",
        currentStage: "BRINGUP",
      },
    });
    createdRevisionIds.push(bRev.id);

    const edge = await db.projectDependency.create({
      data: {
        dependentProjectId: a.id,
        dependsOnProjectId: b.id,
        kind: "DE_RISK",
        dependentStageGated: "BRINGUP",
        dependsOnStageRequired: "BRINGUP",
        createdById: user.id,
      },
    });
    createdEdgeIds.push(edge.id);

    // Regress B from BRINGUP → ASSEMBLY: crosses below the BRINGUP threshold.
    const rows = await db.$transaction(async (tx) =>
      dependentsAtRisk(tx, b.id, "BRINGUP", "ASSEMBLY"),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].dependentProject.slug).toBe(aSlug);
  });

  test("forward stage move → returns []", async () => {
    const user = await getSeedUser();
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const a = await db.project.create({
      data: {
        slug: `${TEST_SLUG_PREFIX}fwd-a-${stamp}`,
        name: "A",
        createdById: user.id,
      },
    });
    createdProjectIds.push(a.id);
    const b = await db.project.create({
      data: {
        slug: `${TEST_SLUG_PREFIX}fwd-b-${stamp}`,
        name: "B",
        createdById: user.id,
      },
    });
    createdProjectIds.push(b.id);

    const aRev = await db.revision.create({
      data: {
        projectId: a.id,
        label: "v1",
        currentStage: "REQUIREMENTS",
      },
    });
    createdRevisionIds.push(aRev.id);
    const bRev = await db.revision.create({
      data: {
        projectId: b.id,
        label: "v1",
        currentStage: "ASSEMBLY",
      },
    });
    createdRevisionIds.push(bRev.id);

    const edge = await db.projectDependency.create({
      data: {
        dependentProjectId: a.id,
        dependsOnProjectId: b.id,
        kind: "DE_RISK",
        dependentStageGated: "BRINGUP",
        dependsOnStageRequired: "BRINGUP",
        createdById: user.id,
      },
    });
    createdEdgeIds.push(edge.id);

    // ASSEMBLY → BRINGUP is forward (toIdx > fromIdx) — short-circuit to [].
    const rows = await db.$transaction(async (tx) =>
      dependentsAtRisk(tx, b.id, "ASSEMBLY", "BRINGUP"),
    );
    expect(rows).toEqual([]);
  });

  test("regress that doesn't cross the threshold → returns []", async () => {
    const user = await getSeedUser();
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const a = await db.project.create({
      data: {
        slug: `${TEST_SLUG_PREFIX}safe-a-${stamp}`,
        name: "A",
        createdById: user.id,
      },
    });
    createdProjectIds.push(a.id);
    const b = await db.project.create({
      data: {
        slug: `${TEST_SLUG_PREFIX}safe-b-${stamp}`,
        name: "B",
        createdById: user.id,
      },
    });
    createdProjectIds.push(b.id);

    const aRev = await db.revision.create({
      data: {
        projectId: a.id,
        label: "v1",
        currentStage: "REQUIREMENTS",
      },
    });
    createdRevisionIds.push(aRev.id);
    const bRev = await db.revision.create({
      data: {
        projectId: b.id,
        label: "v1",
        currentStage: "BRINGUP",
      },
    });
    createdRevisionIds.push(bRev.id);

    // Edge only requires ASSEMBLY. Regress BRINGUP → ASSEMBLY stays at the
    // threshold (toIdx === requiredIdx), so the dependent is still satisfied.
    const edge = await db.projectDependency.create({
      data: {
        dependentProjectId: a.id,
        dependsOnProjectId: b.id,
        kind: "DE_RISK",
        dependentStageGated: "BRINGUP",
        dependsOnStageRequired: "ASSEMBLY",
        createdById: user.id,
      },
    });
    createdEdgeIds.push(edge.id);

    const rows = await db.$transaction(async (tx) =>
      dependentsAtRisk(tx, b.id, "BRINGUP", "ASSEMBLY"),
    );
    expect(rows).toEqual([]);
  });
});
