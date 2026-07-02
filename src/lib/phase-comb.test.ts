import { describe, it, expect } from "vitest";
import {
  COMB_HEX_W,
  COMB_HEX_H,
  COMB_DX,
  COMB_DY,
  combPositions,
  combViewBox,
  combNodeState,
  combGlyph,
} from "./phase-comb";

describe("combPositions — zig-zag comb layout", () => {
  it("advances x by one column step per hex", () => {
    const p = combPositions(8);
    expect(p).toHaveLength(8);
    expect(p[0]!.x).toBeCloseTo(0);
    expect(p[1]!.x).toBeCloseTo(COMB_DX);
    expect(p[7]!.x).toBeCloseTo(7 * COMB_DX);
  });

  it("alternates the row: even index up, odd index down", () => {
    const p = combPositions(8);
    expect(p[0]!.y).toBeCloseTo(0); // up row
    expect(p[1]!.y).toBeCloseTo(COMB_DY); // down row (SE of hex 0)
    expect(p[2]!.y).toBeCloseTo(0); // back up (NE of hex 1)
    expect(p[3]!.y).toBeCloseTo(COMB_DY);
  });

  it("handles the empty / single cases without blowing up", () => {
    expect(combPositions(0)).toEqual([]);
    expect(combPositions(1)).toEqual([{ x: 0, y: 0 }]);
  });
});

describe("combViewBox — intrinsic drawing box", () => {
  it("spans all columns plus one hex width, and two rows of half-height overlap", () => {
    const { w, h } = combViewBox(8);
    expect(w).toBeCloseTo(COMB_DX * 7 + COMB_HEX_W); // 300
    expect(h).toBeCloseTo(COMB_HEX_H + COMB_DY); // ~62.35
  });
});

describe("combNodeState — completion state → fill token", () => {
  it("maps complete and blocked straight through", () => {
    expect(combNodeState("complete")).toBe("complete");
    expect(combNodeState("blocked")).toBe("blocked");
  });

  it("treats the learner's in-progress (partial) stage as current", () => {
    expect(combNodeState("partial")).toBe("current");
  });

  it("treats untouched (and anything unknown) as pending", () => {
    expect(combNodeState("untouched")).toBe("pending");
    expect(combNodeState("something-else")).toBe("pending");
  });
});

describe("combGlyph — the hex face", () => {
  it("shows a check on complete cells", () => {
    expect(combGlyph("complete", 3)).toBe("✓");
  });

  it("shows a zero-padded 1-based number otherwise", () => {
    expect(combGlyph("current", 3)).toBe("04");
    expect(combGlyph("pending", 0)).toBe("01");
    expect(combGlyph("blocked", 4)).toBe("05");
  });
});
