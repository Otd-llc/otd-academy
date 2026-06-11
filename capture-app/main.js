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

const PROTOCOL = "otd-capture";
let overlay = null;
let pendingSession = null; // a deep link that arrived before the overlay loaded

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
    },
  });

  // Float above everything, and stay invisible to screen capture.
  overlay.setAlwaysOnTop(true, "screen-saver");
  overlay.setVisibleOnAllWorkspaces(true);
  overlay.setContentProtection(true);
  // Fully interactive by default, so the panel (×, drag, buttons) ALWAYS works
  // without depending on a hover hit-test. Only during FRAMING does the renderer
  // switch the window to click-through (forward:true) — so you can arrange apps
  // behind the box — and the hover hit-test then keeps just the panel + box live.
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
      overlay.show();
      overlay.focus();
    }
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
    // Auto-pick the primary screen for getDisplayMedia → no picker, no recursion
    // (the overlay is content-protected, so it's not in the captured frame).
    session.defaultSession.setDisplayMediaRequestHandler(
      (request, callback) => {
        desktopCapturer
          .getSources({ types: ["screen"] })
          .then((sources) => callback({ video: sources[0] }))
          .catch(() => callback({}));
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

// Arm/disarm the GLOBAL spacebar (only while framing/recording, so it doesn't
// clobber Space everywhere else). The renderer drives the timing.
ipcMain.on("arm-space", () => {
  globalShortcut.register("Space", () => overlay?.webContents.send("trigger"));
  globalShortcut.register("Escape", () => overlay?.webContents.send("cancel"));
});
ipcMain.on("disarm-space", () => {
  globalShortcut.unregister("Space");
  globalShortcut.unregister("Escape");
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

ipcMain.on("quit", () => app.quit());

app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => app.quit());
