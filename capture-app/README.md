# OTD Capture (desktop companion)

A small **Electron** app that does what a web page can't: float a marching-ants
crop box over **any** app (KiCad), grab/record just that region with a **global
spacebar**, and stay **invisible to its own capture** (no infinite mirror).

It drives the lesson flow end-to-end: click the gold **+** on a placeholder in the
lesson → this app pops up **showing what to capture** → frame → **Space** → review
→ **Approve** uploads straight into that exact slot. (Run standalone with no deep
link and it falls back to saving to `~/Downloads/otd-captures/`.)

## Run it / install it

```sh
cd capture-app
npm install        # pulls Electron (~one-time, ~150 MB)
npm start          # also registers the otd-capture:// protocol for your user
```

Run `npm start` once so the `otd-capture://` protocol is registered (Windows
writes it to HKCU). After that the lesson **+** can launch it even when it's closed.

## The flow (from the lesson)

1. In a lesson, an empty image/clip placeholder shows a gold **+ Add screenshot /
   + Add clip** (admins only). Click it.
2. OTD Capture opens with a **"Capture this"** callout — the author's description of
   exactly what to grab (this also becomes the caption). Pick an **aspect**, then
   **Start capture**.
3. A gold **marching-ants box** appears over your screen, dimming everything else.
   Drag / resize it; arrange KiCad *behind* it on the real desktop.
4. Press **Space** (works even while KiCad is focused) → grabs the boxed region.
   For a clip: **Space** starts, **Space** again stops. **Esc** cancels.
5. **Review** → **Approve** / **Redo**.
6. Approve → the cropped capture is encoded (WebP still · WebM/MP4 clip with the
   duration fixes) and **uploaded into that placeholder**. Refresh the lesson to see
   it.

## How the hand-off works

- The lesson **+** calls `createCaptureSession` (admin-only), which mints a
  **short-lived signed token** scoped to that one block and returns the block's
  description. The browser opens
  `otd-capture://capture?api=…&token=…&kind=…&hint=…&caption=…`.
- This app parses that, shows the description, and on **Approve** POSTs the bytes to
  `‹api›/api/capture?token=…` **from the main process** (Node fetch — no browser
  CORS). The academy verifies the token, stores the blob in R2, and points the block
  at `/api/shot/‹id›.‹ext›`.
- The token is HMAC-signed with the academy's `AUTH_SECRET`, expires in 10 min, and
  only authorizes writing the one block it was minted for.

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

- **The deep link launches it:** clicking **+** in a lesson should open (or focus)
  OTD Capture with the "Capture this" callout filled. If nothing happens, run
  `npm start` once to register the protocol, and accept the browser's
  "Open OTD Capture?" prompt.
- **Upload lands in the slot:** after Approve, the lesson placeholder should show the
  shot on refresh. (Needs an admin session + R2 enabled on the deployment.)
- **Crop alignment:** the box → capture mapping uses `box CSS px × display.scaleFactor`.
  If a capture is offset or scaled on a HiDPI display, that scale factor is the knob.
- **Click-through toggle:** the overlay should pass clicks to KiCad except over the
  panel/box. If KiCad is unclickable, the `set-interactive` hover hit-test needs a
  tweak.
- **Content protection:** confirm the box/dim are NOT in the uploaded shot.
- **Global Space:** grabbed only while framing/recording; it does block Space in
  other apps during that window (by design — it's the trigger).

## Still to do

- A Windows installer (electron-builder) so it's a real app, not `npm start`, and a
  tray icon / auto-launch so it's always ready for the lesson **+**.
