import { describe, expect, test } from "vitest";
import { goldenReferenceFromRows } from "@/lib/golden-reference-load";

describe("goldenReferenceFromRows", () => {
  test("derives has* from the published-rev artifact subkinds", () => {
    const r = goldenReferenceFromRows({
      publishedRevisionId: "rev_1",
      vetted: true,
      publishedArtifactSubkinds: ["BOM_EXPORT", "GERBER_ZIP"],
    });
    expect(r.isGolden).toBe(true);
    expect(r.bundle.find((d) => d.key === "kicadStarter")!.present).toBe(true);
    expect(r.bundle.find((d) => d.key === "referenceGerbers")!.present).toBe(true);
    expect(r.bundle.find((d) => d.key === "measurementsCsv")!.present).toBe(false);
    expect(r.complete).toBe(false);
  });

  test("no published revision → not golden", () => {
    const r = goldenReferenceFromRows({
      publishedRevisionId: null,
      vetted: true,
      publishedArtifactSubkinds: [],
    });
    expect(r.isGolden).toBe(false);
  });

  test("all three subkinds present + vetted → golden + complete", () => {
    const r = goldenReferenceFromRows({
      publishedRevisionId: "rev_1",
      vetted: true,
      publishedArtifactSubkinds: [
        "BOM_EXPORT",
        "GERBER_ZIP",
        "BRINGUP_MEASUREMENTS_CSV",
      ],
    });
    expect(r.isGolden).toBe(true);
    expect(r.complete).toBe(true);
  });
});
