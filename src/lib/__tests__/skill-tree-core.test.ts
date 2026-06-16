import { describe, expect, test } from "vitest";
import {
  computeSkillTree,
  type RawEdge,
  type RawProject,
  type SkillTree,
  type Viewer,
} from "@/lib/skill-tree-core";

// Terse fixture helper. Defaults to an unpublished FREE L1/SENSE non-critical-path node.
function mk(slug: string, overrides: Partial<RawProject> = {}): RawProject {
  return {
    slug,
    name: slug,
    publicTitle: null,
    tagline: null,
    track: "SENSE",
    level: "L1",
    accessTier: "FREE",
    criticalPath: false,
    priceCents: null,
    published: false,
    publishedLabel: null,
    ...overrides,
  };
}

function viewer(overrides: Partial<Viewer> = {}): Viewer {
  return {
    signedIn: false,
    isAdmin: false,
    completedSlugs: new Set<string>(),
    entitledSlugs: new Set<string>(),
    ...overrides,
  };
}

const node = (tree: SkillTree, slug: string) =>
  tree.nodes.find((n) => n.slug === slug)!;

describe("computeSkillTree — state precedence", () => {
  test("unpublished project is coming-soon even if PUBLIC", () => {
    const projects = [mk("a", { accessTier: "PUBLIC", published: false })];
    const t = computeSkillTree(projects, [], viewer({ signedIn: true }));
    expect(node(t, "a").state).toBe("coming-soon");
  });

  test("completed project is done regardless of tier", () => {
    const projects = [
      mk("a", { accessTier: "PREMIUM", published: true }),
    ];
    const t = computeSkillTree(
      projects,
      [],
      viewer({ signedIn: true, completedSlugs: new Set(["a"]) }),
    );
    expect(node(t, "a").state).toBe("done");
  });

  test("PREMIUM signed-in, not entitled, not admin is locked-paywall and carries price", () => {
    const projects = [
      mk("a", { accessTier: "PREMIUM", published: true, priceCents: 4900 }),
    ];
    const t = computeSkillTree(projects, [], viewer({ signedIn: true }));
    const a = node(t, "a");
    expect(a.state).toBe("locked-paywall");
    expect(a.priceCents).toBe(4900);
  });

  test("PREMIUM entitled but prereq unmet is locked-prereq (rule 6 beats ownership)", () => {
    const projects = [
      mk("a", { published: true }),
      mk("b", { accessTier: "PREMIUM", published: true }),
    ];
    const edges: RawEdge[] = [
      { fromSlug: "a", toSlug: "b", kind: "FOUNDATION" },
    ];
    const t = computeSkillTree(
      projects,
      edges,
      viewer({ signedIn: true, entitledSlugs: new Set(["b"]) }),
    );
    expect(node(t, "b").state).toBe("locked-prereq");
  });

  test("dependent with incomplete prereq is locked-prereq with prereq in missingPrereqs", () => {
    const projects = [mk("a", { published: true }), mk("b", { published: true })];
    const edges: RawEdge[] = [
      { fromSlug: "a", toSlug: "b", kind: "FOUNDATION" },
    ];
    const t = computeSkillTree(projects, edges, viewer({ signedIn: true }));
    const b = node(t, "b");
    expect(b.state).toBe("locked-prereq");
    expect(b.missingPrereqs.map((p) => p.slug)).toEqual(["a"]);
  });

  test("missingPrereqs carries the prereq title (publicTitle ?? name)", () => {
    const projects = [
      mk("a", { name: "Alpha", publicTitle: "Alpha Public", published: true }),
      mk("b", { published: true }),
    ];
    const edges: RawEdge[] = [
      { fromSlug: "a", toSlug: "b", kind: "FOUNDATION" },
    ];
    const t = computeSkillTree(projects, edges, viewer({ signedIn: true }));
    expect(node(t, "b").missingPrereqs).toEqual([
      { slug: "a", title: "Alpha Public" },
    ]);
  });

  test("admin sees a published PREMIUM node as available", () => {
    const projects = [
      mk("a", { accessTier: "PREMIUM", published: true }),
    ];
    const t = computeSkillTree(
      projects,
      [],
      viewer({ signedIn: true, isAdmin: true }),
    );
    expect(node(t, "a").state).toBe("available");
  });

  test("admin with unmet prereq still sees available (admin beats prereq)", () => {
    const projects = [mk("a", { published: true }), mk("b", { published: true })];
    const edges: RawEdge[] = [
      { fromSlug: "a", toSlug: "b", kind: "FOUNDATION" },
    ];
    const t = computeSkillTree(
      projects,
      edges,
      viewer({ signedIn: true, isAdmin: true }),
    );
    expect(node(t, "b").state).toBe("available");
  });

  test("anon on PUBLIC published root is preview", () => {
    const projects = [mk("a", { accessTier: "PUBLIC", published: true })];
    const t = computeSkillTree(projects, [], viewer());
    expect(node(t, "a").state).toBe("preview");
  });

  test("anon on a FREE node is locked-account (NOT locked-prereq)", () => {
    const projects = [
      mk("a", { accessTier: "PUBLIC", published: true }),
      mk("b", { accessTier: "FREE", published: true }),
    ];
    const edges: RawEdge[] = [
      { fromSlug: "a", toSlug: "b", kind: "FOUNDATION" },
    ];
    const t = computeSkillTree(projects, edges, viewer());
    expect(node(t, "b").state).toBe("locked-account");
  });

  test("anon on a PREMIUM node is locked-paywall", () => {
    const projects = [mk("a", { accessTier: "PREMIUM", published: true })];
    const t = computeSkillTree(projects, [], viewer());
    expect(node(t, "a").state).toBe("locked-paywall");
  });

  test("signed-in on a FREE node with an unmet prereq is locked-prereq", () => {
    const projects = [
      mk("a", { accessTier: "FREE", published: true }),
      mk("b", { accessTier: "FREE", published: true }),
    ];
    const edges: RawEdge[] = [
      { fromSlug: "a", toSlug: "b", kind: "FOUNDATION" },
    ];
    const t = computeSkillTree(projects, edges, viewer({ signedIn: true }));
    expect(node(t, "b").state).toBe("locked-prereq");
  });

  test("signed-in FREE node with prereq met is available", () => {
    const projects = [
      mk("a", { accessTier: "FREE", published: true }),
      mk("b", { accessTier: "FREE", published: true }),
    ];
    const edges: RawEdge[] = [
      { fromSlug: "a", toSlug: "b", kind: "FOUNDATION" },
    ];
    const t = computeSkillTree(
      projects,
      edges,
      viewer({ signedIn: true, completedSlugs: new Set(["a"]) }),
    );
    // a is done, b becomes available
    expect(node(t, "a").state).toBe("done");
    expect(node(t, "b").state).toBe("available");
  });

  test("title falls back to name when publicTitle is null", () => {
    const projects = [mk("a", { name: "Fallback Name", publicTitle: null })];
    const t = computeSkillTree(projects, [], viewer());
    expect(node(t, "a").title).toBe("Fallback Name");
  });

  test("title uses publicTitle when present", () => {
    const projects = [
      mk("a", { name: "Internal", publicTitle: "Public Title" }),
    ];
    const t = computeSkillTree(projects, [], viewer());
    expect(node(t, "a").title).toBe("Public Title");
  });
});

describe("computeSkillTree — isNext", () => {
  test("at most one node has isNext (signed-in)", () => {
    const projects = [
      mk("a", { accessTier: "FREE", published: true, criticalPath: true }),
      mk("b", { accessTier: "FREE", published: true, criticalPath: true }),
      mk("c", { accessTier: "FREE", published: true, criticalPath: true }),
    ];
    const edges: RawEdge[] = [
      { fromSlug: "a", toSlug: "b", kind: "FOUNDATION" },
      { fromSlug: "b", toSlug: "c", kind: "FOUNDATION" },
    ];
    const t = computeSkillTree(projects, edges, viewer({ signedIn: true }));
    const flagged = t.nodes.filter((n) => n.isNext);
    expect(flagged).toHaveLength(1);
    // a is the only available node (b, c locked-prereq) -> a is next
    expect(flagged[0].slug).toBe("a");
  });

  test("isNext advances as prereqs complete", () => {
    const projects = [
      mk("a", { accessTier: "FREE", published: true, criticalPath: true }),
      mk("b", { accessTier: "FREE", published: true, criticalPath: true }),
    ];
    const edges: RawEdge[] = [
      { fromSlug: "a", toSlug: "b", kind: "FOUNDATION" },
    ];
    const t = computeSkillTree(
      projects,
      edges,
      viewer({ signedIn: true, completedSlugs: new Set(["a"]) }),
    );
    const flagged = t.nodes.filter((n) => n.isNext);
    expect(flagged).toHaveLength(1);
    expect(flagged[0].slug).toBe("b");
  });

  test("zero case: signed-in student who completed everything has no isNext", () => {
    const projects = [
      mk("a", { accessTier: "FREE", published: true, criticalPath: true }),
      mk("b", { accessTier: "FREE", published: true, criticalPath: true }),
    ];
    const edges: RawEdge[] = [
      { fromSlug: "a", toSlug: "b", kind: "FOUNDATION" },
    ];
    const t = computeSkillTree(
      projects,
      edges,
      viewer({ signedIn: true, completedSlugs: new Set(["a", "b"]) }),
    );
    expect(t.nodes.filter((n) => n.isNext)).toHaveLength(0);
  });

  test("zero case: anon when the PUBLIC root is unpublished has no isNext", () => {
    const projects = [
      mk("a", { accessTier: "PUBLIC", published: false, criticalPath: true }),
      mk("b", { accessTier: "FREE", published: true, criticalPath: true }),
    ];
    const t = computeSkillTree(projects, [], viewer());
    // a coming-soon, b locked-account -> no preview node
    expect(t.nodes.filter((n) => n.isNext)).toHaveLength(0);
  });

  test("anon isNext is the first PUBLIC non-done preview node", () => {
    const projects = [
      mk("a", { accessTier: "PUBLIC", published: true, criticalPath: true }),
      mk("b", { accessTier: "FREE", published: true, criticalPath: true }),
    ];
    const edges: RawEdge[] = [
      { fromSlug: "a", toSlug: "b", kind: "FOUNDATION" },
    ];
    const t = computeSkillTree(projects, edges, viewer());
    const flagged = t.nodes.filter((n) => n.isNext);
    expect(flagged).toHaveLength(1);
    expect(flagged[0].slug).toBe("a");
  });

  test("isNext only considers critical-path nodes", () => {
    // off-spine available node should NOT win over an on-spine one
    const projects = [
      mk("off", { accessTier: "FREE", published: true, criticalPath: false }),
      mk("on", { accessTier: "FREE", published: true, criticalPath: true }),
    ];
    const t = computeSkillTree(projects, [], viewer({ signedIn: true }));
    const flagged = t.nodes.filter((n) => n.isNext);
    expect(flagged).toHaveLength(1);
    expect(flagged[0].slug).toBe("on");
  });
});

describe("computeSkillTree — critical-path topo order", () => {
  test("topo determinism with a real tie: same (level,track), no edge between -> slug ascending", () => {
    // zeb and abe share L2/POWER and have NO edge between them.
    // root -> both, so they enter the frontier simultaneously => pure tie.
    const projects = [
      mk("root", {
        accessTier: "FREE",
        published: true,
        criticalPath: true,
        level: "L1",
        track: "COMMS",
      }),
      mk("zeb", {
        accessTier: "FREE",
        published: true,
        criticalPath: true,
        level: "L2",
        track: "POWER",
      }),
      mk("abe", {
        accessTier: "FREE",
        published: true,
        criticalPath: true,
        level: "L2",
        track: "POWER",
      }),
    ];
    const edges: RawEdge[] = [
      { fromSlug: "root", toSlug: "zeb", kind: "FOUNDATION" },
      { fromSlug: "root", toSlug: "abe", kind: "FOUNDATION" },
    ];
    const t = computeSkillTree(
      projects,
      edges,
      viewer({ signedIn: true, completedSlugs: new Set(["root", "zeb", "abe"]) }),
    );
    // With everything done, isNext is none; verify order via the next-pointer
    // instead by checking which becomes available first when nothing completed.
    const t2 = computeSkillTree(projects, edges, viewer({ signedIn: true }));
    // root is the only available node; complete it and abe (slug<zeb) must be next
    const t3 = computeSkillTree(
      projects,
      edges,
      viewer({ signedIn: true, completedSlugs: new Set(["root"]) }),
    );
    expect(t2.nodes.find((n) => n.isNext)?.slug).toBe("root");
    expect(t3.nodes.find((n) => n.isNext)?.slug).toBe("abe");
    // when both root & abe done, zeb is next (slug ascending consumed abe first)
    const t4 = computeSkillTree(
      projects,
      edges,
      viewer({ signedIn: true, completedSlugs: new Set(["root", "abe"]) }),
    );
    expect(t4.nodes.find((n) => n.isNext)?.slug).toBe("zeb");
    void t;
  });

  test("tie-break by level before track", () => {
    // l1Power (L1/POWER) vs l2Comms (L2/COMMS): both available, no edges.
    // L1 < L2 so the L1 node is next even though COMMS<POWER on track.
    const projects = [
      mk("l2comms", {
        accessTier: "FREE",
        published: true,
        criticalPath: true,
        level: "L2",
        track: "COMMS",
      }),
      mk("l1power", {
        accessTier: "FREE",
        published: true,
        criticalPath: true,
        level: "L1",
        track: "POWER",
      }),
    ];
    const t = computeSkillTree(projects, [], viewer({ signedIn: true }));
    expect(t.nodes.find((n) => n.isNext)?.slug).toBe("l1power");
  });

  test("tie-break by track before slug", () => {
    // same level, COMMS < POWER. zzz_comms (COMMS) beats aaa_power (POWER)
    // despite slug ordering, proving track outranks slug.
    const projects = [
      mk("aaa_power", {
        accessTier: "FREE",
        published: true,
        criticalPath: true,
        level: "L1",
        track: "POWER",
      }),
      mk("zzz_comms", {
        accessTier: "FREE",
        published: true,
        criticalPath: true,
        level: "L1",
        track: "COMMS",
      }),
    ];
    const t = computeSkillTree(projects, [], viewer({ signedIn: true }));
    expect(t.nodes.find((n) => n.isNext)?.slug).toBe("zzz_comms");
  });

  test("does not hang on a cycle in critical-path nodes", () => {
    const projects = [
      mk("a", { accessTier: "FREE", published: true, criticalPath: true }),
      mk("b", { accessTier: "FREE", published: true, criticalPath: true }),
    ];
    const edges: RawEdge[] = [
      { fromSlug: "a", toSlug: "b", kind: "FOUNDATION" },
      { fromSlug: "b", toSlug: "a", kind: "FOUNDATION" },
    ];
    // Both have an unmet prereq (cycle) so neither is available -> no isNext,
    // and crucially the function returns (no infinite loop).
    const t = computeSkillTree(projects, edges, viewer({ signedIn: true }));
    expect(t.nodes).toHaveLength(2);
    expect(t.nodes.filter((n) => n.isNext)).toHaveLength(0);
  });

  test("edges referencing non-critical-path nodes do not break ordering", () => {
    const projects = [
      mk("off", { accessTier: "FREE", published: true, criticalPath: false }),
      mk("on", {
        accessTier: "FREE",
        published: true,
        criticalPath: true,
        level: "L1",
        track: "COMMS",
      }),
    ];
    // off (not on spine) -> on. Ordering restricts to crit-path nodes only,
    // so "on" has no in-spine prereq and is available/next.
    const edges: RawEdge[] = [
      { fromSlug: "off", toSlug: "on", kind: "FOUNDATION" },
    ];
    const t = computeSkillTree(
      projects,
      edges,
      viewer({ signedIn: true, completedSlugs: new Set(["off"]) }),
    );
    expect(t.nodes.find((n) => n.isNext)?.slug).toBe("on");
  });
});

describe("computeSkillTree — structural", () => {
  test("returns one node per project and echoes edges", () => {
    const projects = [mk("a"), mk("b")];
    const edges: RawEdge[] = [
      { fromSlug: "a", toSlug: "b", kind: "FOUNDATION" },
    ];
    const t = computeSkillTree(projects, edges, viewer());
    expect(t.nodes).toHaveLength(2);
    expect(t.edges).toEqual(edges);
  });
});
