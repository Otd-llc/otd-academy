// Bridge the (sandboxed) renderer to the main process.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("otd", {
  onDisplayInfo: (cb) =>
    ipcRenderer.on("display-info", (_e, info) => cb(info)),
  onTrigger: (cb) => ipcRenderer.on("trigger", () => cb()),
  onCancel: (cb) => ipcRenderer.on("cancel", () => cb()),
  onToggleFollow: (cb) => ipcRenderer.on("toggle-follow", () => cb()),
  // Script text for the standalone teleprompter window.
  onTeleprompterScript: (cb) =>
    ipcRenderer.on("teleprompter:script", (_e, text) => cb(text)),
  trackCursor: (on) => ipcRenderer.send("cursor-track", on),
  onCursorPos: (cb) => ipcRenderer.on("cursor:pos", (_e, p) => cb(p)),
  setInteractive: (interactive) =>
    ipcRenderer.send("set-interactive", interactive),
  armSpace: () => ipcRenderer.send("arm-space"),
  disarmSpace: () => ipcRenderer.send("disarm-space"),
  // Deep-link session from the lesson "+" (api/token/kind/hint/caption/script).
  onSession: (cb) =>
    ipcRenderer.on("capture:session", (_e, s) => cb(s)),
  upload: (payload) => ipcRenderer.invoke("upload-capture", payload),
  save: (payload) => ipcRenderer.invoke("save-capture", payload),
  // Multi-clip: persist a recorded clip to a temp file, and stitch the ordered set.
  saveClip: (payload) => ipcRenderer.invoke("save-clip", payload),
  exportClips: (payload) => ipcRenderer.invoke("export-clips", payload),
  // Timeline editor window.
  openEditor: (payload) => ipcRenderer.send("open-editor", payload),
  closeEditor: () => ipcRenderer.send("close-editor"),
  onEditorInit: (cb) => ipcRenderer.on("editor:init", (_e, d) => cb(d)),
  quit: () => ipcRenderer.send("quit"),
  // Diagnostic: write a line into the main-process log (otd-capture.log) from the
  // renderer, so we can see exactly when the recording pump stalls.
  log: (msg) => ipcRenderer.send("renderer-log", String(msg)),
});
