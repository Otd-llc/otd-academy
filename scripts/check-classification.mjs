#!/usr/bin/env node
// Classification guard.
//
// This repository is PUBLIC. The External Docs Standard classifies every external or
// stakeholder document; anything marked CONFIDENTIAL or INTERNAL must live OUTSIDE
// this repo. Confidential material has reached public main before, so this guard
// makes a mistaken commit a hard failure instead of a silent leak.
//
// A file trips the guard if EITHER its name carries a classification token
// (`.confidential.` / `.internal.`) OR it contains an explicit classification banner
// (`CLASSIFICATION: CONFIDENTIAL` / `INTERNAL`, optionally in an HTML comment). Loose
// words in prose do not trip it. See docs/classification-guard.md.
//
// Usage: `node scripts/check-classification.mjs` scans all tracked files (CI).
//        `node scripts/check-classification.mjs --staged` scans staged files (hook).
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

// The guard's own files legitimately contain the banner/token strings as
// documentation. Exempt them (add here, with a reason, for any true false positive).
const SELF_EXEMPT = new Set([
  "scripts/check-classification.mjs",
  "docs/classification-guard.md",
]);

const FILENAME_TOKEN = /\.(confidential|internal)\.[^/.]+$/i;
const BANNER = /^\s*(?:<!--\s*)?CLASSIFICATION:\s*(CONFIDENTIAL|INTERNAL)\b/im;
const MAX_BYTES = 512 * 1024;

const staged = process.argv.includes("--staged");
// Static argument arrays, no shell, no interpolation.
const gitArgs = staged
  ? ["diff", "--cached", "--name-only", "--diff-filter=ACM"]
  : ["ls-files"];
const files = execFileSync("git", gitArgs, { encoding: "utf8" }).split(/\r?\n/).filter(Boolean);

const hits = [];
for (const f of files) {
  if (SELF_EXEMPT.has(f)) continue;
  if (FILENAME_TOKEN.test(f)) {
    hits.push([f, "confidential/internal filename token"]);
    continue;
  }
  let st;
  try {
    st = statSync(f);
  } catch {
    continue; // staged-then-deleted, or unreadable
  }
  if (!st.isFile() || st.size > MAX_BYTES) continue;
  let buf;
  try {
    buf = readFileSync(f);
  } catch {
    continue;
  }
  if (buf.includes(0)) continue; // binary
  if (BANNER.test(buf.toString("utf8"))) {
    hits.push([f, "CLASSIFICATION: CONFIDENTIAL/INTERNAL banner"]);
  }
}

if (hits.length) {
  console.error("");
  console.error("  Classification guard FAILED.");
  console.error("  Confidential/internal documents must NOT be committed to this public repo.");
  console.error("  Move them out of the repository tree. See docs/classification-guard.md.");
  console.error("");
  for (const [f, why] of hits) console.error(`    x  ${f}  (${why})`);
  console.error("");
  process.exit(1);
}
console.log(`Classification guard: clean (${files.length} file${files.length === 1 ? "" : "s"} scanned).`);
