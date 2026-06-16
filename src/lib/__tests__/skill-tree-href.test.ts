import { describe, expect, test } from "vitest";
import { hrefForNode } from "@/lib/skill-tree-href";
import type { SkillNode } from "@/lib/skill-tree-core";

// Minimal SkillNode factory. Only the fields hrefForNode reads matter
// (slug, state, publishedLabel); the rest are filled with inert defaults so
// the object satisfies the SkillNode type.
function mkNode(overrides: Partial<SkillNode> = {}): SkillNode {
  return {
    slug: "l1-01-wroom-breakout",
    name: "WROOM Breakout",
    publicTitle: null,
    tagline: null,
    track: "COMMS",
    level: "L1",
    accessTier: "PUBLIC",
    criticalPath: true,
    priceCents: null,
    stripePriceId: null,
    published: true,
    publishedLabel: "v1",
    title: "WROOM Breakout",
    state: "available",
    isNext: false,
    missingPrereqs: [],
    ...overrides,
  };
}

describe("hrefForNode", () => {
  test("done + signed-in → /learn/<slug>", () => {
    const node = mkNode({ slug: "abc", state: "done" });
    expect(hrefForNode(node, { signedIn: true })).toBe("/learn/abc");
  });

  test("available + signed-in → /learn/<slug>", () => {
    const node = mkNode({ slug: "abc", state: "available" });
    expect(hrefForNode(node, { signedIn: true })).toBe("/learn/abc");
  });

  test("locked-account (FREE-anon) → /sign-in?callbackUrl=/courses", () => {
    const node = mkNode({ state: "locked-account", accessTier: "FREE" });
    expect(hrefForNode(node, { signedIn: false })).toBe(
      "/sign-in?callbackUrl=/courses",
    );
  });

  test("preview (PUBLIC-anon) → project outline guide href", () => {
    const node = mkNode({
      slug: "abc",
      state: "preview",
      accessTier: "PUBLIC",
      publishedLabel: "v2",
    });
    expect(hrefForNode(node, { signedIn: false })).toBe(
      "/projects/abc/v2/guide",
    );
  });

  test("locked-paywall (PREMIUM) → project outline guide href", () => {
    const node = mkNode({
      slug: "xyz",
      state: "locked-paywall",
      accessTier: "PREMIUM",
      publishedLabel: "rev-1",
    });
    expect(hrefForNode(node, { signedIn: true })).toBe(
      "/projects/xyz/rev-1/guide",
    );
  });

  test("locked-prereq → project outline guide href", () => {
    const node = mkNode({
      slug: "dep",
      state: "locked-prereq",
      publishedLabel: "v1",
    });
    expect(hrefForNode(node, { signedIn: true })).toBe("/projects/dep/v1/guide");
  });

  test("outline label is URI-encoded", () => {
    const node = mkNode({
      slug: "abc",
      state: "preview",
      publishedLabel: "rev 1/draft",
    });
    expect(hrefForNode(node, { signedIn: false })).toBe(
      `/projects/abc/${encodeURIComponent("rev 1/draft")}/guide`,
    );
  });

  test("coming-soon → /courses/<slug> (preview/waitlist landing)", () => {
    const node = mkNode({
      slug: "l3-04-bms",
      state: "coming-soon",
      published: false,
    });
    expect(hrefForNode(node, { signedIn: false })).toBe("/courses/l3-04-bms");
  });

  test("outline state with null publishedLabel → null (defensive)", () => {
    const node = mkNode({ state: "preview", publishedLabel: null });
    expect(hrefForNode(node, { signedIn: false })).toBeNull();
  });
});
