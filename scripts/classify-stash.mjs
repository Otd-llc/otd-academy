#!/usr/bin/env node
// Out-of-tree store for classified documents.
//
// A confidential / internal / controlled document must never live in this PUBLIC
// repo (see docs/classification-guard.md). This moves such a file OUT of the tree
// into a private store that the classification guard can never scan, because it is
// not in the repository at all.
//
// Store location: $OTD_CLASSIFIED_STORE, else a sibling of the repo root named
// `otd-classified` (i.e. next to project-foundry, not inside it). The helper
// REFUSES to use a store that resolves to somewhere inside the repo tree, since
// that would defeat the whole point.
//
// Usage: node scripts/classify-stash.mjs <file> [--force]
//        pnpm classify:stash <file>
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, realpathSync, renameSync, statSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Absolute path of the private store, given the environment and the repo root.
export function resolveStore(env, repoRoot) {
  const raw = env.OTD_CLASSIFIED_STORE;
  if (raw && raw.trim()) return path.resolve(raw.trim());
  return path.join(path.dirname(path.resolve(repoRoot)), "otd-classified");
}

// True when `child` is the same as, or nested inside, `parent`.
export function isInside(child, parent) {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

// Advisory: the skill's naming contract wants a terminal classification token.
function lacksToken(name) {
  return !/(?:-(?:confidential|internal)(?:-(?:CUI|ITAR|EAR))?|-(?:CUI|ITAR|EAR)|\.(?:confidential|internal))\.[^.]+$/i.test(
    name,
  );
}

function move(src, dest) {
  try {
    renameSync(src, dest);
  } catch (e) {
    if (e && e.code === "EXDEV") {
      // Cross-device (store on another drive): copy then remove.
      copyFileSync(src, dest);
      unlinkSync(src);
    } else {
      throw e;
    }
  }
}

function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) {
    console.error("usage: node scripts/classify-stash.mjs <file> [--force]");
    process.exit(2);
  }
  if (!existsSync(file) || !statSync(file).isFile()) {
    console.error(`  not a file: ${file}`);
    process.exit(2);
  }

  const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  const store = resolveStore(process.env, repoRoot);

  if (isInside(store, repoRoot)) {
    console.error(`  refusing: the store (${store}) is inside the repo tree.`);
    console.error(`  set OTD_CLASSIFIED_STORE to a path OUTSIDE ${repoRoot}.`);
    process.exit(1);
  }

  mkdirSync(store, { recursive: true });
  const dest = path.join(store, path.basename(file));
  if (existsSync(dest) && !force) {
    console.error(`  refusing: ${dest} already exists (use --force to overwrite).`);
    process.exit(1);
  }

  move(file, dest);
  console.log(`  stashed -> ${dest}`);
  if (lacksToken(path.basename(file))) {
    console.log(`  note: filename has no classification token; the skill's contract`);
    console.log(`        wants a terminal -confidential / -internal (+ -CUI/-ITAR/-EAR).`);
  }
}

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
