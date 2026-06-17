import { describe, expect, test } from "vitest";
import {
  assessGoldenReference,
  type GoldenReferenceInput,
} from "@/lib/golden-reference";

const base: GoldenReferenceInput = {
  published: true,
  vetted: true,
  hasKicadStarter: true,
  hasReferenceGerbers: true,
  hasMeasurementsCsv: true,
};

describe("assessGoldenReference", () => {
  test("published + vetted → isGolden; all three present → complete", () => {
    const r = assessGoldenReference(base);
    expect(r.isGolden).toBe(true);
    expect(r.complete).toBe(true);
    expect(r.bundle).toHaveLength(3);
    expect(r.bundle.map((d) => d.key)).toEqual([
      "kicadStarter",
      "referenceGerbers",
      "measurementsCsv",
    ]);
    // Labels render to learners/operators — lock them against accidental edits.
    expect(r.bundle.map((d) => d.label)).toEqual([
      "KiCad starter",
      "Verified reference gerbers",
      "Bring-up measurements (CSV)",
    ]);
  });

  test("not published → not golden (regardless of vetted)", () => {
    const r = assessGoldenReference({ ...base, published: false });
    expect(r.isGolden).toBe(false);
  });

  test("published but not vetted → not golden", () => {
    const r = assessGoldenReference({ ...base, vetted: false });
    expect(r.isGolden).toBe(false);
  });

  test("golden but a deliverable missing → isGolden stays true, complete false", () => {
    const r = assessGoldenReference({ ...base, hasMeasurementsCsv: false });
    expect(r.isGolden).toBe(true);
    expect(r.complete).toBe(false);
    expect(r.bundle.find((d) => d.key === "measurementsCsv")!.present).toBe(false);
  });

  test("isGolden never gates on the files (golden with zero deliverables)", () => {
    const r = assessGoldenReference({
      published: true,
      vetted: true,
      hasKicadStarter: false,
      hasReferenceGerbers: false,
      hasMeasurementsCsv: false,
    });
    expect(r.isGolden).toBe(true);
    expect(r.complete).toBe(false);
  });
});
