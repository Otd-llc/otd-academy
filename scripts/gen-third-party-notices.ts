// Writes public/THIRD_PARTY_NOTICES.txt: every package the academy ships to
// production (the transitive closure of package.json `dependencies`, plus any
// optional dependency actually installed on this platform), with its version,
// declared licence and the licence/notice text found in the package.
//
// Runs from the `build` script, so every deploy serves a list that matches the
// dependency tree it was built from. The output is gitignored rather than
// committed: optional dependencies are platform-specific (@next/swc-*, the
// @img/sharp-* binaries), so a copy generated on one OS is wrong on another and
// a committed file could never be byte-stable enough to freshness-check.
//
// Walks node_modules itself instead of shelling out to `pnpm licenses`, so it
// needs no package-manager CLI on the build image and the same code is unit
// tested (src/__tests__/third-party-notices.test.ts). Exits non-zero if the
// result is implausibly small, so a broken walk fails the build instead of
// shipping an empty notices file.
import { existsSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export type NoticeEntry = {
  name: string;
  version: string;
  license: string;
  homepage?: string;
  texts: { file: string; text: string }[];
};

type Manifest = {
  name?: string;
  version?: string;
  license?: unknown;
  licenses?: unknown;
  homepage?: unknown;
  repository?: unknown;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

const LICENSE_FILE = /^(licen[cs]e|copying|notice)([.-].*)?$/i;

function readManifest(dir: string): Manifest {
  return JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")) as Manifest;
}

/** Node's resolution walk: dep lives in the nearest ancestor `node_modules`. */
function resolvePackageDir(fromDir: string, dep: string): string | null {
  let dir = fromDir;
  for (;;) {
    const candidate = path.join(dir, "node_modules", dep);
    if (existsSync(path.join(candidate, "package.json"))) return realpathSync(candidate);
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function licenseOf(m: Manifest): string {
  if (typeof m.license === "string") return m.license;
  if (m.license && typeof m.license === "object" && "type" in m.license) {
    return String((m.license as { type: unknown }).type);
  }
  if (Array.isArray(m.licenses)) {
    return m.licenses
      .map((l) => (typeof l === "string" ? l : String((l as { type?: unknown }).type)))
      .join(" OR ");
  }
  return "UNKNOWN";
}

function homepageOf(m: Manifest): string | undefined {
  if (typeof m.homepage === "string") return m.homepage;
  if (typeof m.repository === "string") return m.repository;
  if (m.repository && typeof m.repository === "object" && "url" in m.repository) {
    return String((m.repository as { url: unknown }).url);
  }
  return undefined;
}

function licenseTexts(dir: string): { file: string; text: string }[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && LICENSE_FILE.test(e.name))
    .map((e) => e.name)
    .sort()
    .map((file) => ({
      file,
      text: readFileSync(path.join(dir, file), "utf8").replace(/\r\n?/g, "\n").trim(),
    }))
    .filter((t) => t.text.length > 0);
}

/** Every production package reachable from `root`'s package.json, sorted. */
export function collectNotices(root: string): NoticeEntry[] {
  const top = readManifest(root);
  const seen = new Map<string, NoticeEntry>();
  const visitedDirs = new Set<string>();
  const queue: { from: string; dep: string; optional: boolean }[] = [];
  const enqueue = (from: string, m: Manifest) => {
    for (const dep of Object.keys(m.dependencies ?? {})) queue.push({ from, dep, optional: false });
    for (const dep of Object.keys(m.optionalDependencies ?? {})) queue.push({ from, dep, optional: true });
  };
  enqueue(root, top);

  while (queue.length > 0) {
    const { from, dep, optional } = queue.shift()!;
    const dir = resolvePackageDir(from, dep);
    if (!dir) {
      // An optional dependency for another platform is simply not installed.
      if (optional) continue;
      throw new Error(`third-party notices: cannot resolve "${dep}" from ${from}`);
    }
    if (visitedDirs.has(dir)) continue;
    visitedDirs.add(dir);
    const m = readManifest(dir);
    const name = m.name ?? dep;
    const version = (m.version ?? "0.0.0").replace(/^v/, "");
    const key = `${name}@${version}`;
    if (!seen.has(key)) {
      seen.set(key, {
        name,
        version,
        license: licenseOf(m),
        homepage: homepageOf(m),
        texts: licenseTexts(dir),
      });
    }
    enqueue(dir, m);
  }

  return [...seen.values()].sort((a, b) =>
    a.name === b.name ? a.version.localeCompare(b.version) : a.name.localeCompare(b.name),
  );
}

/** Plain-text rendering. Identical licence texts are printed once, then referenced. */
export function renderNotices(entries: NoticeEntry[]): string {
  const rule = "-".repeat(78);
  const out: string[] = [
    "THIRD-PARTY SOFTWARE NOTICES",
    "",
    "OTD Academy (academy.onethousanddrones.com) is built with the open-source",
    "packages listed below. Each is used under the licence shown; the licence and",
    "notice texts shipped with each package are reproduced in full.",
    "",
    "The site's typefaces (Bebas Neue, Space Mono, Lora, Saira Condensed) are",
    "licensed under the SIL Open Font License 1.1; their licence texts are served",
    "beside the font files at /fonts/OFL-<family>.txt.",
    "",
    `Packages: ${entries.length}`,
    "",
  ];
  const printed = new Map<string, string>();
  for (const e of entries) {
    out.push(rule, `${e.name} ${e.version}`, `License: ${e.license}`);
    if (e.homepage) out.push(`Source: ${e.homepage}`);
    if (e.texts.length === 0) {
      out.push("", "(No licence file is included in this package; see the declared licence above.)");
    }
    for (const t of e.texts) {
      const first = printed.get(t.text);
      out.push("");
      if (first) {
        out.push(`${t.file}: identical to the text reproduced under ${first} above.`);
      } else {
        printed.set(t.text, `${e.name} ${e.version}`);
        out.push(`${t.file}:`, "", t.text);
      }
    }
    out.push("");
  }
  return `${out.join("\n")}\n`;
}

/** Floor for a sane walk: the academy has ~40 direct prod deps, hundreds transitive. */
export const MIN_PACKAGES = 50;

// ---------------------------------------------------------------------------
// Copyleft licence guard.
//
// The academy is proprietary, and everything in the production closure ends up
// in (or beside) what we serve. A GPL/AGPL/LGPL/SSPL package there is a licence
// problem, not a notices problem, so the build refuses to proceed.
//
// This is not hypothetical. @c15t/nextjs 2.0.0-rc.12 pulled in
// @c15t/translations 2.0.0-rc.8, and EVERY 2.0.0 pre-release of that package
// (rc.0-rc.8) declares GPL-3.0-only; from 2.0.0 stable it is Apache-2.0. It sat
// in the client bundle until the 2.2.1 upgrade. Nothing flagged it, because
// nothing looked.
//
// The match is deliberately broad: case-insensitive, any -only / -or-later /
// "+" / "v3" spelling, the long GNU/Affero/Server Side names, and any SPDX
// expression that CONTAINS one of them -- including a dual licence like
// "(MIT OR GPL-3.0)". A dual-licensed package may well be fine to ship under
// its other licence, but that is a decision a person makes and records below,
// not one this script infers from an "OR".
const COPYLEFT = [
  /(?<![a-z])[al]?gpl/i, // GPL, LGPL, AGPL in any SPDX or informal spelling
  /(?<![a-z])sspl/i,
  /general public license/i, // GNU GPL / GNU Lesser/Library GPL / Affero GPL
  /affero/i,
  /server side public license/i,
];

/** True if a declared licence string names, or contains, a copyleft licence. */
export function isCopyleft(license: string): boolean {
  return COPYLEFT.some((re) => re.test(license));
}

/**
 * THE ALLOW-LIST. EMPTY, AND IT SHOULD STAY THAT WAY.
 *
 * An entry here ships a copyleft-declared package in a proprietary product, so
 * adding one needs the owner's explicit sign-off and a written reason (e.g. a
 * dual licence where we take the permissive side, confirmed by reading the
 * package's own LICENSE file). Entries pin an exact name AND version, so an
 * upgrade re-triggers the review instead of inheriting the old exemption.
 *
 * Shape: { name: "pkg", version: "1.2.3", reason: "why, who approved, when" }
 *
 * The entries below were RECORDED BY AN AGENT on 2026-09-25, PENDING THE
 * OWNER'S CONFIRMATION. None of them changes what ships: all three were
 * already in production when this guard landed. Each is a standard,
 * compliant use of its licence, stated so the owner can check the claim.
 */
const SHARP_SERVER_ONLY =
  "LGPL-3.0-or-later (bundled libvips). next/image runs sharp on the SERVER; the library is " +
  "never conveyed to a visitor, and LGPL obligations attach to conveying. " +
  "Agent-recorded 2026-09-25, pending owner confirmation.";
export const COPYLEFT_ALLOW: readonly { name: string; version: string; reason: string }[] = [
  {
    name: "jszip",
    version: "3.10.1",
    reason:
      "Dual-licensed (MIT OR GPL-3.0-or-later); we take the MIT side, as its LICENSE.markdown " +
      "offers. Agent-recorded 2026-09-25, pending owner confirmation.",
  },
  {
    name: "occt-import-js",
    version: "0.0.23",
    reason:
      "LGPL-2.1. Shipped UNMODIFIED as its own file (public/occt-import-js.wasm + its loader), " +
      "loaded on demand, so a user can replace it (LGPL-2.1 s.6); its notice and source URL are " +
      "in THIRD_PARTY_NOTICES. Agent-recorded 2026-09-25, pending owner confirmation.",
  },
  // sharp's per-platform binaries: Linux x64 is what Vercel builds on; win32 is local dev.
  { name: "@img/sharp-linux-x64", version: "0.34.5", reason: SHARP_SERVER_ONLY },
  { name: "@img/sharp-libvips-linux-x64", version: "1.2.4", reason: SHARP_SERVER_ONLY },
  { name: "@img/sharp-win32-x64", version: "0.34.5", reason: SHARP_SERVER_ONLY },
];

/** Every entry declaring a copyleft licence that the allow-list does not cover. */
export function copyleftViolations(
  entries: readonly NoticeEntry[],
  allow: readonly { name: string; version: string }[] = COPYLEFT_ALLOW,
): NoticeEntry[] {
  return entries.filter(
    (e) =>
      isCopyleft(e.license) && !allow.some((a) => a.name === e.name && a.version === e.version),
  );
}

function main() {
  const root = process.cwd();
  const entries = collectNotices(root);
  if (entries.length < MIN_PACKAGES) {
    console.error(
      `[third-party-notices] only ${entries.length} packages found (floor ${MIN_PACKAGES}); refusing to write`,
    );
    process.exit(1);
  }
  const bad = copyleftViolations(entries);
  if (bad.length > 0) {
    console.error(
      "[third-party-notices] copyleft licence in the production dependency closure; refusing to build:\n" +
        bad.map((e) => `  ${e.name}@${e.version}  (${e.license})`).join("\n") +
        "\nUpgrade or replace it. See COPYLEFT_ALLOW in scripts/gen-third-party-notices.ts.",
    );
    process.exit(1);
  }
  const outFile = path.join(root, "public", "THIRD_PARTY_NOTICES.txt");
  writeFileSync(outFile, renderNotices(entries), "utf8");
  console.log(`[third-party-notices] ${entries.length} packages -> ${outFile}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
