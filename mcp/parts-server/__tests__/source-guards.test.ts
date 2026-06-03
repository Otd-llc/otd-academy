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
      // Line-anchored: catches real `import ... lib/db` statements but NOT prose
      // comments that mention the path (e.g. "deliberately does NOT import src/lib/db.ts").
      expect(src, `${f} must not import src/lib/db`).not.toMatch(/^\s*import\b[^\n]*\blib\/db/m);
    }
  });

  test("no module writes to stdout (console.log / process.stdout) — stdio is the MCP channel", () => {
    for (const f of FILES) {
      const src = readFileSync(join(SRC, f), "utf8");
      expect(src, `${f} must not console.log`).not.toMatch(/console\.log\s*\(/);
      expect(src, `${f} must not write process.stdout`).not.toMatch(/process\.stdout/);
    }
  });
});
