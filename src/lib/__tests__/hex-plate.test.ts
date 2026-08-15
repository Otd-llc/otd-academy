// Laying parts out on a bed.
//
// Pure arithmetic, no I/O, so the properties can be asserted directly rather
// than inferred from a rendered file: nothing overlaps, nothing sits closer than
// a nozzle path, nothing leaves the bed, the plate count is bounded on BOTH
// sides, and the same build lays out the same way however it is spelled.
import { describe, expect, it } from "vitest";

import {
  MAX_PLATES,
  packPlates,
  PlatePackError,
  PLATE_GAP,
  type PackInput,
  type Placement,
  type PlatePackFailure,
} from "@/lib/hex-plate";

const box = (dx: number, dy: number) => ({ x0: 0, y0: 0, z0: 0, dx, dy, dz: 10 });

const BED = { x: 220, y: 220 };

/** Three depths and two tie groups, because a row of identical parts cannot
 *  fail the way the real data does: 53 published parts across 19 distinct
 *  depths, with one tie group of twelve. On a 220 bed the first row takes both
 *  90s AND a 60, which is the only arrangement that can catch a shelf height
 *  tracking the LAST part placed instead of the DEEPEST. */
const MIXED: PackInput[] = [
  { slug: "tall", qty: 2, box: box(60, 90) },
  { slug: "mid", qty: 4, box: box(50, 60) },
  { slug: "short", qty: 6, box: box(60, 30) },
];

/** The reason a call failed, or `"no-throw"`.
 *
 *  A bare `try { fn() } catch (e) { expect(...) }` passes SILENTLY when nothing
 *  is thrown: the assertions live in the catch block, so they simply never run.
 *  This turns the outcome into a value, so the no-throw case is asserted like
 *  any other. */
const reasonOf = (fn: () => unknown): PlatePackFailure | "no-throw" => {
  try {
    fn();
    return "no-throw";
  } catch (e) {
    if (e instanceof PlatePackError) return e.reason;
    throw e;
  }
};

/** Nothing overlaps, and nothing is closer to its neighbour than PLATE_GAP.
 *
 *  SEPARATION, not merely disjointness. The obvious predicate -- some edge of
 *  one box is `<=` some edge of the other -- counts two parts that TOUCH as
 *  "apart", so it passes on a packer that advances its cursor by the part's size
 *  and forgets the gap, which is precisely the layout with no nozzle path
 *  between neighbours. Separation subsumes non-overlap (a gap of at least 4 mm
 *  on an axis is a gap of more than zero), so this one assertion covers both. */
function expectSeparated(plates: readonly Placement[][]) {
  for (const plate of plates) {
    for (let i = 0; i < plate.length; i++) {
      for (let j = i + 1; j < plate.length; j++) {
        const a = plate[i];
        const b = plate[j];
        const gapX = Math.max(b.x - (a.x + a.box.dx), a.x - (b.x + b.box.dx));
        const gapY = Math.max(b.y - (a.y + a.box.dy), a.y - (b.y + b.box.dy));
        expect(
          Math.max(gapX, gapY),
          `${a.slug} at (${a.x},${a.y}) and ${b.slug} at (${b.x},${b.y})`,
        ).toBeGreaterThanOrEqual(PLATE_GAP);
      }
    }
  }
}

/** Every placement sits inside the bed with the margin counted. */
function expectInside(plates: readonly Placement[][], bed: { x: number; y: number }) {
  for (const p of plates.flat()) {
    expect(p.x).toBeGreaterThanOrEqual(PLATE_GAP);
    expect(p.y).toBeGreaterThanOrEqual(PLATE_GAP);
    expect(p.x + p.box.dx).toBeLessThanOrEqual(bed.x - PLATE_GAP);
    expect(p.y + p.box.dy).toBeLessThanOrEqual(bed.y - PLATE_GAP);
  }
}

describe("packing", () => {
  it("puts everything on one plate when it fits", () => {
    const plates = packPlates([{ slug: "a", qty: 3, box: box(50, 50) }], BED);
    expect(plates).toHaveLength(1);
    expect(plates[0]).toHaveLength(3);
  });

  it("expands quantity into that many placements", () => {
    const plates = packPlates([{ slug: "a", qty: 4, box: box(20, 20) }], BED);
    expect(plates.flat().map((p) => p.slug)).toEqual(["a", "a", "a", "a"]);
  });

  it("opens a new plate when the bed is full", () => {
    // Nine 100x100 parts cannot share a 220 bed: four per plate at most.
    const plates = packPlates([{ slug: "a", qty: 9, box: box(100, 100) }], BED);
    expect(plates.length).toBeGreaterThan(2);
  });

  it("leaves a nozzle path between neighbours on the same plate", () => {
    expectSeparated(packPlates([{ slug: "a", qty: 12, box: box(60, 40) }], BED));
  });

  it("keeps rows apart when one row holds parts of different depths", () => {
    // The test above cannot fail on shelf height: every part in it is the same
    // depth, so a row that clears the LAST part placed clears the deepest one by
    // accident. Mixed depths in one row are the case the real data is made of.
    const plates = packPlates(MIXED, BED);
    expectSeparated(plates);
    expectInside(plates, BED);
    expect(plates.flat()).toHaveLength(12);
  });

  it("shelves the deepest parts first", () => {
    // The heuristic itself, which nothing else here asserts: reverse the sort and
    // every other property still holds, the build just takes more plates. Shelf
    // packing only fills a row when the row is opened by its deepest part.
    const depths = packPlates(MIXED, BED)
      .flat()
      .map((p) => p.box.dy);
    expect(depths).toEqual([...depths].sort((a, b) => b - a));
  });

  it("keeps every placement inside the bed, margin included", () => {
    expectInside(packPlates([{ slug: "a", qty: 20, box: box(37, 53) }], BED), BED);
  });

  it("accepts exactly the plate cap and refuses one item more", () => {
    // THE REAL BOUND ON THIS ENDPOINT, asserted from BOTH sides and against the
    // DEFAULT cap. MAX_PACK_INSTANCES caps items, not plates, and the two are far
    // apart: 250 of the largest part is 63 plates on the default 220 bed and 250
    // plates on a 100 mm bed -- each one a separate 3MF document carrying its own
    // full copy of the mesh, from a single unauthenticated GET.
    //
    // `maxPlates` is left DEFAULTED so the constant's value is what is under
    // test. A test that passes `20` as a literal proves the parameter works and
    // says nothing about `MAX_PLATES`, which could be raised to 1000 and ship.
    //
    // The quantities are literals for the same reason, running the other way:
    // four 100x100 parts fit a 220 bed (two rows of two, gaps counted), so 80
    // items is exactly 20 plates and 81 needs a twenty-first. Derived from
    // MAX_PLATES they would move with it, and a cap of 1000 would pass this with
    // 4000 items.
    expect(MAX_PLATES).toBe(20);
    const at = packPlates([{ slug: "a", qty: 80, box: box(100, 100) }], BED);
    expect(at).toHaveLength(MAX_PLATES);
    expect(at.flat()).toHaveLength(80);
    expectSeparated(at);

    // One item more, not one plate more: the boundary is crossed by the smallest
    // step a caller can take.
    expect(
      reasonOf(() => packPlates([{ slug: "a", qty: 81, box: box(100, 100) }], BED)),
    ).toBe("too-many-plates");
  });

  it("refuses to exceed a cap the caller passes", () => {
    // The parameter as well as the constant -- the route may lower it, and A7
    // reads the reason to choose a status code.
    expect(() =>
      packPlates([{ slug: "a", qty: 250, box: box(88, 78) }], { x: 100, y: 100 }, 20),
    ).toThrow(/plate/i);
  });

  it("refuses an unpackable total before expanding it", () => {
    // A quantity is three characters in a URL and one array element per unit, so
    // the expansion is the one step where a cheap request buys expensive work.
    // The plate cap refuses this build either way -- the question is whether it
    // does so before or after allocating one element per instance and sorting
    // them. `qty: 5_000_000` is the shape of the hazard; the number here is the
    // smallest that proves the same thing, so a regression fails in milliseconds
    // instead of spending seconds sorting its way to the same answer.
    //
    // Proven WITHOUT a stopwatch, which would be flaky and would measure the
    // machine rather than the code. `box` is a counting getter. The expansion
    // never reads it, but the SORT reads it twice per comparison, so a run that
    // got as far as sorting a hundred thousand items leaves millions of reads
    // behind and a run that refused up front leaves none. The part itself FITS,
    // so nothing else in the module can produce this refusal.
    const b = box(50, 50);
    let reads = 0;
    const input: PackInput[] = [
      {
        slug: "a",
        qty: 100_000,
        get box() {
          reads++;
          return b;
        },
      },
    ];
    expect(reasonOf(() => packPlates(input, BED))).toBe("too-many-plates");
    expect(reads).toBeLessThan(5);
  });

  it("refuses a quantity that is not a whole number of parts", () => {
    // `for (let i = 0; i < 2.5; i++)` runs three times, so a fractional quantity
    // silently ships three of something somebody asked for two and a half of.
    // The request grammar in hex-pack already rejects these, which is exactly why
    // the packer must too: the only way to arrive here is a caller that skipped
    // it, and that is a fault worth hearing about rather than rounding away.
    for (const qty of [2.5, 0, -1, NaN, Infinity]) {
      expect(
        reasonOf(() => packPlates([{ slug: "a", qty, box: box(50, 50) }], BED)),
        `qty ${qty}`,
      ).toBe("bad-quantity");
    }
  });

  it("refuses a part whose size is not a real positive number", () => {
    // `NaN > bed.x` is FALSE, so a guard written as "it is too big" waves a NaN
    // part through and places it at NaN, which serialises into a 3MF transform
    // and a model nobody can open. The generator seeds its vertex sweep with
    // +/-Infinity, so a mesh it cannot parse yields exactly this. A negative size
    // gets through the size comparison too -- `-Infinity + 8 <= 220` is true --
    // and lays the part off the bed.
    const bad: [string, number, number][] = [
      ["NaN", NaN, NaN],
      ["negative dx", -5, 40],
      ["negative dy", 40, -5],
      ["-Infinity", -Infinity, 40],
      ["zero", 0, 40],
      ["+Infinity dx", Infinity, 40],
      ["+Infinity dy", 40, Infinity],
    ];
    for (const [name, dx, dy] of bad) {
      expect(
        reasonOf(() => packPlates([{ slug: "a", qty: 1, box: box(dx, dy) }], BED)),
        name,
      ).toBe("part-too-large");
    }
  });

  it("is deterministic", () => {
    // The response is cached per URL, so the same request must produce the same
    // bytes. A Map iteration order or a sort that is not total would break this
    // silently and only for some users.
    const input = [
      { slug: "a", qty: 2, box: box(40, 40) },
      { slug: "b", qty: 3, box: box(35, 60) },
    ];
    expect(JSON.stringify(packPlates(input, BED))).toBe(
      JSON.stringify(packPlates(input, BED)),
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
    //
    // HYPHENATED slugs, because that is the shape ours are and the shape that
    // breaks: under th-TH `"tray-lid".localeCompare("traylid")` is 0, so a
    // locale-sensitive tiebreak is not a total order at all on a host set that
    // way. An "a"/"b" pair cannot express that.
    const a = { slug: "tray-lid", qty: 1, box: box(50, 40) };
    const b = { slug: "traylid", qty: 1, box: box(30, 40) };
    expect(JSON.stringify(packPlates([a, b], BED))).toBe(
      JSON.stringify(packPlates([b, a], BED)),
    );
  });

  it("breaks ties by code unit, not by the host's locale", () => {
    // The pair above is the one that BITES, and it cannot be asserted here: on an
    // en-US host code-unit order and locale order agree across the whole slug
    // alphabet [a-z0-9-] (brute-forced over 400k random pairs), and node's
    // default collator ignores LC_ALL on Windows, so this process cannot be put
    // in a locale where they differ. So the rule is pinned with a pair that
    // separates them HERE: by code unit "Z" (0x5A) precedes "a" (0x61), by en-US
    // collation "a" precedes "Z".
    //
    // A capital cannot appear in a published slug -- PART_SLUG_RE is lowercase --
    // and that is the point: this asserts which RULE the comparator follows, not
    // which parts sort where. The rule has to be the locale-independent one,
    // because the alternative reads ambient state that the deployment chooses
    // and this module cannot see.
    const order = (input: PackInput[]) =>
      packPlates(input, BED)
        .flat()
        .map((p) => p.slug);
    const a = { slug: "Z-cap", qty: 1, box: box(50, 40) };
    const b = { slug: "a-cap", qty: 1, box: box(30, 40) };
    expect(order([a, b])).toEqual(["Z-cap", "a-cap"]);
    expect(order([b, a])).toEqual(["Z-cap", "a-cap"]);
  });

  it("keeps the gap wide enough for a nozzle path", () => {
    // The one place PLATE_GAP's VALUE is pinned, and the only kind of assertion
    // that can pin it: every other check in this file derives its expectation
    // from the constant, so all of them move with it and a gap narrowed to 1 mm
    // passes the lot. The geometry guard bounds it from above (widening it eats
    // the largest part's 4.2 mm of headroom on the smallest bed) and cannot see a
    // narrowing at all -- a smaller gap only makes its limit looser.
    //
    // Held from BELOW here, because "enough for a skirt line and a nozzle path"
    // is a physical claim about the slicer, not a number this file may round
    // down: 4 mm is what leaves both of two adjacent parts their default 2 mm
    // skirt offset without the two loops colliding.
    expect(PLATE_GAP).toBeGreaterThanOrEqual(4);
  });

  it("tells an oversized part apart from a plate overrun", () => {
    // The route answers these differently -- a part that cannot fit a bed we
    // accept is OUR data being wrong, a plate overrun is a request we refuse --
    // so the reason has to be readable without matching the prose. It is a
    // sentence somebody will reword, and a route switching on its wording turns
    // a copy edit into a wrong status code.
    //
    // BOTH AXES of the size guard. Only the `dx` half had coverage, so the `dy`
    // half could be deleted outright and the suite would stay green -- shipping a
    // plate with an over-tall part hanging off its far edge.
    const tooWide = () =>
      packPlates([{ slug: "a", qty: 1, box: box(200, 20) }], { x: 100, y: 100 });
    expect(tooWide).toThrow(PlatePackError);
    expect(tooWide).toThrow(/cannot fit/);
    expect(reasonOf(tooWide)).toBe("part-too-large");

    const tooTall = () =>
      packPlates([{ slug: "a", qty: 1, box: box(20, 200) }], { x: 100, y: 100 });
    expect(reasonOf(tooTall)).toBe("part-too-large");

    const tooMany = () =>
      packPlates([{ slug: "a", qty: 250, box: box(88, 78) }], { x: 100, y: 100 }, 20);
    expect(tooMany).toThrow(PlatePackError);
    expect(reasonOf(tooMany)).toBe("too-many-plates");
  });
});
