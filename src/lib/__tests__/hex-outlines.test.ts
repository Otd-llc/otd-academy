// The outline table and the display families the package thumbnail draws with.
//
// The v2 outline table is EMPTY (see `hex-outlines.ts`): v1's silhouettes were
// traced off v1 meshes, which left the live catalogue with launch readiness 4.6,
// and the v2 tables are generated from the release manifest, which has no
// meshes to trace. The shape invariants below still run over whatever rows the
// table holds, so a future v2 outline table lands already guarded. The rows that
// pinned v1 measurements went with the v1 parts they measured.
import { describe, expect, it } from "vitest";

import { HEX_PART_BOX } from "@/lib/hex-geometry";
import {
  HEX_OUTLINE_RELEASE,
  HEX_OUTLINE_SCALE,
  HEX_PART_OUTLINE,
} from "@/lib/hex-outlines";
import {
  HEX_DISPLAY_FAMILIES,
  HEX_DISPLAY_FAMILY_OF,
  HEX_PART_FAMILIES,
  HEX_PART_SLUGS,
  displayFamilyOf,
} from "@/lib/hex-parts";
import { HEX_PUBLISHED_RECORD_SLUGS } from "@/lib/hex-published-record";
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
  it("describes the release the app publishes", () => {
    expect(HEX_OUTLINE_RELEASE).toBe(HEX_RELEASE);
  });

  it("outlines only parts in the release, and only parts with a box", () => {
    // A row for a part outside the release is a silhouette no plate can draw:
    // exactly what the v1 rows became when v1 left the catalogue.
    const live = new Set<string>(HEX_PART_SLUGS);
    for (const slug of Object.keys(HEX_PART_OUTLINE)) {
      expect(live.has(slug), slug).toBe(true);
      expect(HEX_PART_BOX[slug], slug).toBeDefined();
    }
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
    // budget below is the ceiling every part in the set must stay under.
    for (const slug of Object.keys(HEX_PART_OUTLINE)) {
      const fill = fillFraction(slug);
      expect(fill, `${slug} fill`).toBeGreaterThan(0.3);
      expect(fill, `${slug} fill`).toBeLessThanOrEqual(1.02);
      const points = HEX_PART_OUTLINE[slug].reduce((n, r) => n + r.length / 2, 0);
      expect(points, `${slug} points`).toBeLessThanOrEqual(200);
    }
  });

});

describe("the display families", () => {
  it("fold every release family onto one of the six rungs", () => {
    const rungs = new Set<string>(HEX_DISPLAY_FAMILIES);
    expect(Object.keys(HEX_DISPLAY_FAMILY_OF).sort()).toEqual(
      [...HEX_PART_FAMILIES].sort(),
    );
    for (const [family, rung] of Object.entries(HEX_DISPLAY_FAMILY_OF)) {
      expect(rungs.has(rung), `${family} -> ${rung}`).toBe(true);
    }
  });

  it("give every released part a display family, and none to a stranger", () => {
    for (const slug of HEX_PART_SLUGS) {
      expect(displayFamilyOf(slug), slug).toBeDefined();
    }
    // A part that is not in the release (here, a v1 slug from the published
    // record) has no display family: membership, not a name rule.
    expect(displayFamilyOf(HEX_PUBLISHED_RECORD_SLUGS[0])).toBeUndefined();
  });

  it("draw the parts that are what they say as that, and cells' fittings as inserts", () => {
    expect(displayFamilyOf("hex-main")).toBe("base");
    expect(displayFamilyOf("hex-spike-solid")).toBe("spike");
    expect(displayFamilyOf("hex-cap-edge-1h-f")).toBe("cap");
    expect(displayFamilyOf("hex-acc-hook")).toBe("accessory");
    expect(displayFamilyOf("hex-main-cover")).toBe("insert");
    expect(displayFamilyOf("hex-main-stack-collar")).toBe("insert");
  });
});
