# `/beta` media: how it was made, and how to remake it

`public/beta/board.mp4` and its light twin are **captured, not screen-recorded**.
A re-capture after a board revision reproduces the shot rather than
approximating it, which matters because the alternative is that the hero quietly
stops matching the board the course actually teaches.

The rig lives in the private `Otd-llc/otd-promo` repo, at
`subjects/board/_unported/` (`BoardStage.tsx` + `capture-board.mjs`), with a
README covering what it gets right. It was removed from this repo along with the
dev-only capture route it used; regenerating means restoring that route, or
waiting for T3 of the promo pipeline, which replaces it with a standalone stage.

## What ships

| File | Bytes | Note |
| ---- | ----- | ---- |
| `board.mp4` | ~740 kB | 12 s, one exact revolution, 30 deg/sec, 1280x720, H.264 crf 29 |
| `board-light.mp4` | ~747 kB | identical motion, ivory composite |
| `board-poster.jpg` | ~38 kB | **the LCP candidate** |
| `board-light-poster.jpg` | ~39 kB | |

## The three things that make it work

**One geometry pass, two composites.** The board renders on a transparent
canvas; the theme background is composited at encode time. Dark and light
therefore cannot drift apart in motion, because there is only one motion.

**The clip is frameless, and that is a measurement.** Its background is baked at
the theme token, so its edges are invisible against the page field: measured at
`8,9,13` against a field of `8,10,14` in dark, and `250,247,239` against
`250,247,240` in light. Both within 1/255.

> **The constraint that comes with it.** A frameless clip only disappears over
> the background it was composited against. Put it on a `.section-band` wash, a
> raised `bg-2` section, or any tinted panel, and a rectangle appears. It would
> need re-compositing, not just moving.

**The loop closes by construction, and is still measured.** Frame `i` sets
rotation to `i/N` of a full revolution rather than accumulating an increment, so
frame `N-1` to frame `0` is one ordinary step. Verified at **0.40% drift**
against its neighbouring steps.

## Why 12 seconds, and why that was cheap

30 deg/sec reads as ambient rather than busy. It carries three times the frames
of the 4-second version but only **1.9x the bytes**, because slower rotation
means less change per frame and H.264 charges for change. Slow is not expensive.

## Why a hero loop is affordable at all

For a `<video>`, the **poster is the LCP candidate**, not the stream. First paint
costs a 38 kB JPEG; the 740 kB clip arrives after and does not enter the LCP
measurement. That is also why `BoardLoop` passes `priority` (which sets
`fetchPriority="high"` on the poster) and why any future below-fold clip must
pass `lazy`: `autoplay` alone downloads immediately regardless of position.

Both clips are mounted and CSS picks one, via the `video[data-loop]` rules in
`globals.css`. A single `<video>` keyed by theme makes the swap a React remount,
which lands a frame late: measured on the hex loop, the light clip was still
painted at the instant `data-theme` said dark, and the right one arrived ~49 ms
after. Only the active clip preloads, so mounting both costs one extra poster.

## The question in the check is not a file

`BetaCheckSection` reads the `mpn-not-value` question out of the **published
`BOM_SOURCING` card** and renders it with the real `QuizBlock`. The section
claims the question is real; a hardcoded copy would make that true on ship day
and false the first time someone edits the card. If the block moves, the section
renders nothing rather than a stale copy.

`QuizBlock` with no `context` and no `logbook` is its pure self-check mode: no
XP, no attempt record, no gate write, no auth. `formative_check_engaged` does
fire, which is wanted; posthog-js attaches `$current_url`, so a landing-page
attempt is distinguishable from one inside a guide card.
