import { describe, it, expect } from "vitest";
import {
  centralRowY,
  depthVanishingPoint,
  HEX_CAM_R13I,
  HEX_CAM_T3,
  HEX_CAM_T3_MIRROR,
  paintOrder,
  prismSides,
  resolveAnchor,
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
    const s = projectComb(boxes, HEX_CAM_T3);
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
    const s = projectComb(boxes, HEX_CAM_T3);
    expect(Math.abs(rightEdgeAngle(s, 0) - rightEdgeAngle(s, 2))).toBeGreaterThan(0.01);
  });

  it("leaves verticals parallel when the pitch is zero — the two-point control", () => {
    const s = projectComb(boxes, { ...HEX_CAM_T3, pitch: 0 });
    expect(rightEdgeAngle(s, 0)).toBeCloseTo(rightEdgeAngle(s, 2), 6);
  });

  it("never lets a label's fit exceed the face's own scale", () => {
    // The whole point of `fit`: a trapezoidal face cannot take the widest span as a
    // uniform scale, or the title pushes out over the narrow side.
    for (const s of projectComb(boxes, HEX_CAM_T3)) {
      expect(s.fit).toBeLessThanOrEqual(s.scale + 1e-9);
      expect(s.fit).toBeGreaterThan(0);
    }
  });

  it("foreshortens: cells stop being congruent once the plane is turned", () => {
    const s = projectComb(boxes, HEX_CAM_T3);
    const scales = s.map((x) => x.scale);
    expect(Math.max(...scales) - Math.min(...scales)).toBeGreaterThan(0.05);
  });

  it("is SCALE INVARIANT — the same comb twice the size projects similarly", () => {
    const a = projectComb(layout(8, 3, 150), HEX_CAM_T3);
    const b = projectComb(layout(8, 3, 300), HEX_CAM_T3);
    // Same relative sizes cell for cell, so a phone comb is the same camera as a
    // desktop one rather than a wider-angle lens.
    a.forEach((s, i) => expect(s.scale).toBeCloseTo(b[i]!.scale, 6));
  });

  it("sends the LEFT end away under T3, and the RIGHT end away when mirrored", () => {
    // This is the whole reason the mirror exists: the go-further comb's flagship
    // sits at the left, and under T3 the left end is the far one, so the most
    // important destination would render smallest.
    const t3 = projectComb(boxes, HEX_CAM_T3);
    const mirrored = projectComb(boxes, HEX_CAM_T3_MIRROR);
    expect(t3[2]!.scale).toBeGreaterThan(t3[0]!.scale); // cell 2 right, cell 0 left
    expect(mirrored[0]!.scale).toBeGreaterThan(mirrored[2]!.scale);
  });

  it("keeps the horizon on the central row: a cell there barely moves vertically", () => {
    const b = layout(9, 3); // 3 rows, middle row is the horizon
    const s = projectComb(b, { ...HEX_CAM_T3, yaw: 0 });
    // With no yaw, a middle-row cell's centre projects to y ≈ 0 (the horizon).
    expect(Math.abs(s[4]!.centre[1])).toBeLessThan(Math.abs(s[1]!.centre[1]));
  });

  it("handles an empty layout", () => {
    expect(projectComb([], HEX_CAM_T3)).toEqual([]);
  });

  it("anchoring on a cell puts THAT cell on the vanishing point", () => {
    // The anchor is the point that maps to the projection origin, so the anchored
    // cell sits at the vanishing point: its own prism shows no depth and everything
    // else aims at it.
    const last = boxes.length - 1;
    const s = projectComb(boxes, { ...HEX_CAM_T3, anchor: last });
    expect(Math.abs(s[last]!.centre[0])).toBeLessThan(1e-6);
    expect(Math.abs(s[last]!.centre[1])).toBeLessThan(1e-6);
  });

  it("anchorAxis 'x' shifts the convergence sideways but keeps the horizon level", () => {
    const last = boxes.length - 1;
    const both = projectComb(boxes, { ...HEX_CAM_T3, anchor: last });
    const xOnly = projectComb(boxes, { ...HEX_CAM_T3, anchor: last, anchorAxis: "x" });
    // Same horizontal anchor …
    expect(xOnly[last]!.centre[0]).toBeCloseTo(both[last]!.centre[0], 6);
    // … but the horizon stays on the central row, so the cell is off it vertically.
    expect(Math.abs(xOnly[last]!.centre[1])).toBeGreaterThan(1);
  });

  it("resolves the 'last' rule against the comb's length, at any length", () => {
    // The point of the rule: five hexes anchors on the fifth, fifty on the fiftieth,
    // with no caller arithmetic that can go stale when the comb changes length.
    for (const n of [1, 2, 5, 8, 22, 50]) {
      expect(resolveAnchor("last", n)).toBe(n - 1);
      const s = projectComb(layout(n, 3), { ...HEX_CAM_T3, anchor: "last" });
      expect(Math.abs(s[n - 1]!.centre[0])).toBeLessThan(1e-6);
      expect(Math.abs(s[n - 1]!.centre[1])).toBeLessThan(1e-6);
    }
  });

  it("resolves 'first' the same way, and leaves an explicit index alone", () => {
    expect(resolveAnchor("first", 50)).toBe(0);
    expect(resolveAnchor(3, 50)).toBe(3);
    expect(resolveAnchor(undefined, 50)).toBeUndefined();
    expect(resolveAnchor("last", 0)).toBeUndefined();
  });

  it("stays finite and bounded on a LONG comb, where the plane would cross the lens", () => {
    // 50 cells is ~17 rows. Rotated, its far corners swing past a camera distance
    // fixed in cell widths, `dist + Z` reaches zero, and the near cells render
    // enormous. The distance has to open up to hold them all in front of the lens.
    for (const n of [22, 50, 120]) {
      const s = projectComb(layout(n, 3), { ...HEX_CAM_T3, anchor: "last" });
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
    const eight = projectComb(boxes, HEX_CAM_T3);
    expect(eight[0]!.scale).toBeGreaterThan(0.5);
    expect(eight[0]!.scale).toBeLessThan(2);
  });

  it("VANISHES into the last cell: sizes fall monotonically along the run", () => {
    for (const n of [5, 8, 22, 50]) {
      const s = projectComb(layout(n, 3), { ...HEX_CAM_T3, vanish: { at: "last" } });
      for (let i = 1; i < n; i++) expect(s[i]!.scale).toBeLessThan(s[i - 1]!.scale);
      // first cell full size, last one at the vanishing point
      expect(s[0]!.scale).toBeCloseTo(1, 6);
      expect(s[n - 1]!.scale).toBeCloseTo(0.1, 6);
    }
  });

  it("puts the last cell's size at finalScale at ANY length — the rule is count-independent", () => {
    // A fixed per-step ratio would collapse a 50-cell comb to nothing; the falloff is
    // derived from the comb's length instead, so five and fifty end up equally far.
    for (const n of [5, 50]) {
      const s = projectComb(layout(n, 3), {
        ...HEX_CAM_T3,
        vanish: { at: "last", finalScale: 0.2 },
      });
      expect(s[n - 1]!.scale).toBeCloseTo(0.2, 6);
    }
  });

  it("paints the far cells first, so nearer ones overlap them", () => {
    const s = paintOrder(projectComb(layout(8, 3), { ...HEX_CAM_T3, vanish: { at: "last" } }));
    expect(s[0]!.i).toBe(7); // furthest
    expect(s[s.length - 1]!.i).toBe(0); // nearest
  });

  it("keeps faces parallel to the picture plane, so nothing is skewed", () => {
    // A receding cell is a SMALLER cell, not a distorted one: every face stays a
    // similar copy of the hex, so labels shrink rather than shear.
    const s = projectComb(layout(8, 3), { ...HEX_CAM_T3, vanish: { at: "last" } });
    for (const cell of s) {
      const top = cell.face[1]![1] - cell.face[0]![1];
      const bottom = cell.face[2]![1] - cell.face[3]![1];
      expect(Math.abs(top + bottom)).toBeLessThan(1e-6);
      expect(cell.fit).toBeCloseTo(cell.scale, 9);
    }
  });

  it("vpOn puts the DEPTH vanishing point exactly on that cell, at any length", () => {
    for (const n of [5, 8, 22, 50]) {
      const b = layout(n, 3);
      const s = projectComb(b, { ...HEX_CAM_T3, vpOn: "last" });
      const vp = depthVanishingPoint(HEX_CAM_T3, b[0]!.w);
      expect(s[n - 1]!.centre[0]).toBeCloseTo(vp[0], 4);
      expect(s[n - 1]!.centre[1]).toBeCloseTo(vp[1], 4);
    }
  });

  it("makes every prism's depth edges point AT that cell — the actual claim", () => {
    // A prism edge runs face[k] → rear[k]. Extended, every one of them must pass
    // through the vanishing point, or the comb is not converging on the last hex.
    const b = layout(8, 3);
    const s = projectComb(b, { ...HEX_CAM_T3, vpOn: "last" });
    const [vx, vy] = depthVanishingPoint(HEX_CAM_T3, b[0]!.w);
    for (const cell of s.slice(0, -1)) {
      for (let k = 0; k < 6; k++) {
        const f0 = cell.face[k]!;
        const r0 = cell.rear[k]!;
        // cross product of (edge direction) and (direction to the VP) ≈ 0
        const ex = r0[0] - f0[0];
        const ey = r0[1] - f0[1];
        const vxd = vx - f0[0];
        const vyd = vy - f0[1];
        const cross = ex * vyd - ey * vxd;
        const norm = Math.hypot(ex, ey) * Math.hypot(vxd, vyd);
        expect(Math.abs(cross) / norm).toBeLessThan(1e-3);
      }
    }
  });

  it("collapses the target cell's own prism — a cell at the VP has no depth left", () => {
    const b = layout(8, 3);
    const s = projectComb(b, { ...HEX_CAM_T3, vpOn: "last" });
    const last = s[7]!;
    const drop = Math.hypot(last.rear[0]![0] - last.face[0]![0], last.rear[0]![1] - last.face[0]![1]);
    const other = s[0]!;
    const otherDrop = Math.hypot(other.rear[0]![0] - other.face[0]![0], other.rear[0]![1] - other.face[0]![1]);
    expect(drop).toBeLessThan(otherDrop * 0.25);
  });

  it("stays THREE-point: rows and columns keep their own vanishing points", () => {
    // vpOn moves the comb, not the camera, so the other two axes are untouched.
    const b = layout(8, 3);
    const s = projectComb(b, { ...HEX_CAM_T3, vpOn: "last" });
    const angle = (k: number) => {
      const p = s[k]!.face[1]!;
      const q = s[k]!.face[2]!;
      return Math.atan2(q[1] - p[1], q[0] - p[0]);
    };
    expect(Math.abs(angle(0) - angle(2))).toBeGreaterThan(0.005);
  });

  it("CURVE: the pole cell is square-on to the camera and undistorted", () => {
    // The point of the family: the cell you are standing in faces the camera dead on,
    // so it keeps its shape while everything else turns away from it.
    const b = layout(8, 3);
    for (const mode of ["cylinder", "sphere"] as const) {
      const s = projectComb(b, { ...HEX_CAM_T3, curve: { mode, radius: 3, at: 7 } });
      const pole = s[7]!;
      // top edge and bottom edge mirror each other → no shear, no foreshortening
      const top = pole.face[1]![1] - pole.face[0]![1];
      const bottom = pole.face[2]![1] - pole.face[3]![1];
      expect(Math.abs(top + bottom)).toBeLessThan(1e-6);
      // and it is the largest cell on screen
      expect(Math.max(...s.map((c) => c.scale))).toBeCloseTo(pole.scale, 6);
    }
  });

  it("CURVE: cells foreshorten more the further they sit from the pole", () => {
    const b = layout(8, 3);
    const s = projectComb(b, { ...HEX_CAM_T3, curve: { mode: "sphere", radius: 3, at: 0 } });
    const dist = (i: number) =>
      Math.hypot(b[i]!.left - b[0]!.left, b[i]!.top - b[0]!.top);
    const near = [...s].sort((p, q) => dist(p.i) - dist(q.i));
    expect(near[0]!.scale).toBeGreaterThan(near[near.length - 1]!.scale);
  });

  it("CURVE: the pole follows the active stage — move it and the comb re-faces", () => {
    const b = layout(8, 3);
    const atFirst = projectComb(b, { ...HEX_CAM_T3, curve: { mode: "sphere", radius: 3, at: 0 } });
    const atLast = projectComb(b, { ...HEX_CAM_T3, curve: { mode: "sphere", radius: 3, at: "last" } });
    expect(atFirst[0]!.scale).toBeGreaterThan(atFirst[7]!.scale);
    expect(atLast[7]!.scale).toBeGreaterThan(atLast[0]!.scale);
  });

  it("CURVE: a large radius flattens back toward no curvature at all", () => {
    const b = layout(8, 3);
    const tight = projectComb(b, { ...HEX_CAM_T3, curve: { mode: "sphere", radius: 2, at: 3 } });
    const loose = projectComb(b, { ...HEX_CAM_T3, curve: { mode: "sphere", radius: 40, at: 3 } });
    const spread = (s: typeof tight) =>
      Math.max(...s.map((c) => c.scale)) - Math.min(...s.map((c) => c.scale));
    expect(spread(tight)).toBeGreaterThan(spread(loose) * 3);
  });

  it("R13i: the shipped camera keeps every cell legible while bowing the comb", () => {
    // The pick is the GENTLE end of the curve range on purpose: tighter barrels show
    // more prism but turn the outer cells past the angle their labels survive.
    const b = layout(8, 3);
    const s = projectComb(b, { ...HEX_CAM_R13I, curve: { ...HEX_CAM_R13I.curve!, at: 3 } });
    const pole = s[3]!;
    const top = pole.face[1]![1] - pole.face[0]![1];
    const bottom = pole.face[2]![1] - pole.face[3]![1];
    expect(Math.abs(top + bottom)).toBeLessThan(1e-6); // square-on, no shear
    // Measured floor on an 8-cell, 3-up comb is 0.70: the furthest corner cell keeps
    // seven tenths of its size, so its title and chip stay readable. Pinned as a
    // regression guard — tightening the radius is what would push this under.
    const floor = Math.min(...s.map((c) => c.scale));
    expect(floor).toBeCloseTo(0.7, 2);
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

  it("leaves the default comb unanchored — the neutral centre", () => {
    const plain = projectComb(boxes, HEX_CAM_T3);
    const anchored = projectComb(boxes, { ...HEX_CAM_T3, anchor: 0 });
    expect(plain[0]!.centre).not.toEqual(anchored[0]!.centre);
  });
});

describe("paintOrder + prismSides", () => {
  const solids = projectComb(layout(8, 3), HEX_CAM_T3);

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
    const solids = projectComb(layout(8, 3), HEX_CAM_T3);
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
