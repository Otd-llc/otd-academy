# Extracting the promo motion engine to `otd-promo`

**Status:** scoped. Re-scoped 2026-08-12 after reading the target repo — the
first version of this plan was written before, and was wrong about the shape.
**Owner go-ahead required before any merge.**
**Source:** `feat/logbook-cut-sandbox` @ `e0e90adc` (academy).
**Target:** `Otd-llc/otd-promo`, default branch `main`, currently on
`feat/hex-score` @ `16bcb6e`.

## Why this is urgent rather than tidy

`/sandbox/*` routes are dev-guarded and **deleted before their PR** — that is the
standing convention and every previous round honoured it. About 1,500 lines of
`src/app/sandbox/logbook-cut/` is not about the Logbook at all: it is a general
motion system that cost a session and a dozen paid-for traps.

If the sandbox is deleted first, the engine goes with it. **The extraction
happens before the mp4 render, not after.**

## What I got wrong the first time

I scoped a greenfield package. `otd-promo` is not greenfield:

- **`core/` already holds a motion kit** — `transitions/` (14 transitions as
  data, alignment first-class, plus a canvas glitch compositor), `type/cues.mjs`
  (the kinetic cue layer, five entrances, "subject-agnostic by subtraction"),
  `render/profiles.mjs`, and a Python `audio/` + `score/` engine.
- **`core/` is `.mjs` with JSDoc typedefs, not TypeScript.**
- **There is a real boundary gate**, `pnpm boundary:check`: no file under `core/`
  may import anything resolving outside it, and Python there may carry no
  absolute path literal and no by-path import escape hatch.
- **A film is a data-only cut sheet** under `subjects/<subject>/cuts/`, per
  `subjects/academy/cuts/l101-beta.mjs`: no functions, no renderer imports,
  behaviour named by id.

So this is a **merge into an existing kit**, and the shape below replaces the
one in the first draft.

## Three real consequences

**1. The type work EXTENDS `core/type/cues.mjs`; it must not become a second
type system.** That file has five entrances and the grid. The Logbook round
produced eleven entrances and — the genuinely new part — **seven exits**, plus
`kineticLead` per entrance and the `preRoll`. Exits are new to the kit entirely:
`cues.mjs` has no concept of a word leaving, because the beta film never gave
one. That is the single most valuable thing going in.

**2. `Move` and `Transition` are different axes and both must survive.** A
transition cuts between two shots. A `Move` brings ONE part in or out inside a
shot. `push-l` as a transition means the whole frame slides; `push-l` as a move
means the ring does. They will look like duplicates in review and are not.

**3. TypeScript to `.mjs` is the largest single cost, and it is not mechanical.**
`motion.ts` is typed with `React.CSSProperties`, which is also a boundary
problem: `core/` cannot depend on React. In `.mjs` the return becomes a plain
style object and the React dependency disappears — so the conversion and the
boundary fix are the same edit, which is an argument for doing it rather than
against.

## Target shape

    core/motion/           NEW. No overlap with transitions/.
      moves.mjs            10 enter/exit moves; moveVec, moveMask
      motions.mjs          13 motions incl. 4 Ken Burns; motionVec
      camera.mjs           5 cameras, 4 parallax depths; cameraVec, parallaxVec
      fit.mjs              fitScale — takes a caller-supplied registry
      compose.mjs          Vec, add, partStyle (one composed transform)
    core/type/cues.mjs     EXTENDED: +6 entrances, +7 exits, kineticLead, preRoll
    core/harness/          NEW
      clock.mjs            scrub clock: seek, IntersectionObserver, 30fps
      pin.mjs              the double pin (see traps)
    subjects/academy/cuts/logbook.mjs   the film, data only

Staying in the academy: `beats.ts`, `mixes.ts`, `assembly.ts`, `candidates.ts`
become the cut sheet's content; `quiz-select/` is a **product** change to
`globals.css`, not a promo one, and does not move at all.

## Tasks

1. Branch off `otd-promo` main. **Do not build on `feat/hex-score`** without
   checking whether it is landing first.
2. `core/motion/` — convert `motion.ts` to `.mjs` + JSDoc, splitting as above.
   Keep every comment; several are the only record of a trap.
3. `fit.mjs` — take a registry rather than a fixed `PartId` union.
4. Extend `core/type/cues.mjs` with the six new entrances and the seven exits.
   **Read its header first**: its values were judged in a preview and shipped,
   and are explicitly not up for casual revision.
5. `core/harness/` — the clock and the pin.
6. `pnpm boundary:check` **and** `boundary:selftest` green.
7. Academy side: point `logbook-cut` at the package, delete the moved files.
8. Prove it (below).
9. Thin skill in `Otd-llc/otd-skills`: the round protocol and the traps that are
   invisible in the code. The skill is the small half.

## The acceptance test

`otd-promo`'s own precedent is an extraction proven **byte-identical by
re-render**, not by paperwork. Same standard, with one honest substitution:
`tools/promo/render-cut.mjs` lives on `feat/platform-safe-areas`, **not on this
branch**, so the mp4 comparison is not runnable here yet.

Until it is, the equivalent check is available and is not weak: freeze the round
page at a fixed set of scene times and compare screenshots **pixel for pixel**
before and after. The clock is deterministic by construction, so identical
inputs must produce identical frames; any difference is a real behaviour change.

    node <shoot>.mjs --before   # 30 cuts x 4 times, hashed
    # extract
    node <shoot>.mjs --after
    # every hash must match

Take the BEFORE hashes **before touching anything**.

## Constraints and traps

- Do not merge either side without the maintainer's explicit go-ahead.
- The academy side is stacked on `feat/logbook-cut-sandbox`. Known trap: a
  stacked PR targets its parent, and after the parent is squashed it needs
  `gh pr edit --base main` or it stays CONFLICTING and CI never fires.
- The bed track runs concurrently in `C:/zzz/pf-bed` on `promo/logbook-bed`.
  Disjoint scope, but do not commit from the wrong worktree.

### A finding for the bed track

**`tools/logbook-bed.py` could not move into `core/` as written.** It breaks the
boundary rule twice, and in exactly the two ways that rule was written to catch:
it loads `hex-bed.py` through `spec_from_file_location`, and it inherits
`SAMPLES = "C:/zzz/_hex-promo/samples"` — a module-level absolute path literal
pointing at a scratch directory outside every repository, on one machine, with no
backup. `core/README.md` cites that exact line as the leak that motivated the
check.

That is fine where it is: it is academy tooling, not `core/`. But if the bed is
ever meant to live in `otd-promo`, it has to take its sample root as an argument
and import through the package rather than by path. Worth knowing before anyone
tries to move it in a hurry.
