// Audition surface: the piece playing in real time, with its bed, swappable live.
//
//   /sandbox/video-furniture/r2/preview
//
// The rounds pages judge COMPOSITION on a grid and `frame/` is where things get
// MEASURED. Neither can judge motion or sound, because both are static. This is
// the third question -- does it read, and does it land with the music -- and it
// needs a transport rather than a screenshot.
//
// Beds come from `public/_beds`, written by `python tools/furniture-bed.py`.
// They are gitignored: audio, and a dozen auditions of it, does not belong in a
// public repo.
//
// ASCII only.

import { notFound } from "next/navigation";
import { Preview } from "./Preview";

export default function R2Preview() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Preview />;
}
