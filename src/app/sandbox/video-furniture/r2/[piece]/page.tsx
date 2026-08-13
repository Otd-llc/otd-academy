// Round 2, one piece per page. Ten treatments each.
//
//   /sandbox/video-furniture/r2/intro
//   /sandbox/video-furniture/r2/section
//   /sandbox/video-furniture/r2/lower
//   /sandbox/video-furniture/r2/outro
//
// Split by piece rather than one long page because forty 16:9 frames on one
// scroll is not a comparison, it is a catalogue. Ten of one kind side by side is
// the round the owner can actually judge.
//
// ASCII only.

import { notFound } from "next/navigation";
import { Grid } from "../Grid";
import { PIECE_KEYS, type PieceKey } from "../variants";

export default async function R2Page({ params }: { params: Promise<{ piece: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { piece } = await params;
  if (!PIECE_KEYS.includes(piece as PieceKey)) notFound();
  return <Grid piece={piece as PieceKey} />;
}
