# Screencast Editor v2 — implementation plan

**Status:** ready to execute. **How to use:** this doc is the execution handoff. Read
it top to bottom, then build **Phase 1** first; later phases depend on Phase 1 and on
the Phase 2 "WYSIWYG export pivot" below. Each phase ends with a human-test step (the
editor is a GUI — the agent can't drive it; syntax + headless ffmpeg/WebCodecs checks
are the agent's verification, the human eyeballs the window).

Derived from a Gemini product/UX spec (pasted in the originating chat) benchmarking
Camtasia / ScreenFlow / Descript / Screen Studio, re-scoped for **tutorial screencasts
of KiCad/FreeCAD/electronics** that export ONE MP4 into a lesson slot. Goal: instructional
clarity (the viewer can see exactly which component/constraint was selected), not
cinematic polish.

## Where things stand (the foundation — already on main)

Everything lives in `c:\zzz\project-foundry\capture-app\` (an Electron app, run via
`npm start`; NOT part of the Next.js build). Key files:
- `overlay.js` — the capture overlay: recording via a WebCodecs pipeline that runs in a
  **Web Worker** (`record-worker.js`) → NVENC, with main-thread WebCodecs + canvas
  fallbacks. Event-driven CFR encode. This is the encode pipeline the v2 export will reuse.
- `record-worker.js` — the capture→crop→encode→mux worker (MediaStreamTrackProcessor +
  VideoEncoder + mp4-muxer). The model for the v2 render/export worker.
- `editor.js` / `editor.html` — the **v1 editor** (what we're upgrading): a horizontal
  timeline of clips as bars, click-to-preview one clip, per-clip/segment **speed**
  (0.5–4×), **trim** (in/out handles), **split** at the playhead, reorder, remove,
  Export & Upload. Opened from the overlay's review screen ("✦ Edit timeline").
- `main.js` — windows + IPC. `export-clips` IPC runs ffmpeg (`ffmpeg-static`,
  `h264_nvenc` with libx264 fallback) building a filtergraph: per segment
  `trim=start:end, setpts=PTS-STARTPTS, setpts=PTS/speed, scale, pad, fps`, then concat.
  `save-clip` writes recorded clip bytes to a temp session dir.
- `preload.js` — the contextBridge (`window.otd.*`: exportClips, upload, save, openEditor,
  onEditorInit, quit, log, …).

**Data model (keep + extend):** the timeline is an ordered list of **segments**
`{ path, w, h, durMs, speed, inSec, outSec }`. A segment references a source clip on disk;
trim = inSec/outSec; split = two segments sharing a path. v2 adds timeline-positioning,
plus per-phase fields (zoom keyframes, cursor data, annotations, audio).

**Stack facts / gotchas:**
- Run: `cd capture-app && npm start`. Bash `pnpm`/`npm` may be flaky — use PowerShell or
  `node`. `node --check <file>` is the agent's syntax gate.
- ffmpeg binary: `node_modules/ffmpeg-static/ffmpeg.exe`. **It HAS `h264_nvenc` + the CUDA
  stack** (validated on the dev GTX). Validate filtergraphs headlessly by generating
  `testsrc` clips and running them (see git log for examples).
- The editor window has `webSecurity:false` (loads clip files via `file://`). The overlay
  window too (so `record-worker.js` can `importScripts` the bundled mp4-muxer).
- mp4-muxer UMD: `node_modules/mp4-muxer/build/mp4-muxer.js` (global `Mp4Muxer`, classic
  API: `Muxer`/`ArrayBufferTarget`/`addVideoChunk`/`finalize`).
- WebCodecs encoder config that works here: `avc1.4D4028` (Main) first, `hardwareAcceleration:"prefer-hardware"`,
  `avc:{format:"avc"}`, even width/height; mp4-muxer `firstTimestampBehavior:"offset"`.

## THE PIVOT — WYSIWYG export (decide in Phase 2, design for it now)

v1 export is a pure ffmpeg filtergraph. That works for trim/speed/concat. It **cannot**
match a web-canvas preview once we add **zoom/pan, smooth cursor, keystrokes, or
annotations** (ffmpeg scaling/compositing won't be pixel-identical to the canvas). So from
Phase 2 on, export becomes:

> For each output frame at the timeline time t: decode the active segment's source frame,
> **composite it on a canvas** (apply zoom/pan transform, draw cursor sprite, keystrokes,
> annotations), produce a `VideoFrame`, and **encode via WebCodecs/NVENC** — i.e. re-run the
> same worker pattern as recording, but the frames come from the composited canvas instead
> of the live capture. ffmpeg's role shrinks to **audio** (`loudnorm`, mux) and, optionally,
> muxing the WebCodecs video + audio.

Practical convergence: the editor's **preview** (a canvas compositor driven by the playhead)
and the **export** (the same compositor stepped at CFR, piped to a VideoEncoder) share ONE
render function. Build the preview compositor in Phase 2 so export = "run the preview
compositor headless at 60fps into an encoder."

Until Phase 2, Phase 1 keeps the existing ffmpeg-concat export (no zoom/overlays yet).

## Phase 1 — Core NLE engine (Large; editor UI only; export stays ffmpeg-concat)

Turn the v1 "clip bars + per-clip preview" into a real single-timeline NLE. Files:
`editor.js`, `editor.html` (+ CSS).

Tasks (each is a commit-sized unit):
1. **Time-positioned timeline + ruler.** Replace flex-grow bars with absolute positioning:
   `pxPerSec` (zoomable), each segment placed at its cumulative timeline start (sum of prior
   effective durations = `(outSec-inSec)/speed`). Add a time ruler with timecodes
   (`m:ss` / `m:ss:ff`). Horizontal scroll for long timelines.
2. **Master playhead + full-sequence playback.** A playhead at a timeline time `T`. A
   `seekTo(T)` that finds the active segment + the source time within it
   (`inSec + (T - segStart)*speed`), sets `video.src` to that segment (only when it changes),
   `video.currentTime`, and `playbackRate=speed`. Play loop (rAF while focused; the existing
   anti-throttle setInterval fallback exists in overlay.js for reference): advance `T`,
   switch segments at boundaries (preload the next by swapping `src` slightly early to hide
   the gap — acceptable to show a brief seek for v1). Transport: play/pause, the playhead is
   draggable to scrub (scrubbing updates the preview frame).
3. **Magnetic timeline.** Segments always abut (no gaps). Reorder = move a segment; trim =
   change in/out; both reflow downstream segment starts.
4. **Ripple ops + split.** `splitAtPlayhead` (already exists — adapt to T), `rippleDelete`
   (remove the selected segment + reflow), `rippleTrimStart`/`rippleTrimEnd` (set in/out to
   the playhead and reflow).
5. **Direct-on-timeline editing.** Drag a clip's left/right edge to trim; drag a clip body to
   reorder (with snapping to neighbor edges + the playhead). Keep the existing buttons as a
   fallback.
6. **Keyboard shortcuts (Premiere/Resolve conventions — don't invent):**
   `Space` play/pause · `J/K/L` shuttle (reverse / pause / forward; double-`L` = 2×) ·
   `←/→` frame-step (`Shift` = 10 frames) · `S` or `Ctrl+K` split · `Q` ripple-trim start ·
   `W` ripple-trim end · `Shift+Del` ripple delete · `Ctrl+wheel` or `+`/`-` zoom (centered
   on the playhead) · `Home/End` jump.
7. **3-track shell.** Lay out three lanes: **Video** (active), **Audio** + **Overlay**
   (empty placeholders for Phases 4–5, so the layout doesn't churn later).
8. **Export unchanged.** Still `window.otd.exportClips({clips:[{path,w,h,speed,inSec,outSec}],fps})`
   → the existing ffmpeg filtergraph. (No zoom/overlays yet, so this stays correct.)

Agent verification: `node --check`; confirm the export payload still maps segments→ffmpeg.
Human test: record 3 clips → Edit → scrub the whole sequence, split/ripple-delete, drag-trim,
shortcuts, export → the stitched MP4 matches the timeline order/trims/speeds.

## Phase 2 — Zoom & pan + the WYSIWYG export pivot (Medium+; UI + export rewrite)

1. **Canvas preview compositor.** Replace the `<video>` preview with a `<canvas>`: each
   displayed frame = draw the active segment's current video frame, applying a per-segment
   (or keyframed) **zoom (scale) + pan (translate)** transform. Add zoom keyframes to the
   model: `segment.zoom = [{ t, scale, x, y }]` (interpolate between). UI: a "+ Zoom" that
   adds a keyframe at the playhead; drag a box to set the focus region.
2. **WYSIWYG export.** Implement export as: step a virtual playhead at `fps` over the whole
   timeline; for each step, render the SAME compositor into an `OffscreenCanvas`, make a
   `VideoFrame`, feed a `VideoEncoder` (reuse `record-worker.js`'s encoder/mux setup — factor
   it into a shared `webcodecs-encode.js`), mux to MP4. Source frames: decode each segment via
   `VideoDecoder` + a demuxer (mp4box.js) OR a hidden `<video>` seeked frame-by-frame
   (simpler; slower). **This replaces the ffmpeg video path**; ffmpeg now only does audio.
3. Wire the same compositor for preview AND export so they're pixel-identical.

Human test: a zoom keyframe in the preview looks identical in the exported MP4.

## Phase 3 — Cursor extraction + smoothing (Medium; capture + UI)

1. **Capture side (`overlay.js`/`main.js`):** during recording, **hide the OS cursor** in
   the captured frames if feasible (or accept the OS cursor and overlay on top), and log
   `{ t, x, y, down }` mouse telemetry + click events to a **JSON sidecar** per clip (main
   process already polls `screen.getCursorScreenPoint()` at 60Hz — extend it to record a
   track + click events, saved next to the clip).
2. **Editor:** render a crisp HD cursor **sprite** on the compositor's top layer, its position
   **interpolated** (Catmull-Rom / critically-damped) from the telemetry → smooth, non-jittery
   motion. Click pulse animation. Optional cursor-size/auto-zoom-on-click later.

## Phase 4 — Keystrokes + annotations (Small–Medium; capture + UI)

1. **Keystroke capture:** record key-down events (name + modifiers) to the sidecar during
   recording. NOTE: do this as **passive telemetry written to a file**, NOT a live on-screen
   overlay hook — the live-hook approach was tried and removed (Defender-quarantined keylogger
   exe / input-path lag). Editor-side rendering sidesteps all of that.
2. **Editor:** render keystrokes as styled keycaps (dark rounded rect, gold modifier, white
   key — reuse the look from the removed overlay feature) on the overlay track, timed to the
   telemetry. Plus basic **annotations**: boxes, arrows, text, and **blur/redact** (Canvas2D
   `filter:blur()` or a WebGL shader over a drawn rect) on the overlay track.

## Phase 5 — Audio (Medium; capture + UI + ffmpeg)

1. **Mic capture** synced to the screen recording (a second track; getUserMedia audio →
   encode alongside, or record separately and align by start timestamp).
2. **Waveform** rendered on the audio track (decode → peaks). Editors cut by waveform.
3. **Silence / dead-air removal:** amplitude-threshold pass → find gaps > ~1.5s → mark for
   ripple-delete or 4× speed-ramp.
4. **Normalize** on export via ffmpeg `loudnorm`. Background music + ducking optional.
5. **Auto-captions** (later): on-device Whisper (WASM/WebGPU) → `.vtt`/`.srt` uploaded
   alongside the MP4 (accessibility + SEO).

## Anti-scope (do NOT build — wasted effort for tutorials)
Color grading/LUTs · fancy transitions (hard cuts only) · multi-cam switching (a future
webcam is just a locked PiP track) · audio EQ/compressor plugins (volume slider + `loudnorm`
is enough).

## Suggested sequencing
Phase 1 → 2 (the pivot) → 3 → 4 → 5. Biggest "feels professional" wins per the spec:
**zoom/pan + smooth cursor + keystroke display** (Phases 2–4) — they make a dense CAD UI
legible. Audio (Phase 5) is the credibility floor but a separate capture capability.
