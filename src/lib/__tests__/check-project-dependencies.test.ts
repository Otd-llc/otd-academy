// Tests for `checkProjectDependencies` (Task 12.5 / proposal §3.1).
//
// One-hop dependency gate. Given a project and its current stage, walk the
// direct outbound edges where the gate would be active
// (`currentStage >= dependentStageGated`) and verify each dependency's
// most-recent revision is at or beyond `dependsOnStageRequired`. Returns
// merged `reasons[]` on failure.
//
// All four cases seed projects + edges + revisions inline against the live
// Neon DB, run the helper inside a `db.$transaction`, assert the result,
// then clean up.
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { db } from "@/lib/db";
import { checkProjectDependencies } from "@/lib/check-project-dependencies";

const SEED_EMAIL = "seed@example.com";
const TEST_SLUG_PREFIX = "cpd-";

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

describe("checkProjectDependencies", () => {
  test("no edges → ok", async () => {
    const user = await getSeedUser();
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const p = await db.project.create({
      data: {
        slug: `${TEST_SLUG_PREFIX}no-edges-${stamp}`,
        name: "no edges",
        createdById: user.id,
      },
    });
    createdProjectIds.push(p.id);

    const result = await db.$transaction(async (tx) =>
      checkProjectDependencies(tx, p.id, "REQUIREMENTS"),
    );
    expect(result).toEqual({ ok: true });
  });

  test("dependency at required stage → ok", async () => {
    const user = await getSeedUser();
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const a = await db.project.create({
      data: {
        slug: `${TEST_SLUG_PREFIX}ok-a-${stamp}`,
        name: "A",
        createdById: user.id,
      },
    });
    createdProjectIds.push(a.id);
    const b = await db.project.create({
      data: {
        slug: `${TEST_SLUG_PREFIX}ok-b-${stamp}`,
        name: "B",
        createdById: user.id,
      },
    });
    createdProjectIds.push(b.id);

    // B's most-recent revision sits at BRINGUP — meets `dependsOnStageRequired`.
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
        dependentStageGated: "REQUIREMENTS",
        dependsOnStageRequired: "BRINGUP",
        createdById: user.id,
      },
    });
    createdEdgeIds.push(edge.id);

    const result = await db.$transaction(async (tx) =>
      checkProjectDependencies(tx, a.id, "REQUIREMENTS"),
    );
    expect(result).toEqual({ ok: true });
  });

  test("dependency below required stage → reasons[]", async () => {
    const user = await getSeedUser();
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const a = await db.project.create({
      data: {
        slug: `${TEST_SLUG_PREFIX}fail-a-${stamp}`,
        name: "A",
        createdById: user.id,
      },
    });
    createdProjectIds.push(a.id);
    const bSlug = `${TEST_SLUG_PREFIX}fail-b-${stamp}`;
    const b = await db.project.create({
      data: {
        slug: bSlug,
        name: "B",
        createdById: user.id,
      },
    });
    createdProjectIds.push(b.id);

    // B's most-recent revision only at SCHEMATIC — below the required BRINGUP.
    const bRev = await db.revision.create({
      data: {
        projectId: b.id,
        label: "v1",
        currentStage: "SCHEMATIC",
      },
    });
    createdRevisionIds.push(bRev.id);

    const edge = await db.projectDependency.create({
      data: {
        dependentProjectId: a.id,
        dependsOnProjectId: b.id,
        kind: "DE_RISK",
        dependentStageGated: "REQUIREMENTS",
        dependsOnStageRequired: "BRINGUP",
        createdById: user.id,
      },
    });
    createdEdgeIds.push(edge.id);

    const result = await db.$transaction(async (tx) =>
      checkProjectDependencies(tx, a.id, "REQUIREMENTS"),
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toContain(bSlug);
    expect(result.reasons[0]).toContain("BRINGUP");
    expect(result.reasons[0]).toContain("SCHEMATIC");
  });

  test("fires only when currentStage >= dependentStageGated", async () => {
    const user = await getSeedUser();
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const a = await db.project.create({
      data: {
        slug: `${TEST_SLUG_PREFIX}nogate-a-${stamp}`,
        name: "A",
        createdById: user.id,
      },
    });
    createdProjectIds.push(a.id);
    const b = await db.project.create({
      data: {
        slug: `${TEST_SLUG_PREFIX}nogate-b-${stamp}`,
        name: "B",
        createdById: user.id,
      },
    });
    createdProjectIds.push(b.id);

    // B is unsatisfied (at SCHEMATIC, requires BRINGUP) but A hasn't reached
    // the gate-active stage yet (REQUIREMENTS < LAYOUT), so the check passes.
    const bRev = await db.revision.create({
      data: {
        projectId: b.id,
        label: "v1",
        currentStage: "SCHEMATIC",
      },
    });
    createdRevisionIds.push(bRev.id);

    const edge = await db.projectDependency.create({
      data: {
        dependentProjectId: a.id,
        dependsOnProjectId: b.id,
        kind: "DE_RISK",
        dependentStageGated: "LAYOUT",
        dependsOnStageRequired: "BRINGUP",
        createdById: user.id,
      },
    });
    createdEdgeIds.push(edge.id);

    const result = await db.$transaction(async (tx) =>
      checkProjectDependencies(tx, a.id, "REQUIREMENTS"),
    );
    expect(result).toEqual({ ok: true });
  });
});
