// What each released part LOOKS LIKE from above, for one reader: the 3MF package
// thumbnail (`src/lib/hex-thumbnail.ts`).
//
// EMPTY FOR THE v2 RELEASE, deliberately. The v1 table here was traced off the
// v1 meshes by `scripts/gen-hex-geometry.ts`, and v1 is dead: its 53 parts left
// the live catalogue and plating with launch readiness 4.6, so every row keyed a
// part no plate can hold any more. The v2 tables now come from the hex-cluster
// generator, which reads the release MANIFEST and has no meshes to trace, so it
// cannot produce a silhouette.
//
// Until a v2 outline table exists, the thumbnail draws every part as its
// bounding box. That fallback is the one it already had for a placement with no
// row, so nothing about a plate changes except the picture on its package.
//
// Coordinates, when there are any, are integers 0..HEX_OUTLINE_SCALE: PER-MILLE
// of the part's own bounding box on each axis, y measured from the box's
// minimum corner. Rings close implicitly and fill EVEN-ODD.
import { HEX_TABLES_RELEASE } from "@/lib/hex-release-tables";

/** The release the outlines describe. With the table empty it is simply the
 *  release the tables were generated for. */
export const HEX_OUTLINE_RELEASE = HEX_TABLES_RELEASE;

/** Outline coordinates run 0..this, on both axes, across the part's own bounding
 *  box. Exported so the drawing code divides by the number a tracer multiplied
 *  by, rather than by its own copy of it. */
export const HEX_OUTLINE_SCALE = 1000;

/** Each part's top-down outline, as closed rings of `x, y, x, y, ...` integers
 *  in 0..HEX_OUTLINE_SCALE. Empty for v2; see the header. */
export const HEX_PART_OUTLINE: Readonly<
  Record<string, readonly (readonly number[])[]>
> = {};
