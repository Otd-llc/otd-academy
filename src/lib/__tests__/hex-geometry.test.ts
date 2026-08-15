// The generated part geometry table.
//
// A generated file is only as good as the thing that checks it, and this one is
// checked against three sources it did not come from: the published slug list,
// the two constants that define the smallest bed we accept, and the release the
// rest of the app publishes. The generator's own manifest cross-check (against
// the FreeCAD solid's bounding box) runs at generation time and cannot run here,
// because the meshes live in a sibling repo that never ships with the app.
import { describe, expect, it } from "vitest";

import { HEX_GEOMETRY_RELEASE, HEX_PART_BOX } from "@/lib/hex-geometry";
import { BED_MIN } from "@/lib/hex-pack";
import { HEX_PART_SLUGS } from "@/lib/hex-parts";
import { PLATE_GAP } from "@/lib/hex-plate";
import { HEX_RELEASE } from "@/lib/hex-spec";

describe("the geometry table", () => {
  it("covers every published slug", () => {
    // Two transcriptions of the same manifest. A re-cut that regenerates one and
    // not the other is caught here rather than by a pack that overlaps parts --
    // or, for a slug the table has lost entirely, by a route that throws on a
    // build somebody has already paid attention to configuring.
    for (const slug of HEX_PART_SLUGS) {
      expect(HEX_PART_BOX[slug], `no box for ${slug}`).toBeDefined();
    }
  });

  it("has no part too large for the smallest bed we accept, margin included", () => {
    // The design leans on this: a bed picker changes the plate COUNT and can
    // never make a part unprintable. If a future part breaks it, that promise
    // needs revisiting, not this assertion relaxing.
    //
    // The margin is part of the invariant, not decoration. The packer throws
    // when `size + 2 * PLATE_GAP` exceeds the bed, so a bare `< BED_MIN` check
    // would pass a 95 mm part and then throw on a 100 mm bed. DERIVED from the
    // two constants rather than typed as a number, so widening the gap or
    // lowering the floor is caught here instead of at a stranger's printer.
    //
    // Both dimensions are held to the SMALLER of the two bed limits because a
    // bed need not be square: 100 x 1000 is an accepted bed, and the packer does
    // not rotate parts, so a part is only safe if it clears BED_MIN on the axis
    // it happens to be long in.
    //
    // Headroom on the 2026-08-03 set: the largest footprint is hex-tb-main and
    // the four hex-tb-half-top parts at 87.757 mm, against a limit of 92, so
    // 4.243 mm to spare.
    const limit = BED_MIN - 2 * PLATE_GAP;
    for (const [slug, box] of Object.entries(HEX_PART_BOX)) {
      expect(Math.max(box.dx, box.dy), `${slug} footprint`).toBeLessThanOrEqual(
        limit,
      );
    }
  });

  it("gives every part a real, positive size", () => {
    // The generator computes a size by sweeping vertices, so a source it cannot
    // parse yields Infinity and NaN rather than an error. `NaN` is valid
    // TypeScript and would sail through a typecheck, then compare false against
    // every bound the packer applies -- so a part with no size would be laid
    // straight on top of its neighbour. Cheap to assert, invisible otherwise.
    for (const [slug, box] of Object.entries(HEX_PART_BOX)) {
      for (const axis of ["dx", "dy", "dz"] as const) {
        expect(Number.isFinite(box[axis]), `${slug}.${axis}`).toBe(true);
        expect(box[axis], `${slug}.${axis}`).toBeGreaterThan(0);
      }
      // The minimum corner may sit anywhere, including below the origin, but it
      // still has to be a number: the 3MF writer turns it into a translation.
      for (const axis of ["x0", "y0", "z0"] as const) {
        expect(Number.isFinite(box[axis]), `${slug}.${axis}`).toBe(true);
      }
    }
  });

  it("was regenerated for the release the app publishes", () => {
    // The staleness this file cannot notice about itself. Every number above
    // describes ONE cut of the meshes; bumping HEX_RELEASE without re-running
    // the generator leaves them describing the previous one, and the symptom
    // would be parts overlapping on a plate in someone else's slicer. Fail here,
    // where the fix is one command, instead.
    expect(HEX_GEOMETRY_RELEASE).toBe(HEX_RELEASE);
  });
});
