// Freeze the go-further ribbon's numbers, and freeze the COLLAPSE.
//
// The failures these guard against are all ones that already happened, either in the
// sandbox rounds or in the spine that shipped before it: a laced run that kept lacing
// past the point its titles could be read, a cap-bound run that was centred in its
// column but projected about the column's centre and therefore cast sideways, a slab
// aimed into the neighbour that overlaps it so the prism vanished into a hairline, and
// a camera stated as focal+depth that drew a different slab at every count.
//
// The last one is subtle enough to have cost a debugging round on the spine and is
// repeated here on purpose: the far-end cast is the cast at the corner FARTHEST from
// the vanishing point, so a test must FIND that corner before it measures anything.
// Measuring the cast at a corner you picked for another reason tests nothing.

import { describe, expect, it } from "vitest";
import {
  chooseAxis,
  combUnits,
  COMB_VP,
  FLAT_CORNERS,
  FLAT_RATIO,
  layoutComb,
  POINTY_CORNERS,
  POINTY_RATIO,
  projectComb,
  RIBBON_CAST,
  RIBBON_MAX_CELL,
  RIBBON_MIN_CELL,
  type RibbonLayout,
} from "@/lib/comb-ribbon";
import {
  layoutUnits,
  placeSpine,
  projectSpine,
  SPINE_RATIO,
  SPINE_UNIT_CORNERS,
} from "@/lib/comb-spine";

/** the real brief: four destinations at the foot of /courses. */
const N = 4;
/** four laced hexes are 3.25 cells across, so this is exactly the collapse threshold. */
const FLOOR_W = 3.25 * RIBBON_MIN_CELL;

/** The vanishing point a layout is actually projected about: a fraction of the RUN's
 *  own box, which starts at the leftmost box, not at the container's origin. */
function vpOf(layout: RibbonLayout): [number, number] {
  const vp = COMB_VP[layout.axis];
  const minLeft = Math.min(...layout.boxes.map((b) => b.left));
  const minTop = Math.min(...layout.boxes.map((b) => b.top));
  return [minLeft + vp[0] * layout.width, minTop + vp[1] * layout.height];
}

/** The cast at the corner FARTHEST from the vanishing point, in cell widths. Find the
 *  corner first; the cast at any other corner is a different number by construction. */
function farEndCast(layout: RibbonLayout, castFar?: number): number {
  const solids = projectComb(layout, castFar);
  const [vx, vy] = vpOf(layout);
  let far = -1;
  let cast = 0;
  for (const s of solids) {
    for (let k = 0; k < 6; k++) {
      const [fx, fy] = s.face[k]!;
      const [rx, ry] = s.rear[k]!;
      const dist = Math.hypot(fx - vx, fy - vy);
      if (dist > far) {
        far = dist;
        cast = Math.hypot(fx - rx, fy - ry) / layout.cellW;
      }
    }
  }
  return cast;
}

describe("the two hexes", () => {
  it("states the flat-top ratio and imports the pointy one", () => {
    expect(FLAT_RATIO).toBeCloseTo(0.8660254, 7);
    // Not "equal to 1.1547" - the SAME constant. Restating it is how two combs on one
    // page end up a rounding apart, which reads as a wobble rather than a decision.
    expect(POINTY_RATIO).toBe(SPINE_RATIO);
    expect(POINTY_CORNERS).toBe(SPINE_UNIT_CORNERS);
  });

  it("cuts the flat-top from six corners of a unit cell", () => {
    expect(FLAT_CORNERS).toEqual([
      [0, 0.5],
      [0.25, 0],
      [0.75, 0],
      [1, 0.5],
      [0.75, 1],
      [0.25, 1],
    ]);
  });
});

describe("combUnits", () => {
  it("laces at three quarters of a width per extra hex", () => {
    expect(combUnits("laced", 1).wu).toBe(1);
    expect(combUnits("laced", 4).wu).toBeCloseTo(3.25, 9);
    expect(combUnits("laced", 9).wu).toBeCloseTo(7, 9);
  });

  it("keeps the laced height fixed at any count, which is the whole point of a footer comb", () => {
    // a nine-destination ribbon is exactly as tall as a two-destination one
    expect(combUnits("laced", 2).hu).toBeCloseTo(combUnits("laced", 9).hu, 9);
    expect(combUnits("laced", 4).hu).toBeCloseTo(FLAT_RATIO * 1.5, 9);
  });

  it("delegates the spine outright rather than restating it", () => {
    for (const n of [1, 2, 4, 9]) expect(combUnits("spine", n)).toEqual(layoutUnits(n));
  });

  it("reports nothing for an empty comb, on either axis", () => {
    expect(combUnits("laced", 0)).toEqual({ wu: 0, hu: 0 });
    expect(combUnits("spine", 0)).toEqual({ wu: 0, hu: 0 });
  });
});

describe("chooseAxis", () => {
  it("flips exactly at the legibility floor", () => {
    // solve is availW / 3.25, compared against RIBBON_MIN_CELL. One pixel either side.
    expect(chooseAxis(N, FLOOR_W + 1)).toBe("laced");
    expect(chooseAxis(N, FLOOR_W - 1)).toBe("spine");
    // the boundary itself laces: the floor is the smallest cell still allowed
    expect(chooseAxis(N, FLOOR_W)).toBe("laced");
  });

  it("laces on a desktop column and a tablet, collapses on a phone", () => {
    expect(chooseAxis(N, 1152)).toBe("laced");
    expect(chooseAxis(N, 768)).toBe("laced");
    expect(chooseAxis(N, 390)).toBe("spine");
  });

  it("collapses a long run even at full desktop width", () => {
    // twelve cells lace to 9.25 across: 1152 / 9.25 is 124px, unreadable
    expect(chooseAxis(12, 1152)).toBe("spine");
  });

  it("compares the UNCAPPED solve, so the cap can never force a collapse", () => {
    // 1152 / 3.25 solves to 354, which the cap trims to 340. Had the cap been applied
    // before the comparison a wide column could have been talked into a spine.
    expect(chooseAxis(N, 1152)).toBe("laced");
    expect(layoutComb(N, 1152).cellW).toBe(RIBBON_MAX_CELL);
  });

  it("answers spine for the degenerate first paint rather than throwing", () => {
    // both happen for real: availW is 0 for a frame before the resize observer
    // reports, and count is 0 while the destination list loads.
    expect(chooseAxis(N, 0)).toBe("spine");
    expect(chooseAxis(N, -100)).toBe("spine");
    expect(chooseAxis(0, 1152)).toBe("spine");
  });
});

describe("layoutComb, laced", () => {
  const layout = layoutComb(N, FLOOR_W);

  it("steps each hex three quarters of a width across", () => {
    expect(layout.axis).toBe("laced");
    expect(layout.cellW).toBe(RIBBON_MIN_CELL);
    const step = 0.75 * RIBBON_MIN_CELL;
    expect(layout.boxes.map((b) => b.left)).toEqual([0, step, 2 * step, 3 * step]);
  });

  it("laces by dropping every other hex half a height", () => {
    const h = RIBBON_MIN_CELL * FLAT_RATIO;
    expect(layout.boxes.map((b) => b.top)).toEqual([0, h / 2, 0, h / 2]);
    expect(layout.boxes.every((b) => b.h === h)).toBe(true);
  });

  it("reports the extent the run uses", () => {
    expect(layout.width).toBeCloseTo(FLOOR_W, 9);
    expect(layout.height).toBeCloseTo(FLAT_RATIO * 1.5 * RIBBON_MIN_CELL, 9);
  });

  it("caps the cell and centres what is left in the column", () => {
    const capped = layoutComb(N, 1152);
    expect(capped.cellW).toBe(RIBBON_MAX_CELL);
    // 3.25 * 340 is 1105 of 1152, so 23.5 either side
    expect(capped.width).toBeCloseTo(1105, 9);
    expect(capped.boxes[0]!.left).toBeCloseTo(23.5, 9);
  });
});

describe("layoutComb, spine", () => {
  /** 240 over 1.5 units lands on a round 160, so the arithmetic below is exact and a
   *  drifting last bit would be a real regression rather than a float artefact. */
  const COL = 240;
  const layout = layoutComb(5, COL);

  it("collapses and then IS the shipped spine, not merely like it", () => {
    expect(layout.axis).toBe("spine");
    const ref = placeSpine(5, layout.cellW, COL);
    expect(layout.boxes).toEqual(ref.boxes);
    expect(layout.height).toBeCloseTo(ref.height, 9);
  });

  it("steps down three quarters of a height and alternates half a width across", () => {
    const w = layout.cellW;
    const h = w * POINTY_RATIO;
    const vstep = 0.75 * h;
    expect(layout.boxes.map((b) => b.left)).toEqual([0, w / 2, 0, w / 2, 0]);
    expect(layout.boxes.map((b) => b.top)).toEqual([
      0,
      vstep,
      2 * vstep,
      3 * vstep,
      4 * vstep,
    ]);
  });

  it("needs only 1.5 cells across, which is why it always fits", () => {
    expect(layout.width).toBeCloseTo(1.5 * layout.cellW, 9);
    expect(layout.cellW).toBe(160);
  });

  it("caps the collapsed cell too", () => {
    // a tall narrow column could otherwise solve one hex past the cap
    expect(layoutComb(12, 1152).cellW).toBe(RIBBON_MAX_CELL);
  });
});

describe("layoutComb, empty", () => {
  it("returns an empty run rather than a NaN one", () => {
    for (const l of [layoutComb(0, 1152), layoutComb(4, 0), layoutComb(0, 0)]) {
      expect(l.boxes).toEqual([]);
      expect(l.width).toBe(0);
      expect(l.height).toBe(0);
      expect(l.cellW).toBe(0);
      // the safe axis: a spine fits any column, so a late-arriving count cannot
      // strand the page mid-collapse
      expect(l.axis).toBe("spine");
    }
  });
});

describe("projectComb", () => {
  const laced = layoutComb(N, FLOOR_W);
  const SPINE_COL = 240;
  const spine = layoutComb(5, SPINE_COL);

  it("leaves the near faces exactly on their measured boxes", () => {
    // one-point: the faces lie in the picture plane, which is what lets a cell carry
    // upright HTML at true size. If this fails, the destination title drifts off its hex.
    const s = projectComb(laced);
    const b = laced.boxes[0]!;
    expect(s[0]!.face[0]).toEqual([b.left, b.top + b.h / 2]);
    expect(s[0]!.face[3]).toEqual([b.left + b.w, b.top + b.h / 2]);
    expect(s[0]!.centre).toEqual([b.left + b.w / 2, b.top + b.h / 2]);
    expect(s.every((x) => x.scale === 1 && x.fit === 1)).toBe(true);
  });

  it("puts every cell at the same depth, which is why the scene cannot sort by z", () => {
    expect(projectComb(laced).every((s) => s.z === 0)).toBe(true);
    expect(projectComb(spine).every((s) => s.z === 0)).toBe(true);
  });

  it("casts the far-end prism at the stated share of a cell, on both axes", () => {
    expect(farEndCast(laced)).toBeCloseTo(RIBBON_CAST, 6);
    expect(farEndCast(spine)).toBeCloseTo(RIBBON_CAST, 6);
  });

  it("keeps the far-end cast constant as the run gets longer", () => {
    // the whole reason the camera is stated as a far-end cast and not a focal+depth:
    // a fixed pair draws a hairline on a short run and a wedge on a long one.
    // 1400 is wide enough that nine cells still lace, so this varies the count alone.
    for (const n of [2, 3, 4, 6, 9]) {
      const l = layoutComb(n, 1400);
      expect(l.axis).toBe("laced");
      expect(farEndCast(l)).toBeCloseTo(RIBBON_CAST, 6);
    }
  });

  it("defaults to the owner's cast, and honours an override", () => {
    expect(projectComb(laced)).toEqual(projectComb(laced, RIBBON_CAST));
    expect(farEndCast(laced, 0.3)).toBeCloseTo(0.3, 6);
  });

  it("aims EVERY laced cast the same way, because a laced run overlaps itself", () => {
    // The vanishing point sits below the run. Under a centred one the cells left of
    // centre cast right and the cells right of centre cast left, so half the slabs are
    // aimed into the neighbour that overlaps them by a quarter cell: the face mask
    // removes the cast and a hairline appears where a slab should be.
    const solids = projectComb(laced);
    for (const s of solids) {
      for (let k = 0; k < 6; k++) {
        expect(s.rear[k]![1]).toBeGreaterThan(s.face[k]![1]);
      }
    }
  });

  it("still converges the spine inward, because its cells only touch at a seam", () => {
    const solids = projectComb(spine);
    const [, vy] = vpOf(spine);
    const first = solids[0]!;
    const last = solids[solids.length - 1]!;
    expect(first.centre[1]).toBeLessThan(vy);
    expect(last.centre[1]).toBeGreaterThan(vy);
    // opposite signs: the top cell casts DOWN and the bottom cell casts UP. That is
    // exactly the behaviour the laced axis must not have.
    expect(first.rear[0]![1]).toBeGreaterThan(first.face[0]![1]);
    expect(last.rear[3]![1]).toBeLessThan(last.face[3]![1]);
  });

  it("matches projectSpine exactly on the collapsed axis", () => {
    const ref = projectSpine(spine.boxes, SPINE_COL, spine.height, {
      castFar: RIBBON_CAST,
      vp: [0.5, 0.5],
    });
    expect(projectComb(spine)).toEqual(ref);
  });

  it("projects about the RUN's box, not the column it was centred in", () => {
    // The cap-bound case: 3.25 * 340 in a 1152 column leaves 23.5 of padding. A
    // container-relative vanishing point would sit off to one side of the run and cast
    // the whole comb sideways. Symmetry of the outer two cells' casts proves it does not.
    const capped = layoutComb(N, 1152);
    expect(capped.boxes[0]!.left).toBeGreaterThan(0);
    const solids = projectComb(capped);
    const [vx] = vpOf(capped);
    const firstDx = solids[0]!.rear[0]![0] - solids[0]!.face[0]![0];
    const lastDx =
      solids[N - 1]!.rear[3]![0] - solids[N - 1]!.face[3]![0];
    expect(firstDx).toBeGreaterThan(0); // leftmost corner casts right, toward the run's middle
    expect(lastDx).toBeLessThan(0); // rightmost corner casts left
    expect(firstDx).toBeCloseTo(-lastDx, 6);
    expect(vx).toBeCloseTo(capped.boxes[0]!.left + capped.width / 2, 9);
  });

  it("is scale invariant on the laced axis", () => {
    const small = layoutComb(N, FLOOR_W); // 200px cells
    const big = layoutComb(N, 3.25 * 300); // 300px cells, still under the cap
    const k = 1.5;
    const a = projectComb(small);
    const b = projectComb(big);
    for (let i = 0; i < a.length; i++) {
      for (let n = 0; n < 6; n++) {
        expect(b[i]!.rear[n]![0] / k).toBeCloseTo(a[i]!.rear[n]![0], 6);
        expect(b[i]!.rear[n]![1] / k).toBeCloseTo(a[i]!.rear[n]![1], 6);
      }
    }
  });

  it("is scale invariant on the collapsed axis", () => {
    const a = projectComb(layoutComb(5, 150)); // 100px cells
    const b = projectComb(layoutComb(5, 450)); // 300px cells, still collapsed
    for (let i = 0; i < a.length; i++) {
      for (let n = 0; n < 6; n++) {
        expect(b[i]!.rear[n]![0] / 3).toBeCloseTo(a[i]!.rear[n]![0], 6);
        expect(b[i]!.rear[n]![1] / 3).toBeCloseTo(a[i]!.rear[n]![1], 6);
      }
    }
  });

  it("returns nothing for an empty comb rather than dividing by zero", () => {
    expect(projectComb(layoutComb(0, 1152))).toEqual([]);
  });
});
