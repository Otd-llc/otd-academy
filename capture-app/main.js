// OTD Capture — main process.
//
// One transparent, full-screen, always-on-top overlay window that:
//  • is EXCLUDED from screen capture (setContentProtection → WDA_EXCLUDEFROMCAPTURE
//    on Windows), so the marching-ants box + dim never appear in the shot — this is
//    the thing the browser fundamentally couldn't do (no infinite mirror);
//  • is CLICK-THROUGH except over its own UI (the renderer toggles this per hover),
//    so you can arrange KiCad on the real desktop behind the box;
//  • auto-grants the primary screen to getDisplayMedia (no picker);
//  • exposes a GLOBAL spacebar (armed only while framing) so the trigger works even
//    when KiCad is focused.
//
// The flow starts in the LESSON: clicking the gold "+" launches
// otd-capture://capture?api=…&token=…&kind=…&hint=…&caption=… . We parse that here,
// show the description in the overlay, and on Approve upload the bytes back to the
// academy (/api/capture, token-gated) so they land in the exact placeholder.
const {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  desktopCapturer,
  session,
  screen,
} = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");

const PROTOCOL = "otd-capture";
let overlay = null;
let pendingSession = null; // a deep link that arrived before the overlay loaded

// The overlay is UNFOCUSED on purpose while recording (you're driving KiCad), and
// Chromium throttles a backgrounded renderer's requestAnimationFrame + timers — which
// would freeze the canvas draw loop that feeds the recording, so the clip skips and
// doesn't cover the full duration. Disable that throttling so it keeps capturing at
// full rate even when it isn't the focused window. (Pairs with backgroundThrottling:
// false on the window below.)
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");
// Windows-specific: Chromium's native occlusion calc can mark a transparent,
// always-on-top, unfocused window "occluded" a few seconds in and freeze its
// renderer — which would stop the recording pump mid-clip. Disable that calc.
app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion");
// Capture/encode perf on Windows 11: use the modern Windows Graphics Capture path
// (faster full-screen capture than DXGI duplication), and keep textures on the GPU.
app.commandLine.appendSwitch("enable-features", "WebRTC-AllowWgcDesktopCapturer");
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");

// Debug log → ~/Downloads/otd-captures/otd-capture.log. The ground truth for "the
// capture didn't show up": shows the launch argv, whether a deep link was parsed,
// whether a session reached the renderer, and every upload's response (or a
// STANDALONE save-to-disk line if no lesson target ever arrived).
const LOG_FILE = path.join(
  os.homedir(),
  "Downloads",
  "otd-captures",
  "otd-capture.log",
);
function logLine(msg) {
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {
    // logging must never break the app
  }
}

function parseDeepLink(link) {
  try {
    const u = new URL(link);
    const s = {
      api: u.searchParams.get("api") || "",
      token: u.searchParams.get("token") || "",
      kind: u.searchParams.get("kind") === "video" ? "video" : "image",
      hint: u.searchParams.get("hint") || "",
      caption: u.searchParams.get("caption") || "",
      aspect: u.searchParams.get("aspect") || "",
    };
    logLine(
      `deep link parsed: api=${s.api} kind=${s.kind} aspect=${s.aspect} hasToken=${!!s.token}`,
    );
    return s;
  } catch (e) {
    logLine(`deep link PARSE FAILED for "${link}": ${e && e.message}`);
    return null;
  }
}

function deliverSession(s) {
  if (!s || !s.token) {
    logLine("deliverSession: no session/token — ignored");
    return;
  }
  if (overlay && !overlay.webContents.isLoading()) {
    overlay.webContents.send("capture:session", s);
    overlay.show();
    overlay.focus();
    logLine("session delivered to renderer (overlay ready)");
  } else {
    pendingSession = s; // flushed on did-finish-load
    logLine("session queued (overlay not ready yet)");
  }
}

function handleDeepLink(link) {
  deliverSession(parseDeepLink(link));
}

function createOverlay() {
  const display = screen.getPrimaryDisplay();
  const { x, y, width, height } = display.bounds;

  overlay = new BrowserWindow({
    x,
    y,
    width,
    height,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    fullscreenable: false,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // Keep rAF + timers running while the window is unfocused (it is, during
      // recording) so the canvas draw loop feeding the clip never throttles.
      backgroundThrottling: false,
    },
  });

  // Float above everything, and stay invisible to screen capture.
  overlay.setAlwaysOnTop(true, "screen-saver");
  overlay.setVisibleOnAllWorkspaces(true);
  overlay.setContentProtection(true);
  // Interactive at creation; the renderer then keeps the window click-through in
  // every phase (setInteractive(false) in showSection) so the rest of the screen
  // stays usable, with a forwarded-mousemove hit-test re-enabling it only over the
  // panel (and the crop box, while framing).
  overlay.setIgnoreMouseEvents(false);

  overlay.loadFile(path.join(__dirname, "overlay.html"));

  overlay.webContents.on("did-finish-load", () => {
    overlay.webContents.send("display-info", {
      scaleFactor: display.scaleFactor,
      width,
      height,
    });
    if (pendingSession) {
      overlay.webContents.send("capture:session", pendingSession);
      pendingSession = null;
    }
    // Show + focus in BOTH the deep-link and standalone cases, so the setup panel is
    // reliably clickable (an unfocused transparent window wasn't getting the click).
    overlay.show();
    overlay.focus();
  });

  overlay.on("closed", () => {
    overlay = null;
  });
}

// ── single instance + protocol ─────────────────────────────────────────────
// Register otd-capture:// so the lesson "+" can launch us. In dev (running under
// the electron binary) the registration needs execPath + the app path.
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  // App already running, link clicked again → Windows passes the URL in argv.
  app.on("second-instance", (_e, argv) => {
    const link = argv.find((a) => a.startsWith(`${PROTOCOL}://`));
    if (link) handleDeepLink(link);
    else if (overlay) {
      overlay.show();
      overlay.focus();
    }
  });
  // macOS delivers it here.
  app.on("open-url", (_e, url) => handleDeepLink(url));

  app.whenReady().then(() => {
    // Grant capture permission outright — this is a local tool the user explicitly
    // launched; there's no third-party web content to guard against. Covers the case
    // where getDisplayMedia is denied before the display-media handler is even hit.
    session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(true));
    session.defaultSession.setPermissionCheckHandler(() => true);

    // Auto-pick the primary screen for getDisplayMedia → no picker, no recursion
    // (the overlay is content-protected, so it's not in the captured frame).
    session.defaultSession.setDisplayMediaRequestHandler(
      (request, callback) => {
        desktopCapturer
          .getSources({ types: ["screen"] })
          .then((sources) => {
            logLine(
              `displayMedia request: ${sources.length} screen source(s) [${sources
                .map((s) => s.name)
                .join(", ")}]`,
            );
            if (sources.length) callback({ video: sources[0] });
            else {
              logLine("displayMedia: NO screen sources available — denying");
              callback({});
            }
          })
          .catch((e) => {
            logLine(`displayMedia getSources threw: ${e && e.message}`);
            callback({});
          });
      },
      { useSystemPicker: false },
    );

    logLine(`app ready. argv: ${JSON.stringify(process.argv)}`);
    // First-launch deep link (Windows passes it in argv).
    const link = process.argv.find((a) => a.startsWith(`${PROTOCOL}://`));
    if (link) pendingSession = parseDeepLink(link);
    else logLine("no deep link in launch argv (standalone launch)");

    createOverlay();

    // Always-available safety hatch to quit, even if the renderer wedges.
    globalShortcut.register("CommandOrControl+Shift+Q", () => app.quit());

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createOverlay();
    });
  });
}

// ── IPC ──────────────────────────────────────────────────────────────────
// Make the overlay capture the mouse (true) or pass clicks through (false).
ipcMain.on("set-interactive", (_e, interactive) => {
  overlay?.setIgnoreMouseEvents(!interactive, { forward: true });
});

// Arm/disarm the GLOBAL capture keys (only while framing/recording).
// Ctrl+Shift+Enter = capture / start-stop, Ctrl+Shift+Backspace = cancel.
// Modifier chords on NORMAL keys on purpose: bare Space/Esc clobber KiCad, and
// bare F-keys are unreliable on laptops (the F-row defaults to media/Fn). These
// need no Fn and collide with neither KiCad nor Windows.
ipcMain.on("arm-space", () => {
  globalShortcut.register("CommandOrControl+Shift+Return", () =>
    overlay?.webContents.send("trigger"),
  );
  globalShortcut.register("CommandOrControl+Shift+Backspace", () =>
    overlay?.webContents.send("cancel"),
  );
  // Auto-follow toggle — a combo unlikely to clash with KiCad's shortcuts.
  globalShortcut.register("CommandOrControl+Shift+F", () =>
    overlay?.webContents.send("toggle-follow"),
  );
});
ipcMain.on("disarm-space", () => {
  globalShortcut.unregister("CommandOrControl+Shift+Return");
  globalShortcut.unregister("CommandOrControl+Shift+Backspace");
  globalShortcut.unregister("CommandOrControl+Shift+F");
});

// Deep-link flow: upload the approved capture to the academy. Done in the main
// process (Node fetch) so there's no browser CORS to satisfy. The token in the
// query scopes the write to one guide block; the bytes are the raw blob.
ipcMain.handle(
  "upload-capture",
  async (_e, { api, token, ext, base64, caption }) => {
    const body = Buffer.from(base64, "base64");
    logLine(`upload → ${api}/api/capture ext=${ext} bytes=${body.length}`);
    try {
      const ctype =
        ext === "webp" ? "image/webp" : ext === "mp4" ? "video/mp4" : "video/webm";
      const headers = { "Content-Type": ctype };
      if (caption) headers["x-caption"] = encodeURIComponent(caption);
      const qs = new URLSearchParams({ token, ext }).toString();
      const res = await fetch(`${api}/api/capture?${qs}`, {
        method: "POST",
        headers,
        body,
        // Do NOT follow redirects: an auth/middleware redirect to a 200 sign-in
        // page would otherwise read as success and silently drop the upload.
        redirect: "manual",
      });
      if (res.status >= 300 && res.status < 400) {
        logLine(`upload REDIRECTED: ${res.status} → ${res.headers.get("location")}`);
        return {
          ok: false,
          error: `Redirected (${res.status}) — the upload didn't reach the server.`,
        };
      }
      const json = await res.json().catch(() => ({}));
      logLine(`upload response: ${res.status} ${JSON.stringify(json)}`);
      if (!res.ok || !json.src) {
        return { ok: false, error: json.error || `HTTP ${res.status}` };
      }
      return { ok: true, src: json.src };
    } catch (e) {
      logLine(`upload THREW: ${e && e.message}`);
      return { ok: false, error: e && e.message ? e.message : "Upload failed." };
    }
  },
);

// Standalone (no deep link): save the approved capture to ~/Downloads/otd-captures/.
ipcMain.handle("save-capture", async (_e, { base64, ext, caption }) => {
  const dir = path.join(os.homedir(), "Downloads", "otd-captures");
  fs.mkdirSync(dir, { recursive: true });
  const slug =
    (caption || "capture")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "capture";
  const file = path.join(dir, `${slug}-${Date.now()}.${ext}`);
  fs.writeFileSync(file, Buffer.from(base64, "base64"));
  logLine(`STANDALONE save-to-disk (no lesson target): ${file}`);
  return file;
});

// ── multi-clip session ──────────────────────────────────────────────────────
// Recorded clips are written to a per-run temp dir; on export they're stitched
// into ONE MP4 with ffmpeg (each scaled+padded onto a common canvas, then
// concatenated). The lesson upload still receives a single video, so nothing
// downstream changes.
let sessionDir = null;
function getSessionDir() {
  if (!sessionDir) {
    sessionDir = path.join(os.tmpdir(), `otd-capture-${process.pid}-${Date.now()}`);
    fs.mkdirSync(sessionDir, { recursive: true });
  }
  return sessionDir;
}

// Persist one recorded clip's bytes; return its on-disk path for the timeline.
ipcMain.handle("save-clip", async (_e, { base64, ext, index }) => {
  try {
    const dir = getSessionDir();
    const file = path.join(dir, `clip-${String(index).padStart(3, "0")}.${ext || "mp4"}`);
    fs.writeFileSync(file, Buffer.from(base64, "base64"));
    logLine(`save-clip [${index}] → ${file} (${fs.statSync(file).size} bytes)`);
    return { ok: true, path: file };
  } catch (e) {
    logLine(`save-clip FAILED: ${e && e.message}`);
    return { ok: false, error: e && e.message ? e.message : "Couldn't save clip." };
  }
});

function runFfmpeg(bin, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { windowsHide: true });
    let err = "";
    proc.stderr.on("data", (d) => {
      err += d.toString();
      if (err.length > 8000) err = err.slice(-8000); // keep the tail only
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exit ${code}: ${err.slice(-600)}`));
    });
  });
}

// Is NVIDIA NVENC actually usable (GPU present + driver loaded)? The encoder being
// compiled in doesn't guarantee runtime support, so probe once with a tiny real
// encode and cache the answer. On a machine without an NVENC-capable GPU this
// fails cleanly and we stay on the CPU encoder.
let nvencCache = null;
async function nvencAvailable(ffmpeg) {
  if (nvencCache !== null) return nvencCache;
  try {
    await runFfmpeg(ffmpeg, [
      "-hide_banner", "-f", "lavfi",
      "-i", "color=c=black:s=256x256:r=10:d=0.1",
      "-c:v", "h264_nvenc", "-f", "null", "-",
    ]);
    nvencCache = true;
    logLine("nvenc: available — GPU (NVENC) encode for export");
  } catch (e) {
    nvencCache = false;
    logLine("nvenc: unavailable, using CPU libx264 — " + (e && e.message ? e.message.slice(0, 140) : ""));
  }
  return nvencCache;
}

// Stitch the ordered clips into one MP4 and hand back the bytes (for review +
// upload). clips = [{ path, w, h }]. Heterogeneous sizes are scaled+padded onto a
// common canvas = the largest width/height across clips, so nothing is cropped.
ipcMain.handle("export-clips", async (_e, { clips, fps }) => {
  try {
    if (!clips || !clips.length) return { ok: false, error: "No clips to export." };
    const r = fps && fps > 0 ? Math.round(fps) : 30;

    // One clip at normal speed: nothing to do — return it as-is. (A speed change
    // still needs the encoder, so only short-circuit at 1×.)
    if (clips.length === 1 && (clips[0].speed || 1) === 1) {
      return { ok: true, bytes: fs.readFileSync(clips[0].path) };
    }

    const ffmpeg = require("ffmpeg-static");
    const out = path.join(getSessionDir(), `export-${Date.now()}.mp4`);
    const even = (n) => Math.max(2, Math.floor(n / 2) * 2);
    const W = even(Math.max(...clips.map((c) => c.w || 1280)));
    const H = even(Math.max(...clips.map((c) => c.h || 720)));

    const args = ["-y"];
    for (const c of clips) args.push("-i", c.path);
    const parts = [];
    for (let i = 0; i < clips.length; i++) {
      const sp = clips[i].speed && clips[i].speed > 0 ? clips[i].speed : 1;
      const speedFilter = sp !== 1 ? `setpts=PTS/${sp},` : ""; // >1 faster, <1 slower
      parts.push(
        `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,` +
          `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,${speedFilter}fps=${r},format=yuv420p[v${i}]`,
      );
    }
    const labels = clips.map((_c, i) => `[v${i}]`).join("");
    const filter = `${parts.join(";")};${labels}concat=n=${clips.length}:v=1:a=0[out]`;
    const baseArgs = [...args, "-filter_complex", filter, "-map", "[out]"];
    const tail = ["-pix_fmt", "yuv420p", "-movflags", "+faststart", out];
    const nvencArgs = ["-c:v", "h264_nvenc", "-preset", "p5", "-rc", "vbr", "-cq", "23", "-b:v", "0"];
    const x264Args = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20"];

    // GPU encode (NVENC) when the GTX is usable; CPU x264 otherwise, and as a
    // runtime safety net if a GPU export errors out mid-encode.
    let encoder = (await nvencAvailable(ffmpeg)) ? "h264_nvenc" : "libx264";
    logLine(`export-clips: ${clips.length} clips → ${W}x${H} @ ${r}fps via ${encoder} → ${out}`);
    try {
      await runFfmpeg(ffmpeg, [
        ...baseArgs,
        ...(encoder === "h264_nvenc" ? nvencArgs : x264Args),
        ...tail,
      ]);
    } catch (e) {
      if (encoder === "h264_nvenc") {
        logLine(`nvenc export failed → retrying on CPU (libx264): ${(e && e.message ? e.message : "").slice(-200)}`);
        nvencCache = false; // don't keep trying the GPU this run
        encoder = "libx264";
        await runFfmpeg(ffmpeg, [...baseArgs, ...x264Args, ...tail]);
      } else {
        throw e;
      }
    }
    const bytes = fs.readFileSync(out);
    logLine(`export-clips done (${encoder}): ${bytes.length} bytes`);
    return { ok: true, bytes };
  } catch (e) {
    logLine(`export-clips FAILED: ${e && e.message}`);
    return { ok: false, error: e && e.message ? e.message : "Export failed." };
  }
});

ipcMain.on("renderer-log", (_e, msg) => logLine(`[renderer] ${msg}`));

// Cursor feed for the auto-follow pan: poll the OS cursor (~60 Hz) and push
// window-local coords to the renderer. screen.getCursorScreenPoint() is a clean,
// steady signal — unlike forwarded mousemove, which Windows throttles while the
// overlay is click-through. 60 Hz matches the render and avoids flooding the
// (recording-busy) renderer with IPC. Runs only while recording.
let cursorTimer = null;
ipcMain.on("cursor-track", (_e, on) => {
  if (cursorTimer) {
    clearInterval(cursorTimer);
    cursorTimer = null;
  }
  if (!on || !overlay) return;
  const b = overlay.getBounds(); // the overlay sits at the display origin
  cursorTimer = setInterval(() => {
    if (!overlay) {
      clearInterval(cursorTimer);
      cursorTimer = null;
      return;
    }
    const p = screen.getCursorScreenPoint();
    overlay.webContents.send("cursor:pos", { x: p.x - b.x, y: p.y - b.y });
  }, 16);
});

ipcMain.on("quit", () => app.quit());

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  // Best-effort: drop the per-run temp clip dir (the export was already uploaded).
  if (sessionDir) {
    try {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    } catch {
      // leave it for the OS temp cleaner
    }
  }
});
app.on("window-all-closed", () => app.quit());
