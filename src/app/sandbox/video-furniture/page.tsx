// Round 1: video furniture for the YouTube cut. AUDITION SURFACE - deleted
// before the PR; only the picks survive.
//
//   /sandbox/video-furniture
//
// WHY THIS ROUND EXISTS. The guides carry 127 titled youtube slots with no video
// (audit 2026-08-13, `scripts/_verify-guide-render.ts`). Those are screencasts,
// and every one of them needs the same four wrappers. Authoring furniture once
// and generating it 127 times only works if the treatment is decided by eye
// FIRST - which is what this page is for.
//
// Everything here runs on the film's rules, because they were paid for:
// scrub-never-play, shares-of-frame not pixels, and real product tokens rather
// than a parallel look. The stage names, abbreviations and artifact tiles are
// the product's own (`STAGE_LABELS`, `combAbbr`, `stageArt`), so a card cannot
// drift from the course it introduces.
//
// ASCII only.

import { notFound } from "next/navigation";
import { Round } from "./Round";

export default function VideoFurnitureSandbox() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Round />;
}
