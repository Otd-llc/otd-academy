// ONE piece, full viewport, driven from outside. The honest instrument.
//
//   /sandbox/video-furniture/frame?piece=intro&variant=bench&stage=SCHEMATIC
//
// WHY THIS EXISTS SEPARATELY FROM THE GRID. The round's tiles are three to a
// row, so each one renders at roughly a quarter of 1920 wide. Every size in the
// furniture is a share of its container, so the COMPOSITION is faithful at any
// size - but a measurement taken there is not: a 0.14cqw datum rule is under a
// pixel in a tile and three pixels in the deliverable, and a collision checker
// reading the small one finds nothing to report. That is the same mistake the
// Logbook round paid for (an absolute cap tuned at 1/5 scale, encoded at 1080),
// and the tile grid quietly reintroduced it.
//
// So: judge composition on the grid, MEASURE here, at the size that ships.
//
// Same two contracts as the film's capture surface, deliberately, so this can
// become one without being rewritten:
//   `window.__seek(t)` sets the clock - there is no wall clock on this page.
//   `[data-settled]` says the frame is finished and safe to photograph.
//
// ASCII only.

import { notFound } from "next/navigation";
import { FrameOne } from "./FrameOne";

export default async function FurnitureFrame({
  searchParams,
}: {
  searchParams: Promise<{ piece?: string; variant?: string; stage?: string; guides?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  return (
    <FrameOne
      piece={sp.piece ?? "intro"}
      variant={sp.variant ?? "plate"}
      stage={sp.stage ?? "SCHEMATIC"}
      guides={sp.guides === "1"}
    />
  );
}
