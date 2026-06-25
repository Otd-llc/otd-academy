# Capture app: post-narration pivot (silent recorder + standalone teleprompter + Kdenlive)

**Status:** Design, validated in brainstorming 2026-06-24. Supersedes the live-narration
half of the teleprompter §1 work on this same branch (`feat/teleprompter-narration-capture`).

## Why

The Electron capture app is crashing and buggy, and the live in-overlay teleprompter we
built (teleprompter §1, Task 5) is unusable in practice: it sits over the KiCad work area
and can't be scrolled comfortably. The root cause of both is that the app tries to do two
hard things at once: record the screen *and* capture/mux narration audio live while the
operator drives KiCad and reads a script.

Decision (confirmed with Josh): **stop narrating live.** Record the screen silent, then
narrate after the fact in a mature open-source editor and upload that editor's export as
the finished clip. This decouples the two hard problems, deletes the buggy audio/mux
surface, and plays to each tool's strength: Electron does the one thing only it can (a
content-protected, click-through crop recorder that frames over KiCad without filming
itself); Kdenlive does waveforms, retakes, levels, and export.

This is the standard way screencast tutorials are actually produced. The tradeoff is timing
narration to on-screen action in post rather than live, which is mitigated by scrubbing,
working segment by segment, and reading from a script that already exists.

## Decisions locked

- **Remove ALL audio from the Electron app** (not a partial trim): mic capture, the mic
  toggle, `save-audio`, `mux-audio`, the per-segment audio plumbing, and the editor's audio
  timeline lane. The §2 (studio WAV) and §3 (editable audio timeline) follow-ons are
  **dropped**, not deferred.
- **Post-narration tool: Kdenlive** (OSS video editor with timeline audio recording).
  Audacity optional for studio-clean voice, out of scope to script here.
- **Teleprompter: a second window inside the existing Electron app** (not a web page, not a
  new app). Always-on-top, scrollable, unobtrusive, isolated from the removed audio path.

## Architecture

The Electron app drops to **two single-purpose windows**.

### 1. Recorder window (today's overlay, minus audio)

The content-protected (`setContentProtection(true)`), click-through, marching-ants crop
overlay that already works. It produces a **silent** mp4 written to disk and reports the
path. Everything audio is removed. This is the irreplaceable capability: it frames and
records over KiCad without capturing itself (no infinite mirror).

The old "review → approve → upload the in-app-stitched video" path collapses into the app's
**two verbs** (below). The clip-stitching / multi-clip editor audio complexity goes away
with the audio removal.

### 2. Teleprompter window (new, deliberately boring)

A normal small **resizable** window, `alwaysOnTop: true`, showing a large **scrollable**
script pane, styled dark and low-contrast so it stays out of the way. Crucially it is the
opposite of the recorder overlay:

- **Not click-through** and **not content-protected.** It no longer overlaps the recording
  (it floats over Kdenlive during post-narration), so it behaves like any window: drag it,
  resize it, push it to a second monitor, and **scroll it with the wheel or arrow keys**.
  This directly fixes the "can't scroll / it's over things" problem.
- **Toggle on/off** with a global hotkey (`Ctrl+Shift+H`); hidden by default.
- **Pre-loaded with the slot's script.** When a lesson "+" deep-link arrives carrying a
  `script`, the app loads it into the teleprompter, reusing the main-process fetch
  (`enrichSession` → `GET /api/capture/session`) we already built. The operator can also
  leave it open while Kdenlive is foreground; it stays on top.

## The end-to-end workflow

1. Click the lesson "+". The recorder window opens; the teleprompter is ready with the
   slot's script (toggle it on when wanted).
2. Record the silent clip. The app saves it to disk and shows the path.
3. Open that clip in **Kdenlive**. Toggle the teleprompter on, read the script onto the
   timeline as a voiceover, adjust, and **export the finished mp4**.
4. Back in the Electron app, click **"Upload a finished video to this slot"**, pick the
   Kdenlive export, and it POSTs to the same token-scoped `/api/capture` the app already
   uses. The narrated export lands in the exact placeholder.

The slot binding stays intact end to end (the 4-hour capture token easily covers a few
minutes of narration in Kdenlive). No new academy upload UI, no browser round-trip.

## What is kept / removed / reworked

**Kept (the durable plumbing — already shipped on this branch or main):**

- `script` field on the guide `video` block (`src/lib/schemas/guide.ts`).
- The narration-script textarea in the editor (`BlockEditor.tsx` `MediaEditor`).
- `GET /api/capture/session` (token-gated script bundle) and its tests.
- The main-process script fetch (`enrichSession` / `sessionFromLink` in `capture-app/main.js`).
- The 16 L1.01 narration scripts already written to PROD (the teleprompter consumes them).
- `POST /api/capture` (token-scoped upload) — now used for the finished file.

**Removed:**

- Mic capture + mic toggle (`micEnabled`), `save-audio`, `mux-audio`, per-segment audio.
- The editor's audio timeline lane (from the screencast-editor-v2 work).
- The in-overlay teleprompter panel + its `globalShortcut` scroll/toggle chords
  (`Ctrl+Shift+Down/Up/H` wired into the recording overlay — teleprompter §1 Task 5).
- The old multi-clip stitch/review/approve→upload path that depended on the audio/editor.

**Reworked:**

- `capture-app/INTEGRATION.md` becomes the Electron-plus-Kdenlive workflow doc (record
  silent → Kdenlive narrate → upload export), keeping the three wire contracts (deep link,
  session GET, upload POST).

## Verification gates (unchanged in shape)

- **Academy (`src/`):** Vitest green for anything touched; `tsc --noEmit` clean;
  `pnpm build` succeeds. (Removing audio shouldn't touch `src/`, but the upload/editor
  surfaces might.)
- **Capture app (`capture-app/`):** `node --check` on every changed JS file (no test
  harness; app is slated to split to its own repo).
- **Josh's GUI eyeball (the real gate):** record a silent clip; the teleprompter toggles,
  scrolls with the wheel/keys, and stays off the recording; narrate in Kdenlive; upload the
  export into the slot and confirm it lands.

## Out of scope

- Building the Kdenlive project/templates or automating its export (manual tool use).
- Studio-clean Audacity step (optional, operator's choice).
- Captions / STT (§5), the eventual capture-app repo split (§4).
- Re-recording the 7 already-captured L1.01 clips with voiceover (a content task; the
  scripts now exist for it whenever Josh wants).
