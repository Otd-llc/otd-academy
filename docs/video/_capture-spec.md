# Capture spec — the two irreversible decisions, and the settings that follow

**Date:** 2026-08-14 · **Branch:** `promo/video-furniture` (worktree `C:/zzz/pf-bed`)
**Status:** decided and measured. Read `2026-08-14-video-pipeline-handoff.md` §4 for why
these two were the blockers.

Both decisions bake into 127 videos and neither is cheaply reversible after the first
dozen ship, so both were **measured on this machine, on this content**, rather than
argued from the research doc. The measurements are reproducible: the scripts that
produced them are named inline.

---

## Decision 1 — capture at 1920x1080. Not 2560x1440.

**Recommendation: 1920x1080, 1:1 with delivery.**

The research doc said 2560x1440; the shot list said 1920x1080. They were never
reconciled.

### The measurement

The comparison only means anything if **legibility is held constant**, and the shot list
pins legibility explicitly: *"UI scale up one notch so menus are legible at 720p."* That
target is a property of the **delivered** frame, so it is the same whatever you capture
at. Holding it fixed forces the 1440p capture to run KiCad's UI **1.333x larger** — which
means it carries the *same* glyph and stroke information as the 1080p capture, and then
pays a 0.75 resample on the way out.

Rendering the same logical sheet at both sizes and measuring what reaches the delivered
frame (`res-test.py` + `acutance.py`, method in the scratchpad, numbers below):

| Path | 1px wire contrast, as a fraction of a crisp line |
|---|---|
| **native 1920x1080** | **100.0%** on all 14 lines |
| 2560x1440 -> 1080p, lanczos | mean **63.1%**, worst 57.5% |
| 2560x1440 -> 1080p, bicubic | mean **61.3%**, worst 54.5% |

A hairline arrives at roughly **six tenths of its contrast** before 4:2:0 conversion and
YouTube's transcode have taken their cuts. A schematic is made of hairlines.

**Why amplitude and not PSNR.** PSNR between the downscaled and native renders reads 20.5
dB, which looks damning, but it is not usable evidence: it conflates real blur with
harmless sub-pixel phase, and would read badly even for a perfect resampler. Amplitude
asks the question that decides legibility — *does the line still reach its colour* — and
it is the number above.

**Honest limit on this measurement.** The test lines are synthetic and perfectly aligned,
which is the best case for the native path. Real KiCad output is antialiased and starts
below 100%, so the true gap is narrower than 100 vs 62. The *direction* is not in doubt:
a 0.75 resample of a signal sitting at the pixel Nyquist is information-destroying, so the
native path cannot come out behind.

### The other way 1440p loses

If instead you hold the **UI scale** fixed and capture 1440p, you get more content in
frame at *smaller* delivered text — which fails the shot list's own "legible at 720p"
bar. There is no setting at which 1440p wins.

### What is NOT a reason to go 1440p

- *"Uploading 1440p improves the 1080p rendition."* Research §1.16 grades this
  **unverifiable in both directions** — Google publishes no transcode-ladder
  documentation, so there is no primary source to argue it with either way. It cannot
  carry an irreversible 127-video decision.
- *"Reframe headroom in post."* The shot list forbids zoom effects and the surviving
  motion rule is "hold static frames long enough to read". The format does not reframe.

### The escape hatch, stated now so it is not quietly reversed later

If a 9:16 cut ever needs screen content, **re-shoot that beat with KiCad windowed to
1080x1920** rather than cropping the 16:9 master. A 9:16 crop of a 1080p frame is 607px
of real width, and no capture resolution fixes that — a schematic cropped to a phone
column is unreadable at any source size. The furniture already renders natively at
1080x1920 (`check-video-furniture.ts` runs the loop-seam check at that viewport).

---

## Decision 2 — light schematic canvas. KiCad's own default, untouched.

**Recommendation: leave the schematic canvas on stock KiCad Default (light). Let the
application chrome be whatever a fresh profile gives you.**

The research doc's §2 fairness note assumed a white background; the shot list said dark
theme. The handoff flagged that the note **inverts** under a dark theme. It does, and by
more than was assumed.

### The measurement

1px wires, buses, pin strokes and label-weight ticks, round-tripped through 4:2:0 with
**zero compression** — the same method that produced the finding that survived all three
validation rounds (`theme-swatch.py`):

| Canvas | 4:4:4 round trip | 4:2:0 round trip | penalty |
|---|---|---|---|
| **light** (KiCad Default) | 52.93 dB | **29.44 dB** | -23.5 dB |
| dark (representative community theme) | 59.27 dB | **27.10 dB** | **-32.2 dB** |

The dark canvas ends up **2.3 dB worse** after subsampling, and loses 8.7 dB more from its
own ideal.

The mechanism is luma. 4:2:0 keeps luma at full resolution and halves chroma in both
axes, so an element carried by luma survives and an element carried by hue does not:

| | light canvas | dark canvas |
|---|---|---|
| background luma | 243.9 | 27.0 |
| wire, luma gap from page | **136.6** | 116.0 |
| component outline / pins | **215.8** | 82.8 |
| bus | **234.3** | 82.8 |

On the light canvas every element differs from the page by 137-234 luma and is legible
from luma alone. On a dark canvas the coloured elements collapse toward 83 and lean much
harder on the chroma that 4:2:0 is about to throw away.

### Two independent reasons that point the same way

**It is what the learner sees.** Verified on this machine: `%APPDATA%\kicad\10.0\colors\
user.json` is stock `KiCad Default`, background `rgb(245, 244, 239)`. KiCad's canvas
colour theme is a **separate** per-application JSON theme, independent of the OS/app dark
mode; KiCad 10's new dark mode is **Windows-only and applies to the application chrome**,
not the canvas. A fresh KiCad 10 profile — which the script's production notes require —
gives a **light canvas**. A dark canvas requires importing a third-party theme. Teaching a
true beginner against a canvas they will not have is a needless mismatch, and the script's
own production note asks for a fresh profile precisely so nothing on screen contradicts
what the learner has.

**It matches the lesson.** The shipped reference diagram the learner sees next to this
video, `public/guide-diagrams/l1-01-schematic-reference.svg`, is Eeschema-SVG output on
`fill:#FFFFFF` with the KiCad Classic palette. A dark video next to a light diagram is a
break in the thread for no gain.

### The cost, stated plainly

A light canvas sits inside dark OTD furniture, which is a real luminance step at the
frame edge. That is a **furniture** problem — a matting/inset treatment — not a reason to
degrade the teaching surface. Take it up in the furniture rounds.

### Still owed

Audit the palette for **luma** contrast, per research §2: any two elements that must be
distinguishable should differ in Y, not only in hue. The table above does this for the
four most common; the full palette has not been swept.

---

## The capture settings that follow

OBS **32.2.1** is installed (the chapter-marker fix landed in 32.1.0, so no upgrade is
needed). The existing `Untitled` profile is unconfigured Simple-mode NVENC and must not
be used.

Set these in **Settings -> Output -> Output Mode: Advanced -> Recording**, and
**Settings -> Video**:

| Setting | Value | Why |
|---|---|---|
| Recording format | **mkv** | Crash-safe. Remux to MP4 later; research §1.16 reproduced that MKV->MP4 remux does *not* create VFR. |
| Video encoder | **x264** (not NVENC) | Measured: libx264 beats NVENC at *every* bitrate on screen content, gap widening to +8.27 dB at 16 Mbps. The cited crossover came from one K-pop music video. |
| Rate control | **CRF** | |
| CRF | **12** | Measured: x264 4:4:4 CRF 12 = 88.5 KB/frame at 45.5 dB; bit-exact lossless is 141 KB. This is a master, not a delivery. |
| CPU preset | **veryfast** | Measured: `veryslow` saves **0.9%** on static screen content and `slow`/`slower` are *larger*. Preset buys nothing here, so spend it on not dropping frames. |
| Profile | **high444p** | Required for 4:4:4. |
| x264 options | `deblock=-3:-3` | Reduced deblocking preserves 1px strokes; the default filter treats them as coding noise. **x264 writes this back as `deblock=1:-3:-3`** — the gate asserts the written form. |
| Keyframe interval | **2 s** | Scrub-friendly in the editor. |
| Base + Output resolution | **1920x1080** both | They must be equal. Any inequality is a resample, i.e. decision 1 thrown away. |
| FPS | **30**, Common values | `render-cut.mjs:34` is `const FPS = 30` and the furniture's beat constants are frame-denominated against it. |
| Color format | **I444** | |
| Color space | **Rec. 709** | OBS's `sRGB` and `709` are identical except one metadata tag; `video-matrices.c` collapses them to the same matrix. Pick the one that is not a lie. |
| Color range | **Full** | YUV formats default to Partial. Left at Partial, RGB 0-255 is quantized into 219 luma levels before anything else happens. |

**Capture method: Display Capture (WGC).** Not Window Capture. There is no BitBlt option
on Display Capture — that is a Window Capture method — and the round-1 claim that KiCad
needs it was unproven.

Once the first take passes the gate, **duplicate that OBS profile as the canonical one**
and use it unchanged for all 127. Hand-clicked settings across 127 sessions will drift.

### Narration is recorded separately

Silent screen capture, separate narration pass. Two reasons: the timing sheet has to price
capture and narration as separate stages or the experiment answers nothing, and a
retake of one should not force a retake of the other.

- 48 kHz, mono, **WAV 24-bit**. No compression on a master.
- **1-5 s of room tone at each end** of every take (the ACX recommendation), which is also
  what any alignment step needs.
- Do **not** apply `loudnorm` at capture. Six silent fallbacks, four of them
  sentinel-vs-default comparisons where a genuine 0.0 measurement is indistinguishable
  from "not supplied", and no warning on any. Normalize once, at delivery, and re-measure
  the output with `ebur128` rather than reading `normalization_type`.

---

## Before you hit record

1. **Free disk.** C: has 128 GB free, G: has 122 GB. One 7.5-minute 1080p30 4:4:4 CRF 12
   master is comfortably inside that. The full 127 at this setting is **not** — that is a
   storage decision for after the experiment, not before it.
2. **Shoot the calibration target for 3 seconds at the head of every take.** Open
   `docs/video/calibration/capture-calibration.html` in Chrome, press **F11** for
   fullscreen, start recording, hold 3 s, then bring KiCad up. The gate reads its black,
   white and hairline patches back out of the file. Without it, two of the eight checks
   cannot run.
3. **Confirm the legibility bar before the take, not after.** Grab one frame of the KiCad
   window and look at it downscaled to 1280x720:
   ```powershell
   ffmpeg -y -ss 5 -i <take>.mkv -frames:v 1 -vf scale=1280:720:flags=lanczos frame720.png
   ```
   If a menu label is not comfortably readable in `frame720.png`, raise KiCad's UI scale
   and reshoot. This is the shot list's own bar and it is far cheaper to fail here than
   after the cut.

## After the take, before you cut

```powershell
pnpm video:verify-capture "<path to take>.mkv"
```

Eight checks. A non-zero exit means **do not cut this file, reshoot**. The verdict is
written as `<file>.mkv.verify.json` beside the artifact, so it travels with the bytes
rather than with your memory of a terminal.

| check | catches |
|---|---|
| `resolution` | a resample between KiCad and the file |
| `pix_fmt` | 4:2:0, the damage no encoder recovers |
| `fps` | a cadence the frame-denominated furniture cannot follow |
| `cadence` | PTS wander beyond what the container's 1ms timescale explains |
| `no_dropped_frames` | the encoder falling behind — invisible in every metadata field |
| `x264_options` | OBS silently stripping the options box |
| `color_range_pixels` | Limited-range pixels under a `color_range=pc` tag |
| `no_resample` | display scaling or a stray scale filter, measured on hairlines |

The gate is **proven, not asserted**: `pnpm video:verify-capture:selftest` builds a
compliant file and seven deliberate faults and asserts each check fires on its own fault
and stays quiet otherwise. It passes. Notably the "1440p downscaled to 1080p" fixture
passes `resolution` and is caught only by `no_resample` — which is the entire reason that
check measures pixels.

### Two corrections to handoff §6, found by building this

- **`stream_tags=encoder` does NOT carry x264's options string.** On this muxing path it
  reads `Lavc62.11.100 libx264` and contains no settings at all. x264 writes its real
  options string as **SEI unregistered user data inside the H.264 elementary stream**, so
  it has to be read out of the bitstream. The handoff's spelling is a check that can never
  pass.
- **The string to assert is `deblock=1:-3:-3`, not `deblock=-3:-3`.** You type the CLI
  form (`alpha:beta`); x264 writes the internal form (`enabled:alpha:beta`). Asserting
  what you typed never matches.
