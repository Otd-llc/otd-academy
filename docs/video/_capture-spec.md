# Capture spec — the two irreversible decisions, and the settings that follow

**Date:** 2026-08-14 · **Branch:** `promo/video-furniture` (worktree `C:/zzz/pf-bed`)
**Status:** decided and measured. Read `2026-08-14-video-pipeline-handoff.md` §4 for why
these two were the blockers.

Both decisions bake into 127 videos and neither is cheaply reversible after the first
dozen ship, so both were **measured on this machine, on this content**, rather than
argued from the research doc. The measurements are reproducible: the scripts that
produced them are named inline.

---

## Decision 1 — capture 1920x1080, NVENC H.264, 4:2:0

**Settled 2026-08-18 on the real rig, after three wrong answers. Read the whole
section before changing it; each reversal below was paid for.**

### What actually decided it: the overlay, not the encoder

**KeyViz composites a keystroke overlay on every frame, and at 3840x2160 that
made movement visibly choppy on this machine.** The overlay is not optional for
this material — the script teaches by keystroke (`M`, `R`, `X`, `Y`, `G`,
Ctrl+F), so the viewer has to see the keys. That cost lands *upstream* of the
encoder, which means no amount of encoder headroom fixes it and no synthetic
encode benchmark can detect it. It was found by recording, not by measuring.

### The measurements, so nobody re-runs them

| Config | Result |
|---|---|
| 4K 4:4:4 x264 veryfast | 0.82x — below realtime |
| 4K 4:2:0 x264 veryfast | 1.07x — below realtime in practice |
| **4K 4:2:0 NVENC, sustained 8 min** | **1.78x, no thermal decay** |
| Real 8-min OBS take at 4K | **0 dropped frames**, 14,446 captured |
| 1080p 4:2:0 NVENC P7 CQ14 | **3.74x** |

So **"4K is impossible" was wrong** — NVENC does it comfortably, and the CPU
thermal risk that killed x264 does not apply because NVENC runs on a
fixed-function GPU block. 4K is rejected on the overlay, not the encoder.

### Why 4:2:0, having previously mandated 4:4:4

The 4:4:4 rule came from a real measurement (a 4:2:0 round trip scores 37.40 dB
against 65.72) — but that measures the **master**, and nobody watches the master.

- YouTube's documented ingest spec is 4:2:0, and delivered renditions come back
  4:2:0 whatever you upload. The 4:4:4 never reaches a viewer.
- **H.264 High 4:4:4 Predictive is not loadable in most NLEs** — Premiere
  silently converts it, Resolve free rejects it outright. A 4:4:4 master is a
  master you cannot edit. (The handoff already said this about Resolve; it got
  lost.)
- No one has published an A/B of a 4:4:4 vs 4:2:0 master through YouTube's
  transcode. The pro-4:4:4 claim is vendor-blog folklore with no measurement.

What protects the thin lines is the **light canvas**: 4:2:0 keeps luma at full
resolution, so dark strokes on a light page survive. Research section 2's own
fairness note said exactly that.

### Sheet area comes from the other knob

Area in frame = capture pixels / UI scale. **Lower KiCad's UI scale and increase
line weight** rather than raising the raster. The audience is desktop-only —
KiCad cannot run on a phone or tablet, so there is no small-screen legibility
floor to protect and the shot list's "legible at 720p" line is retired.

**The single highest-value lever, and it is not a codec setting:** a 1px wire
sits at the pixel Nyquist limit and is destroyed by luma-domain quantization
before chroma is even relevant. Get features to **2-3px at delivery** — thicker
lines, or zoom in — and it beats every encoder decision in this document.

### No resample, anywhere. This is the one thing that must not regress

Measured: a 0.75 downscale delivers 1px lines at **61-63%** of full contrast
(lanczos 63.1% mean, bicubic 61.3%) against 100% native. So the Windows display
resolution, the OBS base canvas and the OBS output resolution must **all** be
1920x1080. `no_resample` measures a hairline grid in pixels so this cannot
regress quietly.

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
| Video encoder | **NVIDIA NVENC H.264** | Keeps the encode off the 45W CPU, which is what the KeyViz overlay and KiCad need. x264 measures better per bit on screen content, but the master is re-encoded by YouTube anyway and CPU headroom is the scarce resource here. |
| Rate control | **CQP** | |
| CQ Level | **14** | Measured 3.74x realtime at P7, so quality is affordable. This is a master, not a delivery. |
| Preset | **P7 (slowest/best)** | Measured FASTER than P4 at 1080p (4.14x vs 3.46x), so the quality is free. |
| Profile | **high** | |

| Keyframe interval | **2 s** | Scrub-friendly in the editor. |
| Base + Output resolution | **1920x1080** both | Must equal each other AND the Windows display resolution. Any inequality is a resample. |
| FPS | **30**, Common values | `render-cut.mjs:34` is `const FPS = 30` and the furniture's beat constants are frame-denominated against it. |
| Color format | **NV12** | 4:2:0, per Decision 1. |
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
