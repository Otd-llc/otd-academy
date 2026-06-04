// Pure Zod-schema tests for the PartAsset per-kind upload policy + demote
// decision (`src/lib/schemas/part-asset.ts`, design §2 / Stage C). No DB —
// these exercise the config + schemas directly, mirroring
// part-fact-schema.test.ts.
//
// Coverage: ASSET_KIND_CONFIG per kind (exts / contentType / cap); `extOf`
// lowercasing + the no-dot case; the upload schema's `superRefine` rejecting a
// wrong extension for the kind and a too-large byteSize, and accepting a
// correct case-insensitive one; and `shouldDemoteAsset` (ref OR source change
// demotes; a license-only change / no-op does not).
import { describe, it, expect } from "vitest";

import { MAX_UPLOAD_BYTES } from "@/lib/schemas/upload";
import {
  PART_ASSET_KINDS,
  ASSET_KIND_CONFIG,
  extOf,
  isExtAllowed,
  createPartAssetUploadUrlSchema,
  shouldDemoteAsset,
} from "@/lib/schemas/part-asset";

// A realistically-shaped cuid (z.cuid()) used for the valid-case partId.
const VALID_CUID = "cmpxnfjkl0001a8uvokhe4vlh";
const FIVE_MB = 5 * 1024 * 1024;

describe("ASSET_KIND_CONFIG", () => {
  it("covers exactly the three kinds", () => {
    expect(PART_ASSET_KINDS).toEqual(["SYMBOL", "FOOTPRINT", "MODEL_3D"]);
    expect(Object.keys(ASSET_KIND_CONFIG).sort()).toEqual(
      ["FOOTPRINT", "MODEL_3D", "SYMBOL"],
    );
  });

  it("SYMBOL: [.kicad_sym] + text/plain + 5 MB cap", () => {
    const cfg = ASSET_KIND_CONFIG.SYMBOL;
    expect(cfg.exts).toEqual([".kicad_sym"]);
    expect(cfg.contentType).toBe("text/plain");
    expect(cfg.maxBytes).toBe(FIVE_MB);
  });

  it("FOOTPRINT: [.kicad_mod] + text/plain + 5 MB cap", () => {
    const cfg = ASSET_KIND_CONFIG.FOOTPRINT;
    expect(cfg.exts).toEqual([".kicad_mod"]);
    expect(cfg.contentType).toBe("text/plain");
    expect(cfg.maxBytes).toBe(FIVE_MB);
  });

  it("MODEL_3D: .step/.stp/.wrl + application/octet-stream + MAX_UPLOAD_BYTES cap", () => {
    const cfg = ASSET_KIND_CONFIG.MODEL_3D;
    expect(cfg.exts).toEqual([".step", ".stp", ".wrl"]);
    expect(cfg.exts).toContain(".step");
    expect(cfg.exts).toContain(".stp");
    expect(cfg.exts).toContain(".wrl");
    expect(cfg.contentType).toBe("application/octet-stream");
    expect(cfg.maxBytes).toBe(MAX_UPLOAD_BYTES);
  });
});

describe("extOf", () => {
  it("lowercases the extension incl. the dot", () => {
    expect(extOf("ESP32.STEP")).toBe(".step");
    expect(extOf("Sym.KiCad_Sym")).toBe(".kicad_sym");
  });

  it("returns the last extension for a multi-dot name", () => {
    expect(extOf("foo.bar.STP")).toBe(".stp");
  });

  it("returns '' when there is no dot", () => {
    expect(extOf("noextension")).toBe("");
  });
});

describe("isExtAllowed", () => {
  it("matches per kind, case-insensitively", () => {
    expect(isExtAllowed("SYMBOL", "x.kicad_sym")).toBe(true);
    expect(isExtAllowed("SYMBOL", "X.KICAD_SYM")).toBe(true);
    expect(isExtAllowed("SYMBOL", "x.png")).toBe(false);
    expect(isExtAllowed("MODEL_3D", "ESP32.STEP")).toBe(true);
    expect(isExtAllowed("MODEL_3D", "x.kicad_sym")).toBe(false);
  });
});

describe("createPartAssetUploadUrlSchema", () => {
  it("rejects a wrong extension for SYMBOL (.png)", () => {
    const r = createPartAssetUploadUrlSchema.safeParse({
      partId: VALID_CUID,
      kind: "SYMBOL",
      filename: "x.png",
      byteSize: 1024,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes("filename"))).toBe(true);
    }
  });

  it("rejects a SYMBOL extension for MODEL_3D (.kicad_sym)", () => {
    const r = createPartAssetUploadUrlSchema.safeParse({
      partId: VALID_CUID,
      kind: "MODEL_3D",
      filename: "x.kicad_sym",
      byteSize: 1024,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes("filename"))).toBe(true);
    }
  });

  it("rejects a byteSize over the kind cap (6 MB SYMBOL)", () => {
    const r = createPartAssetUploadUrlSchema.safeParse({
      partId: VALID_CUID,
      kind: "SYMBOL",
      filename: "x.kicad_sym",
      byteSize: 6 * 1024 * 1024,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes("byteSize"))).toBe(true);
    }
  });

  it("accepts a correct case-insensitive MODEL_3D upload", () => {
    const r = createPartAssetUploadUrlSchema.safeParse({
      partId: VALID_CUID,
      kind: "MODEL_3D",
      filename: "ESP32.STEP",
      byteSize: 2 * 1024 * 1024,
    });
    expect(r.success).toBe(true);
  });

  it("accepts a 5 MB SYMBOL at the cap boundary", () => {
    const r = createPartAssetUploadUrlSchema.safeParse({
      partId: VALID_CUID,
      kind: "SYMBOL",
      filename: "ap2112.kicad_sym",
      byteSize: FIVE_MB,
    });
    expect(r.success).toBe(true);
  });

  it("rejects a non-cuid partId", () => {
    const r = createPartAssetUploadUrlSchema.safeParse({
      partId: "not-a-cuid",
      kind: "MODEL_3D",
      filename: "x.step",
      byteSize: 1024,
    });
    expect(r.success).toBe(false);
  });
});

describe("shouldDemoteAsset", () => {
  it("returns true when ref changes", () => {
    expect(
      shouldDemoteAsset({ ref: "AP2112", source: "SnapEDA" }, { ref: "AP2112K", source: "SnapEDA" }),
    ).toBe(true);
  });

  it("returns true when source changes", () => {
    expect(
      shouldDemoteAsset({ ref: "AP2112", source: "SnapEDA" }, { ref: "AP2112", source: "SamacSys" }),
    ).toBe(true);
  });

  it("returns false for a license-only change (license is not an argument)", () => {
    // license is NOT passed to shouldDemoteAsset; ref+source unchanged ⇒ no demote.
    expect(
      shouldDemoteAsset({ ref: "AP2112", source: "SnapEDA" }, { ref: "AP2112", source: "SnapEDA" }),
    ).toBe(false);
  });

  it("returns false for an identical no-op", () => {
    expect(
      shouldDemoteAsset({ ref: "AP2112", source: "SnapEDA" }, { ref: "AP2112", source: "SnapEDA" }),
    ).toBe(false);
  });

  it("treats null / undefined / '' as equivalent (no demote)", () => {
    expect(shouldDemoteAsset({ ref: null, source: null }, {})).toBe(false);
    expect(shouldDemoteAsset({ ref: null, source: null }, { ref: "", source: "" })).toBe(false);
    expect(shouldDemoteAsset({ ref: "", source: "" }, { ref: null, source: null })).toBe(false);
  });

  it("demotes when going from a value to null/empty", () => {
    expect(shouldDemoteAsset({ ref: "AP2112", source: null }, { ref: null, source: null })).toBe(true);
    expect(shouldDemoteAsset({ ref: null, source: "SnapEDA" }, { ref: null, source: "" })).toBe(true);
  });
});
