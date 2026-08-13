// Round 2's measurement surface: ONE treatment, full viewport.
//
//   /sandbox/video-furniture/r2/frame?piece=intro&variant=hex&stage=SCHEMATIC
//
// Same reason as round 1's `frame/`: the grid renders three to a row, at about
// a quarter of 1920, and a measurement taken there is not a measurement of the
// deliverable. A 0.14cqw hairline is sub-pixel in a tile and 3 px in the export,
// and a collision checker reading the small one finds nothing to report. Judge
// composition on the grid; measure here.
//
// ASCII only.

import { notFound } from "next/navigation";
import { FrameOne } from "./FrameOne";

export default async function R2Frame({
  searchParams,
}: {
  searchParams: Promise<{ piece?: string; variant?: string; stage?: string; guides?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  return (
    <FrameOne
      piece={sp.piece ?? "intro"}
      variant={sp.variant ?? "right"}
      stage={sp.stage ?? "SCHEMATIC"}
      guides={sp.guides === "1"}
    />
  );
}
