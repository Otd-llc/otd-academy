import { describe, it, expect } from "vitest";

import { firstDiagramSrc } from "@/lib/library/hero-diagram";

describe("firstDiagramSrc", () => {
  it("returns the first guide-diagram image src", () => {
    const blocks = [
      { type: "prose", md: "intro" },
      { type: "image", src: "/guide-diagrams/a.svg", caption: "a" },
      { type: "image", src: "/guide-diagrams/b.svg" },
    ];
    expect(firstDiagramSrc(blocks)).toBe("/guide-diagrams/a.svg");
  });

  it("ignores non-guide-diagram images (screenshots etc.)", () => {
    expect(firstDiagramSrc([{ type: "image", src: "/shots/x.png" }])).toBeNull();
  });

  it("is null when there is no image block", () => {
    expect(firstDiagramSrc([{ type: "prose", md: "no diagram here" }])).toBeNull();
  });

  it("is resilient to junk / non-array input", () => {
    expect(firstDiagramSrc(null)).toBeNull();
    expect(firstDiagramSrc({})).toBeNull();
    expect(firstDiagramSrc("nope")).toBeNull();
    expect(firstDiagramSrc(undefined)).toBeNull();
  });
});
