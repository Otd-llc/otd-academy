// Pure Zod-schema tests for the per-group `PartFact.data` validators
// (`src/lib/schemas/part-fact.ts`, design §3.3). No DB — these exercise the
// schemas directly, mirroring guide-schema.test.ts.
//
// Coverage per group: a valid `data` parses; the element-level
// `{ sourcePage?, sourceNote? }` anchor is accepted on a pin / curve / entry;
// the category required-key refinement rejects a missing label; DERATING
// enforces strictly-increasing x and requires conditions + yKind; PINOUT
// accepts `type:"strapping"` and `function` as both string and string[];
// NOTES reuses the guide content-block union; and `factDataSchema` routes each
// group (with the category passed through to PARAMETRICS) to the right schema.
import { describe, it, expect } from "vitest";

import {
  parametricEntry,
  parametricsSchema,
  parametricsFor,
  pinSchema,
  pinoutSchema,
  curveSchema,
  deratingSchema,
  powerSchema,
  mechanicalSchema,
  notesSchema,
  factDataSchema,
} from "@/lib/schemas/part-fact";

describe("parametrics", () => {
  it("accepts a valid entries array", () => {
    const r = parametricsSchema.safeParse({
      entries: [{ label: "capacitance", value: "10uF", unit: "F" }],
    });
    expect(r.success).toBe(true);
  });

  it("accepts an element-level {sourcePage, sourceNote} anchor on an entry", () => {
    const r = parametricEntry.safeParse({
      label: "Vout",
      value: "3.3",
      unit: "V",
      sourcePage: 4,
      sourceNote: "Table 1",
    });
    expect(r.success).toBe(true);
  });

  it("rejects an empty (whitespace-only) label or value", () => {
    expect(parametricEntry.safeParse({ label: "   ", value: "x" }).success).toBe(false);
    expect(parametricEntry.safeParse({ label: "x", value: "" }).success).toBe(false);
  });

  it("rejects a non-positive / non-integer sourcePage", () => {
    expect(parametricEntry.safeParse({ label: "x", value: "y", sourcePage: 0 }).success).toBe(false);
    expect(parametricEntry.safeParse({ label: "x", value: "y", sourcePage: 1.5 }).success).toBe(false);
  });
});

describe("parametricsFor (category required-keys)", () => {
  it("MLCC_CAPACITOR rejects entries missing 'capacitance'", () => {
    const schema = parametricsFor("MLCC_CAPACITOR");
    const r = schema.safeParse({
      entries: [
        { label: "voltage", value: "25", unit: "V" },
        { label: "dielectric", value: "X5R" },
      ],
    });
    expect(r.success).toBe(false);
  });

  it("MLCC_CAPACITOR accepts when all required labels present (case-insensitive)", () => {
    const schema = parametricsFor("MLCC_CAPACITOR");
    const r = schema.safeParse({
      entries: [
        { label: "Capacitance", value: "10uF" },
        { label: "VOLTAGE", value: "25", unit: "V" },
        { label: "Dielectric", value: "X5R" },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("LDO_REGULATOR requires vout/iout/dropout", () => {
    const schema = parametricsFor("LDO_REGULATOR");
    expect(
      schema.safeParse({
        entries: [
          { label: "vout", value: "3.3" },
          { label: "iout", value: "600mA" },
        ],
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        entries: [
          { label: "vout", value: "3.3" },
          { label: "iout", value: "600mA" },
          { label: "dropout", value: "250mV" },
        ],
      }).success,
    ).toBe(true);
  });

  it("a null category imposes no required-key constraint", () => {
    const schema = parametricsFor(null);
    expect(schema.safeParse({ entries: [] }).success).toBe(true);
  });

  it("a category with no required keys (PASSIVE_RESISTOR) imposes nothing", () => {
    const schema = parametricsFor("PASSIVE_RESISTOR");
    expect(schema.safeParse({ entries: [{ label: "resistance", value: "10k" }] }).success).toBe(true);
  });
});

describe("pinout", () => {
  it("accepts a single pin with function as a string", () => {
    const r = pinSchema.safeParse({ number: "1", name: "VCC", function: "power supply" });
    expect(r.success).toBe(true);
  });

  it("accepts function as a string[] and type 'strapping'", () => {
    const r = pinSchema.safeParse({
      number: "0",
      name: "IO0",
      function: ["boot strap", "GPIO"],
      type: "strapping",
    });
    expect(r.success).toBe(true);
  });

  it("accepts an element-level anchor on a pin", () => {
    const r = pinSchema.safeParse({
      number: "3",
      name: "EN",
      function: "enable",
      type: "io",
      sourcePage: 9,
      sourceNote: "Figure 3",
    });
    expect(r.success).toBe(true);
  });

  it("rejects an unknown pin type", () => {
    expect(
      pinSchema.safeParse({ number: "1", name: "X", function: "y", type: "magic" }).success,
    ).toBe(false);
  });

  it("requires at least one pin", () => {
    expect(pinoutSchema.safeParse({ pins: [] }).success).toBe(false);
    expect(
      pinoutSchema.safeParse({ pins: [{ number: "1", name: "VCC", function: "power" }] }).success,
    ).toBe(true);
  });
});

describe("derating", () => {
  const goodCurve = {
    kind: "dc-bias",
    xUnit: "V",
    yUnit: "%",
    yKind: "pct-delta-c",
    conditions: [{ label: "temperature", value: "25", unit: "C" }],
    points: [
      { x: 0, y: 0 },
      { x: 1.65, y: -20 },
      { x: 3.3, y: -55 },
    ],
  };

  it("accepts a valid curve with strictly-increasing x", () => {
    expect(curveSchema.safeParse(goodCurve).success).toBe(true);
    expect(deratingSchema.safeParse({ curves: [goodCurve] }).success).toBe(true);
  });

  it("accepts an element-level anchor on a curve", () => {
    expect(curveSchema.safeParse({ ...goodCurve, sourcePage: 7, sourceNote: "dc-bias curve" }).success).toBe(true);
  });

  it("rejects non-increasing points.x", () => {
    const bad = {
      ...goodCurve,
      points: [
        { x: 0, y: 0 },
        { x: 1, y: -10 },
        { x: 1, y: -20 }, // duplicate x — not strictly increasing
      ],
    };
    expect(curveSchema.safeParse(bad).success).toBe(false);

    const decreasing = {
      ...goodCurve,
      points: [
        { x: 0, y: 0 },
        { x: 2, y: -10 },
        { x: 1, y: -20 },
      ],
    };
    expect(curveSchema.safeParse(decreasing).success).toBe(false);
  });

  it("requires at least two points", () => {
    expect(curveSchema.safeParse({ ...goodCurve, points: [{ x: 0, y: 0 }] }).success).toBe(false);
  });

  it("requires conditions and yKind", () => {
    const { yKind: _omitY, ...noYKind } = goodCurve;
    expect(curveSchema.safeParse(noYKind).success).toBe(false);
    const { conditions: _omitC, ...noConditions } = goodCurve;
    expect(curveSchema.safeParse(noConditions).success).toBe(false);
  });

  it("rejects an unknown yKind or kind", () => {
    expect(curveSchema.safeParse({ ...goodCurve, yKind: "nope" }).success).toBe(false);
    expect(curveSchema.safeParse({ ...goodCurve, kind: "nope" }).success).toBe(false);
  });

  it("requires at least one curve", () => {
    expect(deratingSchema.safeParse({ curves: [] }).success).toBe(false);
  });
});

describe("power", () => {
  it("accepts bypass entries with an element anchor and optional rails/notes", () => {
    const r = powerSchema.safeParse({
      rails: [{ name: "3V3", voltage: "3.3" }],
      bypass: [{ value: "0.1uF", qty: 2, placement: "near VCC", sourcePage: 11 }],
      notes: "decoupling",
    });
    expect(r.success).toBe(true);
  });

  it("accepts bypass with no rails / notes", () => {
    expect(powerSchema.safeParse({ bypass: [{ value: "10uF", placement: "output" }] }).success).toBe(true);
  });

  it("rejects a missing bypass array", () => {
    expect(powerSchema.safeParse({ rails: [{ name: "3V3" }] }).success).toBe(false);
  });
});

describe("mechanical", () => {
  it("accepts entries plus optional footprint/mounting/shield/keepOut", () => {
    const r = mechanicalSchema.safeParse({
      entries: [{ label: "keep-out", value: "15mm", sourcePage: 2 }],
      footprintRef: "SMD-38",
      mountingType: "edge",
      shieldBonding: "GND",
      keepOut: "antenna 15mm",
    });
    expect(r.success).toBe(true);
  });

  it("accepts a bare entries array", () => {
    expect(mechanicalSchema.safeParse({ entries: [] }).success).toBe(true);
  });
});

describe("notes (reuses guide content blocks)", () => {
  it("accepts a valid contentBlocks array", () => {
    const r = notesSchema.safeParse({
      blocks: [
        { type: "prose", md: "Bypass close to the pin." },
        { type: "callout", severity: "warn", label: "Gotcha", body: "Mind ESR." },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("rejects an invalid block", () => {
    expect(notesSchema.safeParse({ blocks: [{ type: "nope" }] }).success).toBe(false);
  });
});

describe("factDataSchema dispatcher", () => {
  it("routes PARAMETRICS through the category required-keys", () => {
    const schema = factDataSchema("PARAMETRICS", "MLCC_CAPACITOR");
    expect(schema.safeParse({ entries: [{ label: "voltage", value: "25" }] }).success).toBe(false);
    expect(
      schema.safeParse({
        entries: [
          { label: "capacitance", value: "10uF" },
          { label: "voltage", value: "25" },
          { label: "dielectric", value: "X5R" },
        ],
      }).success,
    ).toBe(true);
  });

  it("routes PINOUT to the pinout schema", () => {
    const schema = factDataSchema("PINOUT", null);
    expect(schema.safeParse({ pins: [{ number: "1", name: "VCC", function: "power" }] }).success).toBe(true);
    expect(schema.safeParse({ entries: [] }).success).toBe(false);
  });

  it("routes DERATING to the derating schema", () => {
    const schema = factDataSchema("DERATING", null);
    expect(
      schema.safeParse({
        curves: [
          {
            kind: "temperature",
            xUnit: "C",
            yUnit: "%",
            yKind: "pct-delta-c",
            conditions: [{ label: "bias", value: "0" }],
            points: [
              { x: -55, y: -10 },
              { x: 25, y: 0 },
              { x: 85, y: -12 },
            ],
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("routes POWER, MECHANICAL, NOTES to their schemas", () => {
    expect(
      factDataSchema("POWER", null).safeParse({ bypass: [{ value: "0.1uF", placement: "VCC" }] }).success,
    ).toBe(true);
    expect(factDataSchema("MECHANICAL", null).safeParse({ entries: [] }).success).toBe(true);
    expect(
      factDataSchema("NOTES", null).safeParse({ blocks: [{ type: "prose", md: "x" }] }).success,
    ).toBe(true);
  });
});
