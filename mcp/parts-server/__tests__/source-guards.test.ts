import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, test } from "vitest";

const DIR = dirname(fileURLToPath(import.meta.url));
const SRC = join(DIR, "..");
const FILES = ["index.ts", "server.ts", "client.ts", "tools.ts", "format.ts", "env.ts"];

describe("MCP server source guards", () => {
  test("no module imports the read-write owner client (src/lib/db)", () => {
    for (const f of FILES) {
      const src = readFileSync(join(SRC, f), "utf8");
      // Quote-anchored on BOTH sides: catches real module refs in any form — static
      // `import`, dynamic `import("…lib/db")`, `require("…lib/db")`, and
      // `export {…} from "…lib/db"` — by requiring a quote before `lib/db` and the
      // CLOSING quote (optionally past a .ts/.js extension) straight after it. Prose
      // comments that mention the unquoted path (e.g. "deliberately does NOT import
      // src/lib/db.ts") never match.
      //
      // The trailing anchor is load-bearing: `lib/db` is a PREFIX of `lib/db-adapter`,
      // which client.ts legitimately imports (it builds no client and reads no env, so
      // sharing it cannot leak the read-write client). Without the closing quote this
      // guard flagged that safe import and failed — and the tempting fix, loosening the
      // pattern, would have blunted the real check. This is the tight version instead.
      expect(src, `${f} must not import src/lib/db`).not.toMatch(
        /(?:from|import|require)\s*\(?\s*["'][^"']*lib\/db(?:\.[jt]s)?["']/,
      );
    }
  });

  test("no module writes to stdout (console.log / process.stdout) — stdio is the MCP channel", () => {
    for (const f of FILES) {
      const src = readFileSync(join(SRC, f), "utf8");
      // On Node 24, console.info/debug/dir/table also write to stdout (only
      // warn/error/trace go to stderr) — any would corrupt the MCP protocol stream.
      expect(src, `${f} must not write stdout via console`).not.toMatch(/console\.(log|info|debug|dir|table)\s*\(/);
      expect(src, `${f} must not write process.stdout`).not.toMatch(/process\.stdout/);
    }
  });
});
