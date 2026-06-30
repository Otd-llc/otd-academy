import { describe, expect, it } from "vitest";
import {
  lipoRuntimeHours,
  ws2812SupplyMilliamps,
  ws2812RecommendedSupplyAmps,
  formatRuntime,
  WS2812_FULL_WHITE_MA,
  ledSeriesResistorOhms,
  ledResistorPowerMw,
  nextE24Up,
  voltageDividerOut,
  voltageDividerCurrentMa,
} from "@/lib/tools/calculators";

describe("lipoRuntimeHours", () => {
  it("computes ideal runtime as usable capacity over average draw", () => {
    // 2000 mAh at 100 mA average, 100% usable = 20 h
    expect(lipoRuntimeHours({ capacityMah: 2000, averageCurrentMa: 100, usablePct: 100 })).toBe(20);
  });

  it("applies the usable-capacity derating", () => {
    // 80% usable knocks 20 h down to 16 h
    expect(lipoRuntimeHours({ capacityMah: 2000, averageCurrentMa: 100, usablePct: 80 })).toBe(16);
  });

  it("throws on a non-positive average current (divide-by-zero guard)", () => {
    expect(() => lipoRuntimeHours({ capacityMah: 2000, averageCurrentMa: 0, usablePct: 80 })).toThrow();
    expect(() => lipoRuntimeHours({ capacityMah: 2000, averageCurrentMa: -5, usablePct: 80 })).toThrow();
  });

  it("throws on a non-positive capacity", () => {
    expect(() => lipoRuntimeHours({ capacityMah: 0, averageCurrentMa: 100, usablePct: 80 })).toThrow();
  });
});

describe("ws2812SupplyMilliamps", () => {
  it("sums per-pixel full-white draw plus controller overhead", () => {
    // 30 px * 60 mA + 0 controller = 1800 mA
    expect(ws2812SupplyMilliamps({ pixelCount: 30, perPixelMa: 60, controllerMa: 0 })).toBe(1800);
  });

  it("adds the controller overhead", () => {
    expect(ws2812SupplyMilliamps({ pixelCount: 30, perPixelMa: 60, controllerMa: 220 })).toBe(2020);
  });

  it("defaults the per-pixel draw to the WS2812 full-white max", () => {
    expect(WS2812_FULL_WHITE_MA).toBe(60);
    expect(ws2812SupplyMilliamps({ pixelCount: 10 })).toBe(600);
  });

  it("throws on a negative pixel count", () => {
    expect(() => ws2812SupplyMilliamps({ pixelCount: -1 })).toThrow();
  });
});

describe("ws2812RecommendedSupplyAmps", () => {
  it("adds a headroom margin and returns amps", () => {
    // 1800 mA + 20% = 2160 mA = 2.16 A
    expect(ws2812RecommendedSupplyAmps({ pixelCount: 30, perPixelMa: 60, controllerMa: 0 }, 20)).toBeCloseTo(2.16, 5);
  });

  it("defaults to a 20% headroom", () => {
    expect(ws2812RecommendedSupplyAmps({ pixelCount: 30 })).toBeCloseTo(2.16, 5);
  });
});

describe("formatRuntime", () => {
  it("renders whole and fractional hours as h/m", () => {
    expect(formatRuntime(20)).toBe("20 h 0 m");
    expect(formatRuntime(16.5)).toBe("16 h 30 m");
    expect(formatRuntime(0.25)).toBe("0 h 15 m");
  });
});

describe("ledSeriesResistorOhms", () => {
  it("is (Vsupply - Vf) / I — Ohm's law over the resistor", () => {
    // 3.3 V rail, red LED Vf 1.8 V, 5 mA → (3.3-1.8)/0.005 = 300 Ω
    expect(ledSeriesResistorOhms({ supplyV: 3.3, ledVf: 1.8, currentMa: 5 })).toBeCloseTo(300, 6);
    // 5 V, Vf 2.0, 20 mA → 3/0.02 = 150 Ω
    expect(ledSeriesResistorOhms({ supplyV: 5, ledVf: 2, currentMa: 20 })).toBeCloseTo(150, 6);
  });
  it("throws when the supply can't exceed the LED forward voltage", () => {
    expect(() => ledSeriesResistorOhms({ supplyV: 1.8, ledVf: 2.0, currentMa: 5 })).toThrow();
    expect(() => ledSeriesResistorOhms({ supplyV: 3.3, ledVf: 3.3, currentMa: 5 })).toThrow();
  });
  it("throws on non-positive current", () => {
    expect(() => ledSeriesResistorOhms({ supplyV: 5, ledVf: 2, currentMa: 0 })).toThrow();
  });
});

describe("ledResistorPowerMw", () => {
  it("is the voltage across the resistor times the current, in mW", () => {
    // (3.3-1.8) V × 5 mA = 7.5 mW
    expect(ledResistorPowerMw({ supplyV: 3.3, ledVf: 1.8, currentMa: 5 })).toBeCloseTo(7.5, 6);
    // (5-2) × 20 = 60 mW
    expect(ledResistorPowerMw({ supplyV: 5, ledVf: 2, currentMa: 20 })).toBeCloseTo(60, 6);
  });
});

describe("nextE24Up", () => {
  it("rounds up to the next E24 standard value (safe: a bit less current)", () => {
    expect(nextE24Up(300)).toBe(300); // exact E24
    expect(nextE24Up(290)).toBe(300);
    expect(nextE24Up(301)).toBe(330); // next E24 above 300 is 330
    expect(nextE24Up(150)).toBe(150);
    expect(nextE24Up(1234)).toBe(1300);
    expect(nextE24Up(47)).toBe(47);
  });
});

describe("voltageDividerOut", () => {
  it("is Vin * R2 / (R1 + R2)", () => {
    // 5 V, R1 10k, R2 20k → 5*20/30 = 3.333 V
    expect(voltageDividerOut({ vinV: 5, r1Ohms: 10000, r2Ohms: 20000 })).toBeCloseTo(3.3333, 4);
    // equal legs halve it
    expect(voltageDividerOut({ vinV: 3.3, r1Ohms: 1000, r2Ohms: 1000 })).toBeCloseTo(1.65, 6);
  });
  it("throws when both resistors are zero", () => {
    expect(() => voltageDividerOut({ vinV: 5, r1Ohms: 0, r2Ohms: 0 })).toThrow();
  });
});

describe("voltageDividerCurrentMa", () => {
  it("is Vin / (R1 + R2), in mA", () => {
    // 5 V / 30k = 0.1667 mA
    expect(voltageDividerCurrentMa({ vinV: 5, r1Ohms: 10000, r2Ohms: 20000 })).toBeCloseTo(0.16667, 4);
  });
});
