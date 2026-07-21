import { describe, it, expect } from "vitest";
import {
  centralRowY,
  HEX_CAM_S5,
  paintOrder,
  prismSides,
  projectComb,
  sceneBox,
  type HexBox,
  type HexCam,
} from "./hex-perspective";

const deg = (d: number) => (d * Math.PI) / 180;

/** A snaking layout like `computeLayout` produces: `perRow` across, rows overlapping
 *  by a quarter hex, alternate rows offset by half a cell. */
function layout(count: number, perRow: number, w = 200): HexBox[] {
  const h = w * 1.1547;
  const vstep = h * 0.75;
  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / perRow);
    const pos = i % perRow;
    const col = row % 2 === 0 ? pos : perRow - 1 - pos;
    return { left: col * w + (row % 2 ? w / 2 : 0), top: row * vstep, w, h };
  });
}

describe("centralRowY — the horizon rule", () => {
  it("uses the middle row's centre line when the row count is odd", () => {
    const b = layout(8, 3); // 3 rows: 3 + 3 + 2
    const h = b[0]!.h;
    const middleTop = b[3]!.top; // first cell of row 1
    expect(centralRowY(b)).toBeCloseTo(middleTop + h / 2, 6);
  });

  it("sits between the middle pair when the row count is even", () => {
    const b = layout(8, 2); // 4 rows
    const h = b[0]!.h;
    const rowTops = [...new Set(b.map((x) => x.top))].sort((p, q) => p - q);
    const expected = (rowTops[1]! + h / 2 + (rowTops[2]! + h / 2)) / 2;
    expect(centralRowY(b)).toBeCloseTo(expected, 6);
  });

  it("uses the row itself when there is only one — the go-further comb's case", () => {
    const b = layout(4, 4);
    expect(centralRowY(b)).toBeCloseTo(b[0]!.top + b[0]!.h / 2, 6);
  });

  it("survives an empty layout", () => {
    expect(centralRowY([])).toBe(0);
  });
});

describe("projectComb — three-point projection", () => {
  const boxes = layout(8, 3);

  it("returns one solid per cell, each with a six-corner near and far face", () => {
    const s = projectComb(boxes, HEX_CAM_S5);
    expect(s).toHaveLength(8);
    expect(s[0]!.face).toHaveLength(6);
    expect(s[0]!.rear).toHaveLength(6);
  });

  // The hex's own vertical edges are corner 1→2 on the right and 5→4 on the left.
  // Cells 0 and 6 are BOTH in the left column, so their right edges are segments of
  // one 3D line and project to the same angle no matter what the camera does — the
  // pair has to differ in x, not just in y.
  const rightEdgeAngle = (s: ReturnType<typeof projectComb>, k: number) => {
    const p = s[k]!.face[1]!;
    const q = s[k]!.face[2]!;
    return Math.atan2(q[1] - p[1], q[0] - p[0]);
  };

  it("converges the VERTICALS, which is what makes it three-point and not two", () => {
    const s = projectComb(boxes, HEX_CAM_S5);
    expect(Math.abs(rightEdgeAngle(s, 0) - rightEdgeAngle(s, 2))).toBeGreaterThan(0.01);
  });

  it("leaves verticals parallel when the pitch is zero — the two-point control", () => {
    const s = projectComb(boxes, { ...HEX_CAM_S5, pitch: 0 });
    expect(rightEdgeAngle(s, 0)).toBeCloseTo(rightEdgeAngle(s, 2), 6);
  });

  it("never lets a label's fit exceed the face's own scale", () => {
    // The whole point of `fit`: a trapezoidal face cannot take the widest span as a
    // uniform scale, or the title pushes out over the narrow side.
    for (const s of projectComb(boxes, HEX_CAM_S5)) {
      expect(s.fit).toBeLessThanOrEqual(s.scale + 1e-9);
      expect(s.fit).toBeGreaterThan(0);
    }
  });

  it("foreshortens: cells stop being congruent once the plane is turned", () => {
    const s = projectComb(boxes, HEX_CAM_S5);
    const scales = s.map((x) => x.scale);
    expect(Math.max(...scales) - Math.min(...scales)).toBeGreaterThan(0.05);
  });

  it("is SCALE INVARIANT — the same comb twice the size projects similarly", () => {
    const a = projectComb(layout(8, 3, 150), HEX_CAM_S5);
    const b = projectComb(layout(8, 3, 300), HEX_CAM_S5);
    // Same relative sizes cell for cell, so a phone comb is the same camera as a
    // desktop one rather than a wider-angle lens.
    a.forEach((s, i) => expect(s.scale).toBeCloseTo(b[i]!.scale, 6));
  });

  it("keeps the horizon on the central row: a cell there barely moves vertically", () => {
    const b = layout(9, 3); // 3 rows, middle row is the horizon
    const s = projectComb(b, { ...HEX_CAM_S5, yaw: 0 });
    // With no yaw, a middle-row cell's centre projects to y ≈ 0 (the horizon).
    expect(Math.abs(s[4]!.centre[1])).toBeLessThan(Math.abs(s[1]!.centre[1]));
  });

  it("handles an empty layout", () => {
    expect(projectComb([], HEX_CAM_S5)).toEqual([]);
  });

  it("stays finite and bounded on a LONG comb, where the plane would cross the lens", () => {
    // 50 cells is ~17 rows. Rotated, its far corners swing past a camera distance
    // fixed in cell widths, `dist + Z` reaches zero, and the near cells render
    // enormous. The distance has to open up to hold them all in front of the lens.
    for (const n of [22, 50, 120]) {
      const s = projectComb(layout(n, 3), HEX_CAM_S5);
      const scales = s.map((x) => x.scale);
      expect(scales.every(Number.isFinite)).toBe(true);
      expect(Math.max(...scales)).toBeLessThan(4);
      expect(Math.min(...scales)).toBeGreaterThan(0);
      // and the whole comb still fits a sane box
      const vb = sceneBox(s);
      expect(Number.isFinite(vb.w) && Number.isFinite(vb.h)).toBe(true);
    }
  });

  it("leaves a short comb's camera exactly as tuned", () => {
    // The long-comb guard must not perturb the approved look on real comb lengths.
    const eight = projectComb(boxes, HEX_CAM_S5);
    expect(eight[0]!.scale).toBeGreaterThan(0.5);
    expect(eight[0]!.scale).toBeLessThan(2);
  });

  it("castSkew makes the slab VISIBLE under a near-head-on camera", () => {
    // Without a skew, a nearly head-on prism extrudes toward the viewer and shows no
    // walls: the rear face lands almost exactly on the near one. This is the whole
    // reason a gentle three-point comb rendered flat.
    const b = layout(8, 3);
    const headOn: HexCam = { yaw: deg(4), pitch: deg(-3), f: 9, dist: 9, depth: 0.075 };
    const plain = projectComb(b, headOn);
    const skewed = projectComb(b, { ...headOn, castSkew: [0.9, 0.9] });
    const offset = (s: ReturnType<typeof projectComb>[number]) =>
      Math.hypot(s.rear[0]![0] - s.face[0]![0], s.rear[0]![1] - s.face[0]![1]);
    // Measured: straight back leaves a 2% sliver, the skew casts over 6% of a cell —
    // the difference between a slab you cannot see and the shipped comb's visible one.
    expect(offset(plain[0]!) / b[0]!.w).toBeCloseTo(0.02, 2);
    expect(offset(skewed[0]!) / b[0]!.w).toBeGreaterThan(0.06);
    expect(offset(skewed[0]!)).toBeGreaterThan(offset(plain[0]!) * 3);
  });

  it("castSkew leans the cast DOWN-RIGHT, like the comb that ships", () => {
    const b = layout(8, 3);
    const s = projectComb(b, {
      yaw: deg(4),
      pitch: deg(-3),
      f: 9,
      dist: 9,
      depth: 0.075,
      castSkew: [0.9, 0.9],
    });
    const dx = s[0]!.rear[0]![0] - s[0]!.face[0]![0];
    const dy = s[0]!.rear[0]![1] - s[0]!.face[0]![1];
    expect(dx).toBeGreaterThan(0); // right
    expect(dy).toBeGreaterThan(0); // down
  });

  it("skewed casts CONVERGE rather than staying parallel — the point of the exercise", () => {
    // A parallel offset (what ships) gives every cell an identical cast. A skewed cast
    // is a real direction in the scene, so perspective aims them all at one point and
    // cells on opposite sides of the comb lean measurably differently.
    const b = layout(8, 3);
    const s = projectComb(b, {
      yaw: 0,
      pitch: 0,
      f: 4,
      dist: 4,
      depth: 0.1,
      castSkew: [0.9, 0.9],
    });
    const ang = (k: number) =>
      Math.atan2(s[k]!.rear[0]![1] - s[k]!.face[0]![1], s[k]!.rear[0]![0] - s[k]!.face[0]![0]);
    expect(Math.abs(ang(0) - ang(2))).toBeGreaterThan(0.02);
  });

});

describe("paintOrder + prismSides", () => {
  const solids = projectComb(layout(8, 3), HEX_CAM_S5);

  it("paints far cells before near ones, so a near prism covers a far face", () => {
    const z = paintOrder(solids).map((s) => s.z);
    for (let i = 1; i < z.length; i++) expect(z[i]!).toBeLessThanOrEqual(z[i - 1]!);
  });

  it("emits six side faces, each a quad joining a near edge to its far one", () => {
    const sides = prismSides(solids[0]!);
    expect(sides).toHaveLength(6);
    sides.forEach((q) => expect(q).toHaveLength(4));
    expect(sides[0]![0]).toEqual(solids[0]!.face[0]);
    expect(sides[0]![3]).toEqual(solids[0]!.rear[0]);
  });
});

describe("sceneBox", () => {
  it("contains every projected point of every prism", () => {
    const solids = projectComb(layout(8, 3), HEX_CAM_S5);
    const vb = sceneBox(solids);
    for (const s of solids) {
      for (const [x, y] of [...s.face, ...s.rear]) {
        expect(x).toBeGreaterThanOrEqual(vb.x);
        expect(y).toBeGreaterThanOrEqual(vb.y);
        expect(x).toBeLessThanOrEqual(vb.x + vb.w);
        expect(y).toBeLessThanOrEqual(vb.y + vb.h);
      }
    }
  });
});
