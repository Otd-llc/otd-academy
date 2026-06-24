// OTD Editor — single-timeline NLE renderer.
//
// Receives the recorded clips (already on disk) + the lesson session over
// `editor:init`. The timeline is one magnetic sequence of segments laid out on a
// time ruler (pxPerSec, zoomable); a master playhead scrubs/plays the WHOLE sequence,
// switching the <video> source as it crosses segment boundaries. Export still runs the
// ffmpeg stitch (Phase 1 — the WYSIWYG canvas/WebCodecs export lands in Phase 2).
//
// Data model (unchanged + extensible): clips = ordered list of segments
//   { path, w, h, durMs, speed, inSec, outSec }
// A segment's effective on-timeline duration = (outSec - inSec) / speed. Its timeline
// start is DERIVED as the cumulative sum of prior effective durations (magnetic — no
// stored positions, so reorder/trim reflow for free).
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const videoEl = $("video");
  const noClipEl = $("noClip");
  const previewEl = $("preview");

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

  // trim scrubber (selected clip)
  const trackEl = $("track");
  const trimRegionEl = $("trimRegion");
  const scrubPlayheadEl = $("scrubPlayhead");
  const inHandleEl = $("inHandle");
  const outHandleEl = $("outHandle");
  const trimInfoEl = $("trimInfo");

  // controls
  const speedBtn = $("speedBtn");
  const splitBtn = $("splitBtn");
  const leftBtn = $("leftBtn");
  const rightBtn = $("rightBtn");
  const removeBtn = $("removeBtn");
  const cancelBtn = $("cancelBtn");
  const exportBtn = $("exportBtn");
  const statusEl = $("status");

  // ── state ──
  let clips = []; // [{ path, w, h, durMs, speed, inSec, outSec }]
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
  let trimDrag = null; // "in" | "out" while dragging a trim handle (scrubber)
  let segAction = null; // direct-on-timeline drag: { type, i, edge, startClientX, moved, origIn, origOut }
  let fwdMul = 1; // forward shuttle multiplier (L / double-L)
  let revRaf = null; // reverse-shuttle rAF id
  let revMul = 1; // reverse shuttle multiplier (J / double-J)
  let revLast = 0;

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
      seg.innerHTML = `${sp}<span class="n">Clip ${i + 1}</span><span class="d">${fmt(e * 1000)}</span>`;
      videoTrackEl.appendChild(seg);
      acc += e;
    });

    updatePlayheadUI();
    renderControls();
  }

  function renderControls() {
    const has = sel >= 0 && sel < clips.length;
    speedBtn.disabled = !has;
    splitBtn.disabled = !has;
    leftBtn.disabled = !has || sel === 0;
    rightBtn.disabled = !has || sel === clips.length - 1;
    removeBtn.disabled = !has;
    exportBtn.disabled = busy || clips.length === 0;
    playBtn.disabled = clips.length === 0;
    homeBtn.disabled = clips.length === 0;
    endBtn.disabled = clips.length === 0;
    speedBtn.textContent = has ? `Speed ${clips[sel].speed || 1}×` : "Speed 1×";
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
      /* not ready yet — onloadedmetadata will retry via re-seek */
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

  // ── transport ──
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
  // ── J/K/L shuttle: forward via native playback rate, reverse via a seek loop ──
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
    if (videoEl.currentTime >= outOf(c) - 0.012) {
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

  // ── timeline pointer interaction (scrub + select) ──
  function tlTimeFromClientX(clientX) {
    const r = tlInnerEl.getBoundingClientRect();
    return Math.max(0, (clientX - r.left) / pxPerSec);
  }
  playheadHitEl.addEventListener("pointerdown", (e) => {
    scrubbing = true;
    if (playing) pausePlayback();
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
  // A pointerdown on the timeline either grabs a segment (edge = trim, body = reorder)
  // or, on empty track / ruler, scrubs the master playhead.
  tlInnerEl.addEventListener("pointerdown", (e) => {
    if (e.target === playheadHitEl) return;
    stopAll();
    tlInnerEl.setPointerCapture(e.pointerId);
    const segEl = e.target.closest && e.target.closest(".seg");
    if (segEl) {
      const i = +segEl.dataset.i;
      setSel(i);
      const r = segEl.getBoundingClientRect();
      const edge =
        e.clientX - r.left < EDGE ? "left" : r.right - e.clientX < EDGE ? "right" : "body";
      segAction = {
        type: edge === "body" ? "body" : "edge",
        i,
        edge,
        startClientX: e.clientX,
        moved: false,
        origIn: inOf(clips[i]),
        origOut: outOf(clips[i]),
      };
    } else {
      segAction = { type: "scrub" };
      const t = tlTimeFromClientX(e.clientX);
      const a = activeAt(t);
      if (a.i >= 0) setSel(a.i);
      seekTo(t, false);
    }
  });
  tlInnerEl.addEventListener("pointermove", (e) => {
    if (!segAction) {
      updateEdgeCursor(e);
      return;
    }
    if (!segAction.moved && Math.abs(e.clientX - segAction.startClientX) < 3) return;
    segAction.moved = true;
    if (segAction.type === "scrub") {
      seekTo(tlTimeFromClientX(e.clientX), false);
    } else if (segAction.type === "edge") {
      dragEdge(e);
    } else if (segAction.type === "body") {
      dragReorder(e);
    }
  });
  tlInnerEl.addEventListener("pointerup", (e) => {
    try {
      tlInnerEl.releasePointerCapture(e.pointerId);
    } catch (_) {}
    if (segAction && segAction.type === "edge" && segAction.moved) {
      seekTo(startOf(segAction.i), false);
    } else if (segAction && segAction.type === "body" && segAction.moved) {
      selectClip(segAction.i);
    } else if (segAction && (segAction.type === "edge" || segAction.type === "body")) {
      // a click, not a drag → seek to the clicked time within the segment
      seekTo(tlTimeFromClientX(segAction.startClientX), false);
    }
    segAction = null;
  });

  // Live edge-trim: convert the timeline drag delta to a source delta, snap the moving
  // edge to the playhead, and reflow the magnetic timeline.
  function dragEdge(e) {
    const c = clips[segAction.i];
    if (!c) return;
    const sp = c.speed || 1;
    const dxSrc = ((e.clientX - segAction.startClientX) / pxPerSec) * sp;
    if (segAction.edge === "left") {
      let nIn = Math.max(0, Math.min(segAction.origIn + dxSrc, segAction.origOut - MIN_SRC));
      c.inSec = nIn;
    } else {
      let nOut = Math.min(durSec(c), Math.max(segAction.origOut + dxSrc, segAction.origIn + MIN_SRC));
      // snap the right edge to the playhead time
      const edgeTime = startOf(segAction.i) + (nOut - inOf(c)) / sp;
      if (Math.abs(edgeTime - playT) * pxPerSec < SNAP_PX) {
        const snapped = inOf(c) + (playT - startOf(segAction.i)) * sp;
        if (snapped > segAction.origIn + MIN_SRC && snapped <= durSec(c)) nOut = snapped;
      }
      c.outSec = nOut;
    }
    renderScrubber();
    renderTimeline();
  }

  // Live reorder: as the pointer crosses into another segment's slot, splice this
  // segment to that index and re-render (index-based, no floating ghost — v1).
  function dragReorder(e) {
    const t = tlTimeFromClientX(e.clientX);
    const a = activeAt(t);
    let target = a.i < 0 ? clips.length - 1 : a.i;
    if (target !== segAction.i) {
      const [moved] = clips.splice(segAction.i, 1);
      clips.splice(target, 0, moved);
      segAction.i = target;
      sel = target;
      curSegIdx = -1;
      curPath = null;
      renderTimeline();
    }
  }

  function updateEdgeCursor(e) {
    const segEl = e.target.closest && e.target.closest(".seg");
    if (!segEl) return;
    const r = segEl.getBoundingClientRect();
    segEl.style.cursor =
      e.clientX - r.left < EDGE || r.right - e.clientX < EDGE ? "ew-resize" : "grab";
  }
  // Ctrl+wheel zoom, centered on the playhead.
  tlScrollEl.addEventListener(
    "wheel",
    (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15);
    },
    { passive: false },
  );

  function zoomBy(factor) {
    pxPerSec = Math.max(PX_MIN, Math.min(PX_MAX, pxPerSec * factor));
    renderTimeline();
    // keep the playhead in view after a zoom
    followPlayhead(playT * pxPerSec);
  }

  // ── selection + trim scrubber (selected clip) ──
  function setSel(i) {
    sel = i;
    const c = clips[i];
    if (c) {
      selInfoEl.textContent =
        `Clip ${i + 1} · ${fmt(c.durMs)} src · ${c.speed || 1}× · ${fmt(effSec(c) * 1000)} on timeline`;
    } else {
      selInfoEl.textContent = "—";
    }
    renderScrubber();
    renderTimeline();
  }
  function selectClip(i) {
    setSel(i);
    seekTo(startOf(i), false); // park the playhead at this clip's start
  }

  function timeFromX(clientX, c) {
    const r = trackEl.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    return frac * (durSec(c) || 1);
  }
  function renderScrubber() {
    const c = sel >= 0 ? clips[sel] : null;
    const show = c ? "block" : "none";
    trimRegionEl.style.display = show;
    inHandleEl.style.display = show;
    outHandleEl.style.display = show;
    scrubPlayheadEl.style.display = show;
    if (!c) {
      trimInfoEl.textContent = "Select a clip to trim its start / end";
      return;
    }
    const dur = durSec(c) || 1;
    const inP = (inOf(c) / dur) * 100;
    const outP = (Math.min(dur, outOf(c)) / dur) * 100;
    inHandleEl.style.left = inP + "%";
    outHandleEl.style.left = outP + "%";
    trimRegionEl.style.left = inP + "%";
    trimRegionEl.style.width = Math.max(0, outP - inP) + "%";
    const keepSec = Math.max(0, outOf(c) - inOf(c));
    const speedNote =
      (c.speed || 1) !== 1 ? ` → ${fmt((keepSec / c.speed) * 1000)} at ${c.speed}×` : "";
    trimInfoEl.textContent =
      `Trim · in ${fmt(inOf(c) * 1000)} · out ${fmt(outOf(c) * 1000)} · keep ${fmt(keepSec * 1000)}${speedNote}` +
      `  (drag the gold handles)`;
  }
  function startTrimDrag(which, e) {
    if (sel < 0) return;
    trimDrag = which;
    e.target.setPointerCapture(e.pointerId);
    e.stopPropagation();
  }
  inHandleEl.addEventListener("pointerdown", (e) => startTrimDrag("in", e));
  outHandleEl.addEventListener("pointerdown", (e) => startTrimDrag("out", e));
  window.addEventListener("pointermove", (e) => {
    if (!trimDrag || sel < 0) return;
    const c = clips[sel];
    const dur = durSec(c) || 1;
    const t = timeFromX(e.clientX, c);
    const minGap = 0.1;
    if (trimDrag === "in") c.inSec = Math.max(0, Math.min(t, outOf(c) - minGap));
    else c.outSec = Math.min(dur, Math.max(t, inOf(c) + minGap));
    // preview the trimmed frame on the scrubber, and reflow the magnetic timeline
    if (curSegIdx === sel && videoEl.readyState >= 1) {
      videoEl.currentTime = trimDrag === "in" ? inOf(c) : outOf(c);
    }
    updateScrubPlayhead(trimDrag === "in" ? inOf(c) : outOf(c));
    renderScrubber();
    renderTimeline();
  });
  window.addEventListener("pointerup", () => {
    if (trimDrag) {
      trimDrag = null;
      // re-park the master playhead at the (reflowed) selected clip start
      seekTo(startOf(sel), false);
    }
  });
  trackEl.addEventListener("pointerdown", (e) => {
    if (trimDrag || sel < 0) return;
    const c = clips[sel];
    const t = timeFromX(e.clientX, c);
    if (curSegIdx === sel && videoEl.readyState >= 1) videoEl.currentTime = t;
    updateScrubPlayhead(t);
  });
  function updateScrubPlayhead(srcT) {
    const c = sel >= 0 ? clips[sel] : null;
    if (!c) return;
    const dur = durSec(c) || 1;
    scrubPlayheadEl.style.left = Math.max(0, Math.min(1, srcT / dur)) * 100 + "%";
  }

  // ── edit ops (full ripple/split set lands in Task 4) ──
  function move(dir) {
    const j = sel + dir;
    if (sel < 0 || j < 0 || j >= clips.length) return;
    const t = clips[sel];
    clips[sel] = clips[j];
    clips[j] = t;
    curSegIdx = -1;
    curPath = null;
    selectClip(j);
  }
  speedBtn.addEventListener("click", () => {
    if (sel < 0) return;
    const cur = clips[sel].speed || 1;
    clips[sel].speed = SPEEDS[(SPEEDS.indexOf(cur) + 1) % SPEEDS.length];
    selectClip(sel);
  });
  // Split the active segment at the master playhead into two segments of the SAME
  // source clip (two ffmpeg inputs of one file), each independently trim/speed-able.
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
    const left = { ...c, inSec: inOf(c), outSec: t };
    const right = { ...c, inSec: t, outSec: outOf(c) };
    clips.splice(a.i, 1, left, right);
    curSegIdx = -1;
    curPath = null;
    setSel(a.i);
    seekTo(playT, false);
    setStatus(`Split at ${fmtTC(playT)} — now 2 segments.`, "ok");
  }

  // Ripple-delete the selected segment: remove it and let the magnetic timeline pull
  // downstream segments left to close the gap.
  function rippleDelete() {
    if (sel < 0) return;
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
      renderScrubber();
      renderTimeline();
      return;
    }
    sel = Math.min(sel, clips.length - 1);
    setSel(sel);
    seekTo(Math.min(at, totalSec()), false);
  }

  // Q — trim the active clip's start up to the playhead (the formerly-at-playhead
  // frame becomes the clip's new start); downstream reflows.
  function rippleTrimStart() {
    if (!clips.length) return;
    const a = activeAt(playT);
    const c = clips[a.i];
    if (!c) return;
    const nIn = Math.min(a.srcTime, outOf(c) - MIN_SRC);
    if (nIn <= inOf(c) + 0.001) {
      setStatus("Playhead is at/before this clip’s start — nothing to trim.", "err");
      return;
    }
    c.inSec = Math.max(0, nIn);
    curSegIdx = -1;
    curPath = null;
    setSel(a.i);
    seekTo(startOf(a.i), false);
    setStatus("Ripple-trimmed start to the playhead.", "ok");
  }

  // W — trim the active clip's end back to the playhead; downstream reflows.
  function rippleTrimEnd() {
    if (!clips.length) return;
    const a = activeAt(playT);
    const c = clips[a.i];
    if (!c) return;
    const nOut = Math.max(a.srcTime, inOf(c) + MIN_SRC);
    if (nOut >= outOf(c) - 0.001) {
      setStatus("Playhead is at/after this clip’s end — nothing to trim.", "err");
      return;
    }
    c.outSec = nOut;
    curSegIdx = -1;
    curPath = null;
    const keepT = startOf(a.i) + effSec(c);
    setSel(a.i);
    seekTo(keepT, false);
    setStatus("Ripple-trimmed end to the playhead.", "ok");
  }

  splitBtn.addEventListener("click", splitAtPlayhead);
  leftBtn.addEventListener("click", () => move(-1));
  rightBtn.addEventListener("click", () => move(1));
  removeBtn.addEventListener("click", rippleDelete);

  playBtn.addEventListener("click", togglePlay);
  homeBtn.addEventListener("click", () => seekTo(0, false));
  endBtn.addEventListener("click", () => seekTo(totalSec(), false));
  zoomInBtn.addEventListener("click", () => zoomBy(1.25));
  zoomOutBtn.addEventListener("click", () => zoomBy(1 / 1.25));
  cancelBtn.addEventListener("click", () => window.otd.closeEditor());

  // ── keyboard shortcuts (Premiere / Resolve conventions) ──
  document.addEventListener("keydown", (e) => {
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    const k = e.key;
    // Ctrl combos first (Ctrl+K split would otherwise hit the K shuttle).
    if (e.ctrlKey && (k === "k" || k === "K")) {
      e.preventDefault();
      splitAtPlayhead();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
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
      case "q":
      case "Q":
        e.preventDefault();
        rippleTrimStart();
        break;
      case "w":
      case "W":
        e.preventDefault();
        rippleTrimEnd();
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
    if (playing) pausePlayback();
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
      ? payload.clips.map((c) => ({
          ...c,
          speed: c.speed || 1,
          inSec: typeof c.inSec === "number" ? c.inSec : 0,
          outSec: typeof c.outSec === "number" ? c.outSec : (c.durMs || 0) / 1000,
        }))
      : [];
    session = (payload && payload.session) || null;
    playT = 0;
    curSegIdx = -1;
    curPath = null;
    sel = clips.length ? 0 : -1;
    renderTimeline();
    renderScrubber();
    if (sel >= 0) selectClip(0);
  });
})();
