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

- **Action 4, the ban-list effects** - landed in `3d487aee`. `blur`, `swipe
  off`, `settle out` and `combwalk/count` are gone; `settle` was decided
  against (it scales) and the default exit is now the named `DEFAULT_EXIT =
  "fade"`. The three Carbon productive curves are in as CONTROL POINTS with a
  `bezier()` evaluator verified against the browser's own implementation to
  5.6e-7 - that evaluator is what the mixer's curve control should consume, so
  do not write a second one. `outro/count` was deliberately KEPT: a static
  `04 / 09` readout is not a counting numeral and is the device 2.6 asks for.
  The fifth banned item, the hex entrance `rotate(-12deg)`, exists only in
  ROUND 1 and was left alone (see below).
- **Action 6 + 11, the caption band** - landed in `772e83fd`. Lower thirds sat
  at y = 0.83, inside the CEA-708 band. `LOWER_THIRD_BOTTOM` is now DERIVED
  from `CAPTION_BAND_16X9` plus clearance rather than typed, and the binding
  constraint has changed: the band starts at 0.72 while the player bar reaches
  only 0.129, so clearing the band clears the bar and the bar no longer decides
  the position. `PLAYER_BAR_BOTTOM` 0.12 -> a measured 0.129 (the small player,
  not fullscreen). Verified across the whole scrub of all 20 variants, 1620
  frames, worst edge y = 0.7000, zero in the band; mutation tested.
- **The slow push is gone** (`1f9b45c9`) - see the audit section below for what
  it cost and why the codec number is the last reason rather than the first.
- **Round 1 is deleted** (`b296f0f0`), and the fifth banned effect with it.
- **NEXT: the persistent `NN / NN` chapter indicator** - signalling (0.70) and
  segmenting (0.67) at zero motion budget, and nothing else in the set does it.
  Nothing blocks it now.
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

## The vocabulary audit, and what it found beyond the named five

Action 4 names five effects. Auditing every animated transform in round 2
against the permitted vocabulary in 2.5 rather than against that list turns up
more, and they are bigger than the five. None of this is fixed.

**1. The slow push is forbidden, and it is everywhere.** RESOLVED in
`1f9b45c9` - removed, and the measurement is recorded here because the codec
argument turned out to be true but modest and the temptation was to oversell
it. Same treatment, 105 frames at 1920x1080, identical encode at CRF 20:
**1233 kbps with the push against 1082 without, so +14.0% of the bitrate was
buying nothing.** After the strip the render is BYTE-IDENTICAL to pinning
`push` to zero, which is what proves the edit removed the motion and nothing
else. Two static base crops (`scale(1.08)`, `scale(1.25)`) were KEPT: a
transform that does not change over time is layout, not a gesture. Original
finding follows. Fourteen call sites
(ten in `Render.tsx`, four in `Render2.tsx`) animate
`scale(1 + push * 0.03..0.05)` where `push = seg(t, 0, 3.5)` - a Ken Burns
creep on the artifact across the whole shot. **Scale is on the forbidden list**,
and a slow zoom on a detailed render is also close to worst-case content for a
block-transform codec, which is the same argument that killed the animated comb.
This is the single most widespread violation in the set and it survived the
research round because the report enumerated effects by NAME and this one has
no name; it is just how every intro was built.

**2. Research action 3, "stop animating the comb", is missing from the action
list above.** DEFERRED by the owner 2026-08-13: the comb sets may not be used
at all and would be restyled first, so patching them now is thrown-away work.
The two animated scales still in the sandbox - `section/guide-solo`'s hex seat
and `combwalk/pulse` - sit inside that deferral and are deliberate, not
oversights. It is item 3 of the research's own numbered list and it never made
it into this file's next-steps. The whole `combwalk` set exists to animate the
honeycomb, which 1.1 rejects three independent ways. Taking that action deletes
or rebuilds all nine remaining treatments, which is why it wants an owner
decision rather than a quiet edit - and why the individual comb violations below
were not fixed piecemeal.

**3. Individual comb treatments that break the vocabulary anyway:**
`pulse` scales on a cosine (scale + oscillation), `zoom` scales, and `drop`
translates `16cqmin`, which is about **172 px at a 1080 short edge** against
the report's own guidance of **travel <= 16 px at 1080p** - off by an order of
magnitude. All three are inside the set that action 3 would remove.

**4. Round 1** - RESOLVED. Deleted in `b296f0f0` (1160 lines), which took the
fifth banned effect with it. `furniture.ts` kept only what round 2 imports;
`youtube.ts` kept INTACT including the exports only round 1 used, because
`outroFits` and the end-screen window are research expressed as code and the
outro work wants them. `/sandbox/video-furniture` is now an index of the seven
round 2 pieces.

## Known open items

- `intro/bleed` reports a collision that is a false positive: `objectFit:
  contain` makes the img box larger than the drawn content, so box arithmetic
  finds overlap in empty space. The honest fix is a pixel-contrast check rather
  than bounding boxes. Not built.
- `combwalk/zoom` pushes far cells out of frame. That is what a zoom is; noted
  so nobody "fixes" it.
- The 127 youtube slots in the guides are titled and empty. They are the brief:
  one overview video per stage, then per-task videos beneath it.
