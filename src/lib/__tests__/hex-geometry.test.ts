// The generated part geometry table.
//
// A generated file is only as good as the thing that checks it, and this one is
// checked against three sources it did not come from: the published slug list,
// the two constants that define the smallest bed we accept, and the release the
// rest of the app publishes. The generator's own manifest cross-check (against
// the FreeCAD solid's bounding box) runs at generation time and cannot run here,
// because the meshes live in a sibling repo that never ships with the app.
import { describe, expect, it } from "vitest";

import {
  HEX_GEOMETRY_RELEASE,
  HEX_PART_BOX,
  HEX_PART_MESH_BOTTOM,
  HEX_PART_NAME,
} from "@/lib/hex-geometry";
import { BED_MIN } from "@/lib/hex-pack";
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
const CONFIGURATOR_PINNED_RELEASE = "2026-08-17";

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
    // the four hex-tb-half-top parts at 87.7572 mm, against a limit of 92, so
    // 4.2428 mm to spare.
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

  it("agrees with the mesh text about where every part's floor is", () => {
    // The generator's own seat gate, repeated here so it also holds for a table
    // nobody regenerated. `z0` is `HEX_PART_MESH_BOTTOM` parsed; a rounding
    // introduced in the numeric path, or a value edited by hand into the file
    // marked "do not edit by hand", breaks the pair. The whole feature rests on
    // `z0` being the mesh's real minimum, because the writer negates it to seat
    // the part -- 0.144 instead of 0.144338 is what left one object 3.38e-4 mm
    // off a bed the rest of the plate sat on.
    //
    // Held from BOTH sides first: a floor with no box is a part the writer will
    // never place, and a box with no floor is one the seat sweep in
    // `hex-3mf.test.ts` would silently stop covering.
    expect(Object.keys(HEX_PART_MESH_BOTTOM).sort()).toEqual(
      Object.keys(HEX_PART_BOX).sort(),
    );
    for (const [slug, text] of Object.entries(HEX_PART_MESH_BOTTOM)) {
      expect(Number(text), `${slug} floor text "${text}"`).toBe(
        HEX_PART_BOX[slug].z0,
      );
    }
  });

  it("records the minimum corner unrounded, at the precision the mesh states it", () => {
    // THE HALF OF THE SEAT INVARIANT THAT NOTHING ELSE IN CI CAN SEE.
    //
    // `hex-3mf.test.ts` proves the writer seats a part exactly where the table
    // says its mesh bottom is. Whether the table is RIGHT about that is a
    // question only the mesh can answer, and the meshes are a sibling checkout
    // that never ships with the app. So the two values below are pinned: they
    // are measurements, taken from release 2026-08-03, recorded here because
    // this repo has nothing else to compare against.
    //
    // Both were rounded to 3 dp by the generator until 2026-08-15, and both
    // spellings are quoted so a regression is obvious rather than arithmetic:
    //
    //   z0  Hex-TB-Spike-Ball-Joint.3mf's lowest vertex is verbatim
    //       `<vertex x="25.5" y="-39.3851" z="0.144338" />`. Stored as 0.144, the
    //       writer emitted `tz = -0.144` and left that one part 3.38e-4 mm above
    //       a bed every other object on the plate sat exactly on -- which is what
    //       made Creality Print offer to fuse the plate into one multi-part
    //       object. It is the only part whose `z0` is anything but float noise,
    //       because it is the only one whose upstream drop-to-bed used a slightly
    //       enlarged OCC bounding box.
    //
    //   x0  Hex-TB-Main measures -43.8786 and was stored as -43.879. Independently
    //       confirmed by the known-good reference plate, which was opened in
    //       Creality Print V7.2.1 and places it with `tx = 47.8786` from a target
    //       of 4 mm: 4 - (-43.8786). Nothing on a bed notices 0.4 micron, so this
    //       one is pinned because it is the same mistake rather than because it
    //       hurt.
    //
    // A re-cut that legitimately changes either number fails here. That is the
    // intended behaviour: these are facts about a specific mesh set, the release
    // stamp below is pinned for the same reason, and "re-measure it" is the
    // correct response to both.
    expect(HEX_PART_BOX["hex-tb-spike-ball-joint"].z0).toBe(0.144338);
    expect(HEX_PART_BOX["hex-tb-main"].x0).toBe(-43.8786);

    // And that the ball joint is still the ONLY part sitting meaningfully off
    // its own origin. Without this, a re-cut could introduce a second such part
    // and the pin above would keep passing while the new one went unexamined.
    // 1e-11 mm separates the exporter's float noise (the largest is
    // `hex-tb-spike-solid` at 1.90781e-12) from real geometry by two orders of
    // magnitude on one side and eight on the other; it is a classifier here, NOT
    // a seat tolerance. The seat tolerance is zero, and it lives in
    // `hex-3mf.test.ts` with its own argument.
    const real = Object.entries(HEX_PART_BOX)
      .filter(([, box]) => Math.abs(box.z0) > 1e-11)
      .map(([slug]) => slug);
    expect(real).toEqual(["hex-tb-spike-ball-joint"]);
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
