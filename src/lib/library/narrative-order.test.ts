import { describe, expect, it } from "vitest";
import {
  LIBRARY_NARRATIVE_ORDER,
  byNarrativeOrder,
} from "@/lib/library/narrative-order";

describe("byNarrativeOrder", () => {
  it("lifts listed slugs into the curated arc order regardless of input order", () => {
    const shuffled = [...LIBRARY_NARRATIVE_ORDER]
      .reverse()
      .map((slug) => ({ slug }));
    expect(byNarrativeOrder(shuffled).map((r) => r.slug)).toEqual([
      ...LIBRARY_NARRATIVE_ORDER,
    ]);
  });

  it("sorts unlisted slugs after the curated arc, preserving their incoming order", () => {
    const rows = [
      { slug: "brand-new-lesson" },
      { slug: "control-a-drone-with-your-brain" },
      { slug: "another-unplaced" },
      { slug: "what-is-a-bci" },
    ];
    expect(byNarrativeOrder(rows).map((r) => r.slug)).toEqual([
      "what-is-a-bci",
      "control-a-drone-with-your-brain",
      "brand-new-lesson",
      "another-unplaced",
    ]);
  });

  it("does not mutate the input array", () => {
    const rows = [{ slug: "eeg-bci-guide" }, { slug: "what-is-a-bci" }];
    const snapshot = rows.map((r) => r.slug);
    byNarrativeOrder(rows);
    expect(rows.map((r) => r.slug)).toEqual(snapshot);
  });

  it("has a unique slug list (no accidental duplicate in the arc)", () => {
    expect(new Set(LIBRARY_NARRATIVE_ORDER).size).toBe(
      LIBRARY_NARRATIVE_ORDER.length,
    );
  });
});
