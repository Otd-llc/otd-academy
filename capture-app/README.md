# OTD Capture (desktop companion)

A small **Electron** app that does what a web page can't: float a marching-ants
crop box over **any** app (KiCad), grab/record just that region with a **global
spacebar**, and stay **invisible to its own capture** (no infinite mirror).

This is **Phase 1 — the capture core**. It saves to disk so you can see the whole
flow work. **Phase 2** wires it to the academy (deep-link from the lesson `+` →
upload → auto slot-fill).

## Run it

```sh
cd capture-app
npm install        # pulls Electron (~one-time, ~150 MB)
npm start
```

## The flow

1. A panel appears (top-left). Type a **caption**, pick **Screenshot/Clip** and an
   **aspect** (16:10 / 16:9 / 4:3 / 1:1 / Free), then **Start framing**.
2. A gold **marching-ants box** appears over your screen, dimming everything else.
   Drag it / resize from the corner. Arrange KiCad *behind* it on the real desktop.
3. Press **Space** (works even while KiCad is focused) → grabs the boxed region.
   For a clip: **Space** starts, **Space** again stops. **Esc** cancels.
4. **Review** → **Approve** / **Redo**.
5. Approve → the cropped capture is encoded (WebP still · WebM/MP4 clip with the
   duration fixes) and saved to `~/Downloads/otd-captures/`.

## Why this works where the browser didn't

- **No recursion:** the overlay window is `setContentProtection(true)` →
  `WDA_EXCLUDEFROMCAPTURE` on Windows, so it (and the dim/box) never appear in the
  captured screen. You get a clean frame of just KiCad.
- **Frame over real apps:** the overlay is transparent + click-through except over
  its own UI, so you arrange windows on the actual desktop behind the box.
- **Global spacebar:** registered while framing, so the trigger fires from any app.

## Reuse

`recorder.js` is a plain-JS port of the academy's `src/lib/record-stream.ts`
(`StreamRecorder`) — same codec chain + Chrome MediaRecorder duration fixes, OTD
branding. Keep them in sync; later they could share one module.

## What to verify (couldn't be tested headlessly)

- **Crop alignment:** the box → capture mapping uses `box CSS px × display.scaleFactor`.
  If a capture is offset or scaled on a HiDPI display, that scale factor is the knob.
- **Click-through toggle:** the overlay should pass clicks to KiCad except over the
  panel/box. If KiCad is unclickable, the `set-interactive` hover hit-test needs a
  tweak.
- **Content protection:** confirm the box/dim are NOT in the saved shot.
- **Global Space:** it's grabbed only while framing/recording; it does block Space
  in other apps during that window (by design — it's the trigger).

## Phase 2 (next)

- An `otd-capture://` deep link so the lesson `+` launches this app pre-loaded with
  `{cardId, blockIndex, kind, caption, token}`.
- An authed academy endpoint (`/api/capture/...`) + a short-lived token, so Approve
  uploads to R2 and fills the exact placeholder (replacing the save-to-disk step).
- A Windows installer (electron-builder).
