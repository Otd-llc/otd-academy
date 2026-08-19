# Capture spec — the two irreversible decisions, and the settings that follow

**Date:** 2026-08-14 · **Branch:** `promo/video-furniture` (worktree `C:/zzz/pf-bed`)
**Status:** decided and measured. Read `2026-08-14-video-pipeline-handoff.md` §4 for why
these two were the blockers.

Both decisions bake into 127 videos and neither is cheaply reversible after the first
dozen ship, so both were **measured on this machine, on this content**, rather than
argued from the research doc. The measurements are reproducible: the scripts that
produced them are named inline.

---

## Decision 1 — capture at 2560x1440. Not 1920x1080.

**Recommendation: 2560x1440, uploaded natively. No downscale anywhere.**

### The audience decides this, and it is a standing fact about the course

**KiCad is desktop-only software. You cannot open it on a phone or a tablet.**
Following one of these lessons therefore REQUIRES a computer, so every viewer of
a course lesson video is sitting at one. There is no mobile audience for this
material — not a small one, none — and any argument that trades sheet area for
small-screen legibility is optimising for a viewer who cannot exist.

This is not a per-video judgement call. It applies to all 128 course videos and it
does not need re-deriving. (It is written down here because it was re-derived
several times from first principles and came out wrong each time.)

A desktop viewer takes 1440p natively. So capture 1440 and upload 1440: more of
the schematic on screen, at a size that is still comfortable, which for a CAD
walkthrough is the thing of value.

**Note what this retires.** The shot list's *"UI scale up one notch so menus are
legible at 720p"* was written against a generic YouTube audience. A 720p rung is
not the constraint for a desktop-only tool. Keep the UI at a natural scale and
let the extra raster buy sheet area instead of magnification.

### What must NOT regress: no resample, anywhere

Measured on this machine, 2026-08-14 — resampling 1440 -> 1080 delivers hairlines
at a fraction of full contrast:

| Path | 1px wire contrast, as a fraction of a crisp line |
|---|---|
| **native** | **100.0%** on all 14 lines |
| 1440 -> 1080, lanczos | mean **63.1%**, worst 57.5% |
| 1440 -> 1080, bicubic | mean **61.3%**, worst 54.5% |

That measurement is about DOWNSCALING, and the conclusion it supports is
"capture native, upload native" — not any particular raster size. A schematic is
made of hairlines, and a 0.75 resample of a signal at the pixel Nyquist is
information-destroying. So OBS base and output resolution must be equal, Windows
display scaling must not be interposing, and no scale filter may be left on.
`no_resample` measures the pixels of a hairline grid precisely so this cannot
regress quietly.

Below 1440, YouTube owns the rungs and does its own resampling. That is fine and
outside our control; what matters is that we hand it a clean native master.

**Honest limit on the measurement.** The test lines are synthetic and perfectly
aligned, the best case for a native capture. Real KiCad output is antialiased and
starts below 100%, so the true gap is narrower than 100 vs 62. The direction is
not in doubt.

### The cost, stated plainly

1440p is 1.78x the pixels of 1080p: bigger masters, longer encodes, and a real
risk that x264 CRF 12 at 4:4:4 cannot hold 30fps on this CPU. That last one is
not a guess to argue about — `no_dropped_frames` in the gate catches it on take
one, before any cutting time is spent.

### The escape hatch, stated now so it is not quietly reversed later

If a 9:16 cut ever needs screen content, **re-shoot that beat with KiCad windowed
to 1080x1920** rather than cropping the master. A vertical crop of a schematic is
unreadable at any source size. The furniture already renders natively at
1080x1920.

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
| Base + Output resolution | **2560x1440** both | They must be equal. Any inequality is a resample, i.e. decision 1 thrown away. |
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
3. **Confirm legibility before the take, not after.** Grab one frame and look at
   it at 100%:
   ```powershell
   ffmpeg -y -ss 5 -i "<take>.mkv" -frames:v 1 frame-native.png
   ```
   Judge it at native size on the monitor a learner would use. The old
   "readable at 720p" bar came from assuming a mobile audience and no longer
   applies — a desktop-only tool has desktop-only viewers. If the UI is
   comfortable at 1440p and the sheet area is useful, you are done.

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
