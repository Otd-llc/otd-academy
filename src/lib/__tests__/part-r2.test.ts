// Unit tests for the part-scoped CAD asset R2 key helper (Stage C Task 3).
// Pure function only — the live R2 ops (presignPut/headVerifySize/presignGet
// in part-r2.ts) are NOT unit-tested here; they're covered by the R2-gate test
// in Task 5 + the manual demo. This test exercises only `partAssetKey`.
import { describe, expect, test } from "vitest";
import { partAssetKey } from "@/lib/r2";

describe("partAssetKey", () => {
  test("lowercases the kind, strips a leading-dot ext, and lowercases the ext", () => {
    // kind MODEL_3D → model_3d; ".STEP" → "step".
    expect(partAssetKey("p1", "MODEL_3D", "abc", ".STEP")).toBe(
      "parts/p1/model_3d-abc.step",
    );
  });

  test("handles a multi-part extension with a leading dot (symbol)", () => {
    expect(partAssetKey("p1", "SYMBOL", "xyz", ".kicad_sym")).toBe(
      "parts/p1/symbol-xyz.kicad_sym",
    );
  });

  test("handles an extension WITHOUT a leading dot (footprint)", () => {
    expect(partAssetKey("p1", "FOOTPRINT", "xyz", "kicad_mod")).toBe(
      "parts/p1/footprint-xyz.kicad_mod",
    );
  });
});
