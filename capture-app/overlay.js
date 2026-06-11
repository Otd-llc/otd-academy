// OTD Capture — overlay renderer.
//
// The window is a transparent, click-through, content-protected overlay over the
// whole screen. You frame against the REAL desktop (seen through the transparent
// overlay); the captured screen stream excludes this overlay (content protection),
// so a Space-press grabs just what's behind the marching-ants box.
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
  const sessionWhatEl = $("sessionWhat");
  const modeRowEl = $("modeRow");
  const modeLabelEl = $("modeLabel");
  const startBtnEl = $("startBtn");

  let scaleFactor = 1;
  let session = null; // deep-link session from the lesson "+" (null = standalone)
  let mode = "image"; // image | video
  let aspect = 1.6; // 0 = free
  let box = null; // { x, y, w, h } in CSS px
  let phase = "setup"; // setup | framing | recording | review | done
  let stream = null;
  let recorder = null;
  let recCanvas = null;
  let raf = null;
  let recTimer = null;
  let recStart = 0;
  let captured = null; // { base64, ext }
  let previewUrl = null;
  let dragging = false;
  const dragRef = { mode: null, x: 0, y: 0, box: null };

  window.otd.onDisplayInfo((info) => {
    scaleFactor = info.scaleFactor || 1;
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
    captionEl.value = s.caption || "";
    startBtnEl.textContent = "Start capture";
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

  // ── click-through hover toggle ──
  // Click-through everywhere except over the panel or the box; forwarded mousemove
  // (main sets ignoreMouseEvents(true,{forward:true})) lets us hit-test.
  function hit(el, x, y) {
    if (el.classList.contains("hidden")) return false;
    const r = el.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }
  document.addEventListener("mousemove", (e) => {
    if (dragging) return;
    const interactive =
      hit(panelEl, e.clientX, e.clientY) ||
      ((phase === "framing" || phase === "recording") && hit(boxEl, e.clientX, e.clientY));
    window.otd.setInteractive(interactive);
  });

  // ── crop math (box CSS px → native source rect) ──
  function cropRect() {
    const sx = box.x * scaleFactor;
    const sy = box.y * scaleFactor;
    const sw = box.w * scaleFactor;
    const sh = box.h * scaleFactor;
    const outW = Math.max(1, Math.min(Math.round(sw), 1600));
    const outH = Math.max(1, Math.round(sh * (outW / sw)));
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
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    } catch (e) {
      framingStatus.textContent = "Couldn't start screen capture: " + (e && e.message);
      return;
    }
    screenVideo.srcObject = stream;
    await screenVideo.play().catch(() => {});
    initBox();
    boxEl.classList.remove("hidden");
    phase = "framing";
    showSection("framing");
    framingStatus.innerHTML =
      mode === "video"
        ? 'Frame it, then <kbd>Space</kbd> to start — <kbd>Space</kbd> again to stop.'
        : 'Frame it, then press <kbd>Space</kbd> to capture. <kbd>Esc</kbd> cancels.';
    window.otd.armSpace();
  }

  function stopStream() {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    screenVideo.srcObject = null;
  }

  function captureFrame() {
    if (!box || !screenVideo.videoWidth) return;
    const r = cropRect();
    const canvas = document.createElement("canvas");
    canvas.width = r.outW;
    canvas.height = r.outH;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(screenVideo, r.sx, r.sy, r.sw, r.sh, 0, 0, r.outW, r.outH);
    const dataUrl = canvas.toDataURL("image/webp", 0.9);
    captured = { base64: dataUrl.split(",")[1], ext: "webp" };
    finishToReview(dataUrl, false);
  }

  function startRecording() {
    if (!box || !screenVideo.videoWidth) return;
    const r = cropRect();
    recCanvas = document.createElement("canvas");
    recCanvas.width = r.outW;
    recCanvas.height = r.outH;
    const ctx = recCanvas.getContext("2d");
    const draw = () => {
      ctx.drawImage(screenVideo, r.sx, r.sy, r.sw, r.sh, 0, 0, r.outW, r.outH);
      raf = requestAnimationFrame(draw);
    };
    draw();
    try {
      recorder = new window.StreamRecorder(recCanvas.captureStream(30));
      recorder.start();
    } catch (e) {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      framingStatus.textContent = "Couldn't start recording: " + (e && e.message);
      return;
    }
    recStart = Date.now();
    phase = "recording";
    recTimer = setInterval(() => {
      const s = Math.floor((Date.now() - recStart) / 1000);
      framingStatus.innerHTML = `<span class="rec">● Recording ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}</span> — <kbd>Space</kbd> to stop.`;
    }, 500);
  }

  async function stopRecording() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    clearInterval(recTimer);
    try {
      const result = await recorder.stop();
      const buf = await result.blob.arrayBuffer();
      captured = { base64: abToBase64(buf), ext: result.ext };
      finishToReview(URL.createObjectURL(result.blob), true);
    } catch (e) {
      framingStatus.textContent = "Recording failed: " + (e && e.message);
      reset();
    } finally {
      recorder = null;
    }
  }

  function finishToReview(url, isVideo) {
    window.otd.disarmSpace();
    stopStream();
    boxEl.classList.add("hidden");
    if (previewUrl && previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    previewUrl = url;
    reviewMediaEl.innerHTML = isVideo
      ? `<video src="${url}" controls loop autoplay muted></video>`
      : `<img src="${url}" alt="capture preview" />`;
    phase = "review";
    showSection("review");
  }

  async function approve() {
    if (!captured) return;
    const caption = captionEl.value.trim();
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
      doneMsg.textContent = res.ok
        ? "Uploaded ✓ — refresh the lesson page to see it."
        : "Upload failed: " + (res.error || "unknown error");
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
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    clearInterval(recTimer);
    window.otd.disarmSpace();
    stopStream();
    recorder = null;
    captured = null;
    box = null;
    boxEl.classList.add("hidden");
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
  $("cancelFrameBtn").addEventListener("click", reset);
  $("approveBtn").addEventListener("click", approve);
  $("redoBtn").addEventListener("click", () => {
    reset();
    startFraming();
  });
  $("discardBtn").addEventListener("click", reset);
  $("againBtn").addEventListener("click", reset);
  $("quitBtn").addEventListener("click", () => window.otd.quit());
})();
