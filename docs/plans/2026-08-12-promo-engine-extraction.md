# Extracting the promo motion engine to `otd-promo`

**Status:** scoped, not started. **Owner go-ahead required before any merge.**
**Written:** 2026-08-12. **Source branch:** `feat/logbook-cut-sandbox` @ `51c66514`.

## Why this is urgent rather than tidy

The Logbook cut lives in `src/app/sandbox/logbook-cut/`, and **every `/sandbox/*`
route is dev-guarded and deleted before its PR** — that is the standing
convention and it has been honoured on every previous round. About 1,500 lines
of the code in there is not about the Logbook at all: it is a general motion
system that took a full session and a dozen paid-for traps to get right.

If the sandbox is deleted before the engine moves, the engine goes with it and
the next film starts from `transition: opacity 0.2s` again.

**So the extraction happens BEFORE the mp4 render, not after.**

## What is actually reusable

Sorted by value, all of it currently in `src/app/sandbox/logbook-cut/`:

| file | reusable? | what it is |
| --- | --- | --- |
| `motion.ts` | **entirely** | 10 enter/exit moves, 13 motions (incl. 4 Ken Burns), 5 cameras, 4 parallax depths, per-part place/size, fit-to-frame sizing, one composed transform. Zero Logbook knowledge. |
| `tuning.ts` | **most** | 11 word entrances, 7 word exits, 3 flows, word positions, `preRoll`. The `Jaunty` set is patch-specific and stays behind. |
| `LogbookType.tsx` | **most** | The kinetic type layer. Rename; it is not Logbook-specific. |
| `LogbookLive.tsx` | **the harness only** | `useSceneClock` (scrub + IntersectionObserver + 30fps), `usePin` (the double pin), the stage box. The four scenes are the film and stay. |
| `round/page.tsx` | **as a pattern** | The round-page shape: one scrollable list, recipes counted off the scheme, `?t=` freeze, `?only=` isolate. |
| `beats.ts`, `mixes.ts`, `assembly.ts`, `candidates.ts` | **no** | These are the Logbook film. They become the first *consumer* of the engine. |
| `quiz-select/` | **no — different destination** | The winner (`others` + `typeon`) ships into this repo's `globals.css`. It is a product change, not a promo one. |

## Target shape in `otd-promo`

    packages/motion/
      moves.ts        Move, moveVec, moveMask
      motions.ts      Motion, motionVec  (incl. Ken Burns)
      camera.ts       Camera, Parallax, cameraVec, parallaxVec, DEPTH
      fit.ts          INTRINSIC / FILL / fitScale  (per-consumer registry)
      compose.ts      Vec, add, partStyle
      type/           Kinetic, KineticOut, kineticCss, outStyle, kineticLead
      harness/        useSceneClock, usePin, Stage
      round/          the bench + round page shapes

`fit.ts` is the one that needs a real interface change: `INTRINSIC` and `FILL`
are keyed by the Logbook's four part ids. In the package they take a
caller-supplied registry.

## Tasks

1. **Create the package skeleton** in `otd-promo` with its own tsconfig + build.
   No behaviour yet.
2. **Move `motion.ts` verbatim**, then split into `moves/motions/camera/fit/
   compose`. Keep every comment — the comments are most of the value, and
   several of them are the only record of a trap.
3. **Generalise `fit.ts`** to take a registry rather than a fixed `PartId` union.
4. **Move the type layer**; drop the `arrangement` prop (a Logbook concept) in
   favour of an explicit slot.
5. **Move the harness.** `usePin`'s `data-anim-at` contract comes with it.
6. **Point `logbook-cut` at the package** and delete the moved files.
7. **PROVE IT BY RE-RENDER.** See below.
8. **Thin skill** in `Otd-llc/otd-skills` — the round protocol and the traps that
   are not visible in the code. The skill is the small half; the package is the
   deliverable.

## The acceptance test, and it is not a checklist

`otd-promo`'s own precedent is that an extraction was proven **byte-identical by
re-render**, not by paperwork ([[otd-promo-repo-plan]]). Same standard here:

    # before
    node tools/promo/render-cut.mjs <scratch-a> wide
    # after the extraction, same commit of the film, same seed
    node tools/promo/render-cut.mjs <scratch-b> wide
    # the two mp4s must hash identically

If they do not hash the same, the extraction changed the film and is not done.
A visual diff is not sufficient — the whole point of the scrub-never-play clock
is that the render is deterministic, so an extraction that preserves it must
reproduce it exactly.

A cheaper intermediate check, for use during the move: freeze the round page at
a fixed set of times and compare screenshots pixel-for-pixel.

## Constraints

- `otd-promo` is a **separate repo** (`Otd-llc/otd-promo`). Branch off its main.
- **Do not merge either side without the maintainer's explicit go-ahead.**
- The academy side is a stacked change on `feat/logbook-cut-sandbox`. Watch the
  known trap: a stacked PR targets its parent branch, and after the parent is
  squashed it must be re-based with `gh pr edit --base main` or it stays
  CONFLICTING and CI never fires.
- The bed track is running concurrently in the `C:/zzz/pf-bed` worktree on
  `promo/logbook-bed`. It only touches `tools/logbook-bed.py` and files outside
  the repo, so the two tracks do not collide — but **do not commit from the
  wrong worktree**; another session sharing a tree is how commits bleed.
