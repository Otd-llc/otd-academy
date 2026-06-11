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

function parseDeepLink(link) {
  try {
    const u = new URL(link);
    return {
      api: u.searchParams.get("api") || "",
      token: u.searchParams.get("token") || "",
      kind: u.searchParams.get("kind") === "video" ? "video" : "image",
      hint: u.searchParams.get("hint") || "",
      caption: u.searchParams.get("caption") || "",
    };
  } catch {
    return null;
  }
}

function deliverSession(s) {
  if (!s || !s.token) return;
  if (overlay && !overlay.webContents.isLoading()) {
    overlay.webContents.send("capture:session", s);
    overlay.show();
    overlay.focus();
  } else {
    pendingSession = s; // flushed on did-finish-load
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
  // Click-through by default; the renderer flips this on while the pointer is over
  // its own UI (panel / crop box) via the `set-interactive` IPC below.
  overlay.setIgnoreMouseEvents(true, { forward: true });

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

    // First-launch deep link (Windows passes it in argv).
    const link = process.argv.find((a) => a.startsWith(`${PROTOCOL}://`));
    if (link) pendingSession = parseDeepLink(link);

    createOverlay();

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
    try {
      const ctype =
        ext === "webp" ? "image/webp" : ext === "mp4" ? "video/mp4" : "video/webm";
      const headers = { "Content-Type": ctype };
      if (caption) headers["x-caption"] = encodeURIComponent(caption);
      const qs = new URLSearchParams({ token, ext }).toString();
      const res = await fetch(`${api}/api/capture?${qs}`, {
        method: "POST",
        headers,
        body: Buffer.from(base64, "base64"),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, error: json.error || `HTTP ${res.status}` };
      }
      return { ok: true, src: json.src };
    } catch (e) {
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
  return file;
});

ipcMain.on("quit", () => app.quit());

app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => app.quit());
