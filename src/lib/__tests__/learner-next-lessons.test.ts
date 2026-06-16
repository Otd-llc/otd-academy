import { describe, it, expect } from "vitest";
import { pickNextLessons, type NextLesson } from "@/lib/learner-next-lessons";

const L = (slug: string, criticalPath: boolean): NextLesson => ({ slug, name: slug, criticalPath });

describe("pickNextLessons", () => {
  it("returns [] when there are no dependents", () => {
    expect(pickNextLessons([])).toEqual([]);
  });
  it("orders critical-path lessons first", () => {
    const out = pickNextLessons([L("a", false), L("b", true)]);
    expect(out.map((l) => l.slug)).toEqual(["b", "a"]);
  });
  it("caps to the limit (default 2)", () => {
    expect(pickNextLessons([L("a", true), L("b", true), L("c", true)])).toHaveLength(2);
  });
});
