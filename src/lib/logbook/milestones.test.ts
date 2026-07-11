import { describe, it, expect } from "vitest";
import { milestonesFor } from "@/lib/logbook/milestones";

const clusters = (o: Record<string, string[]>) => new Map(Object.entries(o));

describe("milestonesFor", () => {
  it("no cluster complete while any lesson in it is unfinished", () => {
    const r = milestonesFor(
      new Set(["a1"]),
      clusters({ alpha: ["a1", "a2"], beta: ["b1"] }),
    );
    expect(r.clusterKeys).toEqual([]);
    expect(r.libraryComplete).toBe(false);
  });

  it("marks a cluster complete on its exact final lesson", () => {
    const r = milestonesFor(
      new Set(["a1", "a2"]),
      clusters({ alpha: ["a1", "a2"], beta: ["b1"] }),
    );
    expect(r.clusterKeys).toEqual(["alpha"]);
    expect(r.libraryComplete).toBe(false);
  });

  it("library complete only when every published lesson is done", () => {
    const r = milestonesFor(
      new Set(["a1", "a2", "b1"]),
      clusters({ alpha: ["a1", "a2"], beta: ["b1"] }),
    );
    expect(r.clusterKeys.sort()).toEqual(["alpha", "beta"]);
    expect(r.libraryComplete).toBe(true);
  });

  it("reopens when the library grows past a prior all-done state", () => {
    // user had finished the old set; a new lesson b2 appears
    const r = milestonesFor(
      new Set(["a1", "a2", "b1"]),
      clusters({ alpha: ["a1", "a2"], beta: ["b1", "b2"] }),
    );
    expect(r.clusterKeys).toEqual(["alpha"]);
    expect(r.libraryComplete).toBe(false);
  });

  it("ignores empty clusters (never emits them, never blocks library)", () => {
    const r = milestonesFor(
      new Set(["a1"]),
      clusters({ alpha: ["a1"], empty: [] }),
    );
    expect(r.clusterKeys).toEqual(["alpha"]);
    expect(r.libraryComplete).toBe(true);
  });

  it("empty map is not a completion", () => {
    const r = milestonesFor(new Set<string>(), clusters({}));
    expect(r.clusterKeys).toEqual([]);
    expect(r.libraryComplete).toBe(false);
  });
});
