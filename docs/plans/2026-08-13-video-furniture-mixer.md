# The video furniture mixer, and the pipeline it feeds

**Status:** plan. Written 2026-08-13 so the next session starts from an artifact
rather than from someone's memory of a conversation.

**Branch:** `promo/video-furniture`, 7 commits off `main`, pushed, no PR.

## START HERE

Read in this order:

1. **`2026-08-13-video-channel-research.md`** - what is true, graded. Its
   section 8 is a numbered action list; items 1-3 of that list are DONE (see
   below), the rest are not.
2. **This file** - what to build.
3. Then run the sandbox: `/sandbox/video-furniture/r2/intro` (and `/ghost`,
   `/section`, `/combwalk`, `/lower`, `/hairline`, `/outro`).

**Already done, do not redo:**

- **Action 1, the short-edge unit fix** - landed in `e74a1083`. Type and stroke
  weights now size against `min(width, height)` via `r2/units.ts`. Verified:
  type-size ratio between 16:9 and 9:16 is 1.000 across 15 sampled cases, down
  from a measured 0.563. The comb was rebuilt as a centred flex row and windows
  itself when eight cells will not fit (8 at 16:9, 6 at 9:16, same 194 px cell).
- **Action 2, designators out of Bebas** - landed in `06240264`. Values are
  classified by KIND (`part` -> Saira via the new `Desig`, `words` -> Bebas)
  rather than by slot, and the classification is declared in the DOM as
  `data-kind` so a check can assert on intent. Verified with a CDP
  `getPlatformFontsForNode` pass over all 42 fragments in both themes at
  1920x1080 - the font PAINTED, not the CSS family - and mutation tested twice.
  **Read the correction in the research doc's 1.4 before touching type again:**
  the swap is justified by `0` and `O` being literally the same drawing in
  Bebas; the slashed zero the report recommended is stripped by the Google
  Fonts CDN and does nothing, and `tnum` does not exist in the family, so every
  `tabular-nums` on `--font-numeral` is a no-op.
- The measurement rigs live in the session scratchpad, not the repo:
  `unit-check.mjs` (size parity across aspects), `pixdiff.mjs` (how much the
  16:9 render actually moved), and from this round `font-metrics.mjs`,
  `zero-decisive.mjs`, `bebas-oh-zero.mjs` and `face-check.mjs` (the CDP
  painted-font assertion + its mutation flag). **Worth porting into the repo** -
  `face-check.mjs` in particular, because it is now the only thing standing
  between the type system and a silent regression.

**Open decision for the owner (blocks nothing):** self-host
`SairaCondensed-ExtraBold.ttf` so `font-feature-settings: "zero" 1` starts
working? Saira's plain `0` is only ~6% narrower than its `O`; the slashed glyph
is the difference between distinguishable and unmistakable on a part number.
The cost is that `--font-numeral` is a product-wide token, so this is a change
to how the whole academy loads a face, not a sandbox change.

**Next, in order of leverage** (from the research action list):

- **Drop the ban-list effects:** `blur`, `swipe off`, `combwalk/count`; decide
  on `settle` (it scales, which the identity rejects).
- **Add the persistent `NN / NN` chapter indicator** - signalling and segmenting
  at zero motion budget, and nothing else in the set does it.
- **Move lower thirds out of `y in [0.70, 0.92]`** (the CEA-708 caption band).
- Then the mixer itself, below.

---

## What exists already

- **`src/app/sandbox/video-furniture/`** - round 1 (four pieces, three
  treatments each) and `r2/` (seven sets, ten treatments each).
- **`r2/exits.ts`** - the exit vocabulary. The film's seven (`outStyle` imported
  from `(bare)/film-render/[cut]/tuning.ts`) plus four furniture-specific ones,
  and `furnitureOutStack`, which composes a stack by NESTING one wrapper per
  effect. Two `clipPath`s do not compose on one element; nesting does.
- **`r2/RealComb.tsx`** - the product's own `.gh-node` markup with the real
  `HexPrism`, so the comb in a video is the comb in the app.
- **`r2/frame/`** - one treatment, full viewport, `window.__seek(t)` +
  `[data-settled]`. The MEASUREMENT surface. The grid is for judging
  composition; anything measured on the grid is measured at a quarter scale and
  is therefore not measured.
- **`youtube.ts`** - end-screen rules verified against Google's own docs, three
  reserved wells (subscribe + two videos; owner dropped the channel element on
  2026-08-13), and `GRAPHICS_16X9`, the reclaimed upper-left quadrant.

## What this plan adds

### 1. The mixer

Owner's brief, verbatim in substance: *buttons proved the point, now I need a
mixing table where I can adjust the curves and duration of each effect.*

**Layout.** Work area LEFT, mixer column RIGHT, sticky for the whole scroll,
attached to the scrubber so the transport and the controls are one object. The
grid of treatments stays where it is and simply narrows.

**Two stacks, not one.** An ENTRY stack and an EXIT stack, each a list of
effects in applied order. Round 2 only has exits; entrances are currently baked
into each treatment, which is the same mistake exits had - a dimension hidden
inside ten variants instead of pulled out where it can be dialled.

**Per effect, three controls:**

| control | why |
| --- | --- |
| **curve** | Every effect is a pure function of `p`. The curve remaps `p` before the effect sees it, so one effect can be exponential and the next linear. Must stay a pure function or the frame stops being seekable. |
| **duration** | In BEATS, not seconds (below). |
| **offset** | When it starts relative to the stack. Stacked effects that all start together is a special case, not the only case. |

**The curve is data, not a name.** A named easing list ("outCubic") is where
this stops being a mixer. Store control points (a cubic bezier `x1 y1 x2 y2`,
the same form CSS uses) so the owner can drag a curve and the renderer can
consume it. `cubic-bezier` is trivially evaluable as a pure function of `p`.

### 2. Timing is BPM, not seconds

**Everything animates on an internal meter, whether or not there is sound.**
Start at **120 BPM**. A duration of "0.55 s" becomes "1 beat"; at 120 BPM that
is 0.5 s, and if the bed later lands at 96 BPM the whole set retimes with it
instead of drifting out of sync with its own music.

This is already half-true in the codebase and worth stating plainly: the Logbook
film is 120 BPM, 5 bars, 10.000 s, with cues on 2/4/6/8, and its weight curve is
a PICTURE instruction as much as an audio one. The lesson from that build was
that landing a visual 2-4 frames BEFORE the beat reads as correct and landing
exactly on the downbeat reads as late (`preRoll` 0.1 s at 30 fps). The mixer
must expose pre-roll, because it is not a bug to be fixed but a dial.

Different video types will want different tempos. That is a research question,
currently out with the 2026-08-13 research round.

### 3. Tabs are the video types, and they do not accumulate

One tab per video type. **The old tab is deleted when its direction is taken.**
It lives in the commit; it does not live in the sandbox. Sandbox rounds are
audition surfaces and the convention is that they are deleted before the PR -
letting them pile up is how a sandbox becomes a second product with no owner.

The set of types comes from the research round, not from guesswork.

### 4. The pipeline, in order

Each phase gates the next. Doing them out of order is how the Logbook cut ended
up re-tuning composition after the bed was already mastered.

1. **Visuals.** Iterate per tab. Owner gives a direction, the tab is rebuilt,
   the old one is deleted. Timing runs on the generic 120 BPM meter.
2. **Sound.** Beds per type. A bed is selected in any mode and TRANSPOSED to
   another - find one in phrygian, hear it in mixolydian - which the existing
   `logbook-comp.py` already supports as an axis. Beds get their own entry and
   exit stacks (riser, filter open, tape stop, reverse, silence-before-impact;
   which of these are conventional versus cliche in 2026 is in the research
   round). The visual stacks then animate to the BED's tempo and accents rather
   than to the generic meter.
3. **Format.** Every treatment in every delivery shape, checked against the safe
   areas and the platform's own furniture. The existing measurement rig does
   this at 1920x1080; it extends to the other shapes.
4. **Encode.**

## Non-negotiables carried forward

These were each paid for once. They are not preferences.

- **Scrub, never play.** Every value a pure function of `t`. No CSS transitions,
  no springs. A transition is a conversation with the wall clock and a frame at
  `t=1.4` must be the same picture every time it is requested.
- **Shares of the frame, never pixels.** An absolute cap tuned at preview scale
  encoded the subject at 16% of frame at 1080.
- **Measure at DELIVERY size, across the WHOLE shot.** A 0.14cqw hairline is
  sub-pixel in a grid tile and 3 px in the export. A collision that is 12 px
  clear at the frame you checked can be 35 px deep at the worst instant.
- **Tokens only, and a theme toggle to prove it.** A literal colour cannot flip;
  the toggle is the test, not decoration.
- **The real components.** The comb in the video is the comb in the app. A
  redrawing drifts the first time either side changes.
- **Mutation-test every gate.** A check nobody has watched fail is a check
  nobody knows works. Three separate checks in this build were broken in ways
  that looked exactly like passing.
- **Declare deliberate overlaps in the DOM** (`data-backdrop`), so intent is
  reviewable in the diff, and have the checker REPORT them rather than drop
  them.

## Known open items

- `intro/bleed` reports a collision that is a false positive: `objectFit:
  contain` makes the img box larger than the drawn content, so box arithmetic
  finds overlap in empty space. The honest fix is a pixel-contrast check rather
  than bounding boxes. Not built.
- `combwalk/zoom` pushes far cells out of frame. That is what a zoom is; noted
  so nobody "fixes" it.
- The 127 youtube slots in the guides are titled and empty. They are the brief:
  one overview video per stage, then per-task videos beneath it.
