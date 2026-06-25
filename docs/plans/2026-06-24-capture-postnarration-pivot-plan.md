# Capture post-narration pivot — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the Electron capture app into a silent crop-recorder plus a standalone,
always-on-top, scrollable teleprompter window; remove all audio capture/mux; narrate after
the fact in Kdenlive and upload that export into the slot.

**Architecture:** The app keeps its content-protected crop-recorder (now silent) and gains a
second, ordinary always-on-top window that shows the slot's narration script (loaded via the
existing token endpoint) for reading aloud over the clip in Kdenlive. The live in-overlay
teleprompter and the entire mic/audio/mux path are deleted. The finished Kdenlive export is
uploaded to the slot through the existing token-scoped `POST /api/capture`.

**Tech Stack:** Electron + plain JS (`capture-app/`). No academy (`src/`) changes — nothing
here touches Next.js/Prisma, so there are no Vitest/tsc/build steps. The gate is
`node --check <file>` (syntax) plus Josh's GUI eyeball (behavior).

**Source design (read first):** [`2026-06-24-capture-postnarration-pivot-design.md`](./2026-06-24-capture-postnarration-pivot-design.md)

---

## Ground rules (codebase-specific)

- **No test harness in `capture-app/`.** The per-step gate is `node --check <file>` (run in
  PowerShell, not the Bash tool — `node` is fine either way, but `pnpm`/`npm` must be
  PowerShell). Behavior is verified by Josh running the GUI; you cannot see it.
- **`.html` files have no JS gate** — they are verified visually. Keep their `<script>`/markup
  changes small and obviously correct.
- **Stay on branch `feat/teleprompter-narration-capture`.** Do not merge to main without
  Josh's explicit go-ahead. Commit after every green step.
- **This pivot deletes shipped behavior** (mic narration, in-app audio mux, the editor audio
  lane, the live teleprompter). That is intended (design "Removed" section). Delete cleanly;
  do not leave dead identifiers that break `node --check`.
- Line numbers below are anchors at plan-writing time; they drift as you edit. Prefer the
  quoted code/grep anchors over raw line numbers.

---

## Task 1: Standalone teleprompter window (additive — nothing breaks yet)

Add a second window that shows the slot's script, always-on-top, scrollable, toggled by a
global hotkey. This is purely additive; the old in-overlay teleprompter still exists until
Task 2 removes it.

**Files:**
- Create: `capture-app/teleprompter.html`
- Modify: `capture-app/main.js`
- Modify: `capture-app/preload.js`

**Step 1 — Create `capture-app/teleprompter.html`.** A dark, scrollable, unobtrusive page:

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; height: 100%; }
      body {
        background: rgba(8, 9, 13, 0.92);
        color: #e8e8e8;
        font-family: Georgia, "Times New Roman", serif;
        overflow-y: auto;          /* native wheel + arrow/PageUp/PageDown scroll */
        cursor: default;
        -webkit-app-region: drag;  /* drag the frameless window by its body */
      }
      #script {
        padding: 28px 32px 60px;
        font-size: 30px;
        line-height: 1.6;
        white-space: pre-wrap;
        max-width: 1100px;
        margin: 0 auto;
        -webkit-user-select: text;
        user-select: text;
      }
      #empty { color: #8a8f9c; font-size: 18px; padding: 28px 32px; }
    </style>
  </head>
  <body>
    <div id="empty">No script for this slot. (Ctrl+Shift+H hides this window.)</div>
    <div id="script"></div>
    <script>
      const scriptEl = document.getElementById("script");
      const emptyEl = document.getElementById("empty");
      window.otd.onTeleprompterScript((text) => {
        const t = (text || "").trim();
        scriptEl.textContent = t;
        emptyEl.style.display = t ? "none" : "block";
        window.scrollTo(0, 0);
      });
    </script>
  </body>
</html>
```

**Step 2 — Add the window + script routing + toggle hotkey in `capture-app/main.js`.**

(a) Near the top, beside `let overlay = null;`, add:

```js
let teleprompter = null; // standalone always-on-top script window (post-narration)
let lastScript = "";     // remember the latest slot script so a late-opened window can load it
```

(b) Add a creator function (put it next to `createOverlay`):

```js
// A plain, always-on-top, scrollable window that shows the slot's narration script
// to read aloud over the clip in Kdenlive. NOT content-protected and NOT click-through
// (it floats over Kdenlive, never over the recording), so it scrolls and moves like any
// window. Hidden until toggled; created lazily.
function createTeleprompter() {
  if (teleprompter && !teleprompter.isDestroyed()) return teleprompter;
  const area = screen.getPrimaryDisplay().workAreaSize;
  teleprompter = new BrowserWindow({
    width: 560,
    height: 320,
    x: Math.round(area.width * 0.5) - 280,
    y: 24,
    frame: false,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    backgroundColor: "#08090d",
    title: "OTD Teleprompter",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  teleprompter.setAlwaysOnTop(true, "screen-saver");
  teleprompter.setVisibleOnAllWorkspaces(true);
  teleprompter.loadFile(path.join(__dirname, "teleprompter.html"));
  teleprompter.webContents.on("did-finish-load", () => {
    teleprompter.webContents.send("teleprompter:script", lastScript);
  });
  teleprompter.on("closed", () => { teleprompter = null; });
  return teleprompter;
}

// Push a script to the teleprompter (creating it hidden if needed). Does not force-show.
function setTeleprompterScript(text) {
  lastScript = typeof text === "string" ? text : "";
  const w = createTeleprompter();
  if (!w.webContents.isLoading()) w.webContents.send("teleprompter:script", lastScript);
}
```

(c) Route the slot script to it. In `deliverSession(s)`, right after the session is
confirmed valid (after the `if (!s || !s.token)` guard), add:

```js
  setTeleprompterScript(s.script || "");
```

(d) Register the toggle hotkey once, where the always-available quit shortcut is registered
(`globalShortcut.register("CommandOrControl+Shift+Q", …)` inside `app.whenReady`):

```js
    globalShortcut.register("CommandOrControl+Shift+H", () => {
      const w = createTeleprompter();
      if (w.isVisible()) w.hide();
      else { w.show(); }
    });
```

**Step 3 — Add the preload bridge in `capture-app/preload.js`.** Beside the other `on*`
bridges:

```js
  // Script text for the standalone teleprompter window.
  onTeleprompterScript: (cb) =>
    ipcRenderer.on("teleprompter:script", (_e, text) => cb(text)),
```

**Step 4 — Syntax gate.**
Run (PowerShell): `node --check capture-app/main.js` and `node --check capture-app/preload.js`
Expected: no output (exit 0) for each.

**Step 5 — Commit.**

```bash
git add capture-app/teleprompter.html capture-app/main.js capture-app/preload.js
git commit -m "feat(capture): standalone always-on-top teleprompter window"
```

---

## Task 2: Remove the in-overlay teleprompter (teleprompter §1 Task 5 revert)

The bottom-band panel inside the recording overlay (can't scroll, sits over the work) is
replaced by Task 1's window. Remove it everywhere.

**Files:**
- Modify: `capture-app/overlay.html`
- Modify: `capture-app/overlay.js`
- Modify: `capture-app/main.js`
- Modify: `capture-app/preload.js`

**Step 1 — `overlay.html`.** Delete the teleprompter markup inside `#framing`:

```html
        <div id="teleprompter" class="teleprompter hidden" aria-hidden="true">
          <div id="teleprompterText" class="teleprompterText"></div>
        </div>
```

…and delete the `/* ── teleprompter (scripted narration) ── */` style block (the
`#teleprompter { … }` and `#teleprompterText { … }` rules) added for it.

**Step 2 — `overlay.js`.** Remove:
- the refs `const teleprompterEl = $("teleprompter");` and
  `const teleprompterTextEl = $("teleprompterText");`
- the teleprompter populate block in the `onSession` callback (the
  `if (s.script && s.script.trim()) { … } else { … }` that shows/hides `teleprompterEl`)
- the two hide lines in `reset()` (`teleprompterEl.classList.add("hidden")` and its
  `setAttribute("aria-hidden", …)`)
- the `window.otd.onTeleprompterScroll(...)` and `window.otd.onTeleprompterToggle(...)`
  subscriptions (the `// ── teleprompter controls ──` block)

**Step 3 — `main.js`.** In `ipcMain.on("arm-space", …)` remove the three teleprompter
registrations (`CommandOrControl+Shift+Down`, `…+Up`, `…+H` that `send("teleprompter:scroll"/
"teleprompter:toggle")`), and in `ipcMain.on("disarm-space", …)` remove the matching three
`globalShortcut.unregister(...)` lines.

> NOTE: the `Ctrl+Shift+H` you keep is the NEW persistent one from Task 1 (toggles the
> standalone window). The one removed here is the OLD arm-space one that sent
> `teleprompter:toggle` to the overlay. Make sure exactly one `Ctrl+Shift+H` remains and it
> is the Task 1 registration in `app.whenReady`.

**Step 4 — `preload.js`.** Remove `onTeleprompterScroll` and `onTeleprompterToggle` (the
`teleprompter:scroll` / `teleprompter:toggle` bridges). Keep `onTeleprompterScript` (Task 1).

**Step 5 — Syntax gate.**
Run: `node --check capture-app/overlay.js`, `node --check capture-app/main.js`,
`node --check capture-app/preload.js`
Expected: exit 0 each.

**Step 6 — Commit.**

```bash
git add capture-app/overlay.html capture-app/overlay.js capture-app/main.js capture-app/preload.js
git commit -m "refactor(capture): drop the in-overlay teleprompter (replaced by the window)"
```

---

## Task 3: Strip the mic capture path from the recorder

The mic is a fully separate `micStream`/`micRecorder` recorded and saved per clip; the screen
video does not depend on it, so removing it yields silent clips with no change to the video
pipeline.

**Files:**
- Modify: `capture-app/overlay.js`
- Modify: `capture-app/overlay.html`

**Step 1 — `overlay.js`.** Remove the mic machinery:
- the state vars `let micEnabled = true;`, `let micStream = null;`, and the `micRecorder`
  declaration + its leading comment (`// Mic narration: recorded per clip …`)
- the mic-start block (the `if (!micEnabled) return;` guard through `micStream =
  await navigator.mediaDevices.getUserMedia({...})` → `micRecorder = new MediaRecorder(...)`
  setup). Grep anchor: `getUserMedia`.
- every mic teardown (`if (micStream) micStream.getTracks().forEach((t) => t.stop());` and the
  `micStream = null;` that follow — there are two such spots plus the start-block's own)
- the `await window.otd.saveAudio({ … })` call and any handling of its result
- the `setMic` function and its two listeners
  (`micOnEl.addEventListener(...)`, `micOffEl.addEventListener(...)`)
- the refs `const micOnEl = $("micOn");` and `const micOffEl = $("micOff");`

After removal, `node --check` will catch any leftover reference to a removed identifier.

**Step 2 — `overlay.html`.** Delete the mic UI:

```html
        <label class="lbl" id="micLabel">Microphone (video clips)</label>
        <div class="row" id="micRow">
          <span class="chip on" id="micOn">Mic on</span>
          <span class="chip" id="micOff">Mic off</span>
        </div>
```

**Step 3 — Syntax gate.**
Run: `node --check capture-app/overlay.js`
Expected: exit 0 (no "is not defined"-style parse issues; runtime mic refs are gone).

**Step 4 — Commit.**

```bash
git add capture-app/overlay.js capture-app/overlay.html
git commit -m "refactor(capture): remove mic capture — clips are now silent (narrate in post)"
```

---

## Task 4: Remove the audio IPC handlers + bridges (`save-audio`, `mux-audio`)

With no callers left (Task 3), delete the main-process audio handlers and their preload
bridges.

**Files:**
- Modify: `capture-app/main.js`
- Modify: `capture-app/preload.js`

**Step 1 — `main.js`.** Delete the whole `ipcMain.handle("save-audio", async (…) => { … });`
block and the whole `ipcMain.handle("mux-audio", async (…) => { … });` block (and the
`atempoChain` helper if it is used ONLY by `mux-audio` — grep `atempoChain` to confirm it has
no other caller before removing).

**Step 2 — `preload.js`.** Remove `saveAudio: (payload) => ipcRenderer.invoke("save-audio", …)`
and `muxAudio: (payload) => ipcRenderer.invoke("mux-audio", …)`.

**Step 3 — Confirm no stragglers.**
Run: `grep -rn "save-audio\|mux-audio\|saveAudio\|muxAudio" capture-app/*.js`
Expected: no matches (or only in comments you then clean up).

**Step 4 — Syntax gate.**
Run: `node --check capture-app/main.js`, `node --check capture-app/preload.js`
Expected: exit 0 each.

**Step 5 — Commit.**

```bash
git add capture-app/main.js capture-app/preload.js
git commit -m "refactor(capture): remove save-audio/mux-audio IPC (no callers after mic removal)"
```

---

## Task 5: Remove the editor's audio timeline lane

The timeline-editor window (`editor.html`/`editor.js`) carries an audio lane from the
screencast-editor work. With narration moving to Kdenlive it is dead weight. Remove the audio
lane and any audio import/record/placement; keep the video trim/reorder/speed editing intact.

**Files:**
- Modify: `capture-app/editor.js`
- Modify: `capture-app/editor.html`

**Step 1 — Inventory.**
Run: `grep -n "audio\|Audio\|mic\|narration\|waveform\|wav\b" capture-app/editor.js`
and the same over `capture-app/editor.html`. Read each hit in context.

**Step 2 — Remove, lane by lane.** Delete: the audio-lane DOM (its container/markup in
`editor.html`), the audio-lane render/draw code, any audio-clip import/record/drag handlers,
audio fields threaded into the export/`editor:init` payload, and any now-unused audio state.
The export must still produce the video (it no longer muxes narration). If the editor sent an
`audioPath`/segments payload to `mux-audio`, remove that wiring (the handler is gone in Task 4).

> If the audio lane is too entangled to excise without destabilizing video editing, STOP and
> report — fuller editor deprecation may be the better call (design "Out of scope" allows
> revisiting). Do not half-remove and leave it broken.

**Step 3 — Syntax gate.**
Run: `node --check capture-app/editor.js`
Expected: exit 0.

**Step 4 — Commit.**

```bash
git add capture-app/editor.js capture-app/editor.html
git commit -m "refactor(capture): remove the editor audio timeline lane"
```

---

## Task 6: Add the "upload a finished video to this slot" verb

After narrating + exporting in Kdenlive, the operator picks that file and uploads it to the
slot using the same token-scoped `POST /api/capture` the app already calls. No academy change.

**Files:**
- Modify: `capture-app/main.js`
- Modify: `capture-app/preload.js`
- Modify: `capture-app/overlay.html`
- Modify: `capture-app/overlay.js`

**Step 1 — `main.js` IPC handler.** Add `dialog` to the `require("electron")` destructure,
then add a handler that opens a file picker, reads the file, and reuses the existing upload
(`/api/capture?token=…&ext=…`). It needs the current session's `api`+`token`; pass them from
the renderer (the overlay holds `session`):

```js
ipcMain.handle("upload-file", async (_e, { api, token }) => {
  if (!api || !token) return { ok: false, error: "No lesson slot — open this from a lesson +." };
  const pick = await dialog.showOpenDialog({
    title: "Choose the finished video to upload",
    properties: ["openFile"],
    filters: [{ name: "Video", extensions: ["mp4", "webm", "mov"] }],
  });
  if (pick.canceled || !pick.filePaths[0]) return { ok: false, error: "Cancelled." };
  const file = pick.filePaths[0];
  const ext = path.extname(file).slice(1).toLowerCase() || "mp4";
  try {
    const body = fs.readFileSync(file);
    const ctype = ext === "webm" ? "video/webm" : ext === "mov" ? "video/quicktime" : "video/mp4";
    const qs = new URLSearchParams({ token, ext }).toString();
    logLine(`upload-file → ${api}/api/capture ext=${ext} bytes=${body.length}`);
    const res = await fetch(`${api}/api/capture?${qs}`, {
      method: "POST",
      headers: { "Content-Type": ctype },
      body,
      redirect: "manual",
    });
    if (res.status >= 300 && res.status < 400) {
      return { ok: false, error: `Redirected (${res.status}) — upload didn't reach the server.` };
    }
    const json = await res.json().catch(() => ({}));
    logLine(`upload-file response: ${res.status} ${JSON.stringify(json)}`);
    if (!res.ok || !json.src) return { ok: false, error: json.error || `HTTP ${res.status}` };
    return { ok: true, src: json.src };
  } catch (e) {
    logLine(`upload-file THREW: ${e && e.message}`);
    return { ok: false, error: e && e.message ? e.message : "Upload failed." };
  }
});
```

> Note: `/api/capture` accepts `ext` of `mp4`/`webm` already (today's clip upload). `mov` maps
> to `video/quicktime`; if the academy route rejects unknown exts, export mp4 from Kdenlive
> (the recommended default) and this is moot.

**Step 2 — `preload.js` bridge.**

```js
  uploadFile: (payload) => ipcRenderer.invoke("upload-file", payload),
```

**Step 3 — `overlay.html` button.** In the `#framing` (or setup) controls, add:

```html
        <button class="btn ghost" id="uploadFileBtn">Upload a finished video to this slot</button>
```

**Step 4 — `overlay.js` wiring.** Add a handler that only works in a deep-link session:

```js
  $("uploadFileBtn").addEventListener("click", async () => {
    if (!session || !session.token) {
      window.otd.log("upload-file: no session");
      return;
    }
    const r = await window.otd.uploadFile({ api: session.api, token: session.token });
    window.otd.log(`upload-file result: ${JSON.stringify(r)}`);
    // Surface success/failure using the same status UI the approve path uses.
  });
```

Hide/disable the button in standalone mode (no `session`) the same way the app hides the
"again" button for deep-link sessions; mirror an existing show/hide pattern.

**Step 5 — Syntax gate.**
Run: `node --check capture-app/main.js`, `node --check capture-app/preload.js`,
`node --check capture-app/overlay.js`
Expected: exit 0 each.

**Step 6 — Commit.**

```bash
git add capture-app/main.js capture-app/preload.js capture-app/overlay.html capture-app/overlay.js
git commit -m "feat(capture): upload a finished (Kdenlive-narrated) video into the slot"
```

---

## Task 7: Rework `INTEGRATION.md` into the Electron + Kdenlive workflow

**Files:**
- Modify: `capture-app/INTEGRATION.md`

**Step 1 — Update the doc.** Keep the three wire contracts (deep link, `GET /api/capture/session`,
`POST /api/capture`). Replace the live-teleprompter section with: (a) the standalone
teleprompter window (`Ctrl+Shift+H` toggle, native scroll, always-on-top, loads the slot
script), (b) the workflow: record silent → open the clip in Kdenlive → toggle teleprompter,
narrate to the timeline → export mp4 → "Upload a finished video to this slot". Note clips are
now silent and the mic/audio path was removed.

**Step 2 — Commit.**

```bash
git add capture-app/INTEGRATION.md
git commit -m "docs(capture): document the silent-record + Kdenlive narration workflow"
```

---

## Task 8: End-to-end manual verification (Josh)

Not automatable. The human gate the design calls for.

**Step 1 — Launch.** Academy running (it already serves `/api/capture/session` + `/api/capture`
from the §1 work). Start the capture app: `cd capture-app; npm start` (PowerShell).

**Step 2 — Teleprompter.** Click a scripted L1.01 slot's "+". Press `Ctrl+Shift+H`: the
teleprompter window appears, shows that slot's script, scrolls with the wheel and arrow/PageDn
keys, drags/resizes like a normal window, and stays on top of other apps (incl. Kdenlive).
`Ctrl+Shift+H` hides it.

**Step 3 — Silent record.** Record a clip. Confirm it saves to disk and has NO audio track
(e.g. open it; or `ffprobe` shows video only). Confirm there is no mic UI anywhere.

**Step 4 — Kdenlive round-trip.** Open the clip in Kdenlive, narrate reading the teleprompter,
export an mp4.

**Step 5 — Upload the export.** In the capture app, click "Upload a finished video to this
slot", pick the Kdenlive export, confirm it lands in the lesson placeholder (the lesson page
shows the narrated video). Check `~/Downloads/otd-captures/otd-capture.log` for the
`upload-file response: 200`.

**Step 6 — Editor.** Open the timeline editor (if still surfaced); confirm it opens with no
audio lane and video trim/reorder/speed still work.

---

## Done criteria

- [ ] Every changed `capture-app/*.js` passes `node --check`.
- [ ] No `mic` / `save-audio` / `mux-audio` / in-overlay-teleprompter identifiers remain
      (`grep -rn` clean).
- [ ] Exactly one `Ctrl+Shift+H` registration (the standalone-window toggle).
- [ ] Josh confirms: teleprompter window toggles/scrolls/stays-on-top; clips are silent;
      Kdenlive export uploads into the slot; editor has no audio lane.

## Out of scope

- Kdenlive project templates / export automation (manual tool use).
- Studio-clean Audacity step (optional).
- Captions/STT (§5), capture-app repo split (§4).
- Re-recording the 7 already-captured L1.01 clips with voiceover (content task; scripts exist).
