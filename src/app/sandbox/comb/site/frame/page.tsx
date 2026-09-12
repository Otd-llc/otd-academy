// SANDBOX — ONE comb, inside the page shell it will really live in.
//
// This route is what the device frames on ../ load. It exists as its own document
// rather than as a component the parent renders three times, and that is not a
// convenience: `max-w-6xl`, `px-4 sm:px-6` and `-mx-4 sm:mx-0` are VIEWPORT media
// queries. Rendered three times inside one 1900px window they would all resolve at
// 1900px, so the "phone" column would silently draw the desktop layout and the round
// would be measuring nothing. An iframe has its own viewport, so the breakpoints fire
// where the device would fire them.
//
// The shell is copied from the real pages, not approximated:
//   build guide  src/app/(chrome)/projects/[slug]/[revLabel]/guide/page.tsx
//   courses      src/app/(chrome)/courses/page.tsx
// both `<main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">` with a PageHeader,
// and both wrapping the comb in `-mx-4 sm:mx-0` so it bleeds to the screen edge on a
// phone. The sticky site header and footer are NOT here; they need a session and nav
// data, and what is being judged is the comb in its column.
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CombFrame } from "./CombFrame";

type Params = {
  comb?: string;
  shape?: string;
  theme?: string;
  cap?: string;
  sw?: string;
  na?: string;
};

/** A query number, clamped, with a fallback. The frame is dev-only, but a NaN here
 *  would silently render a comb with no outline at all, which reads as a bug in the
 *  design rather than in the URL. */
const num = (v: string | undefined, lo: number, hi: number, dflt: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
};

// Awaiting `searchParams` outside a Suspense boundary blocks the whole route from
// rendering, and Next says so at runtime. The await lives in its own child so the
// boundary can hold it.
async function Body({ searchParams }: { searchParams: Promise<Params> }) {
  const { comb, shape, theme, cap, sw, na } = await searchParams;
  return (
    <CombFrame
      comb={comb === "courses" ? "courses" : "guide"}
      shape={shape === "grid" ? "grid" : "ribbon"}
      theme={theme === "light" ? "light" : "dark"}
      capped={cap !== "none"}
      strokeMult={num(sw, 0.1, 3, 1)}
      numAlpha={num(na, 0, 100, 32)}
    />
  );
}

export default function FramePage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense fallback={null}>
      <Body searchParams={searchParams} />
    </Suspense>
  );
}
