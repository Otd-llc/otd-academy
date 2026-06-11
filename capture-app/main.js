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

let overlay = null;

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
  });

  overlay.on("closed", () => {
    overlay = null;
  });
}

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

  createOverlay();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createOverlay();
  });
});

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

// Phase 1: save the approved capture to ~/Downloads/otd-captures/. Phase 2 swaps
// this for the academy upload + slot-fill.
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
