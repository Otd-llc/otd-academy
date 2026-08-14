// The veil round, with the artifact tiles on.
//
//   /sandbox/comb-veil
//
// Follows the alpha-carousel round, which shipped WITHOUT the tiles: the shipped comb
// hoists its artwork into a `.gh-art-layer` above every cell, and that layer was simply
// missing. Six variations here, on the two things still open - how deep the veil cuts,
// and whether an off-window hex is still a stage or just a cell.
//
// Dev-only, deleted before the PR.
//
// ASCII only.

import { notFound } from "next/navigation";
import { Round } from "./Round";

export default function CombVeilSandbox() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Round />;
}
