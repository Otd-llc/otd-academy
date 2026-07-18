// OTD Capture — overlay renderer.
//
// A transparent, content-protected overlay over the whole screen. The panel is
// fully interactive (clickable ×/drag/buttons) in every phase EXCEPT framing —
// only then does the window go click-through so you can arrange the REAL desktop
// behind the marching-ants box. The captured stream excludes this overlay (content
// protection), so a Space-press grabs just what's behind the box.
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const screenVideo = $("screen");
  const boxEl = $("box");
  const handleEl = $("handle");
  const panelEl = $("panel");
  const captionEl = $("caption");
  const setupEl = $("setup");
  const framingEl = $("framing");
  const reviewEl = $("review");
  const reviewMediaEl = $("reviewMedia");
  const doneEl = $("done");
  const framingStatus = framingEl.querySelector("#status");
  const doneMsg = doneEl.querySelector("#status");
  const sessionInfoEl = $("sessionInfo");
  const standaloneNoteEl = $("standaloneNote");
  const sessionWhatEl = $("sessionWhat");
  const modeRowEl = $("modeRow");
  const modeLabelEl = $("modeLabel");
  const aspectRowEl = $("aspectRow");
  const aspectLabelEl = $("aspectLabel");
  const startBtnEl = $("startBtn");
  const uploadFileBtnEl = $("uploadFileBtn");
  const headerEl = $("header");
  const closeBtnEl = $("closeBtn");
  const reviewStatusEl = $("reviewStatus");
  const againBtnEl = $("againBtn");
  const stopBtnEl = $("stopBtn");
  const followLabelEl = $("followLabel");
  const followRowEl = $("followRow");
  const followOffEl = $("followOff");
  const followOnEl = $("followOn");
  const clipTrayEl = $("clipTray");
  const addClipBtnEl = $("addClipBtn");
  const approveBtnEl = $("approveBtn");
  const editBtnEl = $("editBtn");

  // Aspect token (from the placeholder) → ratio. 0 = free (standalone only).
  const ASPECTS = {
    "16:10": 1.6,
    "16:9": 1.7778,
    "4:3": 1.3333,
    "1:1": 1,
    free: 0,
  };

  let scaleFactor = 1;
  let session = null; // deep-link session from the lesson "+" (null = standalone)
  let mode = "image"; // image | video
  let aspect = 1.6; // 0 = free
  let box = null; // { x, y, w, h } in CSS px
  let phase = "setup"; // setup | framing | recording | review | done
  let stream = null;
  let recorder = null;
  let recCanvas = null;
  let recDraw = null; // setInterval id for the recording draw/requestFrame loop (canvas mode)
  let recTimer = null;
  let recStart = 0;
  let recMode = null; // "webcodecs" | "canvas" — which pipeline this recording uses
  let wcSink = null; // WebCodecsSink (webcodecs mode)
  let wcReader = null; // MediaStreamTrackProcessor reader (webcodecs mode)
  let wcProcTrack = null; // cloned capture track feeding the processor
  let wcRunning = false;
  let wcTimer = null; // fixed-rate (CFR) encode pump
  let wcLatest = null; // most-recent source VideoFrame (held for the CFR pump)
  let wcWorker = null; // recording worker (worker mode)
  let camTimer = null; // renderer-side follow-camera loop feeding the worker
  let wcDone = null; // { resolve, reject } awaiting the worker's finished MP4 on stop
  let pumpTicks = 0; // frames pushed/encoded this recording (diagnostics)
  let camLastMs = 0; // timestamp for the follow-spring dt, shared by both pipelines
  const PREFER_WEBCODECS = true; // set false to force the legacy canvas/MediaRecorder path
  const USE_WORKER = true; // run the WebCodecs pipeline in a Worker (per-frame GC off the UI thread)
  let captured = null; // { base64, ext }
  let previewUrl = null;
  // Multi-clip session: clips queued for stitching, in timeline order.
  const clips = []; // [{ path, w, h, durMs }]
  let lastClipDims = { w: 0, h: 0 }; // output dims of the just-recorded clip
  let lastClipDurMs = 0; // wall-clock length of the just-recorded clip
  // Cursor telemetry for the editor's spotlight. Two raw wall-clock-timestamped tracks the
  // editor interpolates per video frame (cancels IPC jitter): the pointer (stamped in main
  // at poll time) and the crop centre / cam (stamped here per frame). The editor combines
  // them as (ptr - cam + box/2)/box at each frame's wall time.
  let ptrSamples = []; // [{ t (wall ms, from main), x, y }]
  let camSamples = []; // [{ t (wall ms), x, y }]
  let telemT0 = 0; // wall ms of the first recorded frame (video time 0)
  let recordingTelem = false;

  let dragging = false;
  const dragRef = { mode: null, x: 0, y: 0, box: null };

  // Auto-follow: when on, the recording frame PANS to keep the cursor centred —
  // size/aspect stay fixed (only the source-rect origin moves). `cursor` is the
  // latest pointer position (CSS px, window-relative); `cam` is the smoothed frame
  // centre that eases toward it each frame.
  let follow = false;
  const cursor = { x: 0, y: 0 };
  const prevCursor = { x: 0, y: 0 };
  const cursorVel = { x: 0, y: 0 }; // low-pass-smoothed pointer velocity (drives lookahead)
  const cam = { x: 0, y: 0, vx: 0, vy: 0 }; // frame centre + its velocity (spring state)
  const REC_FPS = 60; // capture + encode + pan frame rate (60 for smoother motion)
  const FOLLOW_OMEGA = 14; // critically-damped spring stiffness (higher = snappier); ~10-15
  const DEADZONE = 0.42; // cursor roams this fraction of the half-frame before the frame pans
  const LOOKAHEAD = 0.18; // seconds of pointer-velocity lead, so the frame anticipates the cursor
  const VEL_SMOOTH = 0.2; // low-pass on pointer velocity (raw mouse velocity is too noisy to lead on)

  window.otd.onDisplayInfo((info) => {
    scaleFactor = info.scaleFactor || 1;
  });

  // High-rate cursor from the main process (screen.getCursorScreenPoint polled),
  // window-local — a cleaner, steadier signal than forwarded mousemove (which is
  // throttled while the overlay is click-through) for the auto-follow pan.
  window.otd.onCursorPos((p) => {
    cursor.x = p.x;
    cursor.y = p.y;
    // raw, main-timestamped pointer track for the editor's per-frame interpolation
    if (recordingTelem && typeof p.t === "number") ptrSamples.push({ t: p.t, x: p.x, y: p.y });
  });

  // Deep-link from the lesson "+": fix the mode, show the description (what to
  // capture), pre-fill the caption, and switch Approve to upload-into-the-slot.
  window.otd.onSession((s) => {
    session = s;
    mode = s.kind === "video" ? "video" : "image";
    for (const c of modeRowEl.children)
      c.classList.toggle("on", c.dataset.mode === mode);
    modeRowEl.classList.add("hidden");
    modeLabelEl.classList.add("hidden");
    sessionWhatEl.textContent =
      s.hint ||
      (mode === "video"
        ? "Record the clip described in the lesson."
        : "Capture the screenshot described in the lesson.");
    sessionInfoEl.classList.remove("hidden");
    standaloneNoteEl.classList.add("hidden");
    // Post-narration upload targets the slot, so it only makes sense with a session
    // token — revealed here the same way the session info is (hidden until a deep link).
    uploadFileBtnEl.classList.remove("hidden");
    captionEl.value = s.caption || "";
    // Aspect is LOCKED by the placeholder — never the operator's to change. Hide
    // the chooser and use the ratio the lesson specified.
    aspect =
      ASPECTS[s.aspect] ??
      (mode === "video" ? ASPECTS["16:9"] : ASPECTS["16:10"]);
    aspectRowEl.classList.add("hidden");
    aspectLabelEl.classList.add("hidden");
    // Auto-follow only applies to clips — hide it for a locked screenshot session
    // (it stays available, operator's choice, for a video session).
    if (mode === "image") {
      followRowEl.classList.add("hidden");
      followLabelEl.classList.add("hidden");
    }
    startBtnEl.textContent = "Start capture";
    // One-shot: the site initiated this capture, so there's no "capture another".
    againBtnEl.classList.add("hidden");
    phase = "setup";
    showSection("setup");
  });

  // ── panel sections ──
  function showSection(name) {
    for (const [el, n] of [
      [setupEl, "setup"],
      [framingEl, "framing"],
      [reviewEl, "review"],
      [doneEl, "done"],
    ]) {
      el.classList.toggle("hidden", n !== name);
    }
    if (name === "review") renderClipTray(); // tray + Add button + Approve label
    // The full-screen overlay is click-through OUTSIDE its own panel in EVERY phase,
    // so the rest of the screen (KiCad, other apps) stays usable the whole time OTD
    // Capture is open. The mousemove hit-test below re-enables the window only while
    // the cursor is over the panel (and the crop box, while framing) — the same
    // proven mechanism the framing phase already uses. The window stays full-screen +
    // on-top so the box can be drawn over any app and excluded from capture.
    window.otd.setInteractive(false);
  }

  // ── mode / aspect chips ──
  $("modeRow").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    mode = chip.dataset.mode;
    for (const c of $("modeRow").children) c.classList.toggle("on", c === chip);
  });
  $("aspectRow").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    aspect = parseFloat(chip.dataset.aspect);
    for (const c of $("aspectRow").children) c.classList.toggle("on", c === chip);
    if (box && aspect > 0) {
      let h = box.w / aspect;
      if (box.y + h > window.innerHeight) h = window.innerHeight - box.y;
      box.h = h;
      applyBox();
    }
  });

  // ── crop box ──
  function applyBox() {
    boxEl.style.left = box.x + "px";
    boxEl.style.top = box.y + "px";
    boxEl.style.width = box.w + "px";
    boxEl.style.height = box.h + "px";
  }
  function initBox() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    let w = Math.round(W * 0.5);
    let h = aspect > 0 ? w / aspect : Math.round(H * 0.5);
    if (h > H * 0.8) {
      h = H * 0.8;
      if (aspect > 0) w = h * aspect;
    }
    box = { x: Math.round((W - w) / 2), y: Math.round((H - h) / 2), w, h };
    applyBox();
  }

  boxEl.addEventListener("pointerdown", (e) => {
    if (!box) return;
    dragging = true;
    dragRef.mode = e.target === handleEl ? "resize" : "move";
    dragRef.x = e.clientX;
    dragRef.y = e.clientY;
    dragRef.box = { ...box };
    boxEl.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  boxEl.addEventListener("pointermove", (e) => {
    if (!dragging || !dragRef.box) return;
    const dx = e.clientX - dragRef.x;
    const dy = e.clientY - dragRef.y;
    const W = window.innerWidth;
    const H = window.innerHeight;
    if (dragRef.mode === "move") {
      box.x = Math.max(0, Math.min(dragRef.box.x + dx, W - dragRef.box.w));
      box.y = Math.max(0, Math.min(dragRef.box.y + dy, H - dragRef.box.h));
    } else {
      let w = Math.max(48, Math.min(dragRef.box.w + dx, W - dragRef.box.x));
      let h = aspect > 0 ? w / aspect : Math.max(48, Math.min(dragRef.box.h + dy, H - dragRef.box.y));
      if (aspect > 0 && dragRef.box.y + h > H) {
        h = H - dragRef.box.y;
        w = h * aspect;
      }
      box.w = w;
      box.h = h;
    }
    applyBox();
  });
  boxEl.addEventListener("pointerup", (e) => {
    dragging = false;
    dragRef.mode = null;
    boxEl.releasePointerCapture(e.pointerId);
  });

  // ── click-through hover toggle (all phases) ──
  // The overlay is click-through by default (showSection), so other apps stay usable.
  // A forwarded mousemove re-enables interactivity ONLY while the cursor is over the
  // panel (any phase) or the crop box (framing only). Topmost + forward:true means
  // this works even when the overlay isn't the focused window.
  function hit(el, x, y) {
    if (el.classList.contains("hidden")) return false;
    const r = el.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }
  document.addEventListener("mousemove", (e) => {
    // Track the pointer everywhere (forwarded even while click-through) so
    // auto-follow can re-centre the recording frame on it.
    cursor.x = e.clientX;
    cursor.y = e.clientY;
    if (dragging || panelDrag) return;
    // Interactive over the panel (every phase) or the crop box (framing only).
    // Everywhere else — the whole screen during setup, the box during recording — is
    // click-through, so other apps get the mouse.
    const interactive =
      hit(panelEl, e.clientX, e.clientY) ||
      (phase === "framing" && hit(boxEl, e.clientX, e.clientY));
    window.otd.setInteractive(interactive);
  });

  // ── draggable panel (by its header) + close button ──
  let panelDrag = null;
  headerEl.addEventListener("pointerdown", (e) => {
    if (e.target.closest("#closeBtn")) return;
    const r = panelEl.getBoundingClientRect();
    panelDrag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    headerEl.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  headerEl.addEventListener("pointermove", (e) => {
    if (!panelDrag) return;
    const left = Math.max(
      0,
      Math.min(e.clientX - panelDrag.dx, window.innerWidth - panelEl.offsetWidth),
    );
    const top = Math.max(
      0,
      Math.min(e.clientY - panelDrag.dy, window.innerHeight - panelEl.offsetHeight),
    );
    panelEl.style.left = left + "px";
    panelEl.style.top = top + "px";
    panelEl.style.right = "auto";
  });
  headerEl.addEventListener("pointerup", (e) => {
    panelDrag = null;
    headerEl.releasePointerCapture(e.pointerId);
  });
  closeBtnEl.addEventListener("click", () => window.otd.quit());

  // ── crop math (box CSS px → native source rect) ──
  function cropRect(maxW = 1600) {
    const sx = box.x * scaleFactor;
    const sy = box.y * scaleFactor;
    const sw = box.w * scaleFactor;
    const sh = box.h * scaleFactor;
    // Output MUST be even on both axes — hardware H.264 encoders reject odd
    // dimensions and silently fall back to (slow) software encode.
    let outW = Math.min(Math.round(sw), maxW);
    outW = Math.max(2, outW - (outW % 2));
    let outH = Math.round(sh * (outW / sw));
    outH = Math.max(2, outH - (outH % 2));
    return { sx, sy, sw, sh, outW, outH };
  }

  function abToBase64(buf) {
    const bytes = new Uint8Array(buf);
    let bin = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  }

  // ── flow ──
  async function startFraming() {
    // Switch to the framing panel FIRST so any capture error is visible (this is why
    // standalone looked like it "did nothing" — the error was set on a hidden panel).
    phase = "framing";
    showSection("framing");
    framingStatus.textContent = "Starting screen capture…";
    window.otd.log("startFraming: requesting getDisplayMedia");
    try {
      // Cap the SOURCE at 30fps. Uncapped, Chromium captures the whole screen at up
      // to 60fps; with the per-frame canvas crop + H.264 encode on top, that
      // saturated the CPU and made clips stutter. 30fps is plenty for a tutorial.
      stream = await navigator.mediaDevices.getDisplayMedia({
        // cursor:"never" asks Chromium to omit the OS cursor from captured frames, so
        // the editor can draw a smooth HD cursor instead. Best-effort — some capturers
        // ignore it; the editor's synthetic cursor is a toggle for exactly that case.
        video: { frameRate: { ideal: 60, max: 60 }, cursor: "never" },
        audio: false,
      });
    } catch (e) {
      window.otd.log("getDisplayMedia FAILED: " + (e && e.message));
      framingStatus.textContent = "Couldn't start screen capture: " + (e && e.message);
      return;
    }
    window.otd.log("getDisplayMedia OK");
    // Belt-and-suspenders: some capturers ignore the initial constraint, so pin it.
    try {
      await stream.getVideoTracks()[0].applyConstraints({ frameRate: { max: 60 } });
    } catch {
      // not fatal — REC_FPS still bounds the encode rate
    }
    screenVideo.srcObject = stream;
    await screenVideo
      .play()
      .catch((e) => window.otd.log("screenVideo.play err: " + (e && e.message)));
    initBox();
    boxEl.classList.remove("hidden");
    framingStatus.innerHTML =
      mode === "video"
        ? 'Frame the box over KiCad, then <kbd>Ctrl+Shift+Enter</kbd> to start. While recording the box goes <b>click-through</b> — work in KiCad normally; <kbd>Ctrl+Shift+Enter</kbd> or Stop to finish.'
        : 'Frame it, then press <kbd>Ctrl+Shift+Enter</kbd> to capture. <kbd>Ctrl+Shift+Backspace</kbd> cancels.';
    window.otd.armSpace();
  }

  function stopStream() {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    screenVideo.srcObject = null;
  }

  function captureFrame() {
    if (!box || !screenVideo.videoWidth) return;
    // A `zoom` (answer-key) slot shoots hi-res + LOSSLESS PNG so a learner can
    // zoom into fine schematic text; everything else stays the 1600px webp.
    const hires = !!(session && session.zoom);
    const r = cropRect(hires ? 4096 : 1600);
    const canvas = document.createElement("canvas");
    canvas.width = r.outW;
    canvas.height = r.outH;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(screenVideo, r.sx, r.sy, r.sw, r.sh, 0, 0, r.outW, r.outH);
    const dataUrl = hires
      ? canvas.toDataURL("image/png")
      : canvas.toDataURL("image/webp", 0.9);
    captured = { base64: dataUrl.split(",")[1], ext: hires ? "png" : "webp" };
    finishToReview(dataUrl, false);
  }

  // Shared follow-camera update (velocity lookahead + deadzone + critically-damped
  // spring + box transform). Runs once per OUTPUT frame in either pipeline; dt comes
  // from camLastMs so it's correct regardless of the pipeline's frame cadence.
  function updateCamera(halfW, halfH, fixedDt) {
    if (!follow) return;
    let dt;
    if (fixedDt != null) {
      dt = fixedDt; // CFR pump: deterministic per-frame step
    } else {
      const now = performance.now();
      dt = Math.min(0.1, Math.max(0.001, (now - camLastMs) / 1000));
      camLastMs = now;
    }
    const W = window.innerWidth;
    const H = window.innerHeight;
    const rawVx = (cursor.x - prevCursor.x) / dt;
    const rawVy = (cursor.y - prevCursor.y) / dt;
    prevCursor.x = cursor.x;
    prevCursor.y = cursor.y;
    cursorVel.x += (rawVx - cursorVel.x) * VEL_SMOOTH;
    cursorVel.y += (rawVy - cursorVel.y) * VEL_SMOOTH;
    const aimX = cursor.x + cursorVel.x * LOOKAHEAD;
    const aimY = cursor.y + cursorVel.y * LOOKAHEAD;
    const dzx = halfW * DEADZONE;
    const dzy = halfH * DEADZONE;
    let tx = cam.x;
    let ty = cam.y;
    if (aimX > cam.x + dzx) tx = aimX - dzx;
    else if (aimX < cam.x - dzx) tx = aimX + dzx;
    if (aimY > cam.y + dzy) ty = aimY - dzy;
    else if (aimY < cam.y - dzy) ty = aimY + dzy;
    tx = Math.max(halfW, Math.min(tx, W - halfW));
    ty = Math.max(halfH, Math.min(ty, H - halfH));
    const f = 1 + FOLLOW_OMEGA * dt;
    const oo = FOLLOW_OMEGA * FOLLOW_OMEGA * dt;
    cam.x = (cam.x + cam.vx * dt + tx * FOLLOW_OMEGA * dt) / f;
    cam.vx = (cam.vx + (tx - cam.x) * oo) / f;
    cam.y = (cam.y + cam.vy * dt + ty * FOLLOW_OMEGA * dt) / f;
    cam.vy = (cam.vy + (ty - cam.y) * oo) / f;
    boxEl.style.transform = `translate3d(${cam.x - halfW - box.x}px, ${cam.y - halfH - box.y}px, 0)`;
  }

  // Record the crop centre (cam) for this output frame, wall-clock-stamped. telemT0 marks
  // the first frame = video time 0, so the editor can map video time → wall time and LERP
  // both this cam track and main's pointer track to each frame. Called once per output frame.
  function recordCamSample() {
    if (!box) return;
    const now = Date.now();
    if (!telemT0) telemT0 = now;
    camSamples.push({ t: now, x: cam.x, y: cam.y });
  }

  function evenClamp(v, max) {
    v = Math.max(2, v - (v % 2)); // even, >= 2
    return Math.min(v, max - (max % 2));
  }
  function stopTrack(t) {
    try {
      if (t && t.stop) t.stop();
    } catch {
      // already stopped
    }
  }
  function teardownWebCodecs() {
    wcRunning = false;
    if (camTimer) {
      clearInterval(camTimer);
      camTimer = null;
    }
    if (wcWorker) {
      try {
        wcWorker.terminate();
      } catch {
        // ignore
      }
      wcWorker = null;
    }
    wcDone = null;
    if (wcTimer) {
      clearInterval(wcTimer);
      wcTimer = null;
    }
    if (wcReader) {
      try {
        wcReader.cancel();
      } catch {
        // ignore
      }
      wcReader = null;
    }
    if (wcLatest) {
      try {
        wcLatest.close();
      } catch {
        // ignore
      }
      wcLatest = null;
    }
    stopTrack(wcProcTrack);
    wcProcTrack = null;
    if (wcSink && wcSink.encoder) {
      try {
        wcSink.encoder.close();
      } catch {
        // ignore
      }
    }
    wcSink = null;
  }

  async function startRecording() {
    if (!box || !screenVideo.videoWidth) return;
    const halfW = box.w / 2;
    const halfH = box.h / 2;
    // Seed the follow camera at the box centre (CSS px); no jump until the pointer moves.
    cam.x = box.x + halfW;
    cam.y = box.y + halfH;
    cursor.x = cam.x;
    cursor.y = cam.y;
    prevCursor.x = cam.x;
    prevCursor.y = cam.y;
    cam.vx = 0;
    cam.vy = 0;
    cursorVel.x = 0;
    cursorVel.y = 0;
    camLastMs = performance.now();
    pumpTicks = 0;
    ptrSamples = [];
    camSamples = [];
    telemT0 = 0;
    recordingTelem = true;

    // Shared "recording now" UI/state.
    recStart = Date.now();
    phase = "recording";
    stopBtnEl.classList.remove("hidden");
    boxEl.classList.toggle("following", follow); // drop the dim while panning
    window.otd.setInteractive(false);
    window.otd.trackCursor(true); // high-rate cursor for a smooth follow pan

    const track = stream && stream.getVideoTracks ? stream.getVideoTracks()[0] : null;
    if (!track) {
      framingStatus.textContent = "Couldn't start recording: no screen track.";
      return;
    }

    // PRIMARY: zero-copy WebCodecs pipeline (keeps frames on the GPU). Falls back to
    // the canvas/MediaRecorder pipeline if WebCodecs or an H.264 config isn't available.
    let started = false;
    if (PREFER_WEBCODECS && window.WebCodecsSink && window.WebCodecsSink.supported()) {
      try {
        started = await startWebCodecs(track, halfW, halfH);
      } catch (e) {
        window.otd.log("webcodecs start threw: " + (e && e.message));
        teardownWebCodecs();
        started = false;
      }
    }
    if (!started) {
      window.otd.log("using canvas/MediaRecorder pipeline" + (PREFER_WEBCODECS ? " (webcodecs unavailable)" : ""));
      startCanvas(halfW, halfH);
    }
    startStatusTimer();
  }

  // ── WebCodecs pipeline (primary) ──
  // Dispatcher: try the Worker pipeline first (per-frame GC off the UI thread), then
  // the main-thread WebCodecs path. The caller falls back to canvas if both fail.
  async function startWebCodecs(track, halfW, halfH) {
    if (USE_WORKER && typeof Worker !== "undefined" && typeof MediaStreamTrackProcessor !== "undefined") {
      try {
        if (await tryWorker(track, halfW, halfH)) return true;
      } catch (e) {
        window.otd.log("worker path threw, falling back: " + (e && e.message));
        teardownWebCodecs();
      }
    }
    return await startWebCodecsMain(track, halfW, halfH);
  }

  function workerWaitFor(worker, types, ms) {
    return new Promise((resolve) => {
      const onMsg = (e) => {
        const m = e.data || {};
        if (types.indexOf(m.type) !== -1) {
          worker.removeEventListener("message", onMsg);
          resolve(m);
        }
      };
      worker.addEventListener("message", onMsg);
      setTimeout(() => {
        worker.removeEventListener("message", onMsg);
        resolve(null);
      }, ms);
    });
  }
  // The Worker runs capture-read + crop + encode + mux off the UI thread. We keep the
  // original `track` for the main-thread fallback and hand the worker a CLONE, so a
  // worker that can't start costs us nothing.
  async function tryWorker(track, halfW, halfH) {
    let worker;
    try {
      worker = new Worker("record-worker.js");
    } catch (e) {
      window.otd.log("worker create failed: " + (e && e.message));
      return false;
    }
    const ready = await workerWaitFor(worker, ["ready", "fallback"], 2500);
    if (!ready || ready.type !== "ready") {
      worker.terminate();
      window.otd.log("worker not ready → main-thread WebCodecs");
      return false;
    }
    const wTrack = track.clone();
    const processor = new MediaStreamTrackProcessor({ track: wTrack });
    const startedP = workerWaitFor(worker, ["started", "fallback", "error"], 4000);
    worker.postMessage(
      {
        type: "start",
        readable: processor.readable,
        innerW: window.innerWidth,
        innerH: window.innerHeight,
        boxW: box.w,
        boxH: box.h,
        fps: REC_FPS,
        bitrate: 8000000,
        camX: cam.x,
        camY: cam.y,
      },
      [processor.readable],
    );
    const started = await startedP;
    if (!started || started.type !== "started") {
      try {
        wTrack.stop();
      } catch {
        // ignore
      }
      worker.terminate();
      window.otd.log("worker start failed → main-thread WebCodecs");
      return false;
    }
    worker.addEventListener("message", (e) => {
      const m = e.data || {};
      if (m.type === "done" && wcDone) {
        wcDone.resolve(m.buffer);
        wcDone = null;
      } else if (m.type === "error") {
        if (wcDone) {
          wcDone.reject(new Error(m.message || "worker error"));
          wcDone = null;
        } else {
          window.otd.log("worker error mid-record: " + m.message);
        }
      }
    });
    wcWorker = worker;
    wcProcTrack = wTrack;
    recMode = "worker";
    lastClipDims = { w: started.cropW, h: started.cropH };
    window.otd.log(`recording started (worker): codec=${started.codec} crop=${started.cropW}x${started.cropH} coded=${started.codedW}x${started.codedH}`);
    // The worker reads its own cloned track, so the renderer's full-screen <video>
    // is dead weight while recording — pause it so we stop decoding the whole screen
    // on the UI thread (frees GPU/CPU for the live overlay + the worker's encode).
    // It's re-acquired + replayed by startFraming on the next clip.
    try {
      screenVideo.pause();
    } catch {
      // ignore
    }
    // The renderer drives the follow camera + visible box and streams the position to
    // the worker, which samples the latest when cropping each frame.
    camTimer = setInterval(() => {
      updateCamera(halfW, halfH, 1 / REC_FPS);
      recordCamSample();
      try {
        worker.postMessage({ type: "cam", x: cam.x, y: cam.y });
      } catch {
        // ignore
      }
      pumpTicks++;
    }, Math.round(1000 / REC_FPS));
    return true;
  }

  // ── main-thread WebCodecs pipeline (fallback) ──
  async function startWebCodecsMain(track, halfW, halfH) {
    // Read from a CLONE so the original track keeps feeding screenVideo (no contention).
    wcProcTrack = track.clone();
    const processor = new MediaStreamTrackProcessor({ track: wcProcTrack });
    wcReader = processor.readable.getReader();

    // Pull one frame to learn the real coded size, then size the (fixed) crop from it.
    const firstRead = await wcReader.read();
    if (firstRead.done || !firstRead.value) {
      teardownWebCodecs();
      return false;
    }
    const first = firstRead.value;
    const codedW = first.codedWidth;
    const codedH = first.codedHeight;
    // Map window CSS px → source px from the ACTUAL coded size (robust even if the
    // capturer negotiated a resolution that doesn't equal CSS px × scaleFactor).
    const sxScale = codedW / window.innerWidth;
    const syScale = codedH / window.innerHeight;
    const cropW = evenClamp(Math.round(box.w * sxScale), codedW);
    const cropH = evenClamp(Math.round(box.h * syScale), codedH);

    wcSink = new window.WebCodecsSink();
    const ok = await wcSink.init(cropW, cropH, 8000000, REC_FPS);
    if (!ok) {
      try {
        first.close();
      } catch {
        // ignore
      }
      teardownWebCodecs();
      return false;
    }

    recMode = "webcodecs";
    lastClipDims = { w: cropW, h: cropH };
    wcRunning = true;
    const frameIntervalUs = Math.round(1000000 / REC_FPS);
    const fixedDt = 1 / REC_FPS;
    let frameIndex = 0; // output frame counter (CFR)
    let expectedTs = null; // next CFR-grid output timestamp (µs), aligned to frame 0
    let lastCropped = null; // last cropped frame, re-emitted to fill static gaps

    const cropAndEncode = (srcFrame, tsUs) => {
      updateCamera(halfW, halfH, fixedDt);
      recordCamSample();
      let ox = Math.round((cam.x - halfW) * sxScale);
      let oy = Math.round((cam.y - halfH) * syScale);
      ox -= ox % 2; // even origin keeps chroma aligned for the HW encoder
      oy -= oy % 2;
      ox = Math.max(0, Math.min(ox, codedW - cropW));
      oy = Math.max(0, Math.min(oy, codedH - cropH));
      const cropped = new VideoFrame(srcFrame, {
        visibleRect: { x: ox, y: oy, width: cropW, height: cropH },
        timestamp: tsUs,
      });
      wcSink.encode(cropped, frameIndex % (REC_FPS * 2) === 0); // keyframe ~2s
      if (lastCropped) {
        try {
          lastCropped.close();
        } catch {
          // ignore
        }
      }
      lastCropped = cropped.clone(); // keep a copy to fill any following static gap
      cropped.close();
      frameIndex++;
      pumpTicks++;
    };

    window.otd.log(`recording started (webcodecs CFR ${REC_FPS}, event-driven): codec=${wcSink.codec} crop=${cropW}x${cropH} coded=${codedW}x${codedH}`);

    // EVENT-DRIVEN encode: paced by the capture stream's OWN frame delivery (the WGC
    // capture clock), NOT a setInterval — which phase-beats against WGC + vsync and
    // bakes judder into the file. Each arriving frame is quantised onto a constant
    // 1/fps grid; when WGC skips frames (static screen) we fill the gap by re-emitting
    // the last cropped frame, so the output stays CFR and the duration tracks the
    // hardware capture clock.
    const drive = async (firstFrame) => {
      let frame = firstFrame;
      while (wcRunning && frame) {
        if (!wcSink || wcSink.error) {
          try {
            frame.close();
          } catch {
            // ignore
          }
          break;
        }
        if (expectedTs === null) expectedTs = frame.timestamp; // align grid to hw clock
        // Fill CFR slots that elapsed before this frame (cap a burst at ~4s of dupes).
        let fill = 0;
        while (lastCropped && expectedTs < frame.timestamp - frameIntervalUs * 0.5 && fill < REC_FPS * 4) {
          try {
            const dup = new VideoFrame(lastCropped, { timestamp: Math.round(expectedTs) });
            wcSink.encode(dup, frameIndex % (REC_FPS * 2) === 0);
            dup.close();
          } catch (e) {
            window.otd.log("dup err: " + (e && e.message));
          }
          frameIndex++;
          pumpTicks++;
          expectedTs += frameIntervalUs;
          fill++;
        }
        try {
          cropAndEncode(frame, Math.round(expectedTs));
        } catch (e) {
          window.otd.log("crop/encode err: " + (e && e.message));
        }
        expectedTs += frameIntervalUs;
        try {
          frame.close();
        } catch {
          // ignore
        }
        if (!wcRunning) break;
        let res;
        try {
          res = await wcReader.read();
        } catch {
          break;
        }
        if (res.done) break;
        frame = res.value;
      }
      if (lastCropped) {
        try {
          lastCropped.close();
        } catch {
          // ignore
        }
        lastCropped = null;
      }
    };
    drive(first);
    return true;
  }

  // ── canvas / MediaRecorder pipeline (fallback) ──
  function startCanvas(halfW, halfH) {
    const r = cropRect();
    recCanvas = document.createElement("canvas");
    recCanvas.width = r.outW;
    recCanvas.height = r.outH;
    const ctx = recCanvas.getContext("2d");
    // Manual-frame capture: captureStream(0) emits a frame ONLY on requestFrame(), so
    // the clock stays wall-clock real even while this window is unfocused (the default
    // captureStream(30) tied cadence to the throttled compositor and sped clips up).
    const recStream = recCanvas.captureStream(0);
    const recTrack = recStream.getVideoTracks()[0];
    const pushFrame = () => {
      if (!screenVideo.videoWidth) return;
      updateCamera(halfW, halfH);
      recordCamSample();
      const maxSx = Math.max(0, screenVideo.videoWidth - r.sw);
      const maxSy = Math.max(0, screenVideo.videoHeight - r.sh);
      const sx = Math.max(0, Math.min(Math.round((cam.x - halfW) * scaleFactor), maxSx));
      const sy = Math.max(0, Math.min(Math.round((cam.y - halfH) * scaleFactor), maxSy));
      ctx.drawImage(screenVideo, sx, sy, r.sw, r.sh, 0, 0, r.outW, r.outH);
      if (recTrack && recTrack.requestFrame) recTrack.requestFrame();
      else if (recStream.requestFrame) recStream.requestFrame();
      pumpTicks++;
    };
    try {
      recorder = new window.StreamRecorder(recStream);
      recorder.start();
    } catch (e) {
      framingStatus.textContent = "Couldn't start recording: " + (e && e.message);
      return;
    }
    recMode = "canvas";
    lastClipDims = { w: r.outW, h: r.outH };
    pushFrame(); // seed a frame at t=0
    recDraw = setInterval(pushFrame, Math.round(1000 / REC_FPS));
    window.otd.log(`recording started (canvas): codec=${recorder.codec} out=${r.outW}x${r.outH} mp4=${recorder.mp4}`);
  }

  function startStatusTimer() {
    const srcTrack = stream && stream.getVideoTracks ? stream.getVideoTracks()[0] : null;
    if (srcTrack) srcTrack.addEventListener("ended", () => window.otd.log("SCREEN track ENDED"));
    recTimer = setInterval(() => {
      const s = Math.floor((Date.now() - recStart) / 1000);
      framingStatus.innerHTML = `<span class="rec">● Recording ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}</span> — ${follow ? "following cursor" : "fixed frame"} (<kbd>Ctrl+Shift+F</kbd> toggles). <kbd>Ctrl+Shift+Enter</kbd> or Stop to finish.`;
      const q = wcSink && wcSink.encoder ? wcSink.encoder.encodeQueueSize : "-";
      window.otd.log(`rec t=${((Date.now() - recStart) / 1000).toFixed(1)}s mode=${recMode} frames=${pumpTicks} encQ=${q} srcTrack=${srcTrack ? srcTrack.readyState : "?"}`);
    }, 500);
  }

  async function stopRecording() {
    clearInterval(recTimer);
    recTimer = null;
    window.otd.log(`stopRecording: mode=${recMode} wallclock=${((Date.now() - recStart) / 1000).toFixed(1)}s frames=${pumpTicks}`);
    try {
      let result;
      if (recMode === "worker") {
        if (camTimer) {
          clearInterval(camTimer);
          camTimer = null;
        }
        const bufferP = new Promise((resolve, reject) => {
          wcDone = { resolve, reject };
        });
        const to = setTimeout(() => {
          if (wcDone) {
            wcDone.reject(new Error("worker stop timed out"));
            wcDone = null;
          }
        }, 15000);
        try {
          wcWorker.postMessage({ type: "stop" });
        } catch {
          // ignore
        }
        const arrbuf = await bufferP;
        clearTimeout(to);
        result = { blob: new Blob([arrbuf], { type: "video/mp4" }), ext: "mp4" };
        try {
          wcWorker.terminate();
        } catch {
          // ignore
        }
        wcWorker = null;
        stopTrack(wcProcTrack);
        wcProcTrack = null;
      } else if (recMode === "webcodecs") {
        wcRunning = false;
        if (wcTimer) {
          clearInterval(wcTimer); // stop the CFR pump before flushing
          wcTimer = null;
        }
        try {
          await wcReader.cancel();
        } catch {
          // ignore
        }
        result = await wcSink.finish();
        if (wcLatest) {
          try {
            wcLatest.close();
          } catch {
            // ignore
          }
          wcLatest = null;
        }
        stopTrack(wcProcTrack);
        wcProcTrack = null;
        wcReader = null;
      } else {
        if (recDraw) clearInterval(recDraw);
        recDraw = null;
        result = await recorder.stop();
      }
      const buf = await result.blob.arrayBuffer();
      window.otd.log(`stopped: ext=${result.ext} bytes=${buf.byteLength}`);
      captured = { base64: abToBase64(buf), ext: result.ext };
      lastClipDurMs = Date.now() - recStart;
      await queueCurrentClip(); // append to the timeline so it shows immediately
      finishToReview(URL.createObjectURL(result.blob), true);
    } catch (e) {
      window.otd.log(`recording FAILED: ${e && e.message}`);
      framingStatus.textContent = "Recording failed: " + (e && e.message);
      reset();
    } finally {
      teardownWebCodecs();
      recorder = null;
      recMode = null;
    }
  }

  function finishToReview(url, isVideo) {
    window.otd.disarmSpace();
    window.otd.trackCursor(false);
    stopStream();
    boxEl.classList.add("hidden");
    boxEl.classList.remove("following");
    boxEl.style.transform = "";
    stopBtnEl.classList.add("hidden");
    reviewStatusEl.classList.add("hidden");
    if (previewUrl && previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    previewUrl = url;
    // Review is a silent video-framing check; narration is heard in the editor (Phase 5B).
    reviewMediaEl.innerHTML = isVideo
      ? `<video src="${url}" controls loop autoplay muted></video>`
      : `<img src="${url}" alt="capture preview" />`;
    phase = "review";
    showSection("review");
  }

  // ── multi-clip tray ──
  function fmtDur(ms) {
    const s = Math.max(0, Math.round((ms || 0) / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }
  // Persist the just-recorded clip to disk and append it to the timeline. Called
  // right after a recording finishes, so the timeline always shows every clip
  // (including the first one you're reviewing), not just previously-added ones.
  async function queueCurrentClip() {
    if (!captured) return false;
    const res = await window.otd.saveClip({
      base64: captured.base64,
      ext: captured.ext,
      index: clips.length,
    });
    if (!res || !res.ok) {
      window.otd.log("save-clip failed: " + ((res && res.error) || "unknown"));
      return false;
    }
    recordingTelem = false;
    // Clips are silent now (narration is recorded in post); no per-clip audio sidecar.
    clips.push({
      path: res.path,
      w: lastClipDims.w,
      h: lastClipDims.h,
      durMs: lastClipDurMs,
      speed: 1,
      audioPath: null,
      audioOffsetMs: 0,
      cur: box
        ? { box: { w: box.w, h: box.h }, t0: telemT0, ptr: ptrSamples.slice(), cam: camSamples.slice() }
        : null,
    });
    window.otd.log(
      `clip ${clips.length - 1} saved: ${ptrSamples.length} ptr / ${camSamples.length} cam pts (mode=${recMode})`,
    );
    return true;
  }
  function recordAnother() {
    // The current clip is already on the timeline (queued at record time); just
    // re-frame and record the next one.
    captured = null;
    if (previewUrl && previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    startFraming();
  }
  function moveClip(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= clips.length) return;
    const t = clips[i];
    clips[i] = clips[j];
    clips[j] = t;
    renderClipTray();
  }
  function removeClip(i) {
    clips.splice(i, 1);
    renderClipTray();
  }
  function cycleSpeed(i) {
    const steps = [0.5, 1, 1.5, 2, 4];
    const cur = clips[i].speed || 1;
    const at = steps.indexOf(cur);
    clips[i].speed = steps[(at + 1) % steps.length];
    renderClipTray();
  }
  function renderClipTray() {
    const isVideo = mode === "video";
    addClipBtnEl.classList.toggle("hidden", !isVideo);
    editBtnEl.classList.toggle("hidden", !isVideo || clips.length === 0);
    if (!isVideo || clips.length === 0) {
      clipTrayEl.classList.add("hidden");
      clipTrayEl.innerHTML = "";
      approveBtnEl.textContent = "Approve";
      return;
    }
    clipTrayEl.classList.remove("hidden");
    const rows = clips
      .map(
        (c, i) =>
          `<div class="clip-row">` +
          `<span class="clip-name">Clip ${i + 1}</span>` +
          `<span class="clip-dur">${fmtDur(c.durMs / (c.speed || 1))}</span>` +
          `<button class="clip-btn clip-speed" data-act="speed" data-i="${i}" title="Playback speed (click to change)">${c.speed || 1}×</button>` +
          `<button class="clip-btn" data-act="up" data-i="${i}"${i === 0 ? " disabled" : ""} title="Move up">▲</button>` +
          `<button class="clip-btn" data-act="down" data-i="${i}"${i === clips.length - 1 ? " disabled" : ""} title="Move down">▼</button>` +
          `<button class="clip-btn clip-x" data-act="remove" data-i="${i}" title="Remove">✕</button>` +
          `</div>`,
      )
      .join("");
    clipTrayEl.innerHTML =
      `<div class="tray-head">Timeline · ${clips.length} clip${clips.length === 1 ? "" : "s"} · stitched top → bottom</div>` +
      rows;
    approveBtnEl.textContent = `Finish & upload (${clips.length})`;
  }
  function showReviewError(msg) {
    reviewStatusEl.textContent = msg;
    reviewStatusEl.classList.remove("hidden");
  }
  clipTrayEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const i = parseInt(btn.dataset.i, 10);
    if (btn.dataset.act === "up") moveClip(i, -1);
    else if (btn.dataset.act === "down") moveClip(i, 1);
    else if (btn.dataset.act === "remove") removeClip(i);
    else if (btn.dataset.act === "speed") cycleSpeed(i);
  });

  async function approve() {
    if (!captured) return;
    const caption = captionEl.value.trim();
    // Multi-clip: fold the reviewed clip into the queue, then stitch the whole set
    // into one MP4 before the normal upload/save runs on the stitched result.
    if (mode === "video" && clips.length > 0) {
      phase = "done";
      showSection("done");
      doneMsg.textContent = `Stitching ${clips.length} clip${clips.length === 1 ? "" : "s"}…`;
      const res = await window.otd.exportClips({
        clips: clips.map((c) => ({ path: c.path, w: c.w, h: c.h, speed: c.speed })),
        fps: REC_FPS,
      });
      if (!res || !res.ok) {
        phase = "review";
        showSection("review");
        showReviewError("Stitch failed: " + ((res && res.error) || "unknown error"));
        return;
      }
      captured = { base64: abToBase64(res.bytes), ext: "mp4" };
      clips.length = 0; // consumed into the stitched output
    }
    if (session) {
      doneMsg.textContent = "Uploading…";
      phase = "done";
      showSection("done");
      const res = await window.otd.upload({
        api: session.api,
        token: session.token,
        ext: captured.ext,
        base64: captured.base64,
        caption,
      });
      if (res.ok) {
        // One-shot: the lesson page picks up the upload on its own. Close.
        doneMsg.textContent = "Uploaded ✓";
        setTimeout(() => window.otd.quit(), 800);
      } else {
        // Keep the capture; drop back to review so Approve retries (Redo re-frames).
        reviewStatusEl.textContent =
          "Upload failed: " + (res.error || "unknown error") + " — try again.";
        reviewStatusEl.classList.remove("hidden");
        phase = "review";
        showSection("review");
      }
      return;
    }
    const path = await window.otd.save({
      base64: captured.base64,
      ext: captured.ext,
      caption,
    });
    doneMsg.textContent = "Saved to " + path;
    phase = "done";
    showSection("done");
  }

  function reset() {
    if (recDraw) clearInterval(recDraw);
    recDraw = null;
    clearInterval(recTimer);
    teardownWebCodecs(); // stop the webcodecs loop/encoder if a recording was live
    recMode = null;
    window.otd.disarmSpace();
    window.otd.trackCursor(false);
    stopStream();
    recorder = null;
    captured = null;
    clips.length = 0; // cancelling discards the whole queued session
    box = null;
    boxEl.classList.add("hidden");
    boxEl.classList.remove("following");
    boxEl.style.transform = "";
    stopBtnEl.classList.add("hidden");
    if (previewUrl && previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    phase = "setup";
    showSection("setup");
  }

  // ── triggers ──
  window.otd.onTrigger(() => {
    if (phase === "framing") {
      if (mode === "video") startRecording();
      else captureFrame();
    } else if (phase === "recording") {
      void stopRecording();
    }
  });
  window.otd.onCancel(() => {
    if (phase === "framing" || phase === "recording") reset();
    else if (phase === "review" || phase === "done") reset();
  });

  $("startBtn").addEventListener("click", startFraming);
  // Post-narration: pick a finished (Kdenlive-exported) video and upload it straight
  // into this slot. Only meaningful in a deep-link session (the button is hidden in
  // standalone mode, where there's no slot to upload to).
  $("uploadFileBtn").addEventListener("click", async () => {
    if (!session || !session.token) {
      window.otd.log("upload-file: no session");
      return;
    }
    // Surface progress + result with the same status UI the approve/upload path uses.
    doneMsg.textContent = "Uploading…";
    phase = "done";
    showSection("done");
    const r = await window.otd.uploadFile({ api: session.api, token: session.token });
    window.otd.log(`upload-file result: ${JSON.stringify(r)}`);
    if (r && r.ok) {
      // One-shot, like the approve path: the lesson page picks it up. Close.
      doneMsg.textContent = "Uploaded ✓";
      setTimeout(() => window.otd.quit(), 800);
    } else {
      // Stay on the done screen (its Quit button is always shown) with the failure
      // text — same status element (#status / doneMsg) the approve upload writes to.
      doneMsg.textContent =
        "Upload failed: " + ((r && r.error) || "unknown error") + " — try again.";
    }
  });
  stopBtnEl.addEventListener("click", () => {
    if (phase === "recording") void stopRecording();
  });
  $("cancelFrameBtn").addEventListener("click", reset);
  $("approveBtn").addEventListener("click", approve);
  $("addClipBtn").addEventListener("click", recordAnother);
  $("editBtn").addEventListener("click", () => {
    if (!clips.length) return;
    window.otd.openEditor({
      clips: clips.map((c) => ({ path: c.path, w: c.w, h: c.h, durMs: c.durMs, speed: c.speed, audioPath: c.audioPath, audioOffsetMs: c.audioOffsetMs, cur: c.cur })),
      session,
    });
  });
  $("redoBtn").addEventListener("click", () => {
    // Re-record the CURRENT clip: drop the one just queued (the last on the
    // timeline), keep any earlier clips, and re-frame.
    clips.pop();
    captured = null;
    if (previewUrl && previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    startFraming();
  });
  $("discardBtn").addEventListener("click", reset);
  $("againBtn").addEventListener("click", reset);
  $("quitBtn").addEventListener("click", () => window.otd.quit());

  // ── auto-follow toggle ──
  function setFollow(on) {
    follow = on;
    followOffEl.classList.toggle("on", !on);
    followOnEl.classList.toggle("on", on);
    // Only drop the box dim while actually recording — during framing you want the dim
    // to size the box.
    if (phase === "recording") boxEl.classList.toggle("following", on);
  }
  followOffEl.addEventListener("click", () => setFollow(false));
  followOnEl.addEventListener("click", () => setFollow(true));
  // Global Ctrl+Shift+F (armed with Space, only while framing/recording) flips it
  // hands-free — chosen to not clash with KiCad's own shortcuts.
  window.otd.onToggleFollow(() => setFollow(!follow));

  // Initial state: setup is shown — make sure the window is interactive so the
  // panel is clickable immediately (standalone launch has no onSession).
  showSection("setup");
})();
