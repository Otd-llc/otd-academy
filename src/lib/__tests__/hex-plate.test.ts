// Laying parts out on a bed.
//
// Pure arithmetic, no I/O, so the properties can be asserted directly rather
// than inferred from a rendered file: nothing overlaps, nothing leaves the bed,
// the plate count is bounded, and the same request lays out the same way twice.
import { describe, expect, it } from "vitest";

import { packPlates, PlatePackError, PLATE_GAP } from "@/lib/hex-plate";

const box = (dx: number, dy: number) => ({ x0: 0, y0: 0, z0: 0, dx, dy, dz: 10 });

describe("packing", () => {
  it("puts everything on one plate when it fits", () => {
    const plates = packPlates(
      [{ slug: "a", qty: 3, box: box(50, 50) }],
      { x: 220, y: 220 },
    );
    expect(plates).toHaveLength(1);
    expect(plates[0]).toHaveLength(3);
  });

  it("expands quantity into that many placements", () => {
    const plates = packPlates(
      [{ slug: "a", qty: 4, box: box(20, 20) }],
      { x: 220, y: 220 },
    );
    expect(plates.flat().map((p) => p.slug)).toEqual(["a", "a", "a", "a"]);
  });

  it("opens a new plate when the bed is full", () => {
    // Nine 100x100 parts cannot share a 220 bed: four per plate at most.
    const plates = packPlates(
      [{ slug: "a", qty: 9, box: box(100, 100) }],
      { x: 220, y: 220 },
    );
    expect(plates.length).toBeGreaterThan(2);
  });

  it("never overlaps two placements on the same plate", () => {
    const plates = packPlates(
      [{ slug: "a", qty: 12, box: box(60, 40) }],
      { x: 220, y: 220 },
    );
    for (const plate of plates) {
      for (let i = 0; i < plate.length; i++) {
        for (let j = i + 1; j < plate.length; j++) {
          const a = plate[i];
          const b = plate[j];
          const apart =
            a.x + a.box.dx <= b.x ||
            b.x + b.box.dx <= a.x ||
            a.y + a.box.dy <= b.y ||
            b.y + b.box.dy <= a.y;
          expect(apart).toBe(true);
        }
      }
    }
  });

  it("keeps every placement inside the bed, margin included", () => {
    const bed = { x: 220, y: 220 };
    for (const p of packPlates(
      [{ slug: "a", qty: 20, box: box(37, 53) }],
      bed,
    ).flat()) {
      expect(p.x).toBeGreaterThanOrEqual(PLATE_GAP);
      expect(p.y).toBeGreaterThanOrEqual(PLATE_GAP);
      expect(p.x + p.box.dx).toBeLessThanOrEqual(bed.x - PLATE_GAP);
      expect(p.y + p.box.dy).toBeLessThanOrEqual(bed.y - PLATE_GAP);
    }
  });

  it("refuses to exceed the plate cap", () => {
    // THE REAL BOUND ON THIS ENDPOINT. MAX_PACK_INSTANCES caps items, not
    // plates, and the two are far apart: 250 of the largest part is 63 plates
    // on the default 220 bed and 250 plates on a 100 mm bed -- each one a
    // separate 3MF document carrying its own full copy of the mesh, from a
    // single unauthenticated GET. Throwing here lets the route answer 400
    // before it reads anything from R2.
    expect(() =>
      packPlates([{ slug: "a", qty: 250, box: box(88, 78) }], { x: 100, y: 100 }, 20),
    ).toThrow(/plate/i);
  });

  it("allows exactly the plate cap", () => {
    const at = packPlates(
      [{ slug: "a", qty: 80, box: box(100, 100) }],
      { x: 220, y: 220 },
      20,
    );
    expect(at.length).toBeLessThanOrEqual(20);
  });

  it("is deterministic", () => {
    // The response is cached per URL, so the same request must produce the same
    // bytes. A Map iteration order or a sort that is not total would break this
    // silently and only for some users.
    const input = [
      { slug: "a", qty: 2, box: box(40, 40) },
      { slug: "b", qty: 3, box: box(35, 60) },
    ];
    expect(JSON.stringify(packPlates(input, { x: 220, y: 220 }))).toBe(
      JSON.stringify(packPlates(input, { x: 220, y: 220 })),
    );
  });

  it("lays the same build out the same way whatever order it arrives in", () => {
    // The test above cannot fail on a partial sort, and that is not a nitpick:
    // V8's sort is STABLE, so re-sorting one array twice gives the same answer
    // whether or not the comparator is total. Dropping the slug tiebreak passes
    // it. What a TOTAL order actually buys is this -- `a,b` and `b,a` are one
    // build spelled two ways, and without the tiebreak the two spellings lay out
    // differently, so two people with the identical build get byte-different
    // files. EQUAL depths and different widths, because a tie is the only case
    // where the tiebreak is reached at all.
    const a = { slug: "a", qty: 1, box: box(50, 40) };
    const b = { slug: "b", qty: 1, box: box(30, 40) };
    const bed = { x: 220, y: 220 };
    expect(JSON.stringify(packPlates([a, b], bed))).toBe(
      JSON.stringify(packPlates([b, a], bed)),
    );
  });

  it("tells an oversized part apart from a plate overrun", () => {
    // The route answers these differently -- a part that cannot fit a bed we
    // accept is OUR data being wrong, a plate overrun is a request we refuse --
    // so the reason has to be readable without matching the prose. It is a
    // sentence somebody will reword, and a route switching on its wording turns
    // a copy edit into a wrong status code.
    //
    // The oversized branch has no other coverage: every other test here uses
    // parts that fit, so without this the throw could be deleted outright and
    // the suite would stay green.
    const tooBig = () =>
      packPlates([{ slug: "a", qty: 1, box: box(200, 20) }], { x: 100, y: 100 });
    expect(tooBig).toThrow(PlatePackError);
    expect(tooBig).toThrow(/cannot fit/);
    try {
      tooBig();
    } catch (e) {
      expect((e as PlatePackError).reason).toBe("part-too-large");
    }

    const tooMany = () =>
      packPlates([{ slug: "a", qty: 250, box: box(88, 78) }], { x: 100, y: 100 }, 20);
    expect(tooMany).toThrow(PlatePackError);
    try {
      tooMany();
    } catch (e) {
      expect((e as PlatePackError).reason).toBe("too-many-plates");
    }
  });
});
