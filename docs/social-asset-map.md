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
pnpm dev                                  # in Otd-llc/bioscale-viz, NOT `npx vite`
node tools/hex-promo-cuts.mjs --preset=<p> --choreo=orbit --text   # silent loop + type
python tools/hex-bed.py --kit rd-revtaiko                          # arrange the bed
python tools/hex-master.py --kit rd-revtaiko                       # finish it
node tools/hex-social-master.mjs --preset=<p> --laps=3 --text      # loop + bed -> master
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
`node tools/hex-promo-cuts.mjs --preset=<p> --choreo=orbit --text`.

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

`readme` becomes a 720 px animated WebP, where high-contrast type on every frame
is what defeats the inter-frame compression the format depends on. The size is
printed on every run -- read it rather than assume it.

Sizes scale off the **short axis**, not the width. Scaling by width is right for
the three portrait-or-square formats, whose width _is_ the short axis, and wrong
for 16:9, where it multiplied everything by 1.78: the first wide render put the
words at 217 px instead of 122 and the download icon at 359 px instead of 202,
which drew the arrow straight through the front tile of the cluster.

## Which film

There are two Hex Cluster loops and they answer different questions. Picking the
wrong one is the most likely way to waste the asset.

- **`--choreo=orbit`** (the decision loop). Opens in plan view, a ghost lights on
  one slot, the attention moves to another, the part drops, the cluster builds
  up and is inspected. Answers _why would I want this_. **Default for social.**
- **`--choreo=hero`** (the anatomy loop). A tray opens, caps go on, it reverses.
  Answers _what is this thing_. Better where the object is unfamiliar and the
  surrounding page does no explaining.

## Motion posts

Masters are H.264 + AAC-LC 48 kHz, `yuv420p`. Runtime is whole laps of the 10 s
loop: because the cuts are verified exact loops, concatenating them is seamless
by construction and costs a stream copy rather than a longer capture. Measured
on the 30 s vertical master, the lap join reads 0.209 against ordinary
frame-to-frame steps of 0.173 to 0.179. Platform specs
below were verified 2026-08-08 against each platform's current published
guidance; re-check before trusting them, because they move.

**Post the `-text` cut.** A feed viewer scrolls past with the sound off, so the
burned-in words are the only copy that reaches them. The clean cut without `-text`
exists for a surface that supplies its own headline.

| Platform | Placement      | File                                                   | Why this one                                                                                                                                                                                                                  |
| -------- | -------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| YouTube  | Shorts         | `social/hex-vertical-30s-text.mp4` (1080×1920, 3 laps) | Shorts is strictly 9:16; a landscape or square upload is **not** classified as a Short at all, whatever its length. Three laps because max is 3 min since Oct 2024 and a 10 s clip gives retention almost nothing to measure. |
| YouTube  | Regular upload | `social/hex-wide-10s-text.mp4` (1920×1080)             | Standard 16:9.                                                                                                                                                                                                                |
| X        | Feed post      | `social/hex-square-10s-text.mp4` (1080×1080)           | X supports any ratio from 1:3 to 3:1; square wins the most feed height per width on mobile. Free accounts cap at 140 s.                                                                                                       |
| X        | Landscape      | `social/hex-wide-10s-text.mp4`                         | When the post sits beside 16:9 media or a link card.                                                                                                                                                                          |
| LinkedIn | Feed post      | `social/hex-portrait-10s-text.mp4` (1080×1350)         | LinkedIn's 4:5 maximum is _exactly_ 1080×1350, so this fills the slot with no re-encode. Under 60 s, which is where engagement concentrates.                                                                                  |
| LinkedIn | Landscape      | `social/hex-wide-10s-text.mp4`                         | Company-page posts that need to match a 16:9 set.                                                                                                                                                                             |

Built by `node tools/hex-social-master.mjs --preset=<p> --laps=<n> --text`, which
tiles the verified loop with `concat` (stream copy, no generation loss) and the
one-lap mastered bed with `-stream_loop`. Both are exact loops, so N laps join
without a click; measured on the 30 s vertical, every lap reads -13.6 dB mean.

## Page embeds, not social

| Surface             | File                                 | Note                                                                                                                                                                     |
| ------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Academy `/hex` hero | `hex-band-orbit.mp4` + `-light`      | Shipped. `band` is framed for a **cropped** surface: the hero is `object-fit: cover` at 58vh and discards ~13% top and bottom.                                           |
| Apex home band      | `hex-wide.mp4` (**hero**, not orbit) | Deliberate. That band keeps only ~60% of the height; the orbit's vertical travel gets sliced. Clearing it needs a dolly near 2.07, which shrinks the cluster to a speck. |
| GitHub READMEs (×4) | `hex-readme-orbit.webp` (720×450)    | README markdown will not autoplay a repo-hosted mp4; it renders as a dead link. Animated WebP is the only format that plays inline.                                      |

`-orbit-text` variants of both exist and are **not** what these surfaces ship.
They are there to be chosen deliberately -- on a page that drops its own
headline, or a README that wants the words carried by the image.

## Stills

| Use                                 | File                                                                                                                                   |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Post thumbnail / poster frame       | `hex-<preset>-orbit-poster.jpg`, a real frame from mid-clip. The `-text` variant carries SNAP, since mid-clip falls inside that window |
| Transparent cluster, any background | `public/hex/clean/{trio,flower,strip}.webp` (3200×2400)                                                                                |
| Configurator UI, both themes        | `public/hex/ui/{trio,flower,strip}-{dark,light}.webp` (3200×2000)                                                                      |
| `/hex` share card                   | generated by `src/app/(chrome)/hex/opengraph-image.tsx`                                                                                |

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

**Light-theme ghosts are faint.** On ivory the app draws the placement ghosts as
near-white outlines rather than the blue and gold it uses on deep space, so the
decision story reads weakly in the light cut. That is the app's material, not
the capture. Social posts use the dark cut, so this only affects light page
surfaces.

**No vertical-native accounts.** Without Instagram or TikTok, the 9:16 cut earns
its keep on Shorts alone. Worth knowing before commissioning more vertical work.
