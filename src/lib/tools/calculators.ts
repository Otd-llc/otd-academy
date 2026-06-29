// Pure, unit-testable math behind the public /tools EE calculators.
//
// Each function takes already-validated scalars and returns a number, with a
// guard that throws on physically meaningless input (zero/negative current or
// capacity) so the divide-by-zero never reaches the UI as `Infinity`/`NaN`. The
// client islands (src/components/tools/*) clamp their inputs and call these; the
// worked examples on the pages are computed from these same functions so the
// prose can never drift from the math.

// WS2812/NeoPixel full-white draw, per pixel, at 5 V. One pixel = three ~20 mA
// channels driven together, so ~60 mA is the datasheet worst case. Sourced from
// the XINGLIGHT XL-5050RGBC-WS2812B datasheet (LCSC C2843785) used on the OTD
// L1.03 board (docs/boards/l1-03-ws2812-node/design.md §3, "1× WS2812 full white
// = 60 mA max").
export const WS2812_FULL_WHITE_MA = 60;

export function lipoRuntimeHours(input: {
  capacityMah: number;
  averageCurrentMa: number;
  usablePct: number;
}): number {
  if (input.averageCurrentMa <= 0) {
    throw new Error("averageCurrentMa must be greater than 0");
  }
  if (input.capacityMah <= 0) {
    throw new Error("capacityMah must be greater than 0");
  }
  const usableMah = input.capacityMah * (input.usablePct / 100);
  return usableMah / input.averageCurrentMa;
}

export function ws2812SupplyMilliamps(input: {
  pixelCount: number;
  perPixelMa?: number;
  controllerMa?: number;
}): number {
  if (input.pixelCount < 0) {
    throw new Error("pixelCount must be 0 or greater");
  }
  const perPixel = input.perPixelMa ?? WS2812_FULL_WHITE_MA;
  const controller = input.controllerMa ?? 0;
  return input.pixelCount * perPixel + controller;
}

export function ws2812RecommendedSupplyAmps(
  input: { pixelCount: number; perPixelMa?: number; controllerMa?: number },
  headroomPct = 20,
): number {
  const milliamps = ws2812SupplyMilliamps(input);
  return (milliamps * (1 + headroomPct / 100)) / 1000;
}

// Render a duration in hours as "H h M m" (minutes floored). Used by the LiPo
// runtime island so the result reads in human units, not a raw decimal.
export function formatRuntime(hours: number): string {
  const whole = Math.floor(hours);
  const minutes = Math.floor((hours - whole) * 60);
  return `${whole} h ${minutes} m`;
}
