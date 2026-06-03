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
      // Quote-anchored: catches real module refs in any form — static `import`,
      // dynamic `import("…lib/db")`, `require("…lib/db")`, and `export {…} from "…lib/db"` —
      // by requiring a quote between the keyword and `lib/db`. Prose comments that mention
      // the unquoted path (e.g. "deliberately does NOT import src/lib/db.ts") never match.
      expect(src, `${f} must not import src/lib/db`).not.toMatch(/(?:from|import|require)\s*\(?\s*["'][^"']*lib\/db/);
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
