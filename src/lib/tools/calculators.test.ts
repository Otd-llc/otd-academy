import { describe, expect, it } from "vitest";
import {
  lipoRuntimeHours,
  ws2812SupplyMilliamps,
  ws2812RecommendedSupplyAmps,
  formatRuntime,
  WS2812_FULL_WHITE_MA,
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
