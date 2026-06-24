// OTD Editor — timeline window renderer.
//
// Receives the recorded clips (already on disk) + the lesson session over
// `editor:init`, lets you preview / reorder / remove / set per-clip speed, then
// Export & Upload runs the same ffmpeg stitch + upload as the quick path. Trim and
// per-segment speed land in the next phases; the data model is already the segment
// shape ({ path, inSec, outSec, speed }) so those slot in without a rewrite.
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const videoEl = $("video");
  const noClipEl = $("noClip");
  const timelineEl = $("timeline");
  const totalDurEl = $("totalDur");
  const selInfoEl = $("selInfo");
  const speedBtn = $("speedBtn");
  const splitBtn = $("splitBtn");
  const leftBtn = $("leftBtn");
  const rightBtn = $("rightBtn");
  const removeBtn = $("removeBtn");
  const cancelBtn = $("cancelBtn");
  const exportBtn = $("exportBtn");
  const statusEl = $("status");
  const trackEl = $("track");
  const trimRegionEl = $("trimRegion");
  const playheadEl = $("playhead");
  const inHandleEl = $("inHandle");
  const outHandleEl = $("outHandle");
  const trimInfoEl = $("trimInfo");

  let drag = null; // "in" | "out" while dragging a trim handle
  let clips = []; // [{ path, w, h, durMs, speed, inSec, outSec }]
  let session = null; // { api, token, caption } | null (standalone)
  let sel = -1;
  let busy = false;

  const SPEEDS = [0.5, 1, 1.5, 2, 4];

  const fmt = (ms) => {
    const s = Math.max(0, Math.round((ms || 0) / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  const durSec = (c) => (c.durMs || 0) / 1000;
  const inOf = (c) => Math.max(0, c.inSec || 0);
  const outOf = (c) => (typeof c.outSec === "number" ? c.outSec : durSec(c));
  const effMs = (c) => (Math.max(0, outOf(c) - inOf(c)) * 1000) / (c.speed || 1);
  const fileUrl = (p) => "file:///" + encodeURI(String(p).replace(/\\/g, "/"));

  function setStatus(msg, cls) {
    statusEl.textContent = msg || "";
    statusEl.className = cls || "";
  }

  function render() {
    timelineEl.innerHTML = "";
    let total = 0;
    clips.forEach((c, i) => {
      total += effMs(c);
      const seg = document.createElement("div");
      seg.className = "seg" + (i === sel ? " sel" : "");
      seg.style.flexGrow = String(Math.max(0.4, effMs(c) / 1000));
      const sp = (c.speed || 1) !== 1 ? `<span class="sp">${c.speed}×</span>` : "";
      seg.innerHTML = `${sp}<span class="n">Clip ${i + 1}</span><span class="d">${fmt(effMs(c))}</span>`;
      seg.addEventListener("click", () => selectClip(i));
      timelineEl.appendChild(seg);
    });
    totalDurEl.textContent = fmt(total);

    const has = sel >= 0 && sel < clips.length;
    speedBtn.disabled = !has;
    splitBtn.disabled = !has;
    leftBtn.disabled = !has || sel === 0;
    rightBtn.disabled = !has || sel === clips.length - 1;
    removeBtn.disabled = !has;
    exportBtn.disabled = busy || clips.length === 0;
    speedBtn.textContent = has ? `Speed ${clips[sel].speed || 1}×` : "Speed 1×";
  }

  function selectClip(i) {
    sel = i;
    const c = clips[i];
    if (c) {
      videoEl.src = fileUrl(c.path);
      videoEl.controls = true;
      videoEl.style.display = "block";
      noClipEl.style.display = "none";
      videoEl.playbackRate = c.speed || 1;
      selInfoEl.textContent =
        `Clip ${i + 1} · ${fmt(c.durMs)} recorded · ${c.speed || 1}× · ${fmt(effMs(c))} on the timeline`;
    }
    renderScrubber();
    render();
  }

  // ── trim scrubber ──
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
      `  (drag the gold handles; click the bar to seek)`;
  }
  function startDrag(which, e) {
    if (sel < 0) return;
    drag = which;
    e.target.setPointerCapture(e.pointerId);
    e.stopPropagation();
  }
  inHandleEl.addEventListener("pointerdown", (e) => startDrag("in", e));
  outHandleEl.addEventListener("pointerdown", (e) => startDrag("out", e));
  window.addEventListener("pointermove", (e) => {
    if (!drag || sel < 0) return;
    const c = clips[sel];
    const dur = durSec(c) || 1;
    const t = timeFromX(e.clientX, c);
    const minGap = 0.1;
    if (drag === "in") c.inSec = Math.max(0, Math.min(t, outOf(c) - minGap));
    else c.outSec = Math.min(dur, Math.max(t, inOf(c) + minGap));
    if (videoEl.readyState >= 1) videoEl.currentTime = drag === "in" ? inOf(c) : outOf(c);
    renderScrubber();
    render();
  });
  window.addEventListener("pointerup", () => {
    drag = null;
  });
  trackEl.addEventListener("pointerdown", (e) => {
    if (drag || sel < 0) return; // handle drags are captured separately
    if (videoEl.readyState >= 1) videoEl.currentTime = timeFromX(e.clientX, clips[sel]);
  });
  videoEl.addEventListener("loadedmetadata", () => {
    if (sel < 0) return;
    const c = clips[sel];
    if (typeof c.outSec !== "number" || c.outSec <= 0) c.outSec = videoEl.duration || durSec(c);
    videoEl.currentTime = inOf(c);
    renderScrubber();
    render();
  });
  videoEl.addEventListener("timeupdate", () => {
    if (sel < 0) return;
    const c = clips[sel];
    const dur = durSec(c) || videoEl.duration || 1;
    playheadEl.style.left = Math.max(0, Math.min(1, videoEl.currentTime / dur)) * 100 + "%";
    // While playing, loop within the kept region so you preview exactly the trim.
    if (!videoEl.paused && videoEl.currentTime >= outOf(c) - 0.02) {
      videoEl.currentTime = inOf(c);
    }
  });

  function move(dir) {
    const j = sel + dir;
    if (sel < 0 || j < 0 || j >= clips.length) return;
    const t = clips[sel];
    clips[sel] = clips[j];
    clips[j] = t;
    sel = j;
    render();
  }

  speedBtn.addEventListener("click", () => {
    if (sel < 0) return;
    const cur = clips[sel].speed || 1;
    clips[sel].speed = SPEEDS[(SPEEDS.indexOf(cur) + 1) % SPEEDS.length];
    videoEl.playbackRate = clips[sel].speed;
    selectClip(sel);
  });
  // Split the selected segment at the playhead into two segments of the SAME source
  // clip, each independently trimmable + speed-able. (Two ffmpeg inputs of one file.)
  splitBtn.addEventListener("click", () => {
    if (sel < 0) return;
    const c = clips[sel];
    const inS = inOf(c);
    const outS = outOf(c);
    const t = videoEl.currentTime;
    const minGap = 0.1;
    if (!(t > inS + minGap && t < outS - minGap)) {
      setStatus("Move the playhead inside the clip (away from the ends), then Split.", "err");
      return;
    }
    const left = { ...c, inSec: inS, outSec: t };
    const right = { ...c, inSec: t, outSec: outS };
    clips.splice(sel, 1, left, right);
    selectClip(sel); // keep the left half selected
    setStatus(`Split at ${fmt(t * 1000)} — now 2 segments, each with its own speed.`, "ok");
  });
  leftBtn.addEventListener("click", () => move(-1));
  rightBtn.addEventListener("click", () => move(1));
  removeBtn.addEventListener("click", () => {
    if (sel < 0) return;
    clips.splice(sel, 1);
    if (clips.length === 0) {
      sel = -1;
      videoEl.removeAttribute("src");
      videoEl.style.display = "none";
      noClipEl.style.display = "block";
      selInfoEl.textContent = "—";
      renderScrubber();
      render();
    } else {
      selectClip(Math.min(sel, clips.length - 1));
    }
  });
  cancelBtn.addEventListener("click", () => window.otd.closeEditor());

  exportBtn.addEventListener("click", async () => {
    if (busy || clips.length === 0) return;
    busy = true;
    render();
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
        render();
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
          render();
        }
      } else {
        const p = await window.otd.save({ base64, ext: "mp4", caption: (session && session.caption) || "" });
        setStatus("Saved to " + p, "ok");
        busy = false;
        render();
      }
    } catch (e) {
      setStatus("Export error: " + (e && e.message ? e.message : e), "err");
      busy = false;
      render();
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
    sel = clips.length ? 0 : -1;
    if (sel >= 0) selectClip(0);
    else render();
  });
})();
