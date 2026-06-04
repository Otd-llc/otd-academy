import { describe, expect, test } from "vitest";
import { boundsFromPositions } from "@/lib/model-bounds";

describe("boundsFromPositions", () => {
  test("unit cube → center origin, radius = half the space diagonal", () => {
    const cube = [-1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1, -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1];
    const b = boundsFromPositions(cube);
    expect(b.center).toEqual([0, 0, 0]);
    expect(b.radius).toBeCloseTo(Math.sqrt(12) / 2, 5);
  });
  test("empty → unit fallback", () => {
    expect(boundsFromPositions([])).toEqual({ center: [0, 0, 0], radius: 1 });
  });
});
