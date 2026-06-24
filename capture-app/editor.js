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
  const leftBtn = $("leftBtn");
  const rightBtn = $("rightBtn");
  const removeBtn = $("removeBtn");
  const cancelBtn = $("cancelBtn");
  const exportBtn = $("exportBtn");
  const statusEl = $("status");

  let clips = []; // [{ path, w, h, durMs, speed }]
  let session = null; // { api, token, caption } | null (standalone)
  let sel = -1;
  let busy = false;

  const SPEEDS = [0.5, 1, 1.5, 2, 4];

  const fmt = (ms) => {
    const s = Math.max(0, Math.round((ms || 0) / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  const effMs = (c) => (c.durMs || 0) / (c.speed || 1);
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
    render();
  }

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
        clips: clips.map((c) => ({ path: c.path, w: c.w, h: c.h, speed: c.speed })),
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
      ? payload.clips.map((c) => ({ ...c, speed: c.speed || 1 }))
      : [];
    session = (payload && payload.session) || null;
    sel = clips.length ? 0 : -1;
    if (sel >= 0) selectClip(0);
    else render();
  });
})();
