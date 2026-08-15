# Video pipeline — HANDOFF

**Date:** 2026-08-14 · **Branch:** `promo/video-furniture` (worktree `C:/zzz/pf-bed`)
**Status:** research done, plan validated and largely refuted, **nothing implemented**.

Read this before `2026-08-14-video-pipeline-research.md`. That doc's §1 and §2 are good;
its §3/§6/§7 failed validation. This file is the corrected state.

---

## 0. What happened

Round 1: 5 agents researched the production pipeline. Round 2: 5 agents refuted round 1
(measuring with ffmpeg rather than citing). Result written up as the research doc.

Round 3: 5 agents attacked the research doc, one lens each — failing-gate, internal
consistency, actionability, steelman-the-rejected-conclusion, provenance. **~110 findings.**
No two agents found the same thing. The doc's *measurements* held; its *citations*,
*arithmetic chain*, *gates*, and *conclusion* did not.

**Do not re-run rounds 1–2. Do not re-derive §1's corrections. Do act on §4 below.**

---

## 1. What is TRUE (survived all three rounds)

- **4:2:0 chroma damage is applied before any encoder runs and nothing recovers it.**
  Round-trip with zero compression: 4:4:4 = 65.72 dB, 4:2:0 = 37.40 dB. x264 `-qp 0`
  4:2:0 scores 37.399 — identical, the codec adds nothing. Red worst (Cr 37.89 vs Cb
  45.08). Chroma-from-luma does not help (AV1 w/ CfL 37.31 vs VP9 w/o 37.38). Every
  4:2:0 encoder pins at ~37 dB regardless of CRF. **Capture 4:4:4; convert once, last.**
- **Schematic frames are cheap.** AV1 4:4:4 crf20 = 41.9 KB; lossless = 141 KB. The old
  "150–400 KB" estimate exceeded lossless, which is impossible.
- **libx264 beats NVENC on screen content at every bitrate**, gap widening to +8.27 dB at
  16 Mbps. The cited crossover came from one K-pop music video.
- **VMAF is useless here** — 99.98 for everything above 2 Mbps while PSNR spans 52.9–72.3.
- **`loudnorm linear=true` has SIX silent fallbacks**, four of them sentinel-vs-default
  comparisons, no warning on any. Verified line-by-line against `af_loudnorm.c`. Inputs
  under 3 s force linear regardless.
- **YouTube never lets you replace a published video's media.** Verbatim, official.
- **API upload risks a non-appealable private lockout** with no published SLA.
- **`obsws-python` is GPL-3.0-only and is linked.** Use `obs-websocket-js` (MIT).
- **`arnndn` community models have no usable licence.** Don't use them.
- **`veryslow` saves 0.9% on static content**; `slow`/`slower` are larger.

## 2. What is REFUTED (do not re-derive)

| Claim in the research doc | Status |
|---|---|
| "Cut, never pan" — motion destroys legibility | **Dead**, but the *measurement* argument is a category error: 488 kbps is a local CRF encode, 1,205 kbps is YouTube's delivered transcode. They are not comparable quantities. The rule dies on the **shot list** (which requires a scroll and three drag passes), not on the numbers. |
| "1,205 kbps is a real budget" | §1.2 disqualifies that sample for screen content, then §1.1 uses it as the budget for screen content. Unusable either way. |
| "Delete the entire forced-alignment subsystem" | **Unjustified.** I dropped the `Thresh500` column from Rousso Table 3. With gross mismatches excluded: MFA 27.8 ms, WhisperX 36.4 ms, MMS 41.0 ms — same order as TIMIT. WhisperX moves 11,685 → 36.4, a **321× difference from one column**. The "two orders of magnitude" claim does not survive. **Re-decide this on merit.** |
| "Cut 127 videos by hand; the pipeline needs 4.2–8.3 re-cuts to break even" | **The 250–500 h prices the 11 subsystems §6 already deleted.** Minimal incremental build ≈ 46–77 h → break-even **1.33 passes**. The pipeline is not rejected. §6.1 was also the only ungraded claim in the doc. |
| "DaVinci Resolve free" | **Breaks the chain three ways.** Cannot ingest H.264 I444; 8-bit only so no 4:4:4 output path; transcript-based editing is **Studio-only** (Neural Engine) — and that is 20–25 of the 40 min. Also **lost its external scripting API in 19.1 (Nov 2024)**, so "defer automation" is impossible at that tier. |
| "60 fps" | Graded `[MEASURED]` on a figure §8 says doesn't describe delivery; `render-cut.mjs:34` is `const FPS = 30`; the companion's frame-denominated constants silently halve; §1.16's own measurement indicts 60 (Matroska can't represent 1/60 s; 50 fps control is clean); and `-g 30` at 60 fps is a 0.5 s GOP → above the budget the doc calls roomy. |
| "Keyframes are 74% of the bits" | Fit gives 64.8%; packet data gives 81–97%. Neither is 74. |
| "0.47 TB" | That is a **30 fps** figure in a doc that mandates 60 fps. At 60 it is ~0.94 TB. |
| "Wrong by 80–195×" | Computed by dividing a VBR bitrate by fps — the operation §1.4 calls "a fiction" one page later. |
| "aeneas PR #317 merged, fixed on `main`" | **Closed, not merged** (`merged: false`). Base branch is `devel`; there is no `main`. |
| "Blur survives the 100k-view gate" | The exception is scoped to **face** blur. A wrong on-screen value needs **Custom** blur, not exempted. |
| "Remotion: company floor $100/mo" | That is the **Automators** floor. Creators is $25/seat. (Batch render does hit Automators, so the conclusion holds.) |
| §2's "on KiCad's white background" fairness note | The shot list specifies a **dark theme**. Luma gap ~54/255 vs ~201/255 — the note **inverts**: 4:2:0 damage is *worse* in production than stated. |
| 9:16 floor of 44–48 px | Scaled by frame **height** (2×). The companion's `[HARD]` rule is **short edge** → factor **1.0**. This reintroduces a bug the companion documents as shipped. |

## 3. The bottleneck nobody priced

**127 scripts.** One exists — `docs/video/l1-01-schematic-starter-and-arrange.md`, 387
lines, never produced. It carries a provenance table binding 9 beats to specific lesson
blocks, a 15-shot list, 13 timed narration sections with phonetic markup on ~40 terms,
title + 3 alternates, a description with 13 hand-written chapter timestamps, 11 tags,
thumbnail design, end-screen instruction.

**Zero hours, zero owner, no storage, no line in the do-first list.** If one script is 4
hours, 127 is 500+ h — larger than the entire rest of the plan. The research doc optimises
the render stage while the authoring stage is unmeasured.

Storage note: `guide.ts:168` **does** have `script: z.string().max(8000).optional()` — but
on the `video` block, not the `youtube` block that the 127 videos are. Narrower and more
actionable than the doc's "nothing to hash".

---

## 4. DO THIS FIRST — the experiment that decides everything

**Shoot L1.01. Cut it. Time it with a stopwatch.**

The script is complete and ready. ~2 hours buys N=1 on the single most load-bearing input
in the project — the one that decides whether to build a pipeline at all. Everything in §5
is arithmetic downstream of it.

Record, honestly: capture time, narration time, edit time, metadata time, and the defects
the review pass finds. Note whether the 40 min/video estimate is anywhere near real.
Published ratios for this content class run 10:1–100:1 (30:1 most quoted); the doc assumed
5.3:1.

**Decide before shooting** (both irreversible across 127 videos, neither currently decided):
1. **Capture resolution.** Doc says 2560×1440; the shot list says 1920×1080. 1440→1080 is
   a 0.75 downscale, i.e. the exact operation the doc grades `[HARD]` as forbidden. 1080p
   capture is 1:1 to 1080p delivery and self-consistent.
2. **KiCad theme, light or dark.** §2's mitigation assumed white; the shot list says dark.
   Whichever wins, audit it for **luma** contrast (see §6).

---

## 5. Architecture-independent work — safe to do now

These are correct regardless of which pipeline wins.

### 5.1 Live bugs in `scripts/check-video-furniture.ts`

- **The lower-third band assertion passes when nothing renders.** `readBox` returns null at
  every sample → `worst` stays `0` → `0 > BAND_TOP` is false → pass. And `assertions += 1`
  fires anyway. Under `--mutate`, `BAND_TOP` becomes `0`, so `worst > 0` is *also* false —
  **provably blind even under mutation.** Fix: count *observations*; `fail` if `seen === 0`.
- **`page.evaluate(() => window.__seek?.(t))`.** If `__seek` is absent — and `FrameOne.tsx`
  deletes it on effect cleanup — the call is a no-op, mount-time `data-settled` is already
  present, `waitForSelector` returns instantly, and **every `t` measures frame 0** while
  every assertion increments. Fix: have the evaluate return a boolean and throw on false.
- **`--mutate` exits 0 if *any* assertion fires.** The first chapter variant fails
  immediately, so everything after it can be blind. Fix: id each assertion, require *every*
  id to fire, print the ones that didn't.
- **Rule to state at the top of every gate file:** an assertion counter may only increment
  **after a completed measurement**, never on entry to a check.

### 5.2 The settle contract — pick one, before any batch driver

The repo has **two incompatible contracts**: promise-await (`__cutSet`, `render-cut.mjs`,
which has **no** settle wait — `grep -c settled` = 0) and attribute-poll (`data-settled`,
the furniture checker). Make `__seek` return a Promise resolved inside the rAF that sets
settled, exactly as `__cutSet` already does, and have both consumers await it.

Note: the research doc's proposed fixes (`data-settled = String(t)`, seed `Math.random`)
were **written against the wrong file** — they describe `LogbookLive.tsx` (promo film).
`FrameOne.tsx` sets `data-settled` to `""`, has no `pin()`, no `.xp-pop` allowlist, and the
furniture tree contains **no** `Math.random`/`Date.now`/`crypto.getRandomValues` at all.

### 5.3 Block IDs — the only item whose cost grows with delay

`src/lib/schemas/guide.ts` block variants have **no `id`**. Scripts reference blocks
positionally ("blocks `[8]`–`[18]` of the SCHEMATIC card"). Insert one callout at index 10
and every video silently teaches different content than it claims, with no hash change and
no detectable signal.

**Add `id: z.string().uuid()` to every block variant and backfill now**, before 127 scripts
exist. Nearly free today; a migration after authoring.

### 5.4 Vendor the promo tooling — six files, not one

`createRequire("C:/zzz/pf-beta/package.json")` — a sibling repo not in this tree — appears
in **all six** `tools/promo/*.mjs`, including the two that are *gates* (`measure-cut.mjs`,
`chrome-overlay.mjs`). Fixing only `render-cut.mjs` leaves the checkers dead while the
renderer works. Playwright is already in `devDependencies`; the hack is unnecessary. Also
`render-cut.mjs:41,70` hard-require two WAVs stored outside every repo on one disk.

---

## 6. Gate design rules learned the hard way

If you build any gate, these are non-negotiable and were each paid for:

- **A gate must say what failure DOES.** 24 of the research doc's 27 gates never did. Write
  the verdict as a **sidecar JSON beside the artifact**, so it travels with the bytes rather
  than with your memory. A terminal message is a log line, not a gate.
- **Prove you captured output before concluding it is clean.** `render-cut.mjs:56-59`
  already records this: an astats gate read stdout, got an empty string, every comparison
  was falsy, and it passed having measured nothing. *"A check that cannot fail is worse
  than no check."*
- **Gate on a read-back of the output, never on a report of intent.**
  - `normalization_type == linear` is **proof the LRA target was NOT applied** (linear means
    a static gain, which is LRA-invariant). Re-measure the output with `ebur128` instead.
  - `color_range=pc` reads a tag OBS wrote from its own config. If the GPU output range is
    Limited the pixels are already crushed and the tag still says `pc`. Measure pixels:
    `signalstats` `YMIN <= 1` / `YMAX >= 254` on a fixed black/white swatch. **The same
    measurement also catches DPI interpolation**, retiring two one-shot eyeball checks.
  - **x264 writes its full options string into the file.** `ffprobe -show_entries
    stream_tags=encoder` and assert `deblock=-3:-3`. That catches the `-tune stillimage`
    silent-ignore for free.
- **Pin a loglevel in the same command that installs a stderr regex.** `render-cut.mjs:145`
  runs `-loglevel error`; `Past duration` is a WARNING and never prints.
- **Floors: equality, not `>=`, with a calibration comment.** `scripts/export-content.ts:49-52`
  is the only correctly-built floor in the repo — source, date, and *"Do NOT lower these to
  make a run succeed."* Copy it.
- **A human approval must bind to bytes.** Store `watched_artifact_sha256` and gate publish
  on a hash match, or approving v1 approves v2. (The research doc diagnosed this for
  `approved_at` and then didn't apply it to its own most important gate.)
- **`furniture:check` is not in CI** — `ci.yml` runs `diagrams:check` only. A gate nothing
  runs has a realized execution rate near zero across 127 videos.

---

## 7. Blocked, and on what

- **Stage 3 batch driver** — blocked on **seven unresolved design rounds**. `variants.ts`:
  `LOWER` 24 variants no pick, `CHAPTER` 6, `CALLOUT` 7, `LABEL` 6, `INTRO_SHORT` 6,
  `PAUSE` 4, `BEFORE_AFTER` 3. Only `INTRO`/`OUTRO` are taken. The repo's own mixer plan
  states the gate: *"visuals per type, then sound, then format, then encode. Only the outro
  is through phase one."* The batch driver is phase 4.
- **Lower-third rendering** — no text input path exists. `FrameOne.tsx:89` reads a constant;
  both fallbacks are dead code; `lesson=` is hardcoded. And `LOWER` is **six jobs**, not one
  — which fires when is a per-video editorial decision from a script that doesn't exist.
  "127 × ~4" has nothing behind it; the one real script has **zero** lower-third cues.
- **Thumbnails** — the component does not exist. `grep -i thumbnail` across the furniture
  sandbox, `scripts/`, and `tools/promo/`: zero hits.
- **Alpha export** — `Render.tsx:143` and `FrameOne.tsx:95` both paint `deep-space`.
  `tools/hex-stills.mjs:132-135` already documents the trap: *"Both have to go or the
  result is a black rectangle."* And 4 of 10 pieces are full-frame compositions, not
  overlays — "render to alpha" is wrong for them.
- **The 127-video list** — cited to `scripts/_verify-guide-render.ts`, which exists neither
  in the working tree nor in `git log --all`. The count is currently unreproducible.

---

## 8. Standing constraints

- **Work in `C:/zzz/pf-bed` on `promo/video-furniture`.** Do not commit this track from
  `C:/zzz/project-foundry` — that worktree is on a different branch and a shared tree is
  how commits bleed.
- **Do not merge without the maintainer's explicit go-ahead.** No PR exists by design.
- Scrub, never play. Every animated value a pure function of `t`. No CSS transitions.
- Tokens only — no literal hex, no `text-white`.
- Measure at delivery size, across the whole shot, not one frame.
- Mutation-test every check you write.
- Sandbox rounds are deleted before any PR; tabs do not accumulate.
