// Tests for the ARTIFACT_SUBKIND_OWNER map (Task 9.1).
//
// Exhaustive coverage: every ArtifactSubkind crossed with both owner kinds.
// The const itself is the spec — these tests pin the design §4.3 table so a
// later edit that flips e.g. PCB_ORDER from "build" to "revision" lights up
// red immediately.
import { describe, expect, test } from "vitest";
import type { ArtifactSubkind } from "@prisma/client";
import { ARTIFACT_SUBKIND_OWNER, ownerMatches } from "@/lib/artifacts";

const ALL_SUBKINDS = [
  "GENERIC",
  "REQUIREMENTS_DOC",
  "SCHEMATIC_FILE",
  "BOM_EXPORT",
  "LAYOUT_FILE",
  "MODEL_3D",
  "DRC_REPORT",
  "GERBER_ZIP",
  "ASSEMBLY_PROCEDURE",
  "BENCH_PROCEDURE",
  "PCB_ORDER",
  "PARTS_ORDER",
  "BRINGUP_LOG",
  "BRINGUP_COMPLETE",
  "BOM_CSV_AS_ORDERED",
  "ASSEMBLY_PHOTO",
  "BRINGUP_MEASUREMENTS_CSV",
] as const satisfies readonly ArtifactSubkind[];

describe("ARTIFACT_SUBKIND_OWNER", () => {
  test("every ArtifactSubkind has an entry", () => {
    for (const s of ALL_SUBKINDS) {
      expect(ARTIFACT_SUBKIND_OWNER[s]).toBeDefined();
    }
    // And no extras: the const's key count matches the enum's value count.
    expect(Object.keys(ARTIFACT_SUBKIND_OWNER).sort()).toEqual(
      [...ALL_SUBKINDS].sort(),
    );
  });
});

describe("ownerMatches — GENERIC accepts both owner kinds", () => {
  test("GENERIC + revision → true", () => {
    expect(ownerMatches("GENERIC", "revision")).toBe(true);
  });
  test("GENERIC + build → true", () => {
    expect(ownerMatches("GENERIC", "build")).toBe(true);
  });
});

describe("ownerMatches — revision-bound subkinds", () => {
  const REVISION_BOUND: ArtifactSubkind[] = [
    "REQUIREMENTS_DOC",
    "SCHEMATIC_FILE",
    "BOM_EXPORT",
    "LAYOUT_FILE",
    "DRC_REPORT",
    "ASSEMBLY_PROCEDURE",
    "BENCH_PROCEDURE",
  ];

  for (const s of REVISION_BOUND) {
    test(`${s} + revision → true`, () => {
      expect(ownerMatches(s, "revision")).toBe(true);
    });
    test(`${s} + build → false`, () => {
      expect(ownerMatches(s, "build")).toBe(false);
    });
  }
});

describe("ownerMatches — build-bound subkinds", () => {
  const BUILD_BOUND: ArtifactSubkind[] = [
    "PCB_ORDER",
    "PARTS_ORDER",
    "BRINGUP_LOG",
    "BRINGUP_COMPLETE",
    "BOM_CSV_AS_ORDERED",
    "ASSEMBLY_PHOTO",
    "BRINGUP_MEASUREMENTS_CSV",
  ];

  for (const s of BUILD_BOUND) {
    test(`${s} + build → true`, () => {
      expect(ownerMatches(s, "build")).toBe(true);
    });
    test(`${s} + revision → false`, () => {
      expect(ownerMatches(s, "revision")).toBe(false);
    });
  }
});

describe("ownerMatches — either-scoped subkinds (m14 widening)", () => {
  test("GERBER_ZIP is 'either' (covers revision-scoped designed gerbers AND build-scoped fab-submission snapshot)", () => {
    expect(ARTIFACT_SUBKIND_OWNER.GERBER_ZIP).toBe("either");
    expect(ownerMatches("GERBER_ZIP", "revision")).toBe(true);
    expect(ownerMatches("GERBER_ZIP", "build")).toBe(true);
  });

  test("BOM_CSV_AS_ORDERED + ASSEMBLY_PHOTO + BRINGUP_MEASUREMENTS_CSV are Build-scoped", () => {
    expect(ARTIFACT_SUBKIND_OWNER.BOM_CSV_AS_ORDERED).toBe("build");
    expect(ARTIFACT_SUBKIND_OWNER.ASSEMBLY_PHOTO).toBe("build");
    expect(ARTIFACT_SUBKIND_OWNER.BRINGUP_MEASUREMENTS_CSV).toBe("build");
    expect(ownerMatches("BOM_CSV_AS_ORDERED", "revision")).toBe(false);
    expect(ownerMatches("ASSEMBLY_PHOTO", "revision")).toBe(false);
  });
});

describe("ownerMatches — exhaustive cross-product sanity", () => {
  test("every subkind × every owner-kind has a deterministic boolean answer", () => {
    for (const s of ALL_SUBKINDS) {
      for (const o of ["revision", "build"] as const) {
        const r = ownerMatches(s, o);
        expect(typeof r).toBe("boolean");
        const expected = ARTIFACT_SUBKIND_OWNER[s];
        if (expected === "either") {
          expect(r).toBe(true);
        } else {
          expect(r).toBe(expected === o);
        }
      }
    }
  });
});
