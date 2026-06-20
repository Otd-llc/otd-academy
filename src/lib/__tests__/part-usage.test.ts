import { describe, it, expect } from "vitest";
import { summarizePartUsage } from "@/lib/part-usage";

describe("summarizePartUsage", () => {
  it("groups rows by project, dedups + sorts refDes, builds the guide href", () => {
    const out = summarizePartUsage([
      { slug: "l1-01-wroom-breakout", label: "v1", title: "WROOM Breakout", refDes: "R5,R6" },
      { slug: "l1-01-wroom-breakout", label: "v1", title: "WROOM Breakout", refDes: "R7,R8,R5" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      title: "WROOM Breakout",
      href: "/projects/l1-01-wroom-breakout/v1/guide",
      refDes: "R5, R6, R7, R8",
    });
  });

  it("encodes the revision label in the href", () => {
    const out = summarizePartUsage([
      { slug: "b", label: "BUILD 001", title: "Board B", refDes: "U1" },
    ]);
    expect(out[0].href).toBe("/projects/b/BUILD%20001/guide");
  });

  it("returns one entry per project, sorted by title", () => {
    const out = summarizePartUsage([
      { slug: "z", label: "v1", title: "Zebra", refDes: "U1" },
      { slug: "a", label: "v1", title: "Apple", refDes: "C1" },
    ]);
    expect(out.map((e) => e.title)).toEqual(["Apple", "Zebra"]);
  });

  it("returns [] for no usage", () => {
    expect(summarizePartUsage([])).toEqual([]);
  });
});
