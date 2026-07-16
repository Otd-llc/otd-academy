// Integration test for the `buildSkillTree` DB shell. Loads the whole
// non-archived Project table (so it coexists with the real 22 projects + the
// shared seed fixture) — therefore assertions are PER-SLUG ONLY: find each node
// by its unique (Date.now()-suffixed) slug; never assert global shape.
//
// Create-and-clean-up: every row created in beforeAll is deleted in afterAll, and
// nothing else is touched. (DATABASE_URL is the local dev DB since #306, and DB
// tests lease their own Neon branch — but the discipline stands regardless.)
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

// next/cache is stubbed wholesale, so it must carry every export this module graph
// touches. `buildSkillTree` calls cacheLife/cacheTag inside its `use cache` project
// -graph loader; under vitest the directive is an inert string (no Next compiler),
// so these are no-ops and the loader just runs uncached — which is what these tests
// want to exercise. Omit them and the import fails with "No X export is defined on
// the next/cache mock" rather than anything about caching.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));

const mockAuth = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({ auth: () => mockAuth() }));

import { db } from "@/lib/db";
import { buildSkillTree } from "@/lib/skill-tree";
import type { SkillTree } from "@/lib/skill-tree-core";

const EMAIL = "skilltree-builder@example.com";
let userId = "";

const ts = Date.now();
// PUBLIC published root (prereq), completed by the student.
const rootSlug = `st-root-${ts}`;
// FREE published dependent of the root.
const depSlug = `st-dep-${ts}`;
// PREMIUM published standalone (no prereqs).
const premiumSlug = `st-premium-${ts}`;
// Unpublished — must be coming-soon for everyone.
const unpubSlug = `st-unpub-${ts}`;

let rootId = "";
let depId = "";

async function publishedProject(
  slug: string,
  data: {
    accessTier?: "PUBLIC" | "FREE" | "PREMIUM";
    track?: "SENSE" | "ACT" | "POWER" | "COMMS";
    level?: "L1" | "L2" | "L3";
  } = {},
): Promise<{ id: string; revisionId: string }> {
  const project = await db.project.create({
    data: {
      slug,
      name: slug,
      createdById: userId,
      accessTier: data.accessTier ?? "FREE",
      track: data.track ?? null,
      level: data.level ?? null,
      criticalPath: true,
    },
  });
  const rev = await db.revision.create({
    data: { projectId: project.id, label: "v1" },
  });
  await db.project.update({
    where: { id: project.id },
    data: { publishedRevisionId: rev.id },
  });
  return { id: project.id, revisionId: rev.id };
}

beforeAll(async () => {
  await db.user.deleteMany({ where: { email: EMAIL } });
  const user = await db.user.create({
    data: { email: EMAIL, name: "SkillTree Builder", role: "LEARNER" },
  });
  userId = user.id;

  const root = await publishedProject(rootSlug, {
    accessTier: "PUBLIC",
    track: "COMMS",
    level: "L1",
  });
  rootId = root.id;
  const dep = await publishedProject(depSlug, {
    accessTier: "FREE",
    track: "COMMS",
    level: "L2",
  });
  depId = dep.id;
  await publishedProject(premiumSlug, {
    accessTier: "PREMIUM",
    track: "SENSE",
    level: "L2",
  });

  // Unpublished project (no publishedRevisionId).
  await db.project.create({
    data: {
      slug: unpubSlug,
      name: unpubSlug,
      createdById: userId,
      accessTier: "PUBLIC",
    },
  });

  // root -> dep dependency edge.
  await db.projectDependency.create({
    data: {
      dependentProjectId: depId,
      dependsOnProjectId: rootId,
      kind: "FOUNDATION",
      dependentStageGated: "REQUIREMENTS",
      dependsOnStageRequired: "REVISION",
      createdById: userId,
    },
  });

  // Student COMPLETED the root (prereq) so the dependent becomes available.
  await db.enrollment.create({
    data: {
      userId,
      projectId: rootId,
      revisionId: root.revisionId,
      status: "COMPLETED",
    },
  });
});

afterAll(async () => {
  await db.enrollment.deleteMany({ where: { userId } });
  await db.entitlement.deleteMany({ where: { userId } });
  await db.projectDependency.deleteMany({ where: { createdById: userId } });
  await db.project.deleteMany({ where: { createdById: userId } });
  await db.user.deleteMany({ where: { id: userId } });
});

const find = (tree: SkillTree, slug: string) =>
  tree.nodes.find((n) => n.slug === slug);

describe("buildSkillTree — anon (userId null)", () => {
  test("PUBLIC published root is preview (tier-only, no prereq logic)", async () => {
    const tree = await buildSkillTree(null);
    expect(find(tree, rootSlug)?.state).toBe("preview");
  });

  test("FREE node is locked-account regardless of prereqs", async () => {
    const tree = await buildSkillTree(null);
    expect(find(tree, depSlug)?.state).toBe("locked-account");
  });

  test("PREMIUM node is locked-paywall", async () => {
    const tree = await buildSkillTree(null);
    expect(find(tree, premiumSlug)?.state).toBe("locked-paywall");
  });

  test("unpublished project is coming-soon", async () => {
    const tree = await buildSkillTree(null);
    expect(find(tree, unpubSlug)?.state).toBe("coming-soon");
  });
});

describe("buildSkillTree — student with a completed prereq", () => {
  test("completed root is done", async () => {
    const tree = await buildSkillTree(userId);
    expect(find(tree, rootSlug)?.state).toBe("done");
  });

  test("dependent of the completed prereq is available", async () => {
    const tree = await buildSkillTree(userId);
    const dep = find(tree, depSlug);
    expect(dep?.state).toBe("available");
    expect(dep?.missingPrereqs).toHaveLength(0);
  });

  test("unpublished project is still coming-soon for the student", async () => {
    const tree = await buildSkillTree(userId);
    expect(find(tree, unpubSlug)?.state).toBe("coming-soon");
  });

  test("edges carry the root->dep dependency with from=prereq, to=dependent", async () => {
    const tree = await buildSkillTree(userId);
    const edge = tree.edges.find(
      (e) => e.fromSlug === rootSlug && e.toSlug === depSlug,
    );
    expect(edge).toBeDefined();
    expect(edge?.kind).toBe("FOUNDATION");
  });
});
