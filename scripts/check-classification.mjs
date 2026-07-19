#!/usr/bin/env node
// Classification guard.
//
// This repository is PUBLIC. The External Docs Standard (otd-external-docs skill)
// classifies every external or stakeholder document; anything marked CONFIDENTIAL or
// INTERNAL, or carrying a regulatory-control token (CUI / ITAR / EAR), must live
// OUTSIDE this repo. Confidential material has reached public main before, so this
// guard makes a mistaken commit a hard failure instead of a silent leak.
//
// A file trips the guard if EITHER its name carries a classification token OR it
// contains an explicit classification banner. Loose words in prose do not trip it.
//
// Filename tokens (must agree with the skill's naming contract, SKILL.md):
//   • Hyphen-terminal Axis-A token, the skill's real output shape:
//       OTD-Swarm-DiligenceBrief-2026-07-19-confidential.md
//       OTD-Swarm-DiligenceBrief-2026-07-19-confidential-ITAR.md
//   • Hyphen-terminal regulatory token on its own (any Axis-A, including public):
//       OTD-Capability-Statement-2026-08-01-public-CUI.md   (CUI still trips)
//   • Dot-delimited form, kept for backward compatibility:
//       OTD-Investor-One-Pager-2026-08-01.confidential.md
//   `-public` alone does NOT trip (public docs are allowed here); a regulatory
//   token always does, whatever Axis-A precedes it.
//
// Banner (a line near the top, optionally inside an HTML comment):
//   CLASSIFICATION: CONFIDENTIAL | INTERNAL | CUI | ITAR | EAR
//   CLASSIFICATION: PUBLIC is allowed.
//
// See docs/classification-guard.md.
//
// Usage: `node scripts/check-classification.mjs`          scans all tracked files (CI).
//        `node scripts/check-classification.mjs --staged` scans staged files (hook).
import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The guard's own files legitimately contain the banner/token strings as
// documentation. Exempt them (add here, with a reason, for any true false positive).
export const SELF_EXEMPT = new Set([
  "scripts/check-classification.mjs",
  "scripts/check-classification.test.mjs",
  "scripts/classify-stash.mjs",
  "docs/classification-guard.md",
]);

// Hyphen-terminal Axis-A token (optionally with an appended regulatory token), and
// the legacy dot-delimited form. Anchored to the final path segment before the
// extension, so `internal-state.md` / `some-internal-helper.ts` do NOT trip.
const AXIS_A_TOKEN =
  /(?:-(?:confidential|internal)(?:-(?:CUI|ITAR|EAR))?|\.(?:confidential|internal))\.[^/.]+$/i;
// Regulatory-control token on its own, whatever Axis-A class precedes it.
const REG_TOKEN = /-(?:CUI|ITAR|EAR)\.[^/.]+$/i;
const BANNER = /^\s*(?:<!--\s*)?CLASSIFICATION:\s*(CONFIDENTIAL|INTERNAL|CUI|ITAR|EAR)\b/im;
const MAX_BYTES = 512 * 1024;

// Pure detection. `path` is a repo-relative posix path; `readText` is a lazy
// () => string|null so callers control IO (and tests need none).
export function detect(path, readText) {
  if (SELF_EXEMPT.has(path)) return null;
  if (REG_TOKEN.test(path)) return "controlled (CUI/ITAR/EAR) filename token";
  if (AXIS_A_TOKEN.test(path)) return "confidential/internal filename token";
  const text = readText ? readText() : null;
  if (text != null && BANNER.test(text)) {
    return `CLASSIFICATION: ${text.match(BANNER)[1].toUpperCase()} banner`;
  }
  return null;
}

// Lazy file reader that skips oversized/binary/unreadable files (returns null).
function fileReader(path) {
  return () => {
    let st;
    try {
      st = statSync(path);
    } catch {
      return null; // staged-then-deleted, or unreadable
    }
    if (!st.isFile() || st.size > MAX_BYTES) return null;
    let buf;
    try {
      buf = readFileSync(path);
    } catch {
      return null;
    }
    if (buf.includes(0)) return null; // binary
    return buf.toString("utf8");
  };
}

function main() {
  const staged = process.argv.includes("--staged");
  // Static argument arrays, no shell, no interpolation.
  const gitArgs = staged
    ? ["diff", "--cached", "--name-only", "--diff-filter=ACM"]
    : ["ls-files"];
  const files = execFileSync("git", gitArgs, { encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean);

  const hits = [];
  for (const f of files) {
    const why = detect(f, fileReader(f));
    if (why) hits.push([f, why]);
  }

  if (hits.length) {
    console.error("");
    console.error("  Classification guard FAILED.");
    console.error("  Confidential/internal/controlled documents must NOT be committed to this public repo.");
    console.error("  Move them out of the repository tree (pnpm classify:stash <file>).");
    console.error("  See docs/classification-guard.md.");
    console.error("");
    for (const [f, why] of hits) console.error(`    x  ${f}  (${why})`);
    console.error("");
    process.exit(1);
  }
  console.log(`Classification guard: clean (${files.length} file${files.length === 1 ? "" : "s"} scanned).`);
}

// Run as a CLI, but stay importable (the test suite imports `detect`). Compare
// real filesystem paths so it works on Windows and under `node --test`.
function isMain() {
  try {
    return (
      !!process.argv[1] &&
      realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
}
if (isMain()) main();
