// Round 2's measurement surface: ONE treatment, full viewport.
//
//   /sandbox/video-furniture/r2/frame?piece=intro&variant=hex&stage=SCHEMATIC
//
// `?alpha=1` drops the deep-space ground so the surface can be photographed with
// a transparent background, which is what an OVERLAY piece needs to sit on top of
// footage in an NLE. Without it every overlay exports as a black rectangle.
//
// Same reason as round 1's `frame/`: the grid renders three to a row, at about
// a quarter of 1920, and a measurement taken there is not a measurement of the
// deliverable. A 0.14cqw hairline is sub-pixel in a tile and 3 px in the export,
// and a collision checker reading the small one finds nothing to report. Judge
// composition on the grid; measure here.
//
// ASCII only.

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { FrameOne } from "./FrameOne";

type FrameParams = { piece?: string; variant?: string; stage?: string; guides?: string; alpha?: string };

/**
 * The runtime read, isolated.
 *
 * `searchParams` is Runtime data under Cache Components, so awaiting it in the
 * route component makes the WHOLE page blocking -- nothing can be prerendered
 * and Next reports the route as blocking in dev. Pushing the await into a child
 * behind <Suspense> is the documented fix, and it is the same shape used
 * elsewhere in this app.
 */
async function Frame({ searchParams }: { searchParams: Promise<FrameParams> }) {
  const sp = await searchParams;
  return (
    <FrameOne
      piece={sp.piece ?? "intro"}
      variant={sp.variant ?? "right"}
      stage={sp.stage ?? "SCHEMATIC"}
      guides={sp.guides === "1"}
      alpha={sp.alpha === "1"}
    />
  );
}

export default function R2Frame({ searchParams }: { searchParams: Promise<FrameParams> }) {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    // THE FALLBACK PAINTS NOTHING, deliberately. A prerendered fallback IS
    // painted, and this surface exists to be photographed -- anything drawn here
    // could land in a frame grab or flash a ground behind a piece that is
    // supposed to be transparent. `null` cannot. The capture rig waits for
    // `window.__seek` to be installed before it shoots, which only happens once
    // FrameOne has mounted and replaced this, so the wait is already correct.
    <Suspense fallback={null}>
      <Frame searchParams={searchParams} />
    </Suspense>
  );
}
