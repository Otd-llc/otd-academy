// Freeze the spine's numbers. These are the owner's picks from the sandbox rounds,
// and the failures they guard against are all ones that already happened once:
// a flat pixel stroke that read as a third of a hex on a small cell, a camera stated
// as focal+depth that drew a different slab on a 3-node path than on a 9-stage guide,
// and a missing cell cap that let one hex fill a desktop viewport.

import { describe, expect, it } from "vitest";
import {
  fitCellWidth,
  layoutUnits,
  placeSpine,
  projectSpine,
  SPINE_CAM,
  SPINE_MAX_CELL,
  SPINE_RATIO,
  SPINE_STROKE,
  SPINE_VSTEP,
  spineStroke,
} from "@/lib/comb-spine";

const CELL = 300;

describe("layoutUnits", () => {
  it("is 1.5 cells wide once the zig-zag has a second hex to zig to", () => {
    expect(layoutUnits(1).wu).toBe(1);
    expect(layoutUnits(2).wu).toBe(1.5);
    expect(layoutUnits(9).wu).toBe(1.5);
  });

  it("stacks rows at three quarters of a hex height", () => {
    // Frozen as LITERALS. Written as `SPINE_RATIO * (1 + 2 * SPINE_VSTEP)` this was a
    // tautology: it restated the implementation with the same imported constants and
    // still passed with SPINE_VSTEP set to 0.5.
    expect(layoutUnits(1).hu).toBeCloseTo(1.1547, 4);
    expect(layoutUnits(3).hu).toBeCloseTo(2.8868, 4);
    expect(layoutUnits(8).hu).toBeCloseTo(7.2169, 4);
  });

  it("reports nothing for an empty comb", () => {
    expect(layoutUnits(0)).toEqual({ wu: 0, hu: 0 });
  });
});

describe("fitCellWidth", () => {
  it("caps the cell, which is the whole reason a spine does not eat the viewport", () => {
    // a 1152px column over 1.5 units solves to 768px without the cap
    expect(fitCellWidth(8, 1152, null, null)).toBeCloseTo(768, 6);
    expect(fitCellWidth(8, 1152)).toBe(SPINE_MAX_CELL);
  });

  it("still shrinks below the cap when the container is narrow", () => {
    // a phone: 390 / 1.5 is well under the cap, so the cap must not raise it
    expect(fitCellWidth(8, 390)).toBeCloseTo(260, 6);
  });

  it("solves against height too when a box is given", () => {
    const { hu } = layoutUnits(8);
    // height-bound: 600px of box over the spine's height in cells
    expect(fitCellWidth(8, 4000, 600)).toBeCloseTo(600 / hu, 6);
  });
});

describe("placeSpine", () => {
  it("alternates half a cell left and right, and steps down by VSTEP", () => {
    const { boxes, height } = placeSpine(4, CELL, CELL * 1.5);
    expect(boxes.map((b) => b.left)).toEqual([0, CELL / 2, 0, CELL / 2]);
    const h = CELL * SPINE_RATIO;
    expect(boxes.map((b) => b.top)).toEqual([0, h * 0.75, h * 1.5, h * 2.25]);
    expect(height).toBeCloseTo(h * 0.75 * 3 + h, 6);
  });

  it("centres the run in a wider container", () => {
    const { boxes } = placeSpine(2, 100, 500);
    // 500 wide, 150 used, so 175 either side
    expect(boxes[0]!.left).toBeCloseTo(175, 6);
  });
});

describe("spineStroke", () => {
  it("is a share of the cell, not a fixed pixel weight", () => {
    // doubling the cell doubles the outline, which is what keeps a small hex on a
    // hairline instead of the flat 3px that read as a third of a hex
    const a = spineStroke("face", 100, 1);
    const b = spineStroke("face", 200, 1);
    expect(b).toBeCloseTo(a * 2, 6);
  });

  it("carries the lesson ribbon's ratio at trim 1", () => {
    // The ribbon draws in a 48-unit box at 1.1 / 0.5, so at a 48px cell those ARE the
    // pixel weights — except the side, which the 0.55 floor clamps up at that size.
    // Asserted an octave up, where neither is floor-bound, so this tests the ratio.
    expect(spineStroke("face", 96, 1)).toBeCloseTo(2.2, 6);
    expect(spineStroke("side", 96, 1)).toBeCloseTo(1.0, 6);
  });

  it("applies the owner's trim by default", () => {
    // A literal, for the same reason as above: written against the constants this
    // passed with `trim: 0`, which is the exact failure it is named for. 300px cell,
    // 1.1/48 face ratio, 0.4 trim -> 2.75px.
    expect(spineStroke("face", CELL)).toBeCloseTo(2.75, 4);
    expect(spineStroke("face", CELL, 1)).toBeCloseTo(6.875, 4);
  });

  it("keeps a floor, and trims the floor too", () => {
    // an absurdly small cell still draws something...
    expect(spineStroke("face", 1, 1)).toBe(SPINE_STROKE.floor);
    // ...but a trim of 0.4 must still thin it, or the trim stops working down here
    expect(spineStroke("face", 1, 0.4)).toBeCloseTo(SPINE_STROKE.floor * 0.4, 6);
  });
});

describe("projectSpine", () => {
  const boxes = placeSpine(6, CELL, CELL * 1.5).boxes;
  const h = placeSpine(6, CELL, CELL * 1.5).height;
  const solids = projectSpine(boxes, CELL * 1.5, h);

  it("leaves the near faces exactly on their measured boxes", () => {
    // one-point: the faces lie in the picture plane, which is what lets a cell carry
    // upright HTML at true size. If this ever fails, the content drifts off the hex.
    const b = boxes[0]!;
    expect(solids[0]!.face[0]).toEqual([b.left + b.w / 2, b.top]);
    expect(solids[0]!.face[3]).toEqual([b.left + b.w / 2, b.top + b.h]);
    expect(solids.every((s) => s.scale === 1 && s.fit === 1)).toBe(true);
  });

  it("puts every cell at the same depth, which is why the scene cannot sort by z", () => {
    expect(solids.every((s) => s.z === 0)).toBe(true);
  });

  it("casts the far-end prism at the camera's stated share of a cell", () => {
    const vx = 0.5 * CELL * 1.5;
    const vy = 0.5 * h;
    // The cast grows with distance from the vanishing point, so the camera is pinned
    // at the FARTHEST corner. Find that corner first, then measure its cast.
    let far = -1;
    let castAtFar = 0;
    for (const s of solids) {
      for (let k = 0; k < 6; k++) {
        const [fx, fy] = s.face[k]!;
        const [rx, ry] = s.rear[k]!;
        const dist = Math.hypot(fx - vx, fy - vy);
        if (dist > far) {
          far = dist;
          castAtFar = Math.hypot(fx - rx, fy - ry) / CELL;
        }
      }
    }
    expect(castAtFar).toBeCloseTo(SPINE_CAM.castFar, 4);
  });

  it("converges inward: a cell above the centre casts DOWN, one below casts UP", () => {
    const vy = 0.5 * h;
    const first = solids[0]!;
    const last = solids[solids.length - 1]!;
    expect(first.centre[1]).toBeLessThan(vy);
    expect(last.centre[1]).toBeGreaterThan(vy);
    // the rear face is pulled toward the vanishing point in both cases
    expect(first.rear[0]![1]).toBeGreaterThan(first.face[0]![1]);
    expect(last.rear[3]![1]).toBeLessThan(last.face[3]![1]);
  });

  it("is scale invariant: the same comb at any size projects to the same shape", () => {
    const small = placeSpine(6, 100, 150);
    const big = placeSpine(6, 400, 600);
    const a = projectSpine(small.boxes, 150, small.height);
    const b = projectSpine(big.boxes, 600, big.height);
    for (let i = 0; i < a.length; i++) {
      for (let k = 0; k < 6; k++) {
        expect(b[i]!.rear[k]![0] / 4).toBeCloseTo(a[i]!.rear[k]![0], 4);
        expect(b[i]!.rear[k]![1] / 4).toBeCloseTo(a[i]!.rear[k]![1], 4);
      }
    }
  });

  it("returns nothing for an empty comb rather than dividing by zero", () => {
    expect(projectSpine([], 100, 100)).toEqual([]);
  });

  it("keeps every projected point inside the scene box", () => {
    // THE INVARIANT THE MASK DEPENDS ON. `SpineCombScene` masks its slab layer with a
    // region in user space; a mask region CLIPS, so any ink outside it is not drawn.
    // The spine holds this because its vanishing point is at the centre of the run, so
    // rear faces are pulled inward. The go-further ribbon does NOT (its vp sits below
    // the run) and shipped with ~16px sliced off its lower prisms until that was
    // caught. Untested here, this regresses silently and invisibly in code review.
    for (const n of [1, 2, 5, 9]) {
      const { boxes, height } = placeSpine(n, CELL, CELL * 1.5);
      const w = CELL * 1.5;
      for (const s of projectSpine(boxes, w, height)) {
        for (const [x, y] of [...s.face, ...s.rear]) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(w);
          expect(y).toBeLessThanOrEqual(height);
        }
      }
    }
  });

  it("laces: each hex actually shares an edge with the next", () => {
    // The geometric property the height assertion above only implies. If the vstep or
    // the half-cell offset drifts, the run stops being a comb and becomes a column of
    // separate hexes, which no assertion on EXTENTS would catch.
    //
    // A shared edge means two corner pairs COINCIDE, exactly. Which pairs depends on
    // the zig: an even cell hands its lower-RIGHT edge to the next one's upper-left,
    // an odd cell hands over its lower-LEFT edge.
    const { boxes } = placeSpine(5, CELL, CELL * 1.5);
    const at = (bx: (typeof boxes)[number], [ux, uy]: [number, number]) =>
      [bx.left + ux * bx.w, bx.top + uy * bx.h] as const;

    for (let i = 0; i < boxes.length - 1; i++) {
      const a = boxes[i]!;
      const b = boxes[i + 1]!;
      const [aTop, aBot] =
        i % 2 === 0
          ? ([at(a, [1, 0.75]), at(a, [0.5, 1])] as const)
          : ([at(a, [0, 0.75]), at(a, [0.5, 1])] as const);
      const [bTop, bBot] =
        i % 2 === 0
          ? ([at(b, [0.5, 0]), at(b, [0, 0.25])] as const)
          : ([at(b, [0.5, 0]), at(b, [1, 0.25])] as const);
      expect(aTop[0]).toBeCloseTo(bTop[0], 6);
      expect(aTop[1]).toBeCloseTo(bTop[1], 6);
      expect(aBot[0]).toBeCloseTo(bBot[0], 6);
      expect(aBot[1]).toBeCloseTo(bBot[1], 6);
    }
  });

  it("does not hand back a negative cell for a negative container", () => {
    // `fitCellWidth(8, -100)` returns -66.7; `placeSpine`'s `w <= 0` guard is the only
    // thing containing it, so that guard is the contract.
    expect(placeSpine(8, fitCellWidth(8, -100), -100)).toEqual({
      boxes: [],
      height: 0,
    });
  });
});
