# Timing sheet — L1.01 SCHEMATIC, N=1

**Subject:** `docs/video/l1-01-schematic-starter-and-arrange.md` (complete, never produced)
**Target runtime:** 7:00-7:30 · **Capture spec:** `docs/video/_capture-spec.md`
**Filled by:** Josh · **Date shot:** ________

This is the deciding experiment. It is not a log — it is the input to one decision:
**does a batch pipeline pay for itself, or does the cost live somewhere a pipeline
cannot reach?**

---

## Why the middle column is the whole point

The handoff's break-even (1.33 passes, from a 46-77 h minimal build) prices the **render**
stage. That arithmetic is only meaningful if the render stage is where the time goes. If
75% of a video is scripting, shooting and narrating, then a render pipeline can be
built perfectly and save almost nothing.

So every stage below is tagged with **what a batch driver would actually do to it**:

- **FIXED** — a human does this once per video and no tooling removes it.
- **PIPELINE** — a batch driver removes it or reduces it to a queue wait.
- **PARTIAL** — tooling cuts it materially but does not eliminate it. Say how much in
  the notes.

Fill the tags in as **observed**, not as pre-assigned. If a stage you expected to be
PIPELINE turns out to be full of per-video editorial judgement, that is the single most
valuable finding this experiment can produce, and it should overwrite the tag below.

**Stopwatch discipline:** wall clock, start to stop, including the fumbling. Time spent
re-reading the script, hunting a menu, or waiting on a render all counts. An
optimistically-timed N=1 is worse than no N=1, because it will be multiplied by 127.

---

## Stage log

| # | Stage | What it covers | Pre-tag | Start | Stop | Minutes |
|---|---|---|---|---|---|---|
| 1 | Pre-flight | Clean browser profile, sign in, delete old folder, fresh KiCad profile, Explorer extensions on, calibration target up | FIXED | | | |
| 2 | Legibility check | UI scale set, one frame grabbed, read at 1280x720, adjusted | PARTIAL | | | |
| 3 | **Screen capture** | Shots 1-15. Log takes separately below | FIXED | | | |
| 4 | Capture verify | `pnpm video:verify-capture` + any reshoot it forces | PIPELINE | | | |
| 5 | **Narration record** | 13 sections, separate pass, room tone at each end | FIXED | | | |
| 6 | Narration cleanup | Picking takes, trimming, de-breathing | PARTIAL | | | |
| 7 | **Assembly / cut** | Laying picture to narration, trimming, pacing | PARTIAL | | | |
| 8 | Furniture | Intro, outro, chapter marks, lower thirds, callouts | PIPELINE | | | |
| 9 | Encode + delivery convert | Master out, 4:4:4 -> 4:2:0 once, at the end | PIPELINE | | | |
| 10 | Thumbnail | Split frame per the script's design | PIPELINE | | | |
| 11 | Metadata | Title, description, 13 chapter timestamps, 11 tags, end screen | PARTIAL | | | |
| 12 | Upload + YouTube-side setup | Upload, captions, chapters, end screen, cards | PARTIAL | | | |
| 13 | **Review pass** | Watch it through as a learner. Defects below | FIXED | | | |
| 14 | Rework | Whatever the review pass sent back | FIXED | | | |
| | | | | | **TOTAL** | |

> Stage 4 is tagged PIPELINE because the gate already exists and runs in seconds. If it
> forces a reshoot, that reshoot time belongs to **stage 3**, not stage 4 — otherwise the
> sheet credits the gate with the cost of the fault it caught.

---

## Take log — stage 3

The published 10:1-100:1 shooting ratios for this content class are dominated by retakes,
and retakes are the one thing a pipeline provably cannot remove. Count them.

| Shot | Takes | Why the retakes | Minutes |
|---|---|---|---|
| 1 lesson page, scrolled to Setup | | | |
| 2 kicad.org/download | | | |
| 3 click Download, file lands | | | |
| 4 unzip, slow scroll of listing | | | |
| 5 README, "UNWIRED on purpose" | | | |
| 6 EXPORT_REPORT, 3 s | | | |
| 7 open `.kicad_pro` | | | |
| 8 sheet full extent, the "before" frame | | | |
| 9 Schematic Setup, hop over size | | | |
| 10 Ctrl+F `U2` | | | |
| 11 arrange pass A, USB + regulator | | | |
| 12 arrange pass B, U1 centre | | | |
| 13 arrange pass C, LEDs + headers | | | |
| 14 refdes nudge, close in | | | |
| 15 final arrangement, hold 4 s | | | |
| | **total takes** | | |

---

## Defect log — stage 13

Watch the cut end to end as a learner would. Every defect, however small.

| # | Timestamp | Defect | Which stage caused it | Cost to fix |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

The **"which stage caused it"** column is the one that matters. A defect traced to
capture is expensive forever. A defect traced to furniture or metadata is exactly what a
pipeline makes cheap.

---

## The arithmetic — fill after, do not pre-compute

```
runtime delivered                 ______ min      (target 7:00-7:30)
total elapsed                     ______ min
shooting ratio                    ______ : 1      total / runtime

  the research doc assumed         5.3 : 1   (i.e. ~40 min for this video)
  published range, this class     10-100 : 1  (30:1 most quoted)
  where this landed               ______

FIXED   total                     ______ min      stages tagged FIXED
PARTIAL total                     ______ min
PIPELINE total                    ______ min

pipeline-removable share          ______ %        (PIPELINE + half of PARTIAL) / total
```

### How to read the result

| Pipeline-removable share | What it means |
|---|---|
| **under ~25%** | The bottleneck is authoring, shooting and narrating. A batch driver is the wrong build. Spend the 46-77 h on making the FIXED stages faster, or on cutting the video count. |
| **~25-50%** | Build it, but scoped to the top two PIPELINE stages only. Do not build the general system. |
| **over ~50%** | The handoff's break-even arithmetic applies and the pipeline pays back inside two passes. |

Then, separately and more important than any of the above:

```
127 x total elapsed = ______ hours
```

If that number is larger than the time available, the pipeline decision is not the
decision that matters — the **video count** is. Say so plainly rather than optimising the
render stage of a plan that cannot finish.

---

## The thing this experiment does NOT measure — read before drawing conclusions

**The L1.01 script already exists. So this run measures production, not authoring.**
That matters because authoring is the larger number.

Counted from the local database, 2026-08-14 (the handoff records this count as
unreproducible; it is reproducible, and it is not 127):

```
youtube blocks with no videoId : 128        <- the production backlog
lessons carrying them          : 5          (l1-01 .. l1-05)
mean videos per lesson         : 25.6
lessons with a materialized guide : 22      <- 17 of them have ZERO video slots
```

Two consequences:

1. **Scripts amortize far better than "4 h x 127" assumes.** ~25.6 videos share one
   lesson's provenance research, vocabulary and pronunciation list. The L1.01 script says
   so itself: *"Every claim below already exists in shipped lesson copy or in the starter
   generator."* It is an **adaptation** of authored prose, not original technical writing.
2. **128 is 23% of the programme, not the programme.** At the observed rate the full 22
   lessons is ~563 videos — and 17 of those lessons have no authored prose to adapt from,
   so their scripts are blocked behind lesson authoring, not behind any pipeline.

**So add one cheap second measurement, and it may matter more than the first:**

> Write the script for video 2 of L1.01 ("wire the regulator") and time it.

One script, ~1-1.5 h expected. It is the only way to learn the *amortized* per-script rate
— and that rate, multiplied by 127, is the number that decides the programme. The
production stopwatch above cannot see it, because L1.01's script was already paid for.

```
script 2 of L1.01, elapsed    ______ min
                              (4 h would mean scripting dominates everything;
                               1 h would mean the backlog is ~170 h, not 500+)
```

---

## What to record beyond the clock

Four notes, written the same day, while it is fresh:

1. **The thing that took longest that you did not expect.** N=1's single most useful output.
2. **Anything you did that a script could not have told you to do.** That is the part of
   authoring the 126 remaining scripts will *not* cover, and it is currently priced at zero.
3. **Whether the script was sufficient.** It is the only one that exists, and 126 more get
   written to its pattern. If it was missing something, every future script inherits the
   gap. Note it against the script, not just here.
4. **Whether you would do it this way again.** Unstructured. Worth more than the table.
