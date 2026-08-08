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
pnpm dev                                     # in Otd-llc/bioscale-viz, NOT `npx vite`
node tools/hex-promo-cuts.mjs --preset=<p> --choreo=orbit   # the silent loop
python tools/hex-drums.py --seconds 30                      # the bed
node tools/hex-social-master.mjs --preset=<p> --laps=3      # loop + bed -> master
```

Masters land in `C:/zzz/_hex-promo/social/`. Post those, not the raw cuts: the
raw cuts carry no audio stream.

## Live profiles

Three, from the org profile README. There is no Instagram, TikTok or Threads
account, so the vertical cut currently has exactly one native home (Shorts) plus
vertical placements on X and LinkedIn.

| Platform | Handle |
| --- | --- |
| X | [@1KDrones](https://x.com/1KDrones) |
| YouTube | [@1kDrones](https://www.youtube.com/@1kDrones) |
| LinkedIn | [One Thousand Drones](https://www.linkedin.com/company/one-thousand-drones) |

## The 120 BPM grid

The choreography is laid on a musical grid so a scored version lands its drops
on bar lines. Beat 0.5 s, bar 2.0 s, and the 10 s loop is exactly 5 bars. Before
this the placements sat at 1.9 / 3.6 / 4.6 with gaps of 1.7 and 1.0, which is
unscoreable: anyone writing to it would be following arbitrary times instead of
a bar line.

| t (s) | bar.beat | event |
| --- | --- | --- |
| 0.5 / 1.0 / 1.5 | 1.2 / 1.3 / 1.4 | candidates light, attention moves, moves back |
| **2.0** | **2.1** | **place 1** |
| 2.5 / 3.0 | 2.2 / 2.3 | second pair, attention moves |
| **4.0** | **3.1** | **place 2** |
| 4.5 / 5.0 | 3.2 / 3.3 | third candidate, place 3 |
| 5.5 | 3.4 | candidates clear, camera tips |
| **6.0** | **4.1** | **explode** |
| 6.5 / 7.0 / 7.5 | 4.2 / 4.3 / 4.4 | caps on |
| 8.0 / 8.25 / 8.5 | 5.1 / 5.1+ / 5.2 | caps off, on eighths |
| 9.0 / 9.25 / 9.5 | 5.3 / 5.3+ / 5.4 | tiles lift out, closing fill |

Any `--seconds` override must stay a whole number of bars (an even number of
seconds) or the audio seam clicks even though the video seam does not.

## The percussion bed

`tools/hex-drums.py` synthesises it rather than licensing a loop, for one
reason: the bed has to divide the clip exactly. Kick on 1 and 3, toms answering
on offbeats, shakers on eighths, and a tom fill under the closing bar where the
tiles lift out.

Loop safety is enforced, not hoped for. Any hit whose decay would run past the
end is **wrapped** to the head of the buffer; a truncated tail is the click.
Verified the same way as the video seam: the sample step across the join
measured 4 against an ordinary median of 5 and a p99 of 2596, so it sits inside
the ordinary distribution. Peak is 0.72 of full scale, leaving headroom for the
re-encode every platform performs.

## Which film

There are two Hex Cluster loops and they answer different questions. Picking the
wrong one is the most likely way to waste the asset.

- **`--choreo=orbit`** (the decision loop). Opens in plan view, a ghost lights on
  one slot, the attention moves to another, the part drops, the cluster builds
  up and is inspected. Answers *why would I want this*. **Default for social.**
- **`--choreo=hero`** (the anatomy loop). A tray opens, caps go on, it reverses.
  Answers *what is this thing*. Better where the object is unfamiliar and the
  surrounding page does no explaining.

## Motion posts

Masters are H.264 + AAC-LC 48 kHz, `yuv420p`. Runtime is whole laps of the 10 s
loop: because the cuts are verified exact loops, concatenating them is seamless
by construction and costs a stream copy rather than a longer capture. Measured
on the 30 s vertical master, the lap join reads 0.209 against ordinary
frame-to-frame steps of 0.173 to 0.179. Platform specs
below were verified 2026-08-08 against each platform's current published
guidance; re-check before trusting them, because they move.

| Platform | Placement | File | Why this one |
| --- | --- | --- | --- |
| YouTube | Shorts | `social/hex-vertical-30s.mp4` (1080×1920, 3 laps) | Shorts is strictly 9:16; a landscape or square upload is **not** classified as a Short at all, whatever its length. Three laps because max is 3 min since Oct 2024 and a 10 s clip gives retention almost nothing to measure. |
| YouTube | Regular upload | `social/hex-wide-10s.mp4` (1920×1080) | Standard 16:9. |
| X | Feed post | `social/hex-square-10s.mp4` (1080×1080) | X supports any ratio from 1:3 to 3:1; square wins the most feed height per width on mobile. Free accounts cap at 140 s. |
| X | Landscape | `social/hex-wide-10s.mp4` | When the post sits beside 16:9 media or a link card. |
| LinkedIn | Feed post | `social/hex-portrait-10s.mp4` (1080×1350) | LinkedIn's 4:5 maximum is *exactly* 1080×1350, so this fills the slot with no re-encode. Under 60 s, which is where engagement concentrates. |
| LinkedIn | Landscape | `social/hex-wide-10s.mp4` | Company-page posts that need to match a 16:9 set. |

## Page embeds, not social

| Surface | File | Note |
| --- | --- | --- |
| Academy `/hex` hero | `hex-band-orbit.mp4` + `-light` | Shipped. `band` is framed for a **cropped** surface: the hero is `object-fit: cover` at 58vh and discards ~13% top and bottom. |
| Apex home band | `hex-wide.mp4` (**hero**, not orbit) | Deliberate. That band keeps only ~60% of the height; the orbit's vertical travel gets sliced. Clearing it needs a dolly near 2.07, which shrinks the cluster to a speck. |
| GitHub READMEs (×4) | `hex-readme-orbit.webp` (720×450) | README markdown will not autoplay a repo-hosted mp4; it renders as a dead link. Animated WebP is the only format that plays inline. |

## Stills

| Use | File |
| --- | --- |
| Post thumbnail / poster frame | `hex-<preset>-orbit-poster.jpg`, a real frame from mid-clip |
| Transparent cluster, any background | `public/hex/clean/{trio,flower,strip}.webp` (3200×2400) |
| Configurator UI, both themes | `public/hex/ui/{trio,flower,strip}-{dark,light}.webp` (3200×2000) |
| `/hex` share card | generated by `src/app/(chrome)/hex/opengraph-image.tsx` |

## Known gaps

**The raw cuts still carry no audio stream**, because the capture runs with
`-an`. That is why the masters exist: `hex-social-master.mjs` muxes the bed in
as AAC-LC 48 kHz, which is what YouTube's spec names. Post from
`_hex-promo/social/`, never the raw cut, or a Short goes up with no audio track
at all.

**Light-theme ghosts are faint.** On ivory the app draws the placement ghosts as
near-white outlines rather than the blue and gold it uses on deep space, so the
decision story reads weakly in the light cut. That is the app's material, not
the capture. Social posts use the dark cut, so this only affects light page
surfaces.

**No vertical-native accounts.** Without Instagram or TikTok, the 9:16 cut earns
its keep on Shorts alone. Worth knowing before commissioning more vertical work.
