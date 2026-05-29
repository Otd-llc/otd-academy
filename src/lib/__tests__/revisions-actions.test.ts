// Tests for revision server actions (Task 5.1).
//
// Exercises the real Neon DB; mocks `next/cache` (no Next render context in
// Vitest) and `@/auth` so the action's `requireUser()` returns the seeded
// `seed@example.com` user.
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockAuth = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({
  auth: () => mockAuth(),
}));

import { db } from "@/lib/db";
import { createRevision } from "@/lib/actions/revisions";

const SEED_EMAIL = "seed@example.com";
const SEED_PROJECT_SLUG = "esp32-sensor-breakout";

const createdRevisionIds: string[] = [];

beforeAll(() => {
  mockAuth.mockImplementation(async () => ({
    user: { email: SEED_EMAIL },
  }));
});

afterAll(async () => {
  if (createdRevisionIds.length > 0) {
    // BomLines, Artifacts, StageTransitions cascade off Revision per schema.
    await db.revision.deleteMany({
      where: { id: { in: createdRevisionIds } },
    });
  }
});

describe("createRevision", () => {
  test("plain create — no copy-forward: INIT row + REQUIREMENTS, 0 BOM, 0 artifacts", async () => {
    const project = await db.project.findUniqueOrThrow({
      where: { slug: SEED_PROJECT_SLUG },
    });

    const label = `t5.1-plain-${Date.now()}`;
    const rev = await createRevision({
      projectId: project.id,
      label,
    });
    createdRevisionIds.push(rev.id);

    expect(rev.label).toBe(label);
    expect(rev.currentStage).toBe("REQUIREMENTS");
    expect(rev.frozenAt).toBeNull();
    expect(rev.bomFrozenAt).toBeNull();

    const transitions = await db.stageTransition.findMany({
      where: { revisionId: rev.id },
    });
    expect(transitions).toHaveLength(1);
    const [init] = transitions;
    expect(init?.direction).toBe("INIT");
    expect(init?.fromStage).toBeNull();
    expect(init?.toStage).toBe("REQUIREMENTS");
    const snap = init?.gateSnapshot as { v: number; kind: string; ts: string };
    expect(snap.v).toBe(1);
    expect(snap.kind).toBe("init");
    expect(typeof snap.ts).toBe("string");

    const bomLines = await db.bomLine.count({ where: { revisionId: rev.id } });
    expect(bomLines).toBe(0);

    const artifacts = await db.artifact.count({
      where: { revisionId: rev.id },
    });
    expect(artifacts).toBe(0);

    const seedUser = await db.user.findUniqueOrThrow({
      where: { email: SEED_EMAIL },
    });
    expect(init?.transitionedBy).toBe(seedUser.id);
  });

  test("copy-forward from seed v1: BOM cloned, build-scoped artifacts NOT copied, INIT written", async () => {
    const project = await db.project.findUniqueOrThrow({
      where: { slug: SEED_PROJECT_SLUG },
    });
    const sourceRev = await db.revision.findFirstOrThrow({
      where: {
        projectId: project.id,
        label: { equals: "v1", mode: "insensitive" },
      },
    });

    const sourceBomCount = await db.bomLine.count({
      where: { revisionId: sourceRev.id },
    });
    const sourceRevScopedArtifacts = await db.artifact.findMany({
      where: { revisionId: sourceRev.id, buildId: null },
    });
    const sourceBuildScopedArtifacts = await db.artifact.count({
      where: { revisionId: null, build: { revisionId: sourceRev.id } },
    });

    // The seed produces 3 BOM lines and zero rev-scoped artifacts
    // (all 4 seeded artifacts are build-scoped). Guard the test against
    // future seed changes:
    expect(sourceBomCount).toBeGreaterThan(0);

    const label = `t5.1-copy-${Date.now()}`;
    const rev = await createRevision({
      projectId: project.id,
      label,
      copyForwardFromRevisionId: sourceRev.id,
    });
    createdRevisionIds.push(rev.id);

    expect(rev.currentStage).toBe("REQUIREMENTS");

    const newBomLines = await db.bomLine.findMany({
      where: { revisionId: rev.id },
    });
    expect(newBomLines).toHaveLength(sourceBomCount);

    // BomLine partIds should match the source set (BOM cloned, not regenerated).
    const sourcePartIds = (
      await db.bomLine.findMany({
        where: { revisionId: sourceRev.id },
        select: { partId: true },
      })
    )
      .map((r) => r.partId)
      .sort();
    const newPartIds = newBomLines.map((r) => r.partId).sort();
    expect(newPartIds).toEqual(sourcePartIds);

    // Build-scoped artifacts MUST NOT have been copied. The new rev has no
    // builds at all (per design §5.3 — builds are never copied forward), so
    // any artifact with this revisionId would already be revision-scoped.
    const newBuildCount = await db.build.count({
      where: { revisionId: rev.id },
    });
    expect(newBuildCount).toBe(0);

    // Confirm rev-scoped artifacts cloned 1:1.
    const newRevArtifacts = await db.artifact.findMany({
      where: { revisionId: rev.id, buildId: null },
    });
    expect(newRevArtifacts).toHaveLength(sourceRevScopedArtifacts.length);

    // Sanity: the source had build-scoped artifacts that we should NOT see
    // attached to the new rev under any path.
    expect(sourceBuildScopedArtifacts).toBeGreaterThan(0);
    const strayBuildScopedOnNewRev = await db.artifact.count({
      where: { build: { revisionId: rev.id } },
    });
    expect(strayBuildScopedOnNewRev).toBe(0);

    const transitions = await db.stageTransition.findMany({
      where: { revisionId: rev.id },
    });
    expect(transitions).toHaveLength(1);
    expect(transitions[0]?.direction).toBe("INIT");
  });

  test("copy-forward preserves artifact subkind on cloned rows", async () => {
    // To exercise this end-to-end we need at least one rev-scoped artifact
    // on the source. Create a throwaway rev, attach a rev-scoped artifact
    // with a non-GENERIC subkind, then copy-forward.
    const project = await db.project.findUniqueOrThrow({
      where: { slug: SEED_PROJECT_SLUG },
    });
    const seedUser = await db.user.findUniqueOrThrow({
      where: { email: SEED_EMAIL },
    });

    const sourceLabel = `t5.1-subkind-src-${Date.now()}`;
    const source = await createRevision({
      projectId: project.id,
      label: sourceLabel,
    });
    createdRevisionIds.push(source.id);

    await db.artifact.create({
      data: {
        revisionId: source.id,
        stage: "REQUIREMENTS",
        kind: "NOTE",
        subkind: "REQUIREMENTS_DOC",
        title: "Subkind preservation test",
        noteBody: "body",
        createdBy: seedUser.id,
      },
    });

    const destLabel = `t5.1-subkind-dst-${Date.now()}`;
    const dest = await createRevision({
      projectId: project.id,
      label: destLabel,
      copyForwardFromRevisionId: source.id,
    });
    createdRevisionIds.push(dest.id);

    const cloned = await db.artifact.findMany({
      where: { revisionId: dest.id },
    });
    expect(cloned).toHaveLength(1);
    expect(cloned[0]?.subkind).toBe("REQUIREMENTS_DOC");
    expect(cloned[0]?.kind).toBe("NOTE");
    expect(cloned[0]?.title).toBe("Subkind preservation test");
  });
});
