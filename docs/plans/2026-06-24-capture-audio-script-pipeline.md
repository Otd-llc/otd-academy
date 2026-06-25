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

## Constraints (locked this session — do not re-litigate)

- **Human narration only — no AI/TTS voice.** Don't re-propose AI-generated narration for §1/§2.
  Consequence: the caption pipeline can't assume script ≡ audio; it must STT the *real* recording
  (see §5).
- **$0 tooling — free / local / open-source only.** No paid or per-use services for this pipeline
  (e.g. STT runs locally via whisper.cpp/WhisperX, never the hosted Whisper API). The existing paid
  *infra* (Vercel/Neon/R2/domains) is the standing exception; this rule is about not adding NEW
  per-use or subscription costs for tooling.

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

## 4. Break the capture app into its own repo

**Verdict: yes, break it out** (`Otd-llc/otd-capture`, or under `c:\zzz\otd` with the other
siblings). It's already *de facto* separate — only its folder location is shared:
- **Not a pnpm-workspace member** (the academy `pnpm-workspace.yaml` doesn't list it); own
  `package.json` (`otd-capture`), own deps (electron, ffmpeg-static, mp4-muxer).
- **Zero academy-code imports** — no `@/`, no `../src`. No shared TypeScript, no shared build.
- The only ties are two **runtime contracts**, both repo-independent: the `otd-capture://`
  deep-link (academy → app, the `onSession` payload `{kind,hint,caption,aspect,api,token}`,
  +`script` per §1) and the "upload into the lesson slot" API (app → academy).

**Why:** the toolchains don't overlap (Vercel/Next/Prisma web app vs Electron desktop — no
shared build, deploy, or release path), so the academy CI (tsc/build/migrate/vitest) is noise
for the app and vice-versa; the app ships as packaged installers / GitHub Releases, not a web
deploy; `electron` + `ffmpeg-static` are heavy/native/security-relevant and don't belong in the
product repo; and it fits the existing sibling-repo pattern. The captions/STT pipeline (below)
lands cleanly on this seam — production tooling in the capture repo, serving in the academy.

**How (none are blockers):**
1. **Extract WITH history** — `git filter-repo` (or `git subtree split`) on `capture-app/`, not a
   fresh `git init`.
2. **Write down the two contracts** in both repos (a short `INTEGRATION.md`): the deep-link
   `onSession` payload and the upload API (auth + metadata — and the future transcript/VTT
   sidecar). No shared types package needed given there's zero shared code today; a documented
   contract suffices.
3. **Add packaging** while at it — it currently only has `electron .`; add electron-builder + a
   Releases flow.

**Sequencing:** do the extraction at a clean point with no in-flight capture-app work — **now is
ideal** (editor v2 shipped; features §1–§3 not started), so that work lands in the new repo and
history isn't split mid-feature. Not blocking, but cheaper before §1–§3 than after.

> Only *don't* split if §1–§3 end up tightly coupling the two (shared runtime schemas, frequent
> coordinated changes). They don't — the integration is a stable thin contract — so the split holds.

---

## 5. Captions & transcript pipeline (SEO + accessibility)

**Goal.** Every narrated lesson video gets time-synced captions + a readable transcript, at **$0**,
with **no caption-vs-audio drift**. A clean authored script is a *better* transcript than raw STT —
this just adds timing and audio-truth. Spans the §4 seam: produced in the **capture repo**, consumed
by the **academy**.

**Pipeline:**
1. **Record** the human narration (the §1 teleprompter gives a faithful read).
2. **STT the recorded audio** (NOT the script) → timestamped segments. Because it's derived from the
   waveform, captions match what was actually said *by construction* — the script-vs-audio drift is
   gone (audio is the source of truth, not the page).
3. **Reconcile (recommended): STT for the TIMING, the §1 script for the TEXT.** Token-align the two so
   the words come from the clean script and the timing from the audio. This matters because ASR mangles
   exactly our content — part numbers / acronyms (`GRM21BR61E106KA73L`, `USBLC6`, `X5R`, `ERC/DRC`,
   `KiCad`). *Alternative:* raw STT text + a ~2-min human proof pass per video (simpler, slower).
   **Decision for Josh:** text-of-record = script-aligned-to-STT-timing (recommended for jargon density)
   vs raw-STT + proof pass.
4. **Emit, one pass → both deliverables:** WebVTT (timed) → academy serves as `<track kind="captions">`
   (WCAG 1.2.2); strip timestamps → on-page transcript (WCAG 1.2.8) + `VideoObject` JSON-LD `transcript`
   (SEO + AI-answer ingestion).

**Why it matters:**
- **Accessibility:** 1.2.2 captions + 1.2.8 transcript; and because good teaching narration is inherently
  descriptive ("now I click Board Setup → Constraints…"), it also covers the 1.2.5 audio-description gap a
  silent screencast normally fails.
- **SEO / answer-engine:** a video is opaque to crawlers; the transcript turns each lesson into crawlable
  long-tail text (the content-moat play) and feeds AI answer engines. `VideoObject` makes the videos
  eligible for Google video rich results — fits the academy's existing JSON-LD infra.

**Tooling (per the $0 constraint):** **whisper.cpp** (single C++ binary, CPU, `--dtw` word timings) or
**WhisperX** (word-level via forced alignment) — both open-source, run **locally**, $0, emit VTT/SRT
directly. **NOT** the hosted OpenAI Whisper API (paid per-minute). STT/ASR here is *post-production* on
recorded audio — it does **not** violate the "no AI in the narration pipeline" rule (no generated voice).

**Code touchpoints:** *capture repo* — a post-export step that STTs the narration WAV (from §2) and writes
`<video>.vtt` + a transcript sidecar. *academy* — accept the sidecar on upload (extend the §4 upload
contract), serve the `<track>`, render the transcript block + `VideoObject` JSON-LD on the lesson page.

**Sequencing:** comes AFTER narration audio is recorded + edited (needs §1's script + final audio; STT the
§2 narration WAV). Late in the order.

---

## Suggested order
0. **Break out the repo (§4)** — do first; it's a clean moment and everything below lands in the new repo.
1. **#1 teleprompter** (smallest code; content-heavy) — unblocks recording good narration.
2. **#2 export/replace narration WAV** (studio audio) — biggest quality win, small code.
3. **#3 editable audio timeline** (largest; subsumes #2's replace).
4. **#5 captions & transcript** (after audio is final — STT the §2 narration WAV → VTT + transcript +
   `VideoObject`). The SEO/accessibility payoff; consumed on the academy side.

Brainstorm each with Josh (use the brainstorming skill) before building — the data model for
#1's script storage and the alignment model for #2 are the decisions that matter.
