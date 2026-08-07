import { describe, expect, it } from "vitest";

import {
  NAV_FIT_COUNTS,
  NAV_LINKS,
  collapsedMenuClass,
  inlineNavClass,
  isNavActive,
  visibleNavLinks,
} from "@/lib/nav-links";

describe("visibleNavLinks", () => {
  it("hides admin surfaces and the personal dashboard from anonymous visitors", () => {
    const labels = visibleNavLinks(null, false).map((l) => l.label);
    expect(labels).toEqual([
      "Courses",
      "Pricing",
      "Library",
      "Tools",
      "Parts",
      "Hex",
    ]);
  });

  it("adds Learn once signed in", () => {
    expect(visibleNavLinks("LEARNER", true).map((l) => l.label)).toContain(
      "Learn",
    );
    expect(visibleNavLinks("LEARNER", true).map((l) => l.label)).not.toContain(
      "Curriculum",
    );
  });

  it("adds the operator surfaces for an admin", () => {
    const labels = visibleNavLinks("ADMIN", true).map((l) => l.label);
    expect(labels).toContain("Projects");
    expect(labels).toContain("Curriculum");
    expect(labels).toHaveLength(NAV_LINKS.length);
  });

  it("does not show admin links to a signed-out ADMIN role claim", () => {
    // Belt and braces: the header renders `signedIn: false` with a null role,
    // but a stale role must not resurrect the operator links on its own.
    expect(visibleNavLinks("ADMIN", false).map((l) => l.label)).not.toContain(
      "Learn",
    );
  });
});

describe("isNavActive", () => {
  it("never highlights when the URL is unknown (the static shell)", () => {
    for (const link of NAV_LINKS) {
      expect(isNavActive(null, link.href)).toBe(false);
    }
  });

  it("gives the dashboard the whole project tree", () => {
    expect(isNavActive("/", "/")).toBe(true);
    expect(isNavActive("/projects/esp32-sensor-breakout", "/")).toBe(true);
    expect(isNavActive("/library", "/")).toBe(false);
  });

  it("matches a section by prefix, but only on a segment boundary", () => {
    expect(isNavActive("/library", "/library")).toBe(true);
    expect(isNavActive("/library/ohms-law", "/library")).toBe(true);
    // Would be a false positive under a bare startsWith.
    expect(isNavActive("/librarian", "/library")).toBe(false);
  });
});

describe("the fit thresholds", () => {
  it("pairs a reveal class with the exact mirror that hides the menu", () => {
    for (const count of [6, 7, 8, 9]) {
      const width = inlineNavClass(count).match(/@min-\[(\d+rem)\]/)?.[1];
      expect(width).toBeTruthy();
      expect(collapsedMenuClass(count)).toBe(`@min-[${width}]:hidden`);
    }
  });

  it("needs more room for more links", () => {
    const rem = (n: number) =>
      Number(inlineNavClass(n).match(/@min-\[(\d+)rem\]/)?.[1]);
    expect(rem(6)).toBeLessThan(rem(7));
    expect(rem(7)).toBeLessThan(rem(8));
    expect(rem(8)).toBeLessThan(rem(9));
  });

  it("covers every count the link set can actually produce", () => {
    // A count with no entry falls back to the widest threshold, which is safe
    // but silently costs a whole viewport class its inline nav -- so the table
    // has to keep up with NAV_LINKS.
    const counts = new Set(
      [
        visibleNavLinks(null, false),
        visibleNavLinks("LEARNER", true),
        visibleNavLinks("ADMIN", true),
        visibleNavLinks("ADMIN", false),
      ].map((links) => links.length),
    );
    for (const count of counts) {
      expect(NAV_FIT_COUNTS).toContain(count);
    }
  });
});
