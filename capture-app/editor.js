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
  const videoEl = $("video");
  const noClipEl = $("noClip");

  // transport
  const playBtn = $("playBtn");
  const homeBtn = $("homeBtn");
  const endBtn = $("endBtn");
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
  let pendingSeek = null; // { srcTime, resumePlay } applied on loadedmetadata
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

  const SPEEDS = [0.5, 1, 1.5, 2, 4];
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
  function snapshot() {
    return clips.map((c) => ({ ...c }));
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
    clips = state.map((c) => ({ ...c }));
    curSegIdx = -1;
    curPath = null;
    if (clips.length === 0) {
      sel = -1;
      playT = 0;
      videoEl.removeAttribute("src");
      videoEl.style.display = "none";
      noClipEl.style.display = "block";
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
      videoTrackEl.appendChild(seg);
      acc += e;
    });

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
    exportBtn.disabled = busy || clips.length === 0;
    playBtn.disabled = clips.length === 0;
    homeBtn.disabled = clips.length === 0;
    endBtn.disabled = clips.length === 0;
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

  // ── video source management ──
  function showVideo() {
    videoEl.style.display = "block";
    noClipEl.style.display = "none";
  }
  function applyRate() {
    const c = clips[curSegIdx];
    if (c) videoEl.playbackRate = (c.speed || 1) * fwdMul;
  }
  function loadSegment(i, srcTime, resumePlay) {
    const c = clips[i];
    if (!c) return;
    curSegIdx = i;
    videoEl.playbackRate = (c.speed || 1) * fwdMul;
    showVideo();
    pendingSeek = { srcTime, resumePlay };
    if (curPath !== c.path) {
      curPath = c.path;
      videoEl.src = fileUrl(c.path); // currentTime applied on loadedmetadata
    } else {
      applyPendingSeek();
    }
  }
  function applyPendingSeek() {
    if (!pendingSeek) return;
    const { srcTime, resumePlay } = pendingSeek;
    pendingSeek = null;
    try {
      videoEl.currentTime = Math.max(0, srcTime);
    } catch (e) {
      /* not ready yet — onloadedmetadata will retry */
    }
    if (resumePlay) videoEl.play().catch(() => {});
  }
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
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);
  }
  function pausePlayback() {
    playing = false;
    playBtn.textContent = "▶";
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    videoEl.pause();
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
        const next = curSegIdx + 1;
        playT = startOf(next);
        loadSegment(next, inOf(clips[next]), true);
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
    updatePlayheadUI();
    rafId = requestAnimationFrame(tick);
  }

  videoEl.addEventListener("loadedmetadata", () => {
    const c = clips[curSegIdx];
    if (c && (typeof c.outSec !== "number" || c.outSec <= 0)) {
      c.outSec = videoEl.duration || durSec(c);
    }
    applyPendingSeek();
  });

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
    return c
      ? `${nameOf(c, i)} · ${fmt(c.durMs)} src · ${c.speed || 1}× · ${fmt(effSec(c) * 1000)} on timeline`
      : "—";
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
    const left = { ...c, inSec: inOf(c), outSec: t };
    const right = { ...c, inSec: t, outSec: outOf(c), name: nameOf(c, a.i) + " (b)" };
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
      videoEl.removeAttribute("src");
      videoEl.style.display = "none";
      noClipEl.style.display = "block";
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
  exportBtn.addEventListener("click", async () => {
    if (busy || clips.length === 0) return;
    busy = true;
    stopAll();
    renderControls();
    setStatus(`Stitching ${clips.length} clip${clips.length === 1 ? "" : "s"}…`, "");
    try {
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
      if (!res || !res.ok) {
        setStatus("Stitch failed: " + ((res && res.error) || "unknown error"), "err");
        busy = false;
        renderControls();
        return;
      }
      const base64 = abToBase64(res.bytes);
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
        }))
      : [];
    session = (payload && payload.session) || null;
    playT = 0;
    curSegIdx = -1;
    curPath = null;
    undoStack = [];
    redoStack = [];
    sel = clips.length ? 0 : -1;
    renderTimeline();
    if (sel >= 0) selectClip(0);
  });
})();
