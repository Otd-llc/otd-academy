# Video production pipeline — research, validation, and the pipeline that survived

> ## ⚠ THIS DOC FAILED ITS OWN VALIDATION ROUND. READ THE HANDOFF FIRST.
>
> A second 5-agent adversarial round (2026-08-14, one lens each, read-only) returned
> **~110 findings** against this document, including **three that refute its conclusion**
> and **one that repeats, on a bigger number, the exact citation error §0 exists to
> prosecute**.
>
> **Do not act on §3 (THE PIPELINE), §6 (what we are NOT building), or §7 (do-first)
> without reading `2026-08-14-video-pipeline-handoff.md` first.** That file carries the
> errata and the corrected state.
>
> §1 (the corrections) and §2 (the 4:2:0 measurement) largely survived and are still
> the best record of what was measured. Everything downstream of them is suspect.

**Date:** 2026-08-14
**Branch:** `promo/video-furniture`
**Scope:** how to actually produce ~127 instructional YouTube videos, solo, free tools only.
**Companion:** `2026-08-13-video-channel-research.md` (channel/format research; this doc is the
production pipeline).

## How this doc was made, and why that matters

Two rounds of agents, ten total.

- **Round 1 (5 agents):** open research — code-driven compositing, OBS capture, batched
  narration, encode/QC/delivery, and a 127-video production system.
- **Round 2 (5 agents):** adversarial validation, one lens each, each instructed to **REFUTE**
  and to grade anything unsourced as REFUTED. One of them measured with ffmpeg against a real
  KiCad schematic from this repo instead of citing. One of them read this codebase instead of
  taking the proposal on faith.

**Round 2 refuted a large fraction of round 1.** The single most damaging habit it found:
*taking a number from a table row and losing which column it came from*, then compounding it
through three derived claims. That is why §1 of this doc is corrections, not findings — the
wrong numbers are more dangerous than the right ones are useful, because they are memorable,
quotable, and were confidently stated.

**Grades**

| Tag | Meaning |
|---|---|
| `[MEASURED]` | Measured on this machine, this content, in round 2. Highest confidence. |
| `[HARD]` | Primary source: official docs, source code, peer-reviewed paper. |
| `[SOFT]` | Credible secondary, community consensus, no primary. |
| `[CRAFT]` | Practitioner judgement, unsourced. |
| `[FAILS]` | Could not be sourced, or contradicted by better evidence. |
| `[CORRECTED]` | Round 1 asserted this; round 2 proved it wrong. **Do not re-derive.** |

---

## 1. CORRECTIONS — do not re-derive these

Every line here was stated confidently in round 1 and is wrong. They are listed first so that a
future reader (human or agent) hits them before the reasoning that produced them.

### 1.1 `[CORRECTED]` "Motion destroys legibility — cut, never pan"

**Claimed:** YouTube's 1080p budget is ~7.9 KB/frame; a dense schematic needs 150–400 KB/frame;
therefore a pan is 20–50x short of budget and pans/scrolls/zooms must be banned.

**Measured** (VP9, 1080p30, real schematic):

```
static  CRF31   157.8 kbps   PSNR 56.74
pan     CRF31   488.3 kbps   PSNR 51.45
```

A pan costs **488 kbps against a real budget of ~1,205 kbps**. It fits, with room to spare. The
claim was wrong by roughly **80–195x**. A translational pan is near the *best* case for inter
prediction, not the worst.

The rule was also **wrong on content grounds independently**: the only real shot list that
exists (`docs/video/l1-01-schematic-starter-and-arrange.md`) requires "Slow scroll down the
listing" (shot 4) and three arrange passes dragging symbols across the sheet (shots 11–13). You
cannot teach schematic arrangement without showing things move. Two independent agents killed
this rule from two directions.

**Keep only:** do not speed-ramp; hold static frames long enough to read.

### 1.2 `[CORRECTED]` The 1.9 Mbps delivery budget

**Claimed:** YouTube serves 1080p VP9 at ~1.9 Mbps standard.

**Actual:** 1,921 kbps is Sample 1's **Premium** column in the maxofs2d teardown. The prior
agent read across rows. Corrected standard mean across all four samples: **1,205 kbps**
(0.022 bpp). The budget was inflated **59%**.

Two further problems with using that source at all:
- Back-solving the bpp gives **~25 fps**, not 30. The derived per-frame figure then divided by 30.
- **n=4, all talking-head/TV, zero screen content** — against a platform that does per-title
  content-adaptive encoding, so a schematic screencast gets a different allocation entirely.

### 1.3 `[CORRECTED]` "A schematic intra frame needs 150–400 KB"

Round 1 flagged this as its own unverified estimate. It is the worst error in the set.

`[MEASURED]` on `public/guide-diagrams/l1-01-schematic-reference.svg` rasterized to 1920x1080:

| Encode | Full sheet | RGB PSNR |
|---|---|---|
| AV1 4:4:4 crf20 | **41.9 KB** | 49.6 dB |
| AV1 4:4:4 crf10 | **58.2 KB** | 54.4 dB |
| x264 4:4:4 crf12 | 88.5 KB | 45.5 dB |
| **x264 `-qp 0` 4:4:4 — LOSSLESS** | **141 KB** | inf |
| Lossless PNG | 140 KB | inf |

**A mathematically bit-exact frame costs 141 KB. The claimed *minimum* for merely "visually
transparent" was 150 KB.** The entire claimed range sits above lossless — an impossible number.

Real answer: **42–65 KB** at genuine visual transparency. Schematic frames are **cheap**.

### 1.4 `[CORRECTED]` "Bits per frame" is a fiction

Actual packet sizes from a 5s static VP9 encode:

```
keyframe 90,918 B | mean non-key 42 B | ratio 2160:1
```

No frame is near any average. Dividing a VBR bitrate by fps describes nothing that exists. Reason
about **GOP cost**, not frame cost:

```
GOP 1s  739.7 kbps   GOP 2s  448.7 kbps   GOP 4s  303.2 kbps   GOP 5s+ 157.8 kbps
```

At YouTube's recommended 2s keyframe interval, keyframes are **74% of the bits** on static
content. "Static frames cost nothing" is false.

### 1.5 `[CORRECTED]` NVENC beats x264 above ~10 Mbps

The cited crossover comes from a test on **a single K-pop music video**, whose own author warns
readers to run their own experiments. Round 1 extrapolated one camera clip to screen content.

`[MEASURED]` on the schematic pan — libx264 wins at **every** bitrate and the gap **widens**:

| Target | x264 PSNR | NVENC PSNR | x264 advantage |
|---|---|---|---|
| 1000k | 46.58 | 45.93 | +0.65 dB |
| 2000k | 52.88 | 50.63 | +2.25 dB |
| 4000k | 59.27 | 56.12 | +3.15 dB |
| 8000k | 66.60 | 60.92 | +5.68 dB |
| 16000k | **72.29** | 64.02 | **+8.27 dB** |

At 8 and 16 Mbps x264 scores higher while spending **fewer** bits (3013 vs 4349 kbps). There is
no crossover for screen content; the advantage runs the other way.

**Also: VMAF is useless for this content.** It reads 99.98 for everything from 2 Mbps up while
PSNR spans 52.9–72.3 dB. The original NVENC conclusion is VMAF-based, so its metric cannot
resolve the differences that matter here. See also §6.3.

### 1.6 `[CORRECTED]` 60fps costs ~25% more bits per frame

Derived from the *recommended upload* table (8 vs 12 Mbps). Recommended upload and delivered
transcode are different things, and no published delivered ratio exists.

`[MEASURED]` at constant CRF: 30→60fps costs **1.07x** (static) / **1.19x** (pan) total bitrate.
7–19%, not 50%. Per-frame cost falls not through starvation but because temporal redundancy rises
— quality was held constant.

### 1.7 `[CORRECTED]` PNG frame sequences would be 2.7 TB

`[MEASURED]` real 1080p schematic PNG: 140 KB (sharp, level 9), 171 KB (ffmpeg level 9), 232 KB
(level 1, fast-capture worst case). 4K: 317 KB.

2.7 TB requires **1.18 MB/frame** — a photographic assumption, 5–8x the real cost of synthetic
screen content. Corrected: **~0.47 TB** at a conservative 200 KB/frame. Even 4K60 lands ~1.45 TB.

### 1.8 `[CORRECTED]` `veryslow` is 20–25% smaller than `medium`

`[MEASURED]` at identical CRF 20 with quality verified:

```
static  medium 106,032 | slow +2.1% | slower +3.4% | veryslow -0.9%
pan     medium 575,458 | slow -58.9% | slower -60.8% | veryslow -62.1%
```

**Static screen content: `veryslow` saves 0.9%.** `slow` and `slower` are *larger*. The pan's 62%
traces entirely to `ref` 3→5 (isolated: `medium + ref=5` = 235,092, reproducing the whole gap),
and the agent flagged its own constant-velocity synthetic pan as likely amplifying that. Treat
the static row as representative.

### 1.9 `[CORRECTED]` Headless Chrome frame capture plateaus at ~15fps

Remotion issue #4949 is real (9.5fps @16 vCPU → 16.1fps @224 vCPU) but:
- It **scales 1.7x up to 64 vCPU** before plateauing — not "regardless of core count".
- The composition was `<OffthreadVideo>` for its entire duration. That is video **decode**, not
  frame capture. Maintainer confirms the bottleneck is OffthreadVideo overhead.
- **Both issues are closed**, with `offthreadVideoThreads` shipped and a WebCodecs rewrite underway.

A DOM/SVG/canvas composition hits neither bottleneck. **The benchmark does not apply to us.**

### 1.10 `[CORRECTED]` Remotion is unusable — "not open source, $25/seat, retroactive"

`LICENSE.md` grants a Free License to **"an individual"**, to for-profit orgs with **up to 3
employees**, and to non-profits — with permission to use it **"non-commercially or commercially
for the purpose of creating videos and images."**

A solo creator monetizing YouTube **pays nothing**. $25/seat is the *Creators* plan; a company
past the threshold starts at **$100/month**, not $25. **No retroactivity clause exists** anywhere
in the licence, pricing page, or FAQ — that was repeated unsourced.

The reason to skip Remotion is architectural, not legal: it would *replace* the scrub renderer we
have already proven rather than extend it.

### 1.11 `[CORRECTED]` Forced-alignment accuracy, and the whole alignment premise

Round 1 quoted MFA 21.9ms / WhisperX 34.3ms and called the gap noise. Those numbers verify
exactly — **from the TIMIT table, 3.1-second read utterances.** The same paper's long-form
corpus (531s mean utterance, i.e. the actual use case):

| Tool | Long-form mean word error |
|---|---|
| MMS | 208 ms |
| MFA | 976 ms |
| **WhisperX** | **11,685 ms** |

The paper names the cause: *"drift in the alignment prediction."*

And the metric was the wrong one entirely. `ctc-segmentation`'s own paper (Kürzinger et al. 2020,
arXiv:2007.09127, Tables 1–2) measures **segment boundary** deviation:

| Method | Mean | Std | <0.5s |
|---|---|---|---|
| Aeneas (DTW) | 9.01 s | 38.47 | 64.7% |
| MAUS (HTK) | 1.38 s | 11.62 | 74.1% |
| Gentle (kaldi) | 0.41 s | 1.97 | 82.0% |
| **CTC-Seg, Transformer** | **0.31 s** | 0.85 | 88.8% |

**The best aligner misses segment boundaries by ~310 ms on average; 11% are off by >0.5s.** With
random speech prepended/appended — explicitly the batch-take-with-retakes case — it degrades to
0.35s / 89.2%.

Against a delivery format where ACX recommends **1–5 seconds of room tone at each end**. Arguing
21.9 vs 34.3 ms was meaningless by two orders of magnitude. See §3.

### 1.12 `[CORRECTED]` MFA's disqualifiers

Both reasons round 1 gave for rejecting MFA were wrong.

- **The quote was truncated mid-clause.** Real text: *"MFA is not intended to align single files,
  particularly if they are long, **have noise in the background, a different style such as
  singing etc.**"* A caveat about a cluster of hard conditions was presented as a flat
  prohibition. The docs also ship **`mfa align_one`** — *"a command geared towards aligning a
  single file."*
- **The OOV blocker does not exist.** Unknown words become `<unk>`, are reported to
  `oovs_found.txt`, and there is a first-class G2P path (`mfa find_oovs` → `mfa g2p`).
  KiCad/MOSFET/JLCPCB is a one-time dictionary chore. Numbers like `0402`/`RP2040` are a *text
  normalization* problem that hits every aligner equally.

Also: **MFA is the only Windows-native option** of the four considered. `ctc-segmentation` has
shipped **zero wheels across all 18 PyPI releases** (needs MSVC + Cython on Windows) and is
dormant (last release 2022-10-11). NeMo is **not supported on native Windows** — maintainer:
*"I'd suggest using WSL 2."*

WhisperX's cited "regressions" are stale: #1220 is **closed and fixed** (v3.8.4, 2026-03-25);
#1247 is an open user question with no maintainer diagnosis, predating the fix.

### 1.13 `[CORRECTED]` OBS chapter markers are broken with file splitting

Issue #12714 was closed 2026-01-09 by PR **#12807 — merged**. Shipped in **OBS 32.1.0**
(2026-03-11): *"Fixed an issue with chapter markers having incorrect time when using file
splitting."* Current stable is 32.2.2. It never affected chapters **without** splitting anyway.

### 1.14 `[CORRECTED]` OBS "sRGB" prevents clipping

OBS's `sRGB` and `Rec. 709` are **identical except for one metadata tag** — `video-matrices.c`
collapses `VIDEO_CS_SRGB` to `VIDEO_CS_709` for the conversion matrix; only `transfer` differs.
**No pixel values change, so it cannot prevent any clipping.**

The real setting is **Color Range**, and that half holds: YUV formats default to Partial, so I444
needs Full set explicitly. But the mechanism is **quantization** (RGB 0–255 compressed into
16–235, i.e. 219 of 256 luma levels) plus mis-tagging risk — not clipping.

### 1.15 `[CORRECTED]` YouTube API upload quota

Three eras, not two:

| Period | `videos.insert` | Bucket | Uploads/day |
|---|---|---|---|
| before 2025-12-04 | ~1600 units | shared 10,000 | ~6 |
| 2025-12-04 → 2026-06-01 | ~100 units | shared 10,000 | ~100 |
| **since 2026-06-01** | **1 unit** | **own bucket** | **100 calls/day** |

"~100 units" was true only for a six-month window that closed. Current cost is **1 unit**; "100"
is the daily *call limit*. 127 uploads = 2 days.

**And the captions constraint does not exist.** YouTube Studio → Subtitles accepts SRT/VTT per
video, on already-published videos, at **zero quota cost**. The 50,800-unit / 6-day figure only
applies if you insist on using the API.

### 1.16 `[CORRECTED]` Miscellany

- **`loudnorm linear=true` has SIX silent fallbacks**, not two. Two are `offset_tp <= target_tp`
  and `measured_lra <= target_lra`; **four are sentinel comparisons against option defaults** —
  `measured_tp != 99`, `measured_thresh != -70`, `measured_lra != 0`, `measured_i != 0` — so a
  **genuine 0.0 measurement is indistinguishable from "not supplied"**. There is no warning of any
  kind (`af_loudnorm.c` has three `av_log` calls, none about fallback). Extra trap: **inputs
  under 3 seconds force linear mode regardless**, so reading `"linear"` on a short clip proves
  nothing. Measured cost: asking LRA 3 against a 4.80 source silently went dynamic and delivered
  **LRA 17.80** — the fallback made the targeted metric dramatically *worse*.
- **The alpha-dropping filter list is mostly wrong.** Actually drop alpha: `hqdn3d`, `gradfun`,
  `vignette`, `edgedetect`, `nlmeans`, and counterintuitively **`premultiply`**. Preserve it:
  `eq`, `hue`, `unsharp`, `boxblur`, `overlay`, `blend`, `zscale`, `yadif`, `geq`, `chromakey`.
  The auto-inserted scale filter is logged at `AV_LOG_VERBOSE`, so it *is* genuinely silent at
  default verbosity.
- **Display Capture has no BitBlt option** — that is a Window Capture method only. And KiCad is
  not in OBS's 49-entry `compatibility.json`; OpenGL is not the class OBS flags. Use WGC anyway;
  the stated reason was unproven.
- **NVENC HEVC 4:4:4 is Pascal/Volta onward**, not Turing+. AV1 4:4:4 is unsupported on *every*
  NVIDIA generation, not just Ada.
- **`force-cfr` does nothing in either OBS box**, for two different reasons: no such muxer option
  exists, and OBS explicitly strips it from the x264 Options box (`obs-x264.c:283`). OBS cannot
  emit variable PTS — `//#define ENABLE_VFR` is commented out.
- **MKV→MP4 remux does not create VFR.** Reproduced: a "CFR" 60fps MKV's own PTS deltas are
  already non-uniform (17ms x79, 16ms x40) because Matroska's 1ms timescale cannot represent
  1/60s. Matroska's `DefaultDuration` *hides* it; MP4's `stts` *exposes* it. Control at 50fps
  (20ms exact) shows no VFR either way.
- **OBS issue #13235** (downscale filters distort text) is real but **unlabelled, untriaged, and
  an OBS contributor pushed back on the evidence**. Presented in round 1 as an established
  defect. The right answer is to not downscale at all, which makes it moot.
- **`uploading 1440p/4K improves the 1080p rendition`** was graded `[FAILS]` in round 1. Correct
  grade is **UNVERIFIABLE in both directions** — Google publishes no transcode-ladder
  documentation, so there is no primary source to refute it *with*. A plausible non-bitrate
  mechanism exists (higher-res uploads appear to trigger VP9/AV1 across the ladder including the
  1080p rung). Do not build an argument on it either way.

---

## 2. The claim that survived, and it is the one to act on

`[MEASURED]` **4:2:0 chroma damage is applied before any encoder runs, and nothing recovers it.**

Round-tripping the schematic through pixel formats with **no compression at all**:

```
4:4:4 round-trip     RGB 65.72 dB
4:2:2 round-trip     RGB 40.09 dB
4:2:0 round-trip     RGB 37.40 dB     <- 28 dB penalty, zero compression involved
x264 LOSSLESS 4:2:0  RGB 37.399 dB    <- IDENTICAL. the codec adds nothing
x264 LOSSLESS 4:4:4  RGB 65.72 dB
```

- **Red is the worst case, confirmed:** Cr 37.89 dB vs Cb 45.08 dB — a **7.2 dB** gap.
- **Chroma-from-luma does not rescue it.** AV1 *with* CfL = 37.31 dB; VP9 *without* CfL = 37.38
  dB. Identical. CfL is a coding-efficiency prediction tool; it cannot reconstruct chroma the
  downsample already discarded.
- Every 4:2:0 encoder pinned at ~37 dB regardless of CRF. **Spending more bits buys literally
  nothing.**

**Therefore: capture and master in 4:4:4.** Measured at only ~30% larger than 4:2:0 *while being
mathematically lossless* (141 KB vs 109 KB). Convert to 4:2:0 exactly once, at delivery, because
YouTube's spec mandates it `[HARD]`.

One fairness note: "destroys" overstates it for *legibility*. On KiCad's white background, red
lines differ hugely in **luma** too, so text stays readable; the damage is colour fringing and
desaturation of 1px lines. The isoluminant case is the extreme, not the typical. Still worth a
theme audit for **luma** contrast — any two elements that must be distinguishable should differ
in Y, not only in hue.

---

## 3. THE PIPELINE

Five stages. Three of them already exist.

### Stage 1 — Capture (OBS)

| Setting | Value | Grade / why |
|---|---|---|
| Base = Output = capture region | **2560x1440**, no rescale | `[HARD]` any non-1:1 resamples text. Also verify Output→Recording "Rescale Output" is OFF — it stacks |
| Color Format | **I444** | `[MEASURED]` §2. Avoids applying 4:2:0 twice |
| Color Space | 709 or sRGB | `[HARD]` identical but for one tag (§1.14). Irrelevant either way |
| Color Range | **Full** | `[HARD]` KiCad has literal #000/#FFF; Partial quantizes to 219 of 256 luma levels |
| FPS | **60**, integer (never 59.94) | `[MEASURED]` costs 7–19%, not 50%. Pans are legal again, so judder matters |
| Encoder | x264, **CRF 15–16**, preset `veryfast`, `keyint=60` | `[CRAFT]` must run realtime |
| Container | **Hybrid MP4** | `[HARD]` chapters + crash recovery, no remux step |
| Capture method | **WGC** (Windows 10 1903+) | `[SOFT]` Display Capture offers no BitBlt anyway |
| Audio | 48 kHz | `[CRAFT]` a 44.1/48 mismatch is a real resample artifact |

**Do first, once — the irreversible check.** Shoot 30 seconds, zoom the file to 400%, read a pad
number. KiCad on Windows has a documented HiDPI history; if Windows is bitmap-stretching a
non-DPI-aware process, every glyph is interpolated *before OBS ever sees it* and no encoder,
resolution or CRF recovers it. You cannot tell at normal zoom. `[SOFT]` If it renders blurry:
`kicad.exe` → Properties → Compatibility → Override high DPI scaling → **System (Enhanced)**.

**Target apparent size, not resolution** `[CRAFT]`: at final 1080p delivery, label cap-height
**>= 22–24 px**, schematic line weight **>= 2 px**. Text large enough survives the transcode;
11px text does not survive at any upload resolution. Desktop 2560x1440 at Windows 150% scaling
gives a logical ~1707x960 UI — physically large glyphs, 3.7 Mpx of real detail.

**Per-take gates, programmatic** `[CRAFT]`:
- Parse the OBS log for `Number of skipped frames due to encoding lag` and `Number of frames
  missed due to rendering lag`. **Non-zero = fail the take.** x264 at 1440p60 4:4:4 will overload
  a mid-range CPU, OBS drops frames silently, and `-vsync cfr` cannot recover frames that were
  never captured.
- `ffprobe`: assert `r_frame_rate == avg_frame_rate`, `color_range=pc`, `pix_fmt` as expected,
  and `nb_frames` within 1 of `duration * fps`.

**On-screen aids** `[HARD]`: **Keyviz** (GPL-3.0, standalone) for keystrokes — KiCad is
hotkey-driven (`X` route, `V` via, `B` fill, `D` drag) and without an overlay half your
instruction is invisible. **PowerToys Mouse Highlighter** (MIT) for clicks. Enlarge the Windows
pointer. Enable Focus Assist; disable KiCad's update check.

**Motion is permitted.** See §1.1. Do not speed-ramp; hold statics long enough to read.

### Stage 2 — Narration: 127 separate files, no aligner

This is the largest simplification validation produced. The entire forced-alignment subsystem is
deleted.

**Why** `[HARD]`: ACX mandates *"Each file must contain only one chapter or section. Upload each
file individually."* E-learning practice is documented as segment = file. And the best aligner
misses segment boundaries by ~310 ms mean (§1.11) against a format padded with 1–5 seconds of
room tone. The precision debate was off by two orders of magnitude.

**Two acceptable methods:**
1. Record 127 files directly. The problem disappears.
2. Record long in **Audacity**; press `Ctrl+M` at each segment start *while the transport is
   rolling* and type the video ID; then File → Export Multiple, split on labels. `[HARD]` *"Each
   file will be named exactly as the text of each label."* Zero ML, zero dependencies.

If automatic detection is ever wanted, use **auditok** over pydub `[HARD]` — it has automatic
threshold estimation (Otsu) and separates *when the event ends* (`max_silence`) from *how much
tail to keep* (`max_trailing_silence`). pydub's default `silence_thresh=-16` dBFS is absurdly
loud for "silence" and it is pure-Python over 1ms slices.

**Session hygiene** `[CRAFT]`, mostly to defeat drift across a multi-hour sitting:
- 60s of room tone per session, stored as a first-class artifact keyed to the session — denoise
  with the *matching* session's noise print, never a global one.
- A fixed calibration line at session start **and end**; comparing them measures pace creep.
- Sessions <= 90 min. Energy decays; if you record in course order, the tail of the curriculum
  sounds tired. Shuffle within a session.
- Never let one video span a session boundary.
- Retake convention: stop, leave ~2s, re-read from the **start of the current sentence**.
- Store NPR-style script marks (`/` breath, bold stress, `(wah-KEEN)` phonetics) in the DB and
  have the teleprompter renderer honour them `[HARD]`. **Break prompter lines on marked phrase
  boundaries** — line-break position is the strongest determinant of phrasing, and it is a
  rendering-code change, not a performance skill.

**Cleanup chain** `[CRAFT]` — starting points, tune against the real mic and room:

```
highpass=f=80,
afftdn=nr=10:nf=-45,
deesser=i=0.25:f=0.45,
acompressor=threshold=-20dB:ratio=3:attack=8:release=180:makeup=2,
alimiter=limit=0.891
```

HPF before denoise; de-ess before compression; limiter last. **Not `arnndn`** — both community
model repos have no usable licence (§5).

**Loudness** — two-pass `loudnorm` as its own stage, then **read `normalization_type` back from
the JSON and fail the build if it is not `linear`.** Six silent fallbacks, zero warnings
(§1.16). `ffmpeg-normalize --batch` preserves relative loudness across a set, which is the
127-video consistency problem.

**Targets** `[SOFT]`: **-16 LUFS integrated, -1.5 dBTP, LRA 5–7**. -16 sits inside AES TD1004's
-16..-20 window. **LRA is the variable you keep** — YouTube's Stable Volume takes the integrated
number away from you regardless, so a tight LRA is how a mix survives the platform's compression.
That inverts the usual advice, which fixates on the integrated figure. Note also that Stable
Volume is **automatically off when Voice Boost is on** `[HARD]`, so "the platform flattens it
anyway" does not hold for every listener. Noise floor becomes first-class because anything that
can apply *upward* gain amplifies the room: ACX's **-60 dB RMS** floor stops being a formality.

### Stage 3 — Furniture: the scrub renderer, batched

The part that earns its keep. Render once, unattended, to alpha (ProRes 4444 or FFV1 RGBA):

- intros / outros per cluster — a handful of files
- **~500 lower-third clips** (127 x ~4), one per (lesson, title) pair
- **all 127 thumbnails** — absent from every prior version of this plan, the single
  highest-leverage YouTube asset, and the thing this renderer is genuinely better at than any NLE

**Two fixes first, both small, both in existing code:**

1. **The `[data-settled]` contract can be satisfied stale.** `window.__seek` is `setT`, a React
   state update — asynchronous and batched — so the attribute from frame N-1 is still on the
   element when `__seek` returns. The natural consumer:
   ```js
   await page.evaluate(t => window.__seek(t), t);
   await page.waitForSelector('[data-settled]');   // matches the PREVIOUS frame, returns instantly
   ```
   **Fix:** set `data-settled` to `String(t)` rather than `"1"`, and wait for that exact value.
   Two characters on the producer side, and it makes the gate impossible to satisfy stale.
2. **`pin()` covers one selector.** The `.xp-pop` allowlist exists because a component picks a
   variant with `Math.random()` at mount. Any future component using `Math.random()`,
   `Date.now()` or `crypto.getRandomValues()` is uncovered. **Fix:** seed `Math.random` via
   `page.addInitScript` before navigation — kills the class, not the instance. Also count the
   swallowed exceptions in the animation-pinning `catch` and refuse to set `data-settled` if any
   fired.

**Compositing** `[CRAFT]`: force the overlay into full-resolution RGB and subsample **once** at
the end, or antialiased glyph edges and 1px hairlines fringe:
```
[base]format=gbrp[b];[b][ovl]overlay=format=rgb[o];[o]format=yuv420p
```
Verify once by diffing a hairline crop at 400% against the browser's own render. Contact sheets
are downscaled and hide subpixel fringing entirely.

**Also fix while here** `[CRAFT]`: `tools/promo/render-cut.mjs` resolves Playwright via
`createRequire("C:/zzz/pf-beta/package.json")` — a sibling repo not in this one — and hard-fails
without an audio bed stored outside every repo on one disk. Playwright is already in
`devDependencies`; the hack is unnecessary.

### Stage 4 — Assembly: DaVinci Resolve, by hand

Template timeline: intro on V2, outro on V3, a Fusion lower-third with a text parameter, all
furniture in a PowerBin. ~3–4 hours of setup, once.

Per video, narration and capture already in hand `[CRAFT]`:

| Step | Time |
|---|---|
| Import + sync | 3 min |
| Cut to narration beats (transcript-based editing) | 20–25 min |
| Drop furniture, type lower thirds | 8 min |
| Fairlight loudness normalize | 2 min |
| **Watch it through once** | **8 min — not optional** |
| Export | unattended |

**~40 min hands-on. 127 x 40 min ~= 85 hours.**

### Stage 5 — Delivery

**Master:** `libx264`, CRF 15–16, `-tune stillimage`, preset **`medium`**, `-g 30`, 4:2:0
**only at this final step**.

- Not NVENC — up to **8.27 dB worse** on screen content (§1.5).
- Not `veryslow` — saves 0.9% on static content (§1.8).
- `-tune stillimage` sets `--aq-strength 1.2 --deblock -3:-3 --psy-rd 2.0:0.7` `[HARD]`, verified
  against x264 source. **`deblock -3:-3` is the load-bearing part** — x264's deblocking filter is
  tuned for camera noise and smears hairlines. Note: combining `stillimage` with another psy tune
  makes it **silently ignored with only a warning**.
- Leave scene-cut detection ON. Do not set `-sc_threshold 0` — that advice comes from
  live-streaming/ABR contexts.

**Upload through the web UI, not the API.** `[HARD]` Videos uploaded via `videos.insert` from
unverified API projects created after 2020-07-28 are **restricted to private**, and Google's own
words: *"you will not be able to appeal."* There is **no documented own-channel exemption**, the
audit guide never mentions the private-lock at all, and there is **no published SLA** — Google's
developer forum has a compliance-review thread unanswered at 4+ weeks as of 2026-08-06. Apply for
the audit; do not make it a dependency.

**Captions: Studio → Subtitles, SRT per video, zero quota** (§1.15). Auto-captions are 85–95%
accurate versus 99%+ for uploaded files — for a technical curriculum where a misheard component
value is a real defect, upload them.

**9:16 shorts must be authored, never derived** `[HARD]`. Centre-cropping 1920x1080 to 9:16 gives
607x1080, then upscales 1.78x. Letterboxing is worse: the frame occupies 1080x608, a 0.5625x
scale, turning a 24px label into 13.5px on a phone. Phone viewing pushes the floor to ~44–48px
cap height in a 1080x1920 frame. Note the corollary: **each short is a separate authoring pass,
not a render target** — a narrow frame gets *different* content, not smaller content. Budget 127
extra content decisions.

---

## 4. QA — what actually catches things

**Watch each video once.** 8 minutes each, ~17 hours total spread over months. Not optional.

The "17 hours per re-render" argument that motivated skipping this was a non-sequitur: you watch
each video once *at first publish*, and it is the most valuable QA available. Automated gates are
worth having for *re-renders*; they are not a substitute for first-pass review.

**What automated gates actually catch vs. what goes wrong:**

| Real failure | Caught? |
|---|---|
| Clicked the wrong menu item on camera | No |
| Narration for video 44 muxed onto video 43 | No — both valid, both right length |
| Lower third says L1.03 over L1.04 footage | No — contact sheet thumbnail is unreadable |
| Mispronounced part number | No |
| Dialog covering the thing being described | No |
| File missing / wrong size / silent / wrong duration | **Yes** |

Predicted catch rate on injected defects: **2 of 10.** Build the gates anyway — they are cheap —
but do not let them substitute for the watch.

**The one gate worth writing** (~20 lines) `[CRAFT]`: assert the narration transcript overlaps
the lesson's own part designators. Zero overlap means you muxed the wrong take. That is the whole
"right file, wrong content" class, which nothing else catches.

**Capture ffmpeg stderr and fail on** `/Non-monotonous|DTS|Invalid|corrupt|Past duration/`.
**ffmpeg's exit code is not the gate.** This repo already paid for that lesson —
`tools/promo/render-cut.mjs:56-59` documents an `astats` gate that read stdout, got an empty
string, and passed having measured nothing. *"A check that cannot fail is worse than no check."*

**Every gate should emit a count of assertions actually evaluated, and fail below a pinned
floor.** That is how you catch a gate that regressed into a no-op — the failure mode behind both
the astats bug and the `content-export-v1` pinned-tag trap.

---

## 5. Licence findings

| Item | Licence | Action |
|---|---|---|
| **`obsws-python`** | **GPL-3.0-only** | **DO NOT USE.** It is *linked*, so the subprocess safe-harbour does not apply. Use `obs-websocket-js` (MIT) or raw WebSocket — the protocol is not the library |
| `richardpl/arnndn-models` | **none — no LICENSE file at all** | **DO NOT USE.** Default all-rights-reserved. Its `std.rnnn` also redistributes Xiph RNNoise (BSD-3) *without the notice* |
| `GregorR/rnnoise-models` | copyright **disclaimer**, not a grant | Do not rely on. Unsettled law, explicitly excludes `tools/` |
| `ctc-forced-aligner` default model | **CC-BY-NC 4.0** | Non-commercial. Also: the repo has **no LICENSE file**; "BSD" is one README sentence |
| WhisperX fr/de/es/it align models | **CC-BY-NC 4.0** (torchaudio VoxPopuli) | English is safe (`WAV2VEC2_ASR_BASE_960H`, MIT). Does not bite us |
| `aeneas` | **AGPL-3.0** | §13 extends copyleft to *network interaction*. Avoid. (Note: the "broken on modern Python" claim is stale — PR #317 merged 2026-07-22 fixed it on `main`; PyPI still ships broken 2017 v1.7.3) |
| MFA | **MIT**, models **CC-BY-4.0** | Clean. Pushed 2026-08-07 — the only actively-maintained aligner |
| `ctc-segmentation` | Apache-2.0 (LICENSE verified) | Clean licence, models clean (wav2vec2 apache-2.0, NVIDIA conformer/parakeet CC-BY-4.0) — but dormant and wheel-less. **Caveat: NVIDIA is not uniformly CC-BY-4.0; the `canary-*` family is CC-BY-NC. Pin exact model IDs** |
| ffmpeg Windows builds | gyan.dev = **GPLv3-only**; BtbN ships **gpl / lgpl / nonfree** | If you ever redistribute, take **BtbN-lgpl**. `nonfree` is not redistributable at all |
| Tesseract, PowerToys, `obs-websocket-js`, `ffmpeg-normalize` | Apache-2.0 / MIT | Clean |
| Keyviz | GPL-3.0 | Standalone app — imposes nothing on this repo, but cannot be bundled |

**On the subprocess boundary** `[HARD]`: the FSF's test is **arm's-length vs. intimate
communication**, not "did you use a subprocess." CLI args + stdout is the paradigm arm's-length
case, so invoking ffmpeg as a subprocess is sound. Two qualifications round 1 omitted: it is a
strong safe-harbour, **not an automatic rule**; and it protects your **source licence, not
distribution** — shipping a GPL ffmpeg binary in your installer is distributing GPL software
regardless of how you call it. Having the user install ffmpeg avoids that entirely.

---

## 6. What we are NOT building, and why

The round-1 architecture proposed 11 subsystems. All of the following are deleted.

Derived-state model · content-addressed cache · forced alignment · OBS chapter integration ·
EDL/composition model · `concat -c copy` segment reuse · resume infrastructure · cross-process
parallelism · rational-time layer · alpha-overlay-only assembly · lossless segment intermediates.

### 6.1 The break-even math

| | |
|---|---|
| Resolve, by hand | ~40 min/video → **~85 h** for 127 |
| Full pipeline | ~12 min/video → **~25 h** for 127 |
| **Saving per full pass** | **~60 h** |
| Build cost (11 subsystems, Windows/OBS/ffmpeg integration) | **250–500 h** |

```
250 h / 60 h per pass  ~=  4.2 complete re-cuts of all 127 to break even
500 h / 60 h per pass  ~=  8.3 complete re-cuts
```

The build estimate is calibrated against this repo's own evidence: the promo pipeline for **one
10-second film in five formats** produced ~1,500 lines of engine plus ~1,500 lines of tooling,
consumed multiple full sessions, and documented a dozen paid-for traps — a resolution-dependent
scale rule, a `Math.random()` leak, a stderr-vs-stdout gate that measured nothing, a declared
intrinsic wrong three times. That is the trap density of this problem domain, measured on this
machine.

**And the payback passes must all happen before first publish**, because **YouTube never permits
replacing the media of a published video** `[HARD]` — *"You can't replace a video. Any new video
you upload to YouTube will get a new URL."* A post-publish re-render costs the URL, watch time,
comments, every inbound link, and search ranking. Nobody re-cuts an unpublished catalogue four
times.

**Design consequence, independent of architecture:** keep anything likely to change **out of the
pixels**. URLs, part numbers, prices, revision stamps, errata, safety warnings belong in the
description, chapters, pinned comment, cards, and the lesson page that embeds the video. Burn in
only what is time-invariant.

### 6.2 The correction ladder after publish

| Severity | Remedy | Views kept |
|---|---|---|
| Wrong fact, no injury path | Corrections line in the description | Yes |
| Unsafe segment removable without breaking continuity | Studio **trim** | Yes |
| Wrong on-screen value only | Studio **blur** + Corrections | Yes |
| Content must be *added*, or narration states it | **Re-upload — unavoidable** | No |

Two limits round 1 missed `[HARD]`:
- **Trim is now irreversible.** "Revert to original" was **removed in June 2025**.
- **Trim is blocked above 100k views for non-YPP channels**: *"For unedited video with over
  100,000 views, you may not be able to save changes to it, except to blur faces."* **Blur
  survives that gate**, making it the most durable correction instrument.

**Corrections rests on a single 2022 blog post** — there is **no YouTube Help Center page for the
feature at all**. Confirmed from the blog: the `Correction:` syntax and the requirement that it
be **in English regardless of the video's language**. Refuted as unsourced: "placed after
chapters" (official text says *"typically at the bottom but anywhere you like"*), the
strikes/inappropriate-content gating, and any minimum video length. **Whether `videos.update`
actually triggers corrections parsing is unverified** — test on one video before building an
errata workflow on it.

**The playlist is the real publication unit.** Because lessons are playlists, re-uploading a
corrected video and swapping the `playlistItem` gets every learner on the curriculum path onto
the correct step immediately, even though the old URL still exists. That is the closest thing to
atomic republication YouTube permits.

### 6.3 Things that would have gone wrong silently

Kept as a record of what the architecture critic found, because these recur in any future attempt:

- **`approved_at` does not bind to bytes.** Approve v1, re-render one overlay, and derived state
  still reports approved — the human safety gate defeated by the feature it was paired with. If
  an approval flag is ever built, store **`approved_output_sha256`** and derive `approved` as a
  hash match.
- **`hash(script_text)` had no referent.** `prisma/schema.prisma` contains zero occurrences of
  `script`, `narration`, or `teleprompter`. The `youtube` content block
  (`src/lib/schemas/guide.ts`) is `videoId`, `title`, `caption`, `start`, `uploadDate` — no
  script, no duration, no anchor. Five agents designed around a hash with nothing to hash.
- **Scripts reference content blocks by array index, and blocks have no IDs.** The real script
  pins itself to "blocks `[8]`-`[18]` of the SCHEMATIC card". Insert one callout at index 10 and
  every video silently teaches different blocks than it claims. `hash(script_text)` is unchanged
  — *the script did not change; the world it points at did.* If this ever matters, add
  `id: z.string().uuid()` to every block variant and hash `(script, referenced_block_ids,
  hash_of_those_blocks)`.
- **"Artifact exists" is false on Windows** for a file ffmpeg is still writing, or died writing.
  `-movflags +faststart` rewrites the whole file to move the moov atom; killed mid-rewrite you
  get a full-size, existing, unplayable MP4. Defender holds handles for real seconds. Any future
  state derivation must key on a **sidecar `.done` JSON written after fsync**, not on a path.
- **VMAF is out-of-distribution for screen content** `[HARD]`. Netflix's model targets a 1080p
  HDTV at living-room distance on professionally-produced camera content; the June 2026 VMAF v1
  announcement says nothing about screen content, text, or sharpness. `[MEASURED]` it reads 99.98
  for everything from 2 Mbps up while PSNR spans 52.9–72.3 dB. **Do not gate on VMAF.** PSNR on
  synthetic line art, or a Tesseract character-error-rate diff against a destination-simulating
  VP9 proxy, measure the thing you care about.

---

## 7. Do-first list

1. **KiCad DPI test.** 30-second capture, 400% zoom, read a pad number. Irreversible if wrong,
   invisible at normal zoom.
2. **Set OBS to I444 / Full range**, and assert `color_range=pc` in ffprobe. Both halves, or you
   double-crush.
3. **Audit the KiCad theme for luma contrast**, not colour contrast. §2.
4. **Apply for the YouTube API compliance audit** — then plan to upload via the web UI anyway.
   No SLA, non-appealable lockout.
5. **Fix the `data-settled` contract** to `String(t)` and seed `Math.random` via
   `addInitScript`. Small, and everything downstream inherits the determinism.
6. **Vendor the Playwright resolution and the audio bed** into this repo. `render-cut.mjs`
   currently depends on a sibling repo and a file outside version control.

Then: build the Stage-3 batch driver (~20–30 h), cut 30 videos by hand, and **only then** decide
whether any one step deserves automating. Everything in §6 is an answer to a problem not yet
demonstrated.

---

## 8. Open questions

- **TikTok/Reels encode specs** — not researched. Both re-encode more aggressively than YouTube
  and have their own caps.
- **Whether `videos.update` triggers Corrections parsing** — plausible, undocumented, untested.
- **Delivered 1080p30-vs-1080p60 bitrate ratio on YouTube** — unverifiable; no published data.
  The 7–19% figure is our own encode, not YouTube's transcode.
- **Whether higher-res upload changes the 1080p rendition** — unverifiable in both directions
  (§1.16). Google documents no transcode ladder.
- **Stable Volume's actual transfer characteristic** — no rigorous public measurement exists.
  Everything beyond Google's two sentences is speculation. Measurable by uploading a known-LRA
  test file and comparing captured playback.
- **The measurement caveats on §1** — single schematic, two framings, one board. Denser content
  (copper pours, 3D renders) costs more, though the 4K PNG figure suggests synthetic content
  stays cheap. The pan is synthetic constant-velocity, which flatters inter prediction and
  demonstrably inflated the `ref` effect in §1.8.

---

## Appendix — primary sources worth keeping

**YouTube**

```
https://support.google.com/youtube/answer/1722171
```
```
https://support.google.com/youtube/answer/55770
```
```
https://support.google.com/youtube/answer/9057455
```
```
https://support.google.com/youtube/answer/7300965
```
```
https://developers.google.com/youtube/v3/determine_quota_cost
```
```
https://blog.youtube/news-and-events/how-to-add-corrections-to-youtube-videos/
```

**Measurement / codec**

```
https://blog.maxofs2d.net/post/726924872001994752/a-quick-look-at-what-youtubes-1080p-premium
```
```
https://netflixtechblog.com/vmaf-v1-good-is-not-good-enough-60d7e4244ea8
```
```
https://silentaperture.gitlab.io/mdbook-guide/encoding/x264.html
```

**OBS**

```
https://obsproject.com/kb/hybrid-mp4
```
```
https://github.com/obsproject/obs-studio/issues/12714
```

**Alignment**

```
https://arxiv.org/abs/2007.09127
```
```
https://www.isca-archive.org/interspeech_2024/rousso24_interspeech.html
```
```
https://montreal-forced-aligner.readthedocs.io/en/latest/user_guide/corpus_structure.html
```

**Narration craft**

```
https://help.acx.com/s/article/acx-audio-submission-requirements
```
```
https://manual.audacityteam.org/man/label_tracks.html
```
```
https://www.npr.org/sections/npr-training/2025/09/29/g-s1-90460/how-marking-scripts-can-help-you-sound-more-natural
```
