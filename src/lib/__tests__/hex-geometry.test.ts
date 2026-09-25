// The generated part geometry table (hex-cluster `tools/gen_release_tables.py`,
// launch readiness 4.6).
//
// A generated file is only as good as the thing that checks it, and this one is
// checked against sources it did not come from: the published slug list, the
// bed floor and the packer's gap, and the release the rest of the app
// publishes. The generator's own cross-check (each derived print-pose size
// against the manifest's `printBboxMm`) runs at generation time and cannot run
// here, because the manifest lives in a sibling repo that never ships with the
// app. The file's integrity is `hex-release-tables.test.ts`.
import { describe, expect, it } from "vitest";

import {
  HEX_GEOMETRY_RELEASE,
  HEX_PART_BOX,
  HEX_PART_CORNER_INEXACT,
  HEX_PART_NAME,
} from "@/lib/hex-geometry";
import { BED_FLOOR_MM } from "@/lib/hex-pack";
import { HEX_PART_SLUGS } from "@/lib/hex-parts";
import { PLATE_GAP } from "@/lib/hex-plate";
import { HEX_RELEASE } from "@/lib/hex-spec";
// THE REAL uploader transform, imported rather than re-typed. A local copy of
// `slug()` here would agree with itself forever: the whole assertion is that the
// generator's spelling of that transform still matches the one that mints the R2
// keys, and a second copy is a third spelling that could drift from both.
import { slug } from "@/lib/r2";

/**
 * The release the CONFIGURATOR has transcribed this table for.
 *
 * A TRIPWIRE, not a fact this repo can look up. The configurator (`bs-cap`)
 * carries a generated copy of `HEX_PART_BOX` and of `packPlates`, so it can put
 * a plate count inside its download button. It pins that copy to a release, and
 * it has tests that compare our real packer's answers against its own -- but
 * those need both checkouts side by side, so they SKIP in its CI, and this repo
 * has no configurator checkout either.
 *
 * That is the quiet-disagreement shape: we re-cut, both CIs stay green, the
 * route stops plating anything whose release is not ours and serves a loose zip,
 * and the configurator's button goes on claiming "3 plates" for a zip that has
 * none. Nobody is paged, because nothing failed.
 *
 * So the number lives here as a constant a human must move. Bumping
 * HEX_RELEASE without touching this line turns a silent cross-repo drift into a
 * red test in the repo doing the bumping, which is the only side that knows it
 * happened. Moving it is the moment to open the configurator's PR.
 */
// Moved deliberately to the v2 release with 4.6 ("CONFIGURATOR_PINNED_RELEASE
// is updated deliberately"). The configurator's own copy is regenerated on its
// branch (launch readiness phase 7), not here.
const CONFIGURATOR_PINNED_RELEASE = "2026-10-01";

describe("the geometry table", () => {
  it("is still the release the configurator pinned its copy to", () => {
    // Deliberately NOT a lookup of the configurator's own constant: reading it
    // would make this pass automatically the moment someone regenerated over
    // there, which is exactly the coordination this exists to force. If you are
    // here because this failed, the fix is not to edit the number -- it is to
    // re-run `pnpm hex:geometry` in bs-cap, ship that, and THEN edit it.
    expect(HEX_GEOMETRY_RELEASE).toBe(CONFIGURATOR_PINNED_RELEASE);
  });

  it("covers every published slug", () => {
    // Two transcriptions of the same manifest. A re-cut that regenerates one and
    // not the other is caught here rather than by a pack that overlaps parts --
    // or, for a slug the table has lost entirely, by a route that throws on a
    // build somebody has already paid attention to configuring.
    for (const slug of HEX_PART_SLUGS) {
      expect(HEX_PART_BOX[slug], `no box for ${slug}`).toBeDefined();
    }
  });

  it("has no part too large for the bed floor, margin included", () => {
    // The design leans on this: a bed picker changes the plate COUNT and can
    // never make a part unprintable. The pack route refuses any bed under
    // BED_FLOOR_MM (decision 1.5), so the floor is the smallest bed a part must
    // fit.
    //
    // The margin is part of the invariant, not decoration. The packer throws
    // when `size + 2 * PLATE_GAP` exceeds the bed. DERIVED from the two
    // constants rather than typed as a number. Both dimensions are held to the
    // floor because the packer does not rotate parts.
    //
    // Headroom on the 2026-10-01 tables: the widest part is
    // hex-jig-tolerance-ladder at 210 mm against a limit of 212.
    const limit = BED_FLOOR_MM - 2 * PLATE_GAP;
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

  it("names every part it has a box for, and no others", () => {
    // Two tables generated from one pass over one directory, so they can only
    // disagree if the generator was edited into disagreeing with itself -- but a
    // box with no name is exactly the shape that tempts a caller into falling
    // back to the slug, and a name with no box is a part the packer will never
    // be asked to place. Held from BOTH sides, and against HEX_PART_SLUGS too,
    // so a slug can go missing from either table and still be caught.
    expect(Object.keys(HEX_PART_NAME).sort()).toEqual(
      Object.keys(HEX_PART_BOX).sort(),
    );
    for (const s of HEX_PART_SLUGS) {
      expect(HEX_PART_NAME[s], `no name for ${s}`).toBeTruthy();
    }
  });

  it("gives every part the name its own R2 key was derived from", () => {
    // THE INVARIANT THAT TIES THE TWO TOGETHER. The mesh is fetched by the KEY
    // and the object is labelled with the NAME, and the only thing making those
    // the same part is that the generator read them off one filename. Nothing
    // downstream can check it: `Hex-TB-Main` and `Hex-TB-Spare` are equally
    // plausible labels on a mesh fetched as `hex-tb-main`, and a plate carrying
    // the wrong one opens perfectly and prints the wrong thing.
    //
    // Run through `slug()` from `@/lib/r2` -- the function that actually mints
    // the published keys -- rather than through the generator's own copy of that
    // transform, so a divergence between the two fails HERE instead of at a
    // stranger's printer. That is a live risk rather than a theoretical one: the
    // generator cannot import `slug()` (it would drag in `@/env` and validate
    // the whole server environment to measure a directory of meshes), so a copy
    // is unavoidable and this is what holds it honest.
    //
    // A re-cut that renamed `Hex-TB-Main.3mf` to `Hex_TB_Main.3mf` keeps the
    // same slug and changes the name -- fine, and this passes. One that paired a
    // name with someone else's row does not.
    for (const [key, name] of Object.entries(HEX_PART_NAME)) {
      expect(slug(name), `${key} is named ${name}`).toBe(key);
    }
  });

  it("seats every part on the bed: z0 is 0", () => {
    // The v2 exporter drops every part onto Z = 0 before it writes the mesh
    // (`oriented_for_print` in hex-cluster), so the writer's `-z0` is 0 for
    // every part. A non-zero value here would be a table describing some other
    // exporter, and the plate would float that part.
    for (const [slug, box] of Object.entries(HEX_PART_BOX)) {
      expect(box.z0, slug).toBe(0);
    }
  });

  it("records measured boxes, not rounded or reordered ones", () => {
    // Pinned measurements from the 2026-09-21 build manifest. Two kinds:
    //
    //   hex-main is axis-aligned, so its corner is EXACT: the source box
    //   (originMm -95.381, -86.603) is the print box, and its size is
    //   printBboxMm 190.762 x 169.205 x 80.
    //
    //   hex-cap-edge-1h-f is turned X 90 to print, so its source z (0..80)
    //   becomes -y: y0 is -80. A generator that forgot to rotate the corner
    //   would carry the source y0, 73.603, and fails here.
    expect(HEX_PART_BOX["hex-main"]).toEqual({
      x0: -95.381, y0: -86.603, z0: 0, dx: 190.762, dy: 169.205, dz: 80,
    });
    expect(HEX_PART_BOX["hex-cap-edge-1h-f"].y0).toBe(-80);
    expect(HEX_PART_BOX["hex-cap-edge-1h-f"].dy).toBe(80);
  });

  it("estimates a corner only where the pose forces it, and by less than the gap", () => {
    // A pose that is not axis-aligned (the four male edge caps at Z 60, the two
    // spikes at Z +-60) has no exact corner in the manifest. The generator emits
    // the middle of the range the true corner must lie in and records the worst
    // error. That error must stay inside the packer's gap, or an estimated part
    // could reach its neighbour.
    for (const [slug, err] of Object.entries(HEX_PART_CORNER_INEXACT)) {
      expect(HEX_PART_BOX[slug], slug).toBeDefined();
      expect(err, slug).toBeGreaterThan(0);
      expect(err, slug).toBeLessThan(PLATE_GAP);
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
