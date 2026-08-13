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

---

## Addendum, 2026-08-12: what the FORMAT round added after this was scoped

This plan was written against `e0e90adc`, before the film was re-framed for the
delivery shapes. Since then the bed track added **413 lines to the two files
this plan moves** (`motion.ts` +107, `LogbookLive.tsx` +337) and three new
files. None of it is Logbook-specific, all of it is engine, and **it is inside
the sandbox that gets deleted before the PR** — so it is in exactly the danger
this plan exists to prevent, and the target shape above does not mention it.

### New surface in `motion.ts` → `core/motion/fit.mjs`

- `fillFor(id, aspect)` — the fill shares reshaped for the frame. The shares
  were judged on 16:9, where the word costs the subject WIDTH; rotate the frame
  and the word bands move to the top and bottom. Because `fitScale` takes the
  MINIMUM of two constraints, leaving them fixed marooned a 16:9-sized subject
  in the middle of a portrait frame.
- `INTRINSIC_COMPACT` — what a part measures once a narrow frame has taken its
  wide furniture off. Sizing a part against furniture it no longer has is the
  same error one layer up.
- `fitScale(..., adapt, compact)` — both new arguments default OFF, which is
  what keeps the pixel-identical acceptance test below meaningful.

### New surface in `LogbookLive.tsx` → `core/harness/` (and a new concept)

- **`aspect`** — a real re-frame, not a crop. Defaults to 16/9.
- **`safe`** — platform chrome as fractions, applied as ONE INSET on the whole
  scene. Every position inside is already a percentage, so the inset makes them
  resolve against the usable rectangle with nothing downstream changed. This is
  a concept `core/` does not have at all today and it belongs there, not here.
  It also CLIPS, deliberately: a fit is only as honest as its intrinsic, and the
  worst case should be a visibly cut part rather than one painting under the
  platform's UI.
- **Narrow-frame content rules** — a narrow frame gets DIFFERENT content, not
  smaller content (drop the long labels; give reflowing prose its own measure).
  Genuinely general, and the least obvious thing in the whole round.
- **Composition rules as SHARES**, never absolute scale. See the trap below.

### New files

- `formats/formats.ts` — the delivery shapes and their safe areas, single-sourced
  so the preview, the capture route and the renderer cannot drift. Data only;
  it is a cut-sheet sibling and belongs under `subjects/`.
- `frame/` — the capture surface: one stage, full viewport, `window.__seek`,
  no chrome. The renderer's half of the `[data-settled]` contract.
- `tools/logbook-render.mjs` — capture + encode + the gates. `core/` has no
  renderer today; `otd-promo`'s own `render-cut.mjs` lives on
  `feat/platform-safe-areas`, so **check that branch before building a second
  one** — the names suggest it may already solve the safe-area half.

### The trap this round paid for, which the acceptance test would NOT have caught

A composition rule written as an ABSOLUTE SCALE produced exactly the approved
frame in a preview at a fifth of delivery size, and encoded the subject at 16%
of the frame at 1080. The pixel-identical screenshot check above compares a
render to itself at ONE size; it cannot see a resolution-dependent rule. **Add a
second check at delivery size**, or carry the rule as a share of the frame and
gate on the measured share the way `logbook-render.mjs` now does.

Two more worth carrying into the port, both the same failure class: a declared
intrinsic that was wrong three times in three different ways before
`offsetWidth` settled it, and a clearance that is fine at the frame you sample
and 35px short at the worst instant of the shot. **Measure the output, at
delivery size, across the shot.** Codified as `otd-promo-film` in
`Otd-llc/otd-skills` (PR #8).

### Consequence for sequencing

The extraction is now bigger than "the motion system", and the format work is
the more reusable half — every future OTD film needs shapes and safe areas, and
only this one needs a rank wheel. **Re-scope before starting, and take the
BEFORE hashes at two sizes rather than one.**
