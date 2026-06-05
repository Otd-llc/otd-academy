// Tests for the create-part schema's KiCad lib-id validation (Phase C).
import { describe, it, expect } from "vitest";

import { kicadLibId, createPartSchema } from "@/lib/schemas/part";

describe("kicadLibId", () => {
  it("accepts well-formed Lib:Name lib-ids", () => {
    for (const v of [
      "Device:R",
      "Resistor_SMD:R_0805_2012Metric",
      "MCU_Module:ESP32-S3-WROOM-1",
      "Regulator_Linear:AP2112K-3.3",
    ]) {
      expect(kicadLibId.safeParse(v).success).toBe(true);
    }
  });

  it("rejects a missing colon, empty halves, extra colons, or whitespace", () => {
    for (const v of ["Device", "Device:", ":R", "", "a:b:c", "Device R"]) {
      expect(kicadLibId.safeParse(v).success).toBe(false);
    }
  });
});

describe("createPartSchema KiCad fields", () => {
  const base = { manufacturer: "ACME", mpn: "X1", description: "thing" };

  it("accepts optional kicadSymbol/kicadFootprint lib-ids", () => {
    expect(
      createPartSchema.safeParse({
        ...base,
        kicadSymbol: "Device:R",
        kicadFootprint: "Resistor_SMD:R_0805_2012Metric",
      }).success,
    ).toBe(true);
  });

  it("rejects a malformed kicadSymbol", () => {
    expect(
      createPartSchema.safeParse({ ...base, kicadSymbol: "Device" }).success,
    ).toBe(false);
  });

  it("omitting the KiCad fields is fine", () => {
    expect(createPartSchema.safeParse(base).success).toBe(true);
  });
});
