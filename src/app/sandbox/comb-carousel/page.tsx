// The alpha-carousel round.
//
//   /sandbox/comb-carousel
//
// Auditions the GHOST treatment. The window rule, the centring and the two edge cases
// are the owner's and are settled, tested geometry in `lib/comb-carousel.ts`; what is
// still open is what the cells outside the window should look like.
//
// Dev-only, and deleted before the PR like every round before it.
//
// ASCII only.

import { notFound } from "next/navigation";
import { Round } from "./Round";

export default function CombCarouselSandbox() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Round />;
}
