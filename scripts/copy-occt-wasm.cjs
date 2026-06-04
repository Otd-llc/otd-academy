// Copy occt-import-js.wasm into /public so the browser can fetch it at
// /occt-import-js.wasm (occtimportjs({ locateFile })). Runs on postinstall so a
// clean `pnpm install` always refreshes it. Idempotent.
const fs = require("node:fs");
const path = require("node:path");

const src = require.resolve("occt-import-js/dist/occt-import-js.wasm");
const destDir = path.join(__dirname, "..", "public");
const dest = path.join(destDir, "occt-import-js.wasm");

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log(`[copy-occt-wasm] ${src} -> ${dest}`);
