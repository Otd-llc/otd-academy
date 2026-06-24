// OTD Editor — single-timeline NLE renderer.
//
// Receives the recorded clips (already on disk) + the lesson session over
// `editor:init`. The timeline is one magnetic sequence of segments laid out on a
// time ruler (pxPerSec, zoomable); a master playhead scrubs/plays the WHOLE sequence,
// switching the <video> source as it crosses segment boundaries. Trimming is direct on
// the timeline (drag a clip's gold edge grip, or I/O at the playhead); clips reorder by
// dragging the body. Undo/redo (Ctrl+Z/Y) wraps every edit. Export still runs the ffmpeg
// stitch (Phase 1 — the WYSIWYG canvas/WebCodecs export lands in Phase 2).
//
// Data model: clips = ordered list of segments
//   { path, w, h, durMs, speed, inSec, outSec, name }
// Effective on-timeline duration = (outSec - inSec) / speed. A segment's timeline start
// is DERIVED as the cumulative sum of prior effective durations (magnetic — no stored
// positions, so reorder/trim reflow for free). `name` is stable across reorder.
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  // Two <video> elements ping-pong: `videoEl` is the active (visible, playing) one,
  // `altEl` preloads the next clip so cuts between different source files don't flash.
  let videoEl = $("video");
  let altEl = $("video2");
  const exportVideoEl = $("exportVideo"); // dedicated frame source for WYSIWYG export
  const narrationEl = $("narration"); // mic narration playback, synced to the playhead
  const noClipEl = $("noClip");
  const canvasEl = $("previewCanvas");
  const previewCtx = canvasEl.getContext("2d");
  const zoomBoxEl = $("zoomBox");
  const audioWaveEl = $("audioWave");
  const audioWaveCtx = audioWaveEl.getContext("2d");
  let narrationPath = null; // path currently loaded in narrationEl

  // transport
  const playBtn = $("playBtn");
  const homeBtn = $("homeBtn");
  const endBtn = $("endBtn");
  const loopBtn = $("loopBtn");
  const zoomInBtn = $("zoomInBtn");
  const zoomOutBtn = $("zoomOutBtn");
  const timecodeEl = $("timecode");
  const selInfoEl = $("selInfo");

  // timeline
  const tlScrollEl = $("tlScroll");
  const tlInnerEl = $("tlInner");
  const rulerEl = $("ruler");
  const videoTrackEl = $("videoTrack");
  const playheadEl = $("tlPlayhead");
  const playheadHitEl = $("playheadHit");
  const dropMarkerEl = $("dropMarker");

  // controls
  const undoBtn = $("undoBtn");
  const redoBtn = $("redoBtn");
  const speedBtn = $("speedBtn");
  const splitBtn = $("splitBtn");
  const trimInBtn = $("trimInBtn");
  const trimOutBtn = $("trimOutBtn");
  const removeBtn = $("removeBtn");
  const hushBtn = $("hushBtn");
  const zoomKfBtn = $("zoomKfBtn");
  const resetZoomBtn = $("resetZoomBtn");
  const clearZoomBtn = $("clearZoomBtn");
  const cursorBtn = $("cursorBtn");
  const spotCfgBtn = $("spotCfgBtn");
  const spotPanel = $("spotPanel");
  const cancelBtn = $("cancelBtn");
  const exportBtn = $("exportBtn");
  const statusEl = $("status");

  // ── state ──
  let clips = []; // [{ path, w, h, durMs, speed, inSec, outSec, name }]
  let session = null; // { api, token, caption } | null (standalone)
  let sel = -1;
  let busy = false;

  let pxPerSec = 100; // timeline zoom
  let playT = 0; // master playhead time (effective seconds)
  let playing = false;
  let curSegIdx = -1; // segment currently loaded into <video>
  let curPath = null; // <video>.src path (avoid reloading same file)
  let rafId = null;
  let scrubbing = false; // dragging the master playhead
  let segAction = null; // timeline drag: { type:'edge'|'body'|'scrub', i, edge, ... }
  let renaming = false;

  let fwdMul = 1; // forward shuttle multiplier (L / double-L)
  let revRaf = null; // reverse-shuttle rAF id
  let revMul = 1;
  let revLast = 0;

  let undoStack = [];
  let redoStack = [];

  let projW = 1280; // output / canvas resolution (max clip dims, even)
  let projH = 720;
  let zoomDrag = null; // { x0, y0 } while dragging a focus box on the canvas
  let showCursor = true; // draw the cursor spotlight over the composite
  let loopPlay = false; // loop the sequence (handy for tuning the spotlight timing)
  // Spotlight look + timing (timing nudges telemetry vs video to sit on the pointer).
  const spot = { dim: 0.32, diam: 20, soft: 24, offsetMs: 0 };

  const SPEEDS = [0.5, 1, 1.5, 2, 4];
  const MAX_ZOOM = 6;
  const FPS = 60;
  const PX_MIN = 20;
  const PX_MAX = 400;
  const EDGE = 8; // px hit zone for edge-trim on a segment
  const SNAP_PX = 7; // px snap distance to the playhead when edge-trimming
  const MIN_SRC = 0.1; // minimum kept source seconds
  const TICK_STEPS = [0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];

  // ── model helpers ──
  const durSec = (c) => (c.durMs || 0) / 1000;
  const inOf = (c) => Math.max(0, c.inSec || 0);
  const outOf = (c) => (typeof c.outSec === "number" ? c.outSec : durSec(c));
  const effSec = (c) => Math.max(0, outOf(c) - inOf(c)) / (c.speed || 1);
  const nameOf = (c, i) => c.name || `Clip ${i + 1}`;
  const fileUrl = (p) => "file:///" + encodeURI(String(p).replace(/\\/g, "/"));

  function totalSec() {
    let t = 0;
    for (const c of clips) t += effSec(c);
    return t;
  }
  function startOf(i) {
    let a = 0;
    for (let k = 0; k < i && k < clips.length; k++) a += effSec(clips[k]);
    return a;
  }
  function startPx(i) {
    return startOf(i) * pxPerSec;
  }
  // Active segment at timeline time T → { i, segStart, srcTime, eff }.
  function activeAt(T) {
    let acc = 0;
    for (let i = 0; i < clips.length; i++) {
      const e = effSec(clips[i]);
      if (T < acc + e || i === clips.length - 1) {
        const local = Math.max(0, Math.min(e, T - acc));
        const src = inOf(clips[i]) + local * (clips[i].speed || 1);
        return { i, segStart: acc, srcTime: src, eff: e };
      }
      acc += e;
    }
    return { i: -1, segStart: 0, srcTime: 0, eff: 0 };
  }

  // m:ss (seconds) or m:ss:ff (with frames at FPS)
  const fmt = (ms) => {
    const s = Math.max(0, Math.round((ms || 0) / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  function fmtTC(sec) {
    sec = Math.max(0, sec || 0);
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const f = Math.floor((sec - Math.floor(sec)) * FPS);
    return `${m}:${String(s).padStart(2, "0")}:${String(f).padStart(2, "0")}`;
  }

  function setStatus(msg, cls) {
    statusEl.textContent = msg || "";
    statusEl.className = cls || "";
  }

  // ── undo / redo ──
  // Deep-copy a clip incl. its zoom keyframes (so snapshots/splits don't alias arrays).
  function cloneClip(c) {
    return { ...c, zoom: c.zoom ? c.zoom.map((k) => ({ ...k })) : undefined };
  }
  function snapshot() {
    return clips.map(cloneClip);
  }
  function pushUndo() {
    undoStack.push(snapshot());
    if (undoStack.length > 100) undoStack.shift();
    redoStack = [];
    refreshUndoButtons();
  }
  function refreshUndoButtons() {
    undoBtn.disabled = undoStack.length === 0;
    redoBtn.disabled = redoStack.length === 0;
  }
  function restoreState(state) {
    clips = state.map(cloneClip);
    curSegIdx = -1;
    curPath = null;
    if (clips.length === 0) {
      sel = -1;
      playT = 0;
      hideVideos();
      renderTimeline();
      return;
    }
    sel = Math.max(0, Math.min(sel, clips.length - 1));
    setSel(sel);
    seekTo(Math.min(playT, totalSec()), false);
  }
  function undo() {
    if (!undoStack.length) return;
    stopAll();
    redoStack.push(snapshot());
    restoreState(undoStack.pop());
    refreshUndoButtons();
    setStatus("Undo", "ok");
  }
  function redo() {
    if (!redoStack.length) return;
    stopAll();
    undoStack.push(snapshot());
    restoreState(redoStack.pop());
    refreshUndoButtons();
    setStatus("Redo", "ok");
  }

  // ── timeline render (structure) ──
  function tickStep() {
    for (const s of TICK_STEPS) if (s * pxPerSec >= 64) return s;
    return TICK_STEPS[TICK_STEPS.length - 1];
  }
  function renderTimeline() {
    const total = totalSec();
    const viewW = tlScrollEl.clientWidth || 600;
    const innerW = Math.max(viewW, Math.ceil(total * pxPerSec) + 60);
    tlInnerEl.style.width = innerW + "px";

    // ruler
    rulerEl.innerHTML = "";
    const step = tickStep();
    const lastTick = Math.ceil(innerW / pxPerSec);
    for (let t = 0; t <= lastTick; t += step) {
      const x = t * pxPerSec;
      const tick = document.createElement("div");
      tick.className = "tick";
      tick.style.left = x + "px";
      rulerEl.appendChild(tick);
      const lbl = document.createElement("div");
      lbl.className = "tlabel";
      lbl.style.left = x + "px";
      lbl.textContent = fmtTC(t);
      rulerEl.appendChild(lbl);
    }

    // video segments
    videoTrackEl.querySelectorAll(".seg").forEach((n) => n.remove());
    let acc = 0;
    clips.forEach((c, i) => {
      const e = effSec(c);
      const seg = document.createElement("div");
      seg.className = "seg" + (i === sel ? " sel" : "");
      seg.style.left = acc * pxPerSec + "px";
      seg.style.width = Math.max(2, e * pxPerSec) + "px";
      seg.dataset.i = String(i);
      const sp = (c.speed || 1) !== 1 ? `<span class="sp">${c.speed}×</span>` : "";
      seg.innerHTML =
        `<span class="grip l"></span><span class="grip r"></span>` +
        `${sp}<span class="n">${escapeHtml(nameOf(c, i))}</span><span class="d">${fmt(e * 1000)}</span>`;
      // zoom keyframe markers (positioned by source time → timeline-local px)
      if (c.zoom && c.zoom.length) {
        for (const k of c.zoom) {
          if (k.t < inOf(c) - 0.001 || k.t > outOf(c) + 0.001) continue;
          const dot = document.createElement("div");
          dot.className = "kf";
          dot.style.left = ((k.t - inOf(c)) / (c.speed || 1)) * pxPerSec + "px";
          dot.title = `Zoom ${(+k.scale).toFixed(1)}×`;
          seg.appendChild(dot);
        }
      }
      videoTrackEl.appendChild(seg);
      acc += e;
    });

    renderWaveform();
    updatePlayheadUI();
    renderControls();
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (ch) =>
      ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : "&quot;",
    );
  }
  function segElByIndex(i) {
    return videoTrackEl.querySelector('.seg[data-i="' + i + '"]');
  }

  function renderControls() {
    const has = sel >= 0 && sel < clips.length;
    speedBtn.disabled = !has;
    splitBtn.disabled = clips.length === 0;
    trimInBtn.disabled = clips.length === 0;
    trimOutBtn.disabled = clips.length === 0;
    removeBtn.disabled = !has;
    hushBtn.disabled = !clips.some((c) => c.audioPath);
    exportBtn.disabled = busy || clips.length === 0;
    playBtn.disabled = clips.length === 0;
    homeBtn.disabled = clips.length === 0;
    endBtn.disabled = clips.length === 0;
    zoomKfBtn.disabled = clips.length === 0;
    resetZoomBtn.disabled = clips.length === 0;
    const az = curSegIdx >= 0 ? clips[curSegIdx] : null;
    clearZoomBtn.disabled = !(az && az.zoom && az.zoom.length);
    speedBtn.textContent = has ? `Speed ${clips[sel].speed || 1}×` : "Speed 1×";
    refreshUndoButtons();
  }

  // ── playhead (cheap, called every rAF frame) ──
  function updatePlayheadUI() {
    const x = playT * pxPerSec;
    playheadEl.style.left = x + "px";
    playheadHitEl.style.left = x + "px";
    timecodeEl.innerHTML = `${fmtTC(playT)} <span class="tot">/ ${fmtTC(totalSec())}</span>`;
    followPlayhead(x);
  }
  function followPlayhead(x) {
    const pad = 40;
    const left = tlScrollEl.scrollLeft;
    const right = left + tlScrollEl.clientWidth;
    if (x < left + pad) tlScrollEl.scrollLeft = Math.max(0, x - pad);
    else if (x > right - pad) tlScrollEl.scrollLeft = x - tlScrollEl.clientWidth + pad;
  }

  // ── video source management (double-buffered; canvas is the visible composite) ──
  function showVideo() {
    canvasEl.style.display = "block";
    noClipEl.style.display = "none";
  }
  function hideVideos() {
    videoEl.pause();
    altEl.pause();
    videoEl.removeAttribute("src");
    altEl.removeAttribute("src");
    videoEl._path = null;
    altEl._path = null;
    curPath = null;
    canvasEl.style.display = "none";
    noClipEl.style.display = "block";
    previewCtx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  }

  // ── canvas compositor (preview AND export share this one render path) ──
  function setupCanvas() {
    const even = (n) => Math.max(2, Math.floor(n / 2) * 2);
    projW = even(Math.max(1280, ...clips.map((c) => c.w || 0)));
    projH = even(Math.max(720, ...clips.map((c) => c.h || 0)));
    canvasEl.width = projW;
    canvasEl.height = projH;
  }
  const lerp = (a, b, f) => a + (b - a) * f;
  const easeInOut = (f) => (f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2);
  // Interpolate a clip's zoom keyframes (sorted by source-time t) at source time `t`.
  function interpZoom(kfs, t) {
    if (!kfs || !kfs.length) return { scale: 1, x: 0.5, y: 0.5 };
    if (t <= kfs[0].t) return kfs[0];
    const last = kfs[kfs.length - 1];
    if (t >= last.t) return last;
    for (let i = 0; i < kfs.length - 1; i++) {
      const a = kfs[i];
      const b = kfs[i + 1];
      if (t >= a.t && t <= b.t) {
        const f = easeInOut((t - a.t) / (b.t - a.t || 1));
        return { scale: lerp(a.scale, b.scale, f), x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f) };
      }
    }
    return last;
  }
  function currentZoom() {
    const c = clips[curSegIdx];
    if (!c || !c.zoom || !c.zoom.length) return { scale: 1, x: 0.5, y: 0.5 };
    return interpZoom(c.zoom, videoEl.currentTime);
  }
  // Linear interpolation of a wall-clock-timestamped {t,x,y} track at time `wall`.
  function lerpXY(arr, wall) {
    if (!arr || !arr.length) return null;
    if (wall <= arr[0].t) return { x: arr[0].x, y: arr[0].y };
    const last = arr[arr.length - 1];
    if (wall >= last.t) return { x: last.x, y: last.y };
    let lo = 0;
    let hi = arr.length - 1;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid].t <= wall) lo = mid;
      else hi = mid;
    }
    const a = arr[lo];
    const b = arr[lo + 1];
    const p = (wall - a.t) / (b.t - a.t || 1);
    return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p };
  }
  // The cursor's normalised position within the recorded frame at video source time `ts`.
  // Both the pointer and cam tracks are interpolated to the SAME wall time (video time
  // mapped via t0), so IPC jitter cancels — the spotlight tracks the baked-in cursor 1:1.
  // spot.offsetMs is a hardware-sync trim only (should be ~0 with this approach).
  function cursorAt(clip, ts) {
    const cur = clip && clip.cur;
    if (!cur || !cur.box || !cur.ptr || !cur.ptr.length || !cur.cam || !cur.cam.length) return null;
    const wall = cur.t0 + ts * 1000 + spot.offsetMs;
    const p = lerpXY(cur.ptr, wall);
    const c = lerpXY(cur.cam, wall);
    if (!p || !c) return null;
    return {
      nx: (p.x - c.x + cur.box.w / 2) / cur.box.w,
      ny: (p.y - c.y + cur.box.h / 2) / cur.box.h,
    };
  }
  // Draw `srcVideo`'s current frame onto `ctx` (size cw×ch) with a zoom/pan transform,
  // then (if `cursor` given) a smooth HD cursor on top, positioned THROUGH the same
  // transform but drawn at constant size. The single composite step shared by the
  // preview render loop AND the WYSIWYG export — guaranteeing they match.
  function composite(ctx, cw, ch, srcVideo, zoom, cursor) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, cw, ch);
    if (!srcVideo || !srcVideo.videoWidth || srcVideo.readyState < 2) return;
    const vw = srcVideo.videoWidth;
    const vh = srcVideo.videoHeight;
    const fit = Math.min(cw / vw, ch / vh);
    const fw = vw * fit;
    const fh = vh * fit;
    const z = zoom || { scale: 1, x: 0.5, y: 0.5 };
    ctx.save();
    ctx.translate(cw / 2, ch / 2);
    ctx.scale(z.scale, z.scale);
    ctx.translate(-z.x * fw, -z.y * fh);
    ctx.drawImage(srcVideo, 0, 0, fw, fh);
    ctx.restore();
    if (cursor) {
      // Spotlight: keep the real cursor, dim the surroundings, and clear a soft circle
      // around the pointer so the eye goes to the action. (cursor:"never" can't hide the
      // OS cursor on Windows, so we emphasise it rather than replace it.) Position is
      // mapped through the same zoom transform; radius is constant screen px.
      const sx = cw / 2 + z.scale * (cursor.nx - z.x) * fw;
      const sy = ch / 2 + z.scale * (cursor.ny - z.y) * fh;
      const inner = ((spot.diam / 100) * ch) / 2; // clear radius
      const outer = inner + (spot.soft / 100) * ch; // fade-out radius
      const g = ctx.createRadialGradient(sx, sy, inner, sx, sy, Math.max(inner + 1, outer));
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, `rgba(0,0,0,${spot.dim})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cw, ch);
    }
  }
  function drawFrame() {
    if (canvasEl.style.display === "none") return;
    const c = clips[curSegIdx];
    const cur = showCursor && c ? cursorAt(c, videoEl.currentTime) : null;
    composite(previewCtx, canvasEl.width, canvasEl.height, videoEl, currentZoom(), cur);
  }
  function renderLoop() {
    drawFrame();
    requestAnimationFrame(renderLoop);
  }

  // ── narration audio (per-clip mic), synced to the playhead during normal playback ──
  function pauseNarration() {
    if (!narrationEl.paused) narrationEl.pause();
  }
  function narrationSync() {
    const c = clips[curSegIdx];
    // Only during forward 1× playback — scrubbing/shuttle/reverse stay silent.
    if (!playing || fwdMul !== 1 || !c || !c.audioPath) {
      pauseNarration();
      return;
    }
    if (narrationPath !== c.audioPath) {
      narrationPath = c.audioPath;
      narrationEl.src = fileUrl(c.audioPath);
    }
    // audio time = video source time + how far the mic led video frame 0
    const want = videoEl.currentTime + (c.audioOffsetMs || 0) / 1000;
    narrationEl.playbackRate = c.speed || 1;
    if (Math.abs(narrationEl.currentTime - want) > 0.12) {
      try {
        narrationEl.currentTime = Math.max(0, want);
      } catch (e) {
        /* not ready yet */
      }
    }
    if (narrationEl.paused) narrationEl.play().catch(() => {});
  }

  // ── audio waveform on the Audio track ──
  let audioCtx = null;
  // Decode each clip's narration to amplitude peaks (over the full audio), once.
  async function decodeAllAudio() {
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        return;
      }
    }
    let any = false;
    for (const c of clips) {
      if (!c.audioPath || c._peaks || c._peaksFailed) continue;
      try {
        const resp = await fetch(fileUrl(c.audioPath));
        const buf = await resp.arrayBuffer();
        const audio = await audioCtx.decodeAudioData(buf);
        c._audioDur = audio.duration;
        c._peaks = computePeaks(audio.getChannelData(0), 2000);
        any = true;
      } catch (e) {
        c._peaksFailed = true;
        if (window.otd.log) window.otd.log("waveform decode failed: " + (e && e.message));
      }
    }
    if (any) renderWaveform();
  }
  function computePeaks(data, buckets) {
    const block = Math.max(1, Math.floor(data.length / buckets));
    const peaks = new Float32Array(buckets);
    for (let i = 0; i < buckets; i++) {
      let max = 0;
      const start = i * block;
      const end = Math.min(data.length, start + block);
      for (let j = start; j < end; j++) {
        const v = data[j] < 0 ? -data[j] : data[j];
        if (v > max) max = v;
      }
      peaks[i] = max;
    }
    return peaks;
  }
  // Draw each clip's waveform slice across its timeline placement (honouring trim+speed).
  function renderWaveform() {
    const innerW = tlInnerEl.clientWidth || 0;
    const h = audioWaveEl.clientHeight || 46;
    if (audioWaveEl.width !== innerW) audioWaveEl.width = innerW;
    if (audioWaveEl.height !== h) audioWaveEl.height = h;
    const ctx = audioWaveCtx;
    ctx.clearRect(0, 0, audioWaveEl.width, h);
    const mid = h / 2;
    let acc = 0;
    for (const c of clips) {
      const e = effSec(c);
      const x0 = acc * pxPerSec;
      const w = e * pxPerSec;
      acc += e;
      if (!c._peaks || !c._audioDur) continue;
      const off = (c.audioOffsetMs || 0) / 1000;
      const aStart = inOf(c) + off; // audio time at the clip's left edge
      const aEnd = outOf(c) + off; // audio time at the clip's right edge
      const buckets = c._peaks.length;
      ctx.fillStyle = "rgba(200,150,62,0.55)";
      const cols = Math.max(1, Math.floor(w));
      for (let px = 0; px < cols; px++) {
        const at = aStart + ((aEnd - aStart) * px) / cols; // audio time at this column
        const bi = Math.max(0, Math.min(buckets - 1, Math.floor((at / c._audioDur) * buckets)));
        const amp = c._peaks[bi];
        const barH = Math.max(0.5, amp * (h - 4));
        ctx.fillRect(x0 + px, mid - barH / 2, 1, barH);
      }
    }
  }

  // ── zoom keyframes (drag a focus box on the canvas → keyframe at the playhead) ──
  let armingZoom = false;
  function armZoom() {
    if (sel < 0) return;
    armingZoom = true;
    canvasEl.classList.add("zoomable");
    setStatus("Drag a box on the preview around what to zoom into.", "ok");
  }
  function disarmZoom() {
    armingZoom = false;
    zoomDrag = null;
    canvasEl.classList.remove("zoomable");
    zoomBoxEl.style.display = "none";
  }
  // client point → focus normalized over the FITTED image (the z.x/z.y domain).
  function clientToImageNorm(clientX, clientY) {
    const r = canvasEl.getBoundingClientRect();
    const cw = canvasEl.width;
    const ch = canvasEl.height;
    const vw = videoEl.videoWidth || cw;
    const vh = videoEl.videoHeight || ch;
    const fit = Math.min(cw / vw, ch / vh);
    const fw = vw * fit;
    const fh = vh * fit;
    const px = ((clientX - r.left) / r.width) * cw;
    const py = ((clientY - r.top) / r.height) * ch;
    return {
      x: Math.max(0, Math.min(1, (px - (cw - fw) / 2) / fw)),
      y: Math.max(0, Math.min(1, (py - (ch - fh) / 2) / fh)),
    };
  }
  canvasEl.addEventListener("pointerdown", (e) => {
    if (!armingZoom || sel < 0) return;
    canvasEl.setPointerCapture(e.pointerId);
    zoomDrag = { x0: e.clientX, y0: e.clientY };
  });
  canvasEl.addEventListener("pointermove", (e) => {
    if (!zoomDrag) return;
    const pr = $("preview").getBoundingClientRect();
    const left = Math.min(zoomDrag.x0, e.clientX) - pr.left;
    const top = Math.min(zoomDrag.y0, e.clientY) - pr.top;
    zoomBoxEl.style.left = left + "px";
    zoomBoxEl.style.top = top + "px";
    zoomBoxEl.style.width = Math.abs(e.clientX - zoomDrag.x0) + "px";
    zoomBoxEl.style.height = Math.abs(e.clientY - zoomDrag.y0) + "px";
    zoomBoxEl.style.display = "block";
  });
  canvasEl.addEventListener("pointerup", (e) => {
    if (!zoomDrag) return;
    const a = clientToImageNorm(zoomDrag.x0, zoomDrag.y0);
    const b = clientToImageNorm(e.clientX, e.clientY);
    const bw = Math.abs(b.x - a.x);
    const bh = Math.abs(b.y - a.y);
    disarmZoom();
    if (bw < 0.02 && bh < 0.02) {
      setStatus("Zoom cancelled (drag a box next time).", "");
      return;
    }
    const scale = Math.max(1, Math.min(MAX_ZOOM, 1 / Math.max(bw, bh, 0.02)));
    addZoomKeyframe(scale, (a.x + b.x) / 2, (a.y + b.y) / 2);
  });
  // Add/replace a zoom keyframe at the playhead's source time on the active clip.
  function addZoomKeyframe(scale, x, y) {
    if (curSegIdx < 0) return;
    const c = clips[curSegIdx];
    pushUndo();
    if (!c.zoom) c.zoom = [];
    const t = videoEl.currentTime;
    const i = c.zoom.findIndex((k) => Math.abs(k.t - t) < 0.03);
    const kf = { t, scale, x, y };
    if (i >= 0) c.zoom[i] = kf;
    else {
      c.zoom.push(kf);
      c.zoom.sort((p, q) => p.t - q.t);
    }
    setSel(curSegIdx);
    setStatus(`Zoom ${scale.toFixed(1)}× keyframe @ ${fmtTC(playT)}.`, "ok");
  }
  function resetZoomAtPlayhead() {
    if (curSegIdx < 0) return;
    addZoomKeyframe(1, 0.5, 0.5);
  }
  function clearZooms() {
    if (curSegIdx < 0) return;
    const c = clips[curSegIdx];
    if (!c.zoom || !c.zoom.length) return;
    pushUndo();
    c.zoom = [];
    setSel(curSegIdx);
    setStatus("Cleared zoom keyframes on this clip.", "ok");
  }
  function applyRate() {
    const c = clips[curSegIdx];
    if (c) videoEl.playbackRate = (c.speed || 1) * fwdMul;
  }
  // Load clip `path` seeked to `srcTime` into a SPECIFIC element (active or standby).
  // The seek is applied on the element's own loadedmetadata when the file changes.
  function loadElement(el, path, srcTime, play) {
    el._pendingSeek = { srcTime, play };
    if (el._path !== path) {
      el._path = path;
      el.src = fileUrl(path);
    } else {
      applyElementSeek(el);
    }
  }
  function applyElementSeek(el) {
    const ps = el._pendingSeek;
    if (!ps) return;
    el._pendingSeek = null;
    try {
      el.currentTime = Math.max(0, ps.srcTime);
    } catch (e) {
      /* not ready — its loadedmetadata will retry */
    }
    if (ps.play) el.play().catch(() => {});
  }
  // Load a segment into the ACTIVE element (used by seek/scrub and play-start).
  function loadSegment(i, srcTime, resumePlay) {
    const c = clips[i];
    if (!c) return;
    curSegIdx = i;
    curPath = c.path;
    videoEl.playbackRate = (c.speed || 1) * fwdMul;
    showVideo();
    loadElement(videoEl, c.path, srcTime, resumePlay);
  }
  // Warm the standby element with the next clip's first frame (only when the next clip
  // is a DIFFERENT file — same-file neighbours are handled by a plain seek, no flash).
  function preloadNext() {
    const next = curSegIdx + 1;
    const cur = clips[curSegIdx];
    const nx = clips[next];
    if (!cur || !nx || nx.path === cur.path) return;
    if (altEl._path === nx.path) {
      altEl._pendingSeek = { srcTime: inOf(nx), play: false };
      applyElementSeek(altEl);
      return;
    }
    altEl.pause();
    altEl.style.opacity = "0";
    loadElement(altEl, nx.path, inOf(nx), false);
  }
  // Advance playback to the next segment at a cut.
  function advanceToNext() {
    const next = curSegIdx + 1;
    const cur = clips[curSegIdx];
    const nx = clips[next];
    playT = startOf(next);
    if (nx.path === cur.path) {
      // same source file → seamless seek on the active element, no swap, no flash
      curSegIdx = next;
      curPath = nx.path;
      videoEl.playbackRate = (nx.speed || 1) * fwdMul;
      loadElement(videoEl, nx.path, inOf(nx), true);
    } else if (altEl._path === nx.path && altEl.readyState >= 2) {
      // standby already shows this clip's first frame → hard-swap (no flash)
      swapToAlt(next);
    } else {
      // standby wasn't ready in time (rare) → direct load; may flash briefly
      curSegIdx = next;
      curPath = nx.path;
      videoEl.playbackRate = (nx.speed || 1) * fwdMul;
      loadElement(videoEl, nx.path, inOf(nx), true);
    }
    preloadNext();
  }
  function swapToAlt(idx) {
    const old = videoEl;
    old.pause();
    // promote the standby (already decoded to the next clip's first frame) to active;
    // the canvas compositor draws whichever element `videoEl` points at.
    videoEl = altEl;
    altEl = old;
    curSegIdx = idx;
    curPath = clips[idx].path;
    videoEl.playbackRate = (clips[idx].speed || 1) * fwdMul;
    try {
      videoEl.currentTime = inOf(clips[idx]);
    } catch (e) {}
    videoEl.play().catch(() => {});
  }
  // The seek is applied on each element's own loadedmetadata.
  $("video").addEventListener("loadedmetadata", () => applyElementSeek($("video")));
  $("video2").addEventListener("loadedmetadata", () => applyElementSeek($("video2")));
  // Seek the master playhead to timeline time T (paused unless resumePlay).
  function seekTo(T, resumePlay) {
    T = Math.max(0, Math.min(totalSec(), T));
    playT = T;
    const a = activeAt(T);
    if (a.i < 0) {
      updatePlayheadUI();
      return;
    }
    loadSegment(a.i, a.srcTime, !!resumePlay);
    updatePlayheadUI();
  }

  // ── transport / shuttle ──
  function startPlayback() {
    if (!clips.length) return;
    if (playT >= totalSec() - 0.001) playT = 0;
    playing = true;
    playBtn.textContent = "⏸";
    const a = activeAt(playT);
    if (a.i === curSegIdx && videoEl.readyState >= 2) {
      applyRate();
      videoEl.play().catch(() => {});
    } else {
      loadSegment(a.i, a.srcTime, true);
    }
    preloadNext(); // warm the standby with the next clip so the cut doesn't flash
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);
  }
  function pausePlayback() {
    playing = false;
    playBtn.textContent = "▶";
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    videoEl.pause();
    pauseNarration();
  }
  function stopReverse() {
    if (revRaf) cancelAnimationFrame(revRaf);
    revRaf = null;
    revMul = 1;
    revLast = 0;
  }
  function stopAll() {
    stopReverse();
    pausePlayback();
    fwdMul = 1;
  }
  function togglePlay() {
    if (playing || revRaf) stopAll();
    else {
      fwdMul = 1;
      startPlayback();
    }
  }
  function shuttleForward() {
    stopReverse();
    if (!playing) {
      fwdMul = 1;
      startPlayback();
    } else {
      fwdMul = fwdMul >= 4 ? 4 : fwdMul === 1 ? 2 : 4;
      applyRate();
    }
    playBtn.textContent = "⏸";
  }
  function shuttleReverse() {
    if (playing) pausePlayback();
    revMul = revRaf ? Math.min(2, revMul + 1) : 1;
    if (revRaf) cancelAnimationFrame(revRaf);
    playBtn.textContent = "◀";
    revLast = 0;
    const step = (ts) => {
      if (!revLast) revLast = ts;
      const dt = (ts - revLast) / 1000;
      revLast = ts;
      playT = Math.max(0, playT - dt * revMul);
      seekTo(playT, false);
      if (playT <= 0) {
        stopReverse();
        playBtn.textContent = "▶";
        return;
      }
      revRaf = requestAnimationFrame(step);
    };
    revRaf = requestAnimationFrame(step);
  }
  function frameStep(frames) {
    stopAll();
    seekTo(playT + frames / FPS, false);
  }

  // Drive the master playhead from the playing <video>; switch segments at boundaries.
  function tick() {
    if (!playing) return;
    let c = clips[curSegIdx];
    if (!c) {
      pausePlayback();
      return;
    }
    // The real end of this segment is min(trim-out, the clip's actual decodable
    // duration). durMs (→ default outSec) can run slightly past videoEl.duration, in
    // which case currentTime can never reach outSec and the <video> just ends — so we
    // also treat `ended` as the boundary, otherwise playback stalls before the cut and
    // never advances to the next clip.
    const segEnd = isFinite(videoEl.duration) ? Math.min(outOf(c), videoEl.duration) : outOf(c);
    if (videoEl.ended || videoEl.currentTime >= segEnd - 0.012) {
      if (curSegIdx < clips.length - 1) {
        advanceToNext();
      } else if (loopPlay && clips.length) {
        // restart from the top without stopping — live spotlight-timing tuning
        playT = 0;
        const a0 = activeAt(0);
        loadSegment(a0.i, a0.srcTime, true);
        updatePlayheadUI();
        rafId = requestAnimationFrame(tick);
        return;
      } else {
        playT = totalSec();
        pausePlayback();
        updatePlayheadUI();
        return;
      }
    } else {
      const local = (videoEl.currentTime - inOf(c)) / (c.speed || 1);
      playT = startOf(curSegIdx) + Math.max(0, local);
    }
    narrationSync();
    updatePlayheadUI();
    rafId = requestAnimationFrame(tick);
  }

  // ── timeline pointer interaction ──
  function tlTimeFromClientX(clientX) {
    const r = tlInnerEl.getBoundingClientRect();
    return Math.max(0, (clientX - r.left) / pxPerSec);
  }
  function tlPxFromClientX(clientX) {
    const r = tlInnerEl.getBoundingClientRect();
    return Math.max(0, clientX - r.left);
  }

  // master playhead drag
  playheadHitEl.addEventListener("pointerdown", (e) => {
    scrubbing = true;
    stopAll();
    playheadHitEl.setPointerCapture(e.pointerId);
    e.stopPropagation();
  });
  playheadHitEl.addEventListener("pointermove", (e) => {
    if (!scrubbing) return;
    seekTo(tlTimeFromClientX(e.clientX), false);
  });
  playheadHitEl.addEventListener("pointerup", (e) => {
    scrubbing = false;
    try {
      playheadHitEl.releasePointerCapture(e.pointerId);
    } catch (_) {}
  });

  // segment grab (edge = trim, body = reorder) or empty-track scrub
  tlInnerEl.addEventListener("pointerdown", (e) => {
    if (e.target === playheadHitEl || renaming) return;
    if (e.target.tagName === "INPUT") return;
    stopAll();
    // Capture lazily on the first real drag move (see pointermove), not here — capturing
    // on the parent would retarget the click to tlInner and muddy click-vs-drag.
    const segEl = e.target.closest && e.target.closest(".seg");
    if (segEl) {
      const i = +segEl.dataset.i;
      const r = segEl.getBoundingClientRect();
      highlightSel(i); // lightweight select; no node recreation
      const cls = e.target.classList;
      const onGripL = cls && cls.contains("grip") && cls.contains("l");
      const onGripR = cls && cls.contains("grip") && cls.contains("r");
      let edge;
      if (onGripL) edge = "left";
      else if (onGripR) edge = "right";
      else if (e.clientX - r.left < EDGE) edge = "left";
      else if (r.right - e.clientX < EDGE) edge = "right";
      else edge = "body";
      segAction = {
        type: edge === "body" ? "body" : "edge",
        i,
        edge,
        startClientX: e.clientX,
        moved: false,
        undoPushed: false,
        origIn: inOf(clips[i]),
        origOut: outOf(clips[i]),
        dropIndex: i,
      };
    } else {
      segAction = { type: "scrub" };
      const t = tlTimeFromClientX(e.clientX);
      const a = activeAt(t);
      if (a.i >= 0) highlightSel(a.i);
      seekTo(t, false);
    }
  });
  tlInnerEl.addEventListener("pointermove", (e) => {
    if (!segAction) {
      updateEdgeCursor(e);
      return;
    }
    if (!segAction.moved) {
      if (Math.abs(e.clientX - segAction.startClientX) < 3) return;
      segAction.moved = true;
      // now that it's a genuine drag, capture the pointer so moves keep flowing even
      // if the cursor leaves the timeline.
      try {
        tlInnerEl.setPointerCapture(e.pointerId);
      } catch (_) {}
    }
    if (segAction.type === "scrub") seekTo(tlTimeFromClientX(e.clientX), false);
    else if (segAction.type === "edge") dragEdge(e);
    else if (segAction.type === "body") dragReorder(e);
  });
  tlInnerEl.addEventListener("pointerup", (e) => {
    try {
      tlInnerEl.releasePointerCapture(e.pointerId);
    } catch (_) {}
    if (!segAction) return;
    if (segAction.type === "edge" && segAction.moved) {
      seekTo(startOf(segAction.i), false);
    } else if (segAction.type === "body" && segAction.moved) {
      finishReorder();
    } else if (segAction.type === "edge" || segAction.type === "body") {
      // a click, not a drag → seek to the clicked time
      seekTo(tlTimeFromClientX(segAction.startClientX), false);
    }
    segAction = null;
  });

  // Live edge-trim: timeline drag delta → source delta; snap right edge to playhead; reflow.
  function dragEdge(e) {
    const c = clips[segAction.i];
    if (!c) return;
    if (!segAction.undoPushed) {
      pushUndo();
      segAction.undoPushed = true;
    }
    const sp = c.speed || 1;
    const dxSrc = ((e.clientX - segAction.startClientX) / pxPerSec) * sp;
    if (segAction.edge === "left") {
      c.inSec = Math.max(0, Math.min(segAction.origIn + dxSrc, segAction.origOut - MIN_SRC));
    } else {
      let nOut = Math.min(durSec(c), Math.max(segAction.origOut + dxSrc, segAction.origIn + MIN_SRC));
      const edgeTime = startOf(segAction.i) + (nOut - inOf(c)) / sp;
      if (Math.abs(edgeTime - playT) * pxPerSec < SNAP_PX) {
        const snapped = inOf(c) + (playT - startOf(segAction.i)) * sp;
        if (snapped > segAction.origIn + MIN_SRC && snapped <= durSec(c)) nOut = snapped;
      }
      c.outSec = nOut;
    }
    renderTimeline();
  }

  // Live reorder with a floating ghost + a gold drop marker. The dragged clip's element
  // follows the cursor; the insertion index is computed from the OTHER clips' centers
  // (so you don't have to drag across the dragged clip's full width — the old bug).
  function dragReorder(e) {
    const seg = segElByIndex(segAction.i);
    if (seg) {
      seg.classList.add("dragging");
      const dx = e.clientX - segAction.startClientX;
      seg.style.transform = `translateX(${dx}px)`;
    }
    const pointerPx = tlPxFromClientX(e.clientX);
    let acc = 0;
    let ins = 0;
    for (let k = 0; k < clips.length; k++) {
      if (k === segAction.i) continue;
      const w = effSec(clips[k]) * pxPerSec;
      if (acc + w / 2 < pointerPx) ins++;
      else break;
      acc += w;
    }
    segAction.dropIndex = ins;
    // drop marker x = cumulative width of the first `ins` non-dragged clips
    let mx = 0;
    let cnt = 0;
    for (let k = 0; k < clips.length; k++) {
      if (k === segAction.i) continue;
      if (cnt === ins) break;
      mx += effSec(clips[k]) * pxPerSec;
      cnt++;
    }
    dropMarkerEl.style.left = mx + "px";
    dropMarkerEl.style.display = "block";
  }
  function finishReorder() {
    dropMarkerEl.style.display = "none";
    const from = segAction.i;
    const to = segAction.dropIndex;
    if (to === from) {
      renderTimeline();
      return;
    }
    pushUndo();
    const [moved] = clips.splice(from, 1);
    clips.splice(to, 0, moved);
    curSegIdx = -1;
    curPath = null;
    setSel(to);
    seekTo(startOf(to), false);
    setStatus(`Moved “${nameOf(moved, to)}” to position ${to + 1}.`, "ok");
  }

  function updateEdgeCursor(e) {
    const segEl = e.target.closest && e.target.closest(".seg");
    if (!segEl) return;
    const r = segEl.getBoundingClientRect();
    segEl.style.cursor =
      e.clientX - r.left < EDGE || r.right - e.clientX < EDGE ? "ew-resize" : "grab";
  }

  // ── rename (select a clip, press R) ──
  function beginRename(i) {
    if (i < 0 || i >= clips.length) return;
    const segEl = segElByIndex(i);
    const nameEl = segEl && segEl.querySelector(".n");
    if (!nameEl) return;
    renaming = true;
    const input = document.createElement("input");
    input.className = "rename";
    input.value = nameOf(clips[i], i);
    nameEl.replaceWith(input);
    input.focus();
    input.select();
    let done = false;
    const finish = (commit) => {
      if (done) return;
      done = true;
      renaming = false;
      if (commit) {
        const v = input.value.trim();
        if (v && v !== clips[i].name) {
          pushUndo();
          clips[i].name = v;
        }
      }
      renderTimeline();
    };
    input.addEventListener("pointerdown", (ev) => ev.stopPropagation());
    input.addEventListener("keydown", (ev) => {
      ev.stopPropagation();
      if (ev.key === "Enter") finish(true);
      else if (ev.key === "Escape") finish(false);
    });
    input.addEventListener("blur", () => finish(true));
  }

  // ── selection ──
  function selInfoText(i) {
    const c = clips[i];
    if (!c) return "—";
    const cur =
      c.cur && c.cur.ptr && c.cur.ptr.length ? `cursor ${c.cur.ptr.length}/${c.cur.cam.length}pts` : "NO cursor data";
    return `${nameOf(c, i)} · ${fmt(c.durMs)} src · ${c.speed || 1}× · ${fmt(effSec(c) * 1000)} on timeline · ${cur}`;
  }
  // Full structural re-render + select — use after any edit that changes clip count/sizes.
  function setSel(i) {
    sel = i;
    selInfoEl.textContent = selInfoText(i);
    renderTimeline();
  }
  // Lightweight select: toggle the highlight in place WITHOUT recreating nodes, so a
  // double-click (rename) isn't broken by the node being replaced between clicks.
  function highlightSel(i) {
    sel = i;
    selInfoEl.textContent = selInfoText(i);
    videoTrackEl.querySelectorAll(".seg").forEach((el) => {
      el.classList.toggle("sel", +el.dataset.i === i);
    });
    renderControls();
  }
  function selectClip(i) {
    setSel(i);
    seekTo(startOf(i), false);
  }

  // ── edit ops (each snapshots for undo) ──
  function splitAtPlayhead() {
    if (!clips.length) return;
    const a = activeAt(playT);
    if (a.i < 0) return;
    const c = clips[a.i];
    const t = a.srcTime;
    if (!(t > inOf(c) + MIN_SRC && t < outOf(c) - MIN_SRC)) {
      setStatus("Move the playhead inside a clip (away from the ends), then Split.", "err");
      return;
    }
    pushUndo();
    const left = cloneClip(c);
    left.inSec = inOf(c);
    left.outSec = t;
    const right = cloneClip(c);
    right.inSec = t;
    right.outSec = outOf(c);
    right.name = nameOf(c, a.i) + " (b)";
    if (left.zoom) left.zoom = left.zoom.filter((k) => k.t <= t);
    if (right.zoom) right.zoom = right.zoom.filter((k) => k.t >= t);
    clips.splice(a.i, 1, left, right);
    curSegIdx = -1;
    curPath = null;
    setSel(a.i);
    seekTo(playT, false);
    setStatus(`Split at ${fmtTC(playT)} — now 2 segments.`, "ok");
  }
  function rippleDelete() {
    if (sel < 0) return;
    pushUndo();
    const at = startOf(sel);
    clips.splice(sel, 1);
    curSegIdx = -1;
    curPath = null;
    if (clips.length === 0) {
      sel = -1;
      playT = 0;
      hideVideos();
      renderTimeline();
      return;
    }
    sel = Math.min(sel, clips.length - 1);
    setSel(sel);
    seekTo(Math.min(at, totalSec()), false);
  }
  // I / Q — trim the active clip's start up to the playhead.
  function trimStartToPlayhead() {
    if (!clips.length) return;
    const a = activeAt(playT);
    const c = clips[a.i];
    if (!c) return;
    const nIn = Math.min(a.srcTime, outOf(c) - MIN_SRC);
    if (nIn <= inOf(c) + 0.001) {
      setStatus("Playhead is at/before this clip’s start — nothing to trim.", "err");
      return;
    }
    pushUndo();
    c.inSec = Math.max(0, nIn);
    curSegIdx = -1;
    curPath = null;
    setSel(a.i);
    seekTo(startOf(a.i), false);
    setStatus("Trimmed start to the playhead.", "ok");
  }
  // O / W — trim the active clip's end back to the playhead.
  function trimEndToPlayhead() {
    if (!clips.length) return;
    const a = activeAt(playT);
    const c = clips[a.i];
    if (!c) return;
    const nOut = Math.max(a.srcTime, inOf(c) + MIN_SRC);
    if (nOut >= outOf(c) - 0.001) {
      setStatus("Playhead is at/after this clip’s end — nothing to trim.", "err");
      return;
    }
    pushUndo();
    c.outSec = nOut;
    curSegIdx = -1;
    curPath = null;
    const keepT = startOf(a.i) + effSec(c);
    setSel(a.i);
    seekTo(keepT, false);
    setStatus("Trimmed end to the playhead.", "ok");
  }
  function cycleSpeed() {
    if (sel < 0) return;
    pushUndo();
    const cur = clips[sel].speed || 1;
    clips[sel].speed = SPEEDS[(SPEEDS.indexOf(cur) + 1) % SPEEDS.length];
    selectClip(sel);
  }

  // A sub-range of a clip's source (keeps the shared audio/cursor/zoom telemetry).
  function subClip(c, inS, outS) {
    const n = cloneClip(c);
    n.inSec = inS;
    n.outSec = outS;
    n._explicitOut = true;
    return n;
  }
  // Cut dead-air: for each clip, find runs of near-silence (> MIN_GAP) in its narration
  // peaks and drop them, keeping a little padding around speech.
  function removeSilences() {
    const THRESH = 0.03; // peak amplitude (0..1) below this = silent
    const MIN_GAP = 1.2; // seconds of continuous silence to cut
    const PAD = 0.15; // keep this much speech around each gap
    if (!clips.some((c) => c._peaks)) {
      setStatus("Waveforms still decoding (or no narration) — try again in a moment.", "");
      return;
    }
    let cutSec = 0;
    const next = [];
    for (const c of clips) {
      if (!c._peaks || !c._audioDur) {
        next.push(c);
        continue;
      }
      const off = (c.audioOffsetMs || 0) / 1000;
      const buckets = c._peaks.length;
      const step = c._audioDur / buckets;
      const aStart = inOf(c) + off;
      const aEnd = outOf(c) + off;
      const gaps = [];
      let runStart = null;
      for (let at = aStart; at <= aEnd; at += step) {
        const bi = Math.max(0, Math.min(buckets - 1, Math.floor((at / c._audioDur) * buckets)));
        const silent = c._peaks[bi] < THRESH;
        if (silent && runStart === null) runStart = at;
        else if (!silent && runStart !== null) {
          if (at - runStart >= MIN_GAP) gaps.push([runStart, at]);
          runStart = null;
        }
      }
      if (runStart !== null && aEnd - runStart >= MIN_GAP) gaps.push([runStart, aEnd]);
      if (!gaps.length) {
        next.push(c);
        continue;
      }
      // keep the complement of the (padded) gaps, in source time
      let cursor = inOf(c);
      for (const [gs, ge] of gaps) {
        const gapStart = Math.max(inOf(c), gs - off + PAD);
        const gapEnd = Math.min(outOf(c), ge - off - PAD);
        if (gapEnd - gapStart <= 0.1) continue;
        if (gapStart - cursor > 0.1) next.push(subClip(c, cursor, gapStart));
        cursor = gapEnd;
        cutSec += gapEnd - gapStart;
      }
      if (outOf(c) - cursor > 0.1) next.push(subClip(c, cursor, outOf(c)));
    }
    if (cutSec < 0.05 || !next.length) {
      setStatus("No dead air over the threshold found.", "");
      return;
    }
    pushUndo();
    clips = next;
    curSegIdx = -1;
    curPath = null;
    sel = clips.length ? Math.min(Math.max(0, sel), clips.length - 1) : -1;
    renderTimeline();
    if (sel >= 0) selectClip(sel);
    setStatus(`Trimmed ~${cutSec.toFixed(1)}s of dead air → ${clips.length} segments.`, "ok");
  }

  // ── zoom ──
  // Keep the playhead in view (used by the +/- buttons).
  function zoomBy(factor) {
    pxPerSec = Math.max(PX_MIN, Math.min(PX_MAX, pxPerSec * factor));
    renderTimeline();
    followPlayhead(playT * pxPerSec);
  }
  // Zoom centered on a viewport X (keeps the time under the cursor under the cursor).
  function zoomAt(clientX, factor) {
    const next = Math.max(PX_MIN, Math.min(PX_MAX, pxPerSec * factor));
    if (next === pxPerSec) return;
    const sr = tlScrollEl.getBoundingClientRect();
    const cursorOffset = clientX - sr.left;
    const timeUnder = (tlScrollEl.scrollLeft + cursorOffset) / pxPerSec;
    pxPerSec = next;
    renderTimeline();
    tlScrollEl.scrollLeft = Math.max(0, timeUnder * pxPerSec - cursorOffset);
  }
  // Wheel over the timeline zooms (cursor-centered). Shift+wheel scrolls horizontally.
  // preventDefault stops Electron's page-zoom from eating Ctrl+wheel.
  tlScrollEl.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      if (e.shiftKey) {
        tlScrollEl.scrollLeft += e.deltaY || e.deltaX;
        return;
      }
      zoomAt(e.clientX, e.deltaY < 0 ? 1.15 : 1 / 1.15);
    },
    { passive: false },
  );

  // ── wiring ──
  undoBtn.addEventListener("click", undo);
  redoBtn.addEventListener("click", redo);
  speedBtn.addEventListener("click", cycleSpeed);
  splitBtn.addEventListener("click", splitAtPlayhead);
  trimInBtn.addEventListener("click", trimStartToPlayhead);
  trimOutBtn.addEventListener("click", trimEndToPlayhead);
  removeBtn.addEventListener("click", rippleDelete);
  hushBtn.addEventListener("click", removeSilences);
  zoomKfBtn.addEventListener("click", armZoom);
  resetZoomBtn.addEventListener("click", resetZoomAtPlayhead);
  clearZoomBtn.addEventListener("click", clearZooms);
  function toggleCursor() {
    showCursor = !showCursor;
    cursorBtn.textContent = `◐ Spotlight: ${showCursor ? "on" : "off"}`;
  }
  cursorBtn.addEventListener("click", toggleCursor);
  // Spotlight settings popover
  spotCfgBtn.addEventListener("click", () => spotPanel.classList.toggle("hidden"));
  function bindSpot(id, key, fmt) {
    const input = $(id);
    const out = $(id + "V");
    const apply = () => {
      const v = +input.value;
      spot[key] = key === "dim" ? v / 100 : v;
      out.textContent = fmt(v);
    };
    input.addEventListener("input", apply);
    apply();
  }
  bindSpot("spotDim", "dim", (v) => `${v}%`);
  bindSpot("spotDiam", "diam", (v) => `${v}%`);
  bindSpot("spotSoft", "soft", (v) => `${v}%`);
  // Timing is an EXPONENTIAL control: slider position ∈ [-1000,1000] → ±SPOT_MAX_MS, so
  // there's fine resolution near 0 and a large reach at the extremes.
  const SPOT_MAX_MS = 5000;
  const SPOT_EXP = 2.4;
  const sliderToMs = (pos) =>
    Math.round(Math.sign(pos) * Math.pow(Math.abs(pos) / 1000, SPOT_EXP) * SPOT_MAX_MS);
  const msToSlider = (ms) =>
    Math.round(Math.sign(ms) * Math.pow(Math.min(1, Math.abs(ms) / SPOT_MAX_MS), 1 / SPOT_EXP) * 1000);
  function setTimingMs(ms, syncSlider) {
    spot.offsetMs = Math.max(-SPOT_MAX_MS, Math.min(SPOT_MAX_MS, Math.round(ms)));
    const out = $("spotTimeV");
    if (out) out.textContent = `${spot.offsetMs}ms`;
    if (syncSlider) {
      const inp = $("spotTime");
      if (inp) inp.value = String(msToSlider(spot.offsetMs));
    }
  }
  $("spotTime").addEventListener("input", (e) => setTimingMs(sliderToMs(+e.target.value), false));
  // Live spotlight-timing nudge ( [ / ] ) — fine ms steps, dialled in during looped playback.
  function nudgeTiming(d) {
    setTimingMs(spot.offsetMs + d, true);
    if (!showCursor) toggleCursor(); // make sure the spotlight is visible while tuning
    setStatus(`Spotlight timing ${spot.offsetMs >= 0 ? "+" : ""}${spot.offsetMs}ms`, "ok");
  }
  function toggleLoop() {
    loopPlay = !loopPlay;
    loopBtn.style.color = loopPlay ? "var(--gold)" : "";
    setStatus(loopPlay ? "Loop on" : "Loop off", "");
  }
  loopBtn.addEventListener("click", toggleLoop);
  playBtn.addEventListener("click", togglePlay);
  homeBtn.addEventListener("click", () => {
    stopAll();
    seekTo(0, false);
  });
  endBtn.addEventListener("click", () => {
    stopAll();
    seekTo(totalSec(), false);
  });
  zoomInBtn.addEventListener("click", () => zoomBy(1.25));
  zoomOutBtn.addEventListener("click", () => zoomBy(1 / 1.25));
  cancelBtn.addEventListener("click", () => window.otd.closeEditor());

  // ── keyboard shortcuts (Premiere / Resolve conventions) ──
  document.addEventListener("keydown", (e) => {
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || renaming) return;
    const k = e.key;
    // Ctrl/Cmd combos first.
    if (e.ctrlKey || e.metaKey) {
      if (k === "z" || k === "Z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (k === "y" || k === "Y") {
        e.preventDefault();
        redo();
      } else if (k === "k" || k === "K") {
        e.preventDefault();
        splitAtPlayhead();
      }
      return;
    }
    if (e.altKey) return;
    switch (k) {
      case " ":
        e.preventDefault();
        togglePlay();
        break;
      case "j":
      case "J":
        e.preventDefault();
        shuttleReverse();
        break;
      case "k":
      case "K":
        e.preventDefault();
        stopAll();
        playBtn.textContent = "▶";
        break;
      case "l":
      case "L":
        e.preventDefault();
        shuttleForward();
        break;
      case "ArrowLeft":
        e.preventDefault();
        frameStep(e.shiftKey ? -10 : -1);
        break;
      case "ArrowRight":
        e.preventDefault();
        frameStep(e.shiftKey ? 10 : 1);
        break;
      case "s":
      case "S":
        e.preventDefault();
        splitAtPlayhead();
        break;
      case "i":
      case "I":
      case "q":
      case "Q":
        e.preventDefault();
        trimStartToPlayhead();
        break;
      case "o":
      case "O":
      case "w":
      case "W":
        e.preventDefault();
        trimEndToPlayhead();
        break;
      case "r":
      case "R":
        e.preventDefault();
        if (sel >= 0) beginRename(sel);
        break;
      case "z":
      case "Z":
        e.preventDefault();
        resetZoomAtPlayhead();
        break;
      case "c":
      case "C":
        e.preventDefault();
        toggleCursor();
        break;
      case "[":
        e.preventDefault();
        nudgeTiming(e.shiftKey ? -25 : -5);
        break;
      case "]":
        e.preventDefault();
        nudgeTiming(e.shiftKey ? 25 : 5);
        break;
      case "Escape":
        if (armingZoom) {
          e.preventDefault();
          disarmZoom();
          setStatus("", "");
        }
        break;
      case "Delete":
      case "Backspace":
        e.preventDefault();
        rippleDelete();
        break;
      case "Home":
        e.preventDefault();
        stopAll();
        seekTo(0, false);
        break;
      case "End":
        e.preventDefault();
        stopAll();
        seekTo(totalSec(), false);
        break;
      case "+":
      case "=":
        e.preventDefault();
        zoomBy(1.25);
        break;
      case "-":
      case "_":
        e.preventDefault();
        zoomBy(1 / 1.25);
        break;
      default:
        break;
    }
  });

  // ── export (Phase 1: unchanged ffmpeg stitch) ──
  // ── WYSIWYG export (the same compositor, stepped at CFR into a WebCodecs encoder) ──
  function loadExportSource(path) {
    return new Promise((resolve, reject) => {
      const el = exportVideoEl;
      const ok = () => {
        cleanup();
        resolve();
      };
      const bad = () => {
        cleanup();
        reject(new Error("could not load " + path));
      };
      const cleanup = () => {
        el.removeEventListener("loadeddata", ok);
        el.removeEventListener("error", bad);
      };
      el.addEventListener("loadeddata", ok);
      el.addEventListener("error", bad);
      el.src = fileUrl(path);
    });
  }
  function seekExport(t) {
    return new Promise((resolve) => {
      const el = exportVideoEl;
      t = Math.max(0, t);
      if (Math.abs(el.currentTime - t) < 1e-3 && el.readyState >= 2) return resolve();
      let to = null;
      const done = () => {
        if (to) clearTimeout(to);
        el.removeEventListener("seeked", done);
        resolve();
      };
      el.addEventListener("seeked", done);
      to = setTimeout(done, 2000); // safety: never hang the whole export on one frame
      try {
        el.currentTime = t;
      } catch (e) {
        done();
      }
    });
  }
  // Step a virtual playhead at `fps` over the whole timeline; composite each frame
  // (trim + speed + zoom/pan, identical to the preview) and encode to MP4. Returns the
  // MP4 bytes (ArrayBuffer). Video-only — clips carry no audio yet (audio is Phase 5).
  async function exportWysiwyg(fps) {
    const total = totalSec();
    if (total <= 0) throw new Error("nothing to export");
    const W = projW;
    const H = projH;
    const nFrames = Math.max(1, Math.round(total * fps));
    const frameDurUs = 1e6 / fps;
    const oc = new OffscreenCanvas(W, H);
    const octx = oc.getContext("2d", { alpha: false });
    const enc = await createMp4Encoder({ width: W, height: H, fps });
    if (window.otd.log) {
      window.otd.log(`wysiwyg export: ${nFrames} frames @ ${fps}fps ${W}x${H} via ${enc.codec}`);
    }
    let loadedPath = null;
    for (let f = 0; f < nFrames; f++) {
      const t = Math.min(f / fps, total - 1e-4);
      const a = activeAt(t);
      if (a.i < 0) continue;
      const c = clips[a.i];
      if (c.path !== loadedPath) {
        await loadExportSource(c.path);
        loadedPath = c.path;
      }
      await seekExport(a.srcTime);
      const cur = showCursor ? cursorAt(c, a.srcTime) : null;
      composite(octx, W, H, exportVideoEl, interpZoom(c.zoom, a.srcTime), cur);
      const frame = new VideoFrame(oc, {
        timestamp: Math.round(f * frameDurUs),
        duration: Math.round(frameDurUs),
      });
      await enc.encode(frame, f % (fps * 2) === 0);
      frame.close();
      if (f % 5 === 0 || f === nFrames - 1) {
        setStatus(`Rendering ${f + 1}/${nFrames} (${Math.round((100 * (f + 1)) / nFrames)}%)…`, "");
        await new Promise((r) => setTimeout(r, 0)); // let the UI repaint
      }
    }
    return enc.finalize();
  }

  exportBtn.addEventListener("click", async () => {
    if (busy || clips.length === 0) return;
    busy = true;
    stopAll();
    renderControls();
    setStatus("Rendering timeline…", "");
    try {
      let bytes;
      try {
        bytes = await exportWysiwyg(60);
      } catch (err) {
        const msg = err && err.message ? err.message : String(err);
        if (window.otd.log) window.otd.log("wysiwyg export failed → ffmpeg fallback: " + msg);
        const hasZoom = clips.some((c) => c.zoom && c.zoom.length);
        setStatus(
          "WYSIWYG encode failed (" +
            msg +
            ")" +
            (hasZoom ? " — ffmpeg fallback, ZOOM WILL BE LOST." : " — using ffmpeg fallback…"),
          hasZoom ? "err" : "",
        );
        const res = await window.otd.exportClips({
          clips: clips.map((c) => {
            const dur = durSec(c);
            const trimmed = inOf(c) > 0 || outOf(c) < dur - 0.01;
            return {
              path: c.path,
              w: c.w,
              h: c.h,
              speed: c.speed,
              ...(trimmed ? { inSec: inOf(c), outSec: outOf(c) } : {}),
            };
          }),
          fps: 60,
        });
        if (!res || !res.ok) throw new Error((res && res.error) || "ffmpeg export failed");
        bytes = res.bytes;
      }
      // Mux mic narration (loudnorm) over the video, if any clip has audio.
      if (clips.some((c) => c.audioPath)) {
        setStatus("Adding narration…", "");
        try {
          const segs = clips.map((c) => ({
            audioPath: c.audioPath || null,
            inSec: inOf(c),
            outSec: outOf(c),
            speed: c.speed || 1,
            offset: (c.audioOffsetMs || 0) / 1000,
            effDur: effSec(c),
          }));
          const mux = await window.otd.muxAudio({ video: new Uint8Array(bytes), segments: segs });
          if (mux && mux.ok) bytes = mux.bytes;
          else {
            if (window.otd.log) window.otd.log("mux-audio failed: " + ((mux && mux.error) || "?"));
            setStatus("Narration mux failed — exporting without audio.", "err");
          }
        } catch (e) {
          if (window.otd.log) window.otd.log("mux-audio threw: " + (e && e.message));
        }
      }
      const base64 = abToBase64(bytes);
      if (session && session.token) {
        setStatus("Uploading…", "");
        const up = await window.otd.upload({
          api: session.api,
          token: session.token,
          ext: "mp4",
          base64,
          caption: session.caption || "",
        });
        if (up && up.ok) {
          setStatus("Uploaded ✓", "ok");
          setTimeout(() => window.otd.quit(), 800);
        } else {
          setStatus("Upload failed: " + ((up && up.error) || "unknown") + " — try Export again.", "err");
          busy = false;
          renderControls();
        }
      } else {
        const p = await window.otd.save({ base64, ext: "mp4", caption: (session && session.caption) || "" });
        setStatus("Saved to " + p, "ok");
        busy = false;
        renderControls();
      }
    } catch (e) {
      setStatus("Export error: " + (e && e.message ? e.message : e), "err");
      busy = false;
      renderControls();
    }
  });

  function abToBase64(buf) {
    const bytes = new Uint8Array(buf);
    let bin = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  }

  window.addEventListener("resize", () => renderTimeline());

  window.otd.onEditorInit((payload) => {
    clips = Array.isArray(payload && payload.clips)
      ? payload.clips.map((c, i) => ({
          ...c,
          speed: c.speed || 1,
          inSec: typeof c.inSec === "number" ? c.inSec : 0,
          outSec: typeof c.outSec === "number" ? c.outSec : (c.durMs || 0) / 1000,
          name: c.name || `Clip ${i + 1}`, // stable across reorder
          _explicitOut: typeof c.outSec === "number", // a real trim/split, not the default
        }))
      : [];
    session = (payload && payload.session) || null;
    playT = 0;
    curSegIdx = -1;
    curPath = null;
    undoStack = [];
    redoStack = [];
    // reset the ping-pong pair to a known state
    videoEl = $("video");
    altEl = $("video2");
    videoEl._path = null;
    altEl._path = null;
    altEl.style.opacity = "0";
    setupCanvas();
    if (window.otd.log) {
      window.otd.log(
        "editor init — cursor ptr pts per clip: [" +
          clips.map((c) => (c.cur && c.cur.ptr ? c.cur.ptr.length : 0)).join(", ") +
          "]",
      );
    }
    narrationPath = null;
    sel = clips.length ? 0 : -1;
    renderTimeline();
    if (sel >= 0) selectClip(0);
    measureDurations();
    decodeAllAudio();
  });

  // Canvas compositor runs continuously (preview); export reuses composite().
  requestAnimationFrame(renderLoop);

  // The recorded durMs can differ from the clip's true decodable duration, which leaves
  // a dead zone at the end of each timeline slot and makes the playhead snap across it at
  // cut points. Probe each distinct source once and pin the geometry to the real duration
  // so the playhead is 1:1. Only auto-fits full clips (never overrides an explicit trim).
  async function measureDurations() {
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.muted = true;
    const cache = {};
    const realDur = (path) =>
      new Promise((resolve) => {
        if (cache[path] !== undefined) return resolve(cache[path]);
        const done = (d) => {
          cache[path] = d;
          resolve(d);
        };
        probe.onloadedmetadata = () => done(probe.duration);
        probe.onerror = () => done(NaN);
        probe.src = fileUrl(path);
      });

    let changed = false;
    for (const c of clips) {
      const d = await realDur(c.path);
      if (!isFinite(d) || d <= 0) continue;
      if (c.durMs == null || Math.abs(c.durMs - d * 1000) > 1) {
        c.durMs = Math.round(d * 1000);
        changed = true;
      }
      if (!c._explicitOut && Math.abs(outOf(c) - d) > 0.001) {
        c.outSec = d; // pin full-clip slots to the real duration
        changed = true;
      } else if (c._explicitOut && c.outSec > d) {
        c.outSec = d; // a trim that ran past the real end
        changed = true;
      }
    }
    if (changed) {
      const keepPlay = playT;
      const keepSel = sel;
      curSegIdx = -1;
      curPath = null;
      renderTimeline();
      if (keepSel >= 0 && keepSel < clips.length) setSel(keepSel);
      seekTo(Math.min(keepPlay, totalSec()), false);
    }
  }
})();
