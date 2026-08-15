// The contract between a capture surface and whatever is driving its clock.
//
// WHY IT LIVES IN ONE FILE. There were two `declare global` blocks for `__seek`
// -- one in the furniture frame, one in the film stage -- and they drifted into
// different shapes, which TypeScript reports as "Subsequent property
// declarations must have the same type" at the point somebody finally fixes one
// of them. Two declarations of one global is the same failure as two settle
// contracts: whichever is weaker wins silently until it doesn't.
//
// THE CONTRACT. `__seek(t)` sets scene time; the driver owns the clock and the
// surface has no wall clock of its own. A surface that can say when it has
// FINISHED returns a promise that settles once the frame is safe to measure or
// photograph. `src/app/sandbox/video-furniture/r2/frame/FrameOne.tsx` is the
// reference implementation, and it matches `__cutSet` in the capture sandbox.
//
// `void` is still in the union because `film-render/[cut]/FrameStage.tsx` has
// NOT been migrated: its settle signal is raised by a child (`LogbookLive` sets
// `data-settled` after its pin pass), so promising from the stage means
// threading a resolver through the child, and its renderer lives in the
// extracted `otd-promo` repo where the change cannot be verified from here.
// Awaiting a `void` is harmless, so a driver that awaits is correct against
// both surfaces today and stays correct after that migration.
//
// DRIVERS MUST AWAIT, and must treat a MISSING `__seek` as an error rather than
// a no-op. Optional-chaining the call is what made the furniture checker
// measure frame 0 eight hundred times while every assertion counted itself.

declare global {
  interface Window {
    __seek?: (t: number) => void | Promise<void>;
    /** Furniture frame: which piece/variant is mounted, and at what size. */
    __pieceInfo?: () => { piece: string; variant: string; seconds: number; w: number; h: number };
    /** Film stage: which format is mounted, and at what size. */
    __filmInfo?: () => { fmt: string; w: number; h: number; seconds: number };
  }
}

export {};
