import { describe, it, expect } from "vitest";
import {
  COMB_HEX_W,
  COMB_HEX_H,
  COMB_DX,
  COMB_DY,
  COMB_HEX_CORNERS,
  COMB_PRISM_RATIO,
  combPositions,
  combViewBox,
  combNodeState,
  combGlyph,
  combVanishingPoint,
  combCellVp,
  combRearFace,
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

// The comb is drawn in ONE-POINT perspective (sandbox round "P1a", 2026-07-20):
// the hex faces stay parallel to the picture plane, so every face is the same size
// and every label stays undistorted, and only the prism's depth axis converges — on
// a single vanishing point at the centre of the run.
describe("combVanishingPoint — the single VP the depth axis converges on", () => {
  it("sits at the centre of the comb's drawing box", () => {
    const { w, h } = combViewBox(8);
    expect(combVanishingPoint(8)).toEqual({ x: w / 2, y: h / 2 });
  });

  it("stays at the centre for an odd stage count", () => {
    const { w, h } = combViewBox(9);
    expect(combVanishingPoint(9)).toEqual({ x: w / 2, y: h / 2 });
  });
});

describe("combRearFace — the prism's far face", () => {
  const N = 8;
  const V = combVanishingPoint(N);
  const origin = (i: number) => combPositions(N)[i]!;
  /** a local corner of hex `i` back in comb-wide coordinates */
  const world = (i: number, p: { x: number; y: number }) => ({
    x: p.x + origin(i).x,
    y: p.y + origin(i).y,
  });

  it("returns one point per hex corner, in the hex's own local box", () => {
    const rear = combRearFace(0, N);
    expect(rear).toHaveLength(COMB_HEX_CORNERS.length);
  });

  it("is the front face scaled toward the vanishing point by the prism ratio", () => {
    const rear = combRearFace(1, N);
    COMB_HEX_CORNERS.forEach((c, k) => {
      const f = world(1, { x: c[0], y: c[1] });
      const r = world(1, rear[k]!);
      expect(r.x).toBeCloseTo(V.x + (f.x - V.x) * COMB_PRISM_RATIO, 6);
      expect(r.y).toBeCloseTo(V.y + (f.y - V.y) * COMB_PRISM_RATIO, 6);
    });
  });

  it("casts INWARD: hexes left of the VP cast right, hexes right of it cast left", () => {
    // This is the whole difference from the oblique cast it replaces, and the
    // reason a left-to-right paint order cannot be correct — see PhaseComb.
    const left = combRearFace(0, N);
    const right = combRearFace(N - 1, N);
    expect(left[0]!.x).toBeGreaterThan(COMB_HEX_CORNERS[0]![0]);
    expect(right[0]!.x).toBeLessThan(COMB_HEX_CORNERS[0]![0]);
  });

  it("shrinks the face rather than translating it, so the prism reads as depth", () => {
    const rear = combRearFace(0, N);
    const frontW = COMB_HEX_CORNERS[3]![0] - COMB_HEX_CORNERS[0]![0];
    const rearW = rear[3]!.x - rear[0]!.x;
    expect(rearW).toBeCloseTo(frontW * COMB_PRISM_RATIO, 6);
  });

  it("keeps every rear corner inside the comb's drawing box, so the layout needs no cast padding", () => {
    const { w, h } = combViewBox(N);
    for (let i = 0; i < N; i++) {
      for (const p of combRearFace(i, N)) {
        const q = world(i, p);
        expect(q.x).toBeGreaterThanOrEqual(0);
        expect(q.x).toBeLessThanOrEqual(w);
        expect(q.y).toBeGreaterThanOrEqual(0);
        expect(q.y).toBeLessThanOrEqual(h);
      }
    }
  });

  it("gives the hex nearest the VP the least visible depth", () => {
    const drop = (i: number) => {
      const rear = combRearFace(i, N);
      return Math.hypot(rear[0]!.x - COMB_HEX_CORNERS[0]![0], rear[0]!.y - COMB_HEX_CORNERS[0]![1]);
    };
    // hexes 3 and 4 straddle the centre; 0 and 7 are the far ends
    expect(drop(3)).toBeLessThan(drop(0));
    expect(drop(4)).toBeLessThan(drop(7));
  });
});

describe("combCellVp — the VP expressed in one hex's local box", () => {
  it("is the comb-wide VP minus that hex's origin", () => {
    const V = combVanishingPoint(8);
    const o = combPositions(8)[5]!;
    expect(combCellVp(5, 8)).toEqual({ x: V.x - o.x, y: V.y - o.y });
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
