# Social asset map

What to post where, and which file to reach for. Two kinds of asset are in play
and they live in different places:

- **Profile furniture** (banners, avatars, watermarks) is committed in the apex
  repo at `public/brand/social/` and documented on
  [onethousanddrones.com/brand](https://onethousanddrones.com/brand) §18. It is
  rendered from the live brand components, so the download cannot drift from the
  site.
- **Motion posts** (the Hex Cluster loops) are generated, not committed. They
  land in `C:/zzz/_hex-promo/`, outside every repo, because they are destined
  for several places and none of them is a repo. The generator IS committed:
  `tools/hex-promo-cuts.mjs` in this repo. Regenerate rather than archive.

```
# the v2 configurator's DEV server, from an archived copy of one commit --
# see the header of tools/hex-film.mjs (HEX_V2_APP, default :5231)
node tools/hex-promo-cuts.mjs --preset=<p> --text                  # silent loop + type
python tools/hex-bed.py --kit rd-revtaiko                          # arrange the bed
python tools/hex-master.py --kit rd-revtaiko                       # finish it
node tools/hex-social-master.mjs --preset=<p> --laps=1 --text      # loop + bed -> master
```

Masters land in `C:/zzz/_hex-promo/social/`. Post those, not the raw cuts: the
raw cuts carry no audio stream.

## Live profiles

Three, from the org profile README. There is no Instagram, TikTok or Threads
account, so the vertical cut currently has exactly one native home (Shorts) plus
vertical placements on X and LinkedIn.

| Platform | Handle                                                                      |
| -------- | --------------------------------------------------------------------------- |
| X        | [@1KDrones](https://x.com/1KDrones)                                         |
| YouTube  | [@1kDrones](https://www.youtube.com/@1kDrones)                              |
| LinkedIn | [One Thousand Drones](https://www.linkedin.com/company/one-thousand-drones) |

## The 120 BPM grid

The choreography is laid on a musical grid so a scored version lands its drops
on bar lines. Beat 0.5 s, bar 2.0 s, and the 10 s loop is exactly 5 bars. Before
this the placements sat at 1.9 / 3.6 / 4.6 with gaps of 1.7 and 1.0, which is
unscoreable: anyone writing to it would be following arbitrary times instead of
a bar line.

| t (s)            | bar.beat         | event                                         |
| ---------------- | ---------------- | --------------------------------------------- |
| 0.5 / 1.0 / 1.5  | 1.2 / 1.3 / 1.4  | candidates light, attention moves, moves back |
| **2.0**          | **2.1**          | **place 1**                                   |
| 2.5 / 3.0        | 2.2 / 2.3        | second pair, attention moves                  |
| **4.0**          | **3.1**          | **place 2**                                   |
| 4.5 / 5.0        | 3.2 / 3.3        | third candidate, place 3                      |
| 5.5              | 3.4              | candidates clear, camera tips                 |
| **6.0**          | **4.1**          | **explode**                                   |
| 6.5 / 7.0 / 7.5  | 4.2 / 4.3 / 4.4  | caps on                                       |
| 8.0 / 8.25 / 8.5 | 5.1 / 5.1+ / 5.2 | caps off, on eighths                          |
| 9.0 / 9.25 / 9.5 | 5.3 / 5.3+ / 5.4 | tiles lift out, closing fill                  |

Any `--seconds` override must stay a whole number of bars (an even number of
seconds) or the audio seam clicks even though the video seam does not.

## The percussion bed

**It is CC0 samples, not synthesis, and that correction cost four rounds.**
`tools/hex-drums.py` originally synthesised the bed, on the reasoning that the
bed has to divide the clip exactly and a generator can be told the length. Each
round measured a real improvement on the thing it set out to fix and none of
them sounded good, because the problem was never the arrangement -- it was the
material. A synthesised membrane does not have the body of a struck drum.

The pipeline is three files, and they are separate because they fail
differently:

| File                   | Does                                                                           | Why separate                                                                                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tools/hex-samples.py` | Fetches CC0 samples from Freesound into `_hex-promo/samples/`, with provenance | Network + licence. **Every result is re-checked against the returned `license` field, never trusted from the search filter** -- committed samples are redistribution, and this repo is public |
| `tools/hex-bed.py`     | Arranges a kit into one 10 s lap                                               | The creative part. Kit `rd-revtaiko` is the pick: a long taiko played backwards on both the SNAP arrival and the drop riser, over a sub                                                       |
| `tools/hex-master.py`  | Convolution reverb, glue compression, true-peak limit, EBU R128                | Solved engineering. ffmpeg already ships professional implementations; hand-rolling them in Python would be slower and worse                                                                  |

Delivered at **-14 LUFS integrated, -1 dBTP, stereo**, which is where every
platform normalises. Louder gains nothing because it gets turned down, and costs
dynamic range.

**Compression is deliberately gentle** -- 1.6:1 from -12 dB with no makeup. At
2:1 with makeup it took loudness range from 5.8 to 3.7 LU and crest from 13.1 to
9.6 dB, which is the sparse-to-drop arc being levelled away. The arc is the thing
the arrangement exists to produce, so the chain must not spend it buying volume.

Loop safety is enforced, not hoped for, at both stages. In the arrangement, any
hit whose decay would run past the end is **wrapped** to the head of the buffer;
a truncated tail is the click. In the master, the whole bed is run through the
chain **two laps long and the second lap kept**, because convolution adds a tail
as long as the impulse response and it has to arrive from a previous lap rather
than out of silence. Measured across the join: 22 against a p99 of 739.

## The kinetic type

Five words on strikes in the bed, one per two bars, burned into the picture by
`node tools/hex-promo-cuts.mjs --preset=<p> --text`.

**The words were approved against the v1 picture.** Against the v2 film they
land on: PRINT as the pipe arrives, SNAP as the column's cover snaps home, GROW
on the explode, FREE as the parts lie on their print beds. The cue sheet is
unchanged; whether the pairing still reads is the owner's call.

| t (s)   | Cue                | Cell             | Motion                                                                |
| ------- | ------------------ | ---------------- | --------------------------------------------------------------------- |
| 2.0     | PRINT.             | top left         | per-character key strike                                              |
| **3.7** | SNAP.              | bottom right     | two halves meet **on 4.0**                                            |
| 6.0     | GROW.              | top right        | rises behind a mask, then keeps growing to 1.34x for the whole window |
| 8.0     | FREE.              | top left, larger | release from tight tracking                                           |
| 8.0     | download, actuated | bottom band      | arrow travels into the tray, tray flashes, twice                      |

**SNAP starts 0.3 s early on purpose.** The halves-meet animation runs 0.3 s and
was starting on the beat, which put the moment of impact 0.3 s late. An entrance
whose _point_ is an impact has to be timed by its impact, not by its first frame.

The sign-off is the gesture rather than a caption that says "get the files".
Periods are hollow -- transparent fill over a stroke -- and take the opposite
colour to their word: ivory word, gold stop; gold word, ivory stop.

**Every cue fades out inside its own window**, so the clip's last frame carries
no type and the loop's first frame is clean. The first version faded out _after_
the window and wrapped the tail round to the next lap, which made the seam
continuous but put FREE and the download URL on frame 0 at ~87% -- the still a
feed shows before play. Every alternative that keeps a post-window fade and a
clean frame 0 is worse: truncating it steps at the seam, and compressing it into
the 0.067 s left after 9.9 is a two-frame blink while the picture flows. The
cost is 0.28 s off a 1.9 s hold, and it lands somewhere useful -- PRINT dims as
SNAP arrives, and the download dissolves just after its second hit.

**`band` and `readme` can carry type, but they are ADDITIONAL files, not page
swaps.** Both surfaces ship a clean cut and supply their own headline copy;
`public/hex/configurator*.mp4` and the four README WebPs are untouched.

`band` is the only preset nobody ever sees whole -- `object-fit: cover` on a
~2.4:1 slice, 13% off each end on the academy hero and 20% on apex -- so it
takes a **24% vertical safe margin** (`textSafe`) instead of the usual 7%. At 7%
the top row centres at 21% of frame height and apex cuts straight through it.
That fix creates a second one: pulling the bottom row up 17% puts a centred
download icon through the front tile of the cluster, where the 7% margin had
left it just below. The icon moves to the empty left third (`textDl`), which is
empty at every azimuth because landscape pays for the explode's height in empty
sides.

`readme` becomes a 640 px, 12 fps animated WebP, where high-contrast type on every frame
is what defeats the inter-frame compression the format depends on. The size is
printed on every run -- read it rather than assume it.

Sizes scale off the **short axis**, not the width. Scaling by width is right for
the three portrait-or-square formats, whose width _is_ the short axis, and wrong
for 16:9, where it multiplied everything by 1.78: the first wide render put the
words at 217 px instead of 122 and the download icon at 359 px instead of 202,
which drew the arrow straight through the front tile of the cluster.

## The film

There is one Hex Cluster v2 loop (`tools/hex-film.mjs`), and every cut, the
`/hex` clip and every still are frames of it: **column -> PVC -> explode ->
plates**, as a closed ten-second loop on the bed's grid. A stacked column with
its cover stands in a row of open bases; the PVC pipe slides through the row on
2.0; the cover lifts and snaps home on 4.0; the build explodes on 6.0; every
printed part flies onto a print bed, in its print pose, where the configurator's
own packer lays it (the bought pipe shrinks away), landing on 8.0; and the parts
fly home to the opening frame by 9.9. The v1 loops (`--choreo=orbit|hero`, the
parts tray) are retired with v1.

## Motion posts

Masters are H.264 + AAC-LC 48 kHz, `yuv420p`. Runtime is whole laps of the 10 s
loop: because the cuts are verified exact loops, concatenating them is seamless
by construction and costs a stream copy rather than a longer capture. Measured
on a three-lap vertical master before those files were retired, the lap join
read 0.209 against ordinary frame-to-frame steps of 0.173 to 0.179, which is the
evidence that the loop is exact enough to leave to the player. Platform specs
below were verified 2026-08-08 against each platform's current published
guidance; re-check before trusting them, because they move.

### One lap, not three, and why that reversed

This file used to be a 30 s three-lap master, on the reasoning that "a 10 s clip
gives retention almost nothing to measure". That reasoning was wrong, and the
correction comes from YouTube's own documentation rather than from a blog. Since
31 March 2025:

> Views count the number of times a Short **starts to play or replay**, with no
> minimum watch time requirement.
> [YouTube Help](https://support.google.com/youtube/answer/10059070?hl=en)

A 10 s Short is not unmeasured. It loops, and every loop counts again. Baking
three laps into one file converts replays the platform counts separately into a
single long play, so pre-looping gives away the one thing an exact loop is good
for. These cuts are verified exact loops, which makes them the assets that
benefit most from being left alone.

Two honest caveats. Third-party analyses put the observed band around 20-45 s
and report a length-banded retention gate (roughly 65% under 30 s against 50%
for 30-60 s), so a longer cut is judged on a lower bar; those are not YouTube's
numbers. And YouTube separated raw views from **engaged views** in 2025, with
engaged views driving monetisation, so loop-inflated view counts are confirmed
while loop-driven reach is not. Settle it on the account, not on the argument:
post both and read engaged views and retention back.

The 30 s files are deleted. `--laps=<n>` still works if a longer runtime is ever
wanted; nothing about the tiler changed.

**Post the `-text` cut.** A feed viewer scrolls past with the sound off, so the
burned-in words are the only copy that reaches them. The clean cut without `-text`
exists for a surface that supplies its own headline.

| Platform | Placement      | File                                                   | Why this one                                                                                                                                                                                                                  |
| -------- | -------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| YouTube  | Shorts         | `social/hex-vertical-10s-text.mp4` (1080×1920, 1 lap)  | Shorts is strictly 9:16; a landscape or square upload is **not** classified as a Short at all, whatever its length. ONE lap, and the player does the repeating. See the note below. |
| YouTube  | Regular upload | `social/hex-wide-10s-text.mp4` (1920×1080)             | Standard 16:9.                                                                                                                                                                                                                |
| X        | Feed post      | `social/hex-square-10s-text.mp4` (1080×1080)           | X supports any ratio from 1:3 to 3:1; square wins the most feed height per width on mobile. Free accounts cap at 140 s.                                                                                                       |
| X        | Landscape      | `social/hex-wide-10s-text.mp4`                         | When the post sits beside 16:9 media or a link card.                                                                                                                                                                          |
| LinkedIn | Feed post      | `social/hex-portrait-10s-text.mp4` (1080×1350)         | LinkedIn's 4:5 maximum is _exactly_ 1080×1350, so this fills the slot with no re-encode. Under 60 s, which is where engagement concentrates.                                                                                  |
| LinkedIn | Landscape      | `social/hex-wide-10s-text.mp4`                         | Company-page posts that need to match a 16:9 set.                                                                                                                                                                             |

Built by `node tools/hex-social-master.mjs --preset=<p> --laps=<n> --text`, which
tiles the verified loop with `concat` (stream copy, no generation loss) and the
one-lap mastered bed with `-stream_loop`. Both are exact loops, so N laps join
without a click; measured on a three-lap vertical before it was retired, every
lap read -13.6 dB mean.

## Page embeds, not social

| Surface             | File                                 | Note                                                                                                                                                                     |
| ------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Academy `/hex` hero | `public/hex/hero-{dark,light}.webp` (a still) | The v2 hero is a STILL (launch 6.4), so reduced motion needs no second path. `hex-band.mp4` is still cut, framed for a surface that keeps 74% of the height. |
| Academy `/hex` loop | `public/hex/configurator{,-light}.mp4` + posters | `tools/hex-video.mjs`, 1280×800, one clip <= 500 KB (gated). |
| Apex home band      | `hex-apex.mp4` + `-poster.jpg`, copied to the apex repo as `public/hex/cluster-loop{.mp4,-poster.jpg}` | At 1440×900 that band shows rows 317-763 and the left 62% of a 16:9 frame, with the copy over its left third, so the `apex` preset fits the whole shot inside that window and shifts it clear of the copy (`shiftX`). The clip is gated at <= 500 KB. |
| GitHub READMEs (×4) | `hex-readme.webp` (640×400, 12 fps, <= 620 KB) | README markdown will not autoplay a repo-hosted mp4; it renders as a dead link. Animated WebP is the only format that plays inline.                                      |

`-text` variants of both exist and are **not** what these surfaces ship.
They are there to be chosen deliberately -- on a page that drops its own
headline, or a README that wants the words carried by the image.

## Stills

| Use                                 | File                                                                                                                                   |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Post thumbnail / poster frame       | `hex-<preset>-poster.jpg`, a real frame from mid-clip (5.0 s: the assembled build with its pipe). The `-text` variant carries SNAP, since mid-clip falls inside that window |
| Transparent cluster, any background | `public/hex/clean/{trio,flower,strip}.webp` (3200×2400), v2 builds under the v1 file names (`tools/hex-stills.mjs clean`)            |
| Configurator UI, both themes        | `public/hex/ui/{trio,flower,strip}-{dark,light}.webp` (3200×2000) (`tools/hex-stills.mjs ui`)                                        |
| `/hex` share card                   | `src/app/(chrome)/hex/opengraph-image.tsx`, composing `public/hex/og-cutout.png` (`tools/hex-stills.mjs og`)                          |

## Known gaps

**The raw cuts still carry no audio stream**, because the capture runs with
`-an`. That is why the masters exist: `hex-social-master.mjs` muxes the bed in
as AAC-LC 48 kHz, which is what YouTube's spec names. Post from
`_hex-promo/social/`, never the raw cut, or a Short goes up with no audio track
at all. The raw cut is also the one **without** the type.

**`tools/hex-drums.py` is retained but no longer feeds anything shipped.** The
bed comes from `hex-bed.py` + `hex-master.py`; the synthesiser survives only
because the sub layer still uses it and deleting it would lose the record of
four rounds of what did not work.

**The film hides the app's placement ghosts.** They are an offer to a live
pointer, and a loop with no pointer in it has nothing to offer them to.

**No vertical-native accounts.** Without Instagram or TikTok, the 9:16 cut earns
its keep on Shorts alone. Worth knowing before commissioning more vertical work.
