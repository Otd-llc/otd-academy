// Bridge the (sandboxed) renderer to the main process.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("otd", {
  onDisplayInfo: (cb) =>
    ipcRenderer.on("display-info", (_e, info) => cb(info)),
  onTrigger: (cb) => ipcRenderer.on("trigger", () => cb()),
  onCancel: (cb) => ipcRenderer.on("cancel", () => cb()),
  setInteractive: (interactive) =>
    ipcRenderer.send("set-interactive", interactive),
  armSpace: () => ipcRenderer.send("arm-space"),
  disarmSpace: () => ipcRenderer.send("disarm-space"),
  // Deep-link session from the lesson "+" (api/token/kind/hint/caption).
  onSession: (cb) =>
    ipcRenderer.on("capture:session", (_e, s) => cb(s)),
  upload: (payload) => ipcRenderer.invoke("upload-capture", payload),
  save: (payload) => ipcRenderer.invoke("save-capture", payload),
  quit: () => ipcRenderer.send("quit"),
});
