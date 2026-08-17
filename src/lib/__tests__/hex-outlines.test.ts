// The generated outline + family table.
//
// A generated file is only as good as the thing that checks it, and the checks
// that can run HERE are not the ones the generator runs: it has the meshes and
// can compare a traced shape against the solid it came from; this repo has only
// the committed numbers. So these rows hold the table to things it cannot
// satisfy by accident -- the published slug list, the release the app ships, the
// six families the vocabulary defines, and the geometric invariant that a
// silhouette is exactly as big as the part casting it.
//
// The reason it is worth this much: the failure mode is SILENT AND PRETTY. A
// table of outlines that is subtly wrong still draws a picture. It draws the
// wrong picture, inside a file somebody downloaded, and nothing about it points
// back at a committed data file.
import { describe, expect, it } from "vitest";

import { HEX_PART_BOX } from "@/lib/hex-geometry";
import {
  HEX_OUTLINE_RELEASE,
  HEX_OUTLINE_SCALE,
  HEX_PART_FAMILY,
  HEX_PART_OUTLINE,
} from "@/lib/hex-outlines";
import { HEX_PART_FAMILIES, HEX_PART_SLUGS } from "@/lib/hex-parts";
import { HEX_RELEASE } from "@/lib/hex-spec";

/** Twice the signed area of a closed flat ring. Holes come out of the tracer
 *  wound the other way, so summing SIGNED areas across a part's rings gives the
 *  area actually drawn rather than the outer boundary's. */
function shoelace2(ring: readonly number[]): number {
  let sum = 0;
  for (let i = 0, n = ring.length; i < n; i += 2) {
    sum += ring[i] * ring[(i + 3) % n] - ring[(i + 2) % n] * ring[i + 1];
  }
  return sum;
}

/** The share of its own bounding box a part's outline covers. */
function fillFraction(slug: string): number {
  let area2 = 0;
  for (const ring of HEX_PART_OUTLINE[slug]) area2 += shoelace2(ring);
  return Math.abs(area2) / 2 / (HEX_OUTLINE_SCALE * HEX_OUTLINE_SCALE);
}

describe("the outline table", () => {
  it("was traced for the release the app publishes", () => {
    // The staleness this file cannot notice about itself, and the same tripwire
    // `hex-geometry.test.ts` carries: bumping HEX_RELEASE without re-running the
    // generator leaves every shape here describing the previous cut, and the
    // symptom is a thumbnail drawing last month's parts.
    expect(HEX_OUTLINE_RELEASE).toBe(HEX_RELEASE);
  });

  it("covers every published slug, from both sides", () => {
    // A slug with no outline is a part the thumbnail falls back to drawing as a
    // rectangle -- silently, because the fallback is deliberate and exists for
    // placements that are not ours. That is exactly what makes the gap invisible
    // at runtime and worth asserting here.
    for (const slug of HEX_PART_SLUGS) {
      expect(HEX_PART_OUTLINE[slug], `no outline for ${slug}`).toBeDefined();
      expect(HEX_PART_OUTLINE[slug].length, `${slug} has no rings`).toBeGreaterThan(0);
      expect(HEX_PART_FAMILY[slug], `no family for ${slug}`).toBeDefined();
    }
    // And the same keys as the geometry table, so neither can grow a part the
    // other has never heard of.
    expect(Object.keys(HEX_PART_OUTLINE).sort()).toEqual(
      Object.keys(HEX_PART_BOX).sort(),
    );
    expect(Object.keys(HEX_PART_FAMILY).sort()).toEqual(
      Object.keys(HEX_PART_BOX).sort(),
    );
  });

  it("gives every part one of the six families, and no other value", () => {
    const known = new Set<string>(HEX_PART_FAMILIES);
    for (const [slug, family] of Object.entries(HEX_PART_FAMILY)) {
      expect(known.has(family), `${slug} is family "${family}"`).toBe(true);
    }
  });

  it("puts a real number of parts in EVERY family, at the counts measured", () => {
    // THE ROW THAT CAUGHT A REAL BUG. The lid rule was written
    // `Hex-TB-Carrier-.*-Parts-Tray-Lid`, which needs a middle segment -- so it
    // matched the four half-cell lids and MISSED `Hex-TB-Carrier-Parts-Tray-Lid`,
    // which fell through to the next rule and became an insert. Every family was
    // still occupied, every slug still had a family, and the only visible symptom
    // was one hexagon painted one rung too dark.
    //
    // So the counts are pinned, not just the emptiness. They are measurements off
    // the 2026-08-03 set and a re-cut that legitimately changes one fails here --
    // which is the intended behaviour, the same argument the pinned `z0` in
    // `hex-geometry.test.ts` is made on.
    const counts: Record<string, number> = {};
    for (const family of Object.values(HEX_PART_FAMILY)) {
      counts[family] = (counts[family] ?? 0) + 1;
    }
    expect(counts).toEqual({
      base: 17, // Hex-TB-Main + 16 half tiles
      insert: 10, // 5 carriers x {solid, parts tray}
      pcb: 5, // 5 carrier parts-tray lids
      cap: 14, // 12 dovetail caps + 2 corner caps
      spike: 4, // solid, ball joint, 2 platforms
      accessory: 3, // ball platform, 2 ball zips
    });
    // Summing to the whole set is not implied by the six numbers above -- it is
    // implied by them AND by nothing else existing, which is what this adds.
    expect(Object.keys(HEX_PART_FAMILY)).toHaveLength(HEX_PART_SLUGS.length);
  });

  it("emits rings that are closed, integral, and inside the coordinate space", () => {
    for (const [slug, rings] of Object.entries(HEX_PART_OUTLINE)) {
      for (const [i, ring] of rings.entries()) {
        // Flat x,y pairs: an odd length is a ring whose last point has no y, and
        // the fill loop would read `undefined` as NaN and drop a whole edge.
        expect(ring.length % 2, `${slug} ring ${i} length`).toBe(0);
        expect(ring.length, `${slug} ring ${i} is degenerate`).toBeGreaterThanOrEqual(6);
        for (const v of ring) {
          expect(Number.isInteger(v), `${slug} ring ${i} has ${v}`).toBe(true);
          expect(v, `${slug} ring ${i} has ${v}`).toBeGreaterThanOrEqual(0);
          expect(v, `${slug} ring ${i} has ${v}`).toBeLessThanOrEqual(HEX_OUTLINE_SCALE);
        }
      }
    }
  });

  it("makes every outline reach all four sides of its own bounding box", () => {
    // THE INVARIANT THAT CANNOT BE SATISFIED BY A WRONG SHAPE. A solid's vertical
    // shadow is exactly as wide and as deep as the solid, so an outline that
    // stops short of its box is one traced in the wrong plane, or with a face
    // group missing, or scaled against the wrong extent -- all of which produce a
    // shape that looks entirely plausible and draws every part slightly small.
    //
    // The generator asserts this before writing. Repeated here so it also holds
    // for a table nobody regenerated, and for one edited by hand in the file
    // marked "do not edit by hand".
    const slack = 8; // half a raster cell plus the quantiser's rounding
    for (const [slug, rings] of Object.entries(HEX_PART_OUTLINE)) {
      let uMin = HEX_OUTLINE_SCALE;
      let uMax = 0;
      let vMin = HEX_OUTLINE_SCALE;
      let vMax = 0;
      for (const ring of rings) {
        for (let i = 0; i < ring.length; i += 2) {
          uMin = Math.min(uMin, ring[i]);
          uMax = Math.max(uMax, ring[i]);
          vMin = Math.min(vMin, ring[i + 1]);
          vMax = Math.max(vMax, ring[i + 1]);
        }
      }
      expect(uMin, `${slug} left`).toBeLessThanOrEqual(slack);
      expect(vMin, `${slug} bottom`).toBeLessThanOrEqual(slack);
      expect(uMax, `${slug} right`).toBeGreaterThanOrEqual(HEX_OUTLINE_SCALE - slack);
      expect(vMax, `${slug} top`).toBeGreaterThanOrEqual(HEX_OUTLINE_SCALE - slack);
    }
  });

  it("keeps every outline a believable share of its box, and cheap", () => {
    // Touching all four sides is not enough on its own: a cross and a pair of
    // slivers both do that. Measured on the 2026-08-03 set the range is 0.61
    // (the corner cap, a wedge) to 1.00 (the solid dovetail caps, which really
    // are rectangles).
    //
    // The point budget is the other half. A simplifier that stops simplifying is
    // SILENT -- the outline is right, and twenty times bigger and slower. The
    // busiest part on this set is `hex-tb-main` at 50 points.
    for (const slug of Object.keys(HEX_PART_OUTLINE)) {
      const fill = fillFraction(slug);
      expect(fill, `${slug} fill`).toBeGreaterThan(0.3);
      expect(fill, `${slug} fill`).toBeLessThanOrEqual(1.02);
      const points = HEX_PART_OUTLINE[slug].reduce((n, r) => n + r.length / 2, 0);
      expect(points, `${slug} points`).toBeLessThanOrEqual(200);
    }
  });

  it("is SILHOUETTES and not bounding boxes", () => {
    // THE ONE THAT MATTERS, and the reason the whole table exists. A table of
    // four-point rings covering the full box would pass every row above: it
    // reaches all four sides, it fills 100%, its rings are closed and integral.
    // It would also draw exactly the picture this replaced.
    //
    // So: most parts must be concave, and the ones that really ARE rectangles
    // are named rather than assumed.
    const trueRectangles = new Set([
      "dovetail-cap-double-f-solid",
      "dovetail-cap-double-m-solid",
      "dovetail-cap-single-f-solid",
      "dovetail-cap-single-m-solid",
    ]);
    const shaped = Object.keys(HEX_PART_OUTLINE).filter(
      (slug) => !trueRectangles.has(slug),
    );
    for (const slug of shaped) {
      expect(fillFraction(slug), `${slug} fills its whole box`).toBeLessThan(0.95);
    }
    // CONTROL: the parts that are genuinely rectangles are still drawn as
    // rectangles, so "less than its box" is not being satisfied by a table that
    // shrank everything.
    for (const slug of trueRectangles) {
      expect(HEX_PART_OUTLINE[slug]).toHaveLength(1);
      expect(HEX_PART_OUTLINE[slug][0]).toHaveLength(8); // four points
      expect(fillFraction(slug), `${slug}`).toBeGreaterThan(0.99);
    }
  });

  it("keeps the through-holes that tell two caps apart", () => {
    // A hex tile and a carrier tray are told apart by their boundary; a solid cap
    // and a 3H cap are told apart ONLY by holes. A representation that carried
    // just the outer boundary -- a convex hull, or the outer ring alone -- would
    // draw these two identically, which is the specific failure this pins.
    expect(HEX_PART_OUTLINE["dovetail-cap-double-f-solid"]).toHaveLength(1);
    expect(HEX_PART_OUTLINE["dovetail-cap-double-f-1h"]).toHaveLength(2);
    expect(HEX_PART_OUTLINE["dovetail-cap-double-f-2h"]).toHaveLength(3);
    expect(HEX_PART_OUTLINE["dovetail-cap-double-f-3h"]).toHaveLength(4);
  });
});
