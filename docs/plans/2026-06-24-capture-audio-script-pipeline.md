# Handoff — narration scripts + studio-audio + editable audio timeline

**Status:** HANDOFF / not started. Three follow-on features for the screencast capture
pipeline (the editor v2 — Phases 1–5 — is shipped & merged on `main`, PR #178). Each needs
a short brainstorm/design pass before building; this doc is the requirement + analysis +
code-touchpoint map so a fresh session can pick it up. Read it top to bottom.

**Where the code lives.** Everything is the Electron capture app at
`c:\zzz\project-foundry\capture-app\` UNLESS noted as academy (the Next app at
`c:\zzz\project-foundry\src\`). Run the capture app with `cd capture-app && npm start`
(PowerShell, not the Bash tool); `node --check <file>` is the agent syntax gate — the GUI
can only be eyeballed by Josh. Key files:
- `overlay.js` / `overlay.html` — the capture overlay: framing, recording (mic toggle lives
  here), the `onSession` deep-link payload from the academy (`{kind,hint,caption,aspect,api,token}`),
  the review screen.
- `record-worker.js` — the WebCodecs/NVENC record worker.
- `editor.js` / `editor.html` — the NLE: timeline, the **Audio** lane (waveform decode +
  per-clip narration playback synced to the playhead), the WYSIWYG export.
- `main.js` — IPC: `save-clip`, `save-audio` (per-clip `clip-NNN.audio.webm` sidecar),
  `mux-audio` (ffmpeg: per-segment `atrim`/`atempo`/`concat` + `loudnorm`, muxed over the
  WYSIWYG video). `preload.js` is the contextBridge.
- Academy: the lesson "+" deep-links into the overlay; guide media slots (empty clip/screenshot
  placeholders, the CaptureQueue / gold-+ admin capture — see the `guide-media-capture` memory).

---

## 1. Teleprompter script during narrated capture

**Goal.** When a clip is recorded WITH the mic on, show the teacher a script to read/enact
while recording — a teleprompter in the capture overlay. Requires (a) knowing *which* lesson
videos need audio + a script, and (b) the scripts themselves.

**Pieces:**
1. **Data — "this video needs narration + here's the script."** A guide video/clip media slot
   gains an optional `script` (and an implied `needsNarration` = script present). Lives with
   the slot's content block in the academy (the same place the empty clip placeholder + caption
   live). One script per video slot.
2. **Plumb it to the overlay.** The lesson "+" already deep-links a session into the overlay
   (`onSession`). Extend that payload with `script`. (academy side: the deep-link/session
   builder; capture side: `overlay.js` `onSession`.)
3. **Teleprompter UI** in `overlay.js`/`overlay.html`: render the script in the framing +
   recording phases — large, readable, scrollable (manual scroll or a slow auto-scroll;
   keep it OFF the captured region so it isn't in the recording — the overlay is already
   `webSecurity`/content-protected and excluded from the frame, but verify the teleprompter
   panel sits outside the box). Toggle to hide.
4. **Write the scripts (content task).** Inventory every video slot that needs audio across the
   built curriculum (today that's mainly **L1.01**; see the guide cards) and write a script per
   video in OTD house voice (use the `otd-content-writing` skill; honor the academy disclosure
   boundary — generic education only). This is the bulk of the effort and is content, not code.

**Open decisions for Josh:** auto-scroll vs manual; where scripts are authored (an admin field
on the slot vs a doc); whether `needsNarration` is explicit or just "has a script."

---

## 2. Download / replace the lesson audio for studio-quality cleanup

Josh's ask: pull the lesson's audio out, run it through real software (Audacity / iZotope RX /
Adobe) to get studio quality instead of laptop-mic quality, then put it back.

**Thoughts / recommendation (this was explicitly requested):**
- **Do the round-trip BEFORE final export, at the timeline level — not on the uploaded MP4.**
  Add to the editor: **"Export narration WAV"** (render the timeline's narration to one WAV with
  the silence-trims/speed/offset already baked in — i.e. the same audio the `mux-audio` step
  builds, but as a standalone 48k WAV) → Josh cleans it externally → **"Replace narration"**
  (import the cleaned WAV) → export muxes the replacement instead of the live mic track.
- **The hard constraint is time-alignment.** A replacement WAV only lines up if the video edit
  is LOCKED when the WAV is exported. So gate it: export-WAV → clean → import → export-final,
  with a warning that re-trimming/reordering after export-WAV invalidates the cleaned audio.
  Treat the imported WAV as "the audio for the whole timeline, same total duration."
- **Don't build DSP in-app.** Noise reduction / de-ess / EQ / compression are far better in
  Audacity/RX; our job is just clean export + import. (We already do `loudnorm` on export — keep
  that as the floor; the external pass is the ceiling.)
- **The real fix is upstream:** laptop-mic quality is the root problem. Capture mic at higher
  quality (prefer a WAV/PCM or high-bitrate path in `getUserMedia`/`MediaRecorder` so there's
  more signal to clean), and recommend a cheap USB mic in the teacher workflow — a $50 mic beats
  any cleanup. Worth a line in the capture UI.
- Code touchpoints: `editor.js` (new export-WAV from the narration segments + an import that sets
  a `replacementAudioPath`), `main.js` `mux-audio` (use the replacement WAV when present instead
  of the per-segment mic webms). Reuses the existing audio-decode/offset math.

**Open decision for Josh:** timeline-WAV round-trip (recommended) vs. post-upload MP4 audio
swap (heavier, alignment-fragile). Confirm before building.

---

## 3. Editable audio timeline (split + arrange)

**Goal.** The Audio lane should let you split and arrange audio like clips — independent of the
video clips.

**Today:** audio is *per-video-clip* narration (`clip.audioPath` + `audioOffsetMs`), played
synced to the active video segment and muxed per-segment at export. The Audio lane only *shows*
waveforms; it isn't independently editable.

**The change (mirrors the annotation-timeline decoupling already done in editor.js):** make
audio its own set of **timeline objects** — `audioSegments = [{ path, inSec, outSec, tStart,
... }]` positioned in master-timeline time, with split / move / trim / lane like the annotation
blocks (which became free, draggable, multi-lane timeline objects — copy that pattern). Then:
- Playback: play the audio segment(s) active at the playhead (decoupled from which video clip
  shows), same as the annotation render-by-timeline-time approach.
- Export: `mux-audio` builds the audio from the **audio-track segments** (timeline-positioned)
  instead of per-video-segment. This also subsumes #2's "replace narration" (a cleaned WAV is
  just an audio segment) and pairs with the waveform that's already rendered.
- Undo must snapshot audio segments too (extend the existing `{clips, annotations}` snapshot).

**Sequencing:** #3 is the biggest and naturally comes after #2 (replace-audio) — or do #3 first
and let #2 fall out of it (a replacement WAV = one audio segment spanning the timeline). #1
(scripts) is independent and can go anytime; its content half (writing scripts) is the long pole.

---

## Suggested order
1. **#1 teleprompter** (smallest code; content-heavy) — unblocks recording good narration.
2. **#2 export/replace narration WAV** (studio audio) — biggest quality win, small code.
3. **#3 editable audio timeline** (largest; subsumes #2's replace).

Brainstorm each with Josh (use the brainstorming skill) before building — the data model for
#1's script storage and the alignment model for #2 are the decisions that matter.
