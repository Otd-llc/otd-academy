// NO v1 RESIDUE IN src/, scripts/ OR tools/ -- launch readiness 4.8, as a gate.
//
// v1 is dead ("No need to support v1 at all in any capacity"). What stays is the
// PUBLISHED RECORD: the 53 v1 part slugs and the three v1 release ids, which
// `/api/printable` keeps serving from immutable R2 keys. Everything else that
// names a v1 part slug, a v1 bench carrier, or the last v1 release id is
// residue, and this test fails on it.
//
// The checklist states the criterion as
//   git grep -ilE '<v1 part prefix>|<carrier name>|<last v1 release>' -- src
// listing only the published-record files. This is that grep, tightened:
//   - WORD BOUNDARIES, so an unrelated identifier that merely contains the
//     letters cannot match;
//   - over scripts/ and tools/ as well as src/: the probe and sample scripts
//     pack real parts by slug, and a v1 slug there is residue exactly as it is
//     in the app (and a script that no longer runs -- the v1 slugs left
//     `HEX_PART_NAME`, so the mesh path it builds is `undefined.3mf`);
//   - a FOURTH alternative, the v1 cap family: the part prefix alone misses 12
//     of the 53 v1 slugs, and four scripts were still packing them;
//   - an explicit ALLOW-LIST of the published-record files, whole-file;
//   - and ALLOWED LINES -- published-record lines inside live files, and false
//     positives -- each held to an exact count AND to the words around the
//     match, so any new match in those files still fails.
//
// The patterns are assembled from pieces ON PURPOSE. Spelled literally here,
// this file would itself appear in the checklist's grep, and the criterion is
// that the grep lists the published-record files and nothing else.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..", "..");
/** Every tree the gate scans. `tools/` carries no hit today; it is scanned so a
 *  generator there cannot grow one unseen. */
const SCANNED_DIRS = ["src", "scripts", "tools"];

const V1_PART = ["hex", "tb"].join("-");
const V1_CARRIER = ["tb", "1"].join("-");
const V1_LAST_RELEASE = ["2026", "08", "17"].join("-");
/** The v1 cap family: 12 of the 53 published v1 slugs, which the part prefix
 *  does not reach. v2 caps are `hex-cap-*`. */
const V1_CAP = ["dovetail", "cap"].join("-");

/** The done-criterion's three alternatives plus the v1 caps, with word
 *  boundaries. */
const V1_RESIDUE = new RegExp(
  `\\b(?:${V1_PART}|${V1_CARRIER}|${V1_LAST_RELEASE}|${V1_CAP})\\b`,
  "i",
);

/** THE PUBLISHED RECORD, and its own test. Whole-file: these ARE the v1 names,
 *  kept verbatim because a record that can be edited is not a record. */
const PUBLISHED_RECORD_FILES = new Set([
  "src/lib/hex-published-record.ts",
  // The published record's own test: pins the 53 slugs and the 3 releases.
  "src/lib/__tests__/hex-release-tables.test.ts",
  // The published LICENSE.txt: the three v1 releases' notice, byte-for-byte,
  // and the test that pins it to the published hash.
  "src/lib/hex-license-txt.ts",
  "src/lib/__tests__/hex-license-txt.test.ts",
  // A GATE, not residue: the /hex page test asserts the page does NOT match
  // the v1 terms, so the pattern has to be written in it.
  "src/lib/__tests__/hex-v2-page.test.ts",
]);

/** LINES, not files: each entry allows exactly `count` hits in its file, and
 *  only on lines whose text matches `context`, so a new v1 reference anywhere
 *  in the same file still fails. */
type AllowedLines = Record<string, { count: number; context: RegExp }>;

/** PUBLISHED-RECORD LINES inside files that are otherwise live code. */
const PUBLISHED_RECORD_LINES: AllowedLines = {
  // The download route's key cross-check: a real key of the first v1 release
  // (a v1 cap, still served from its immutable R2 segment), spelled as the
  // uploader wrote it. It tests that frozen bytes stay reachable.
  "src/lib/__tests__/printable-download.test.ts": {
    count: 2,
    context: /-double-f-1h\.3mf/,
  },
};

/** FALSE POSITIVES: the name of the owner's bench PCB project (a curriculum
 *  board, not a hex part), and one measurement date. Allowed by exact count AND
 *  by the words around the match on the same line, so a new hex reference in
 *  any of these files still fails. */
const FALSE_POSITIVES: AllowedLines = {
  // "Bench-console recipes -- ported from the <board>-POWER bench stylesheet"
  "src/app/globals.css": { count: 1, context: /-POWER bench stylesheet/ },
  // "Items are drawn from the <board>-POWER Step-0 screening / continuity sweep"
  "src/lib/canonical-checklist-templates.ts": {
    count: 1,
    context: /-POWER Step-0/,
  },
  // Two L1.03 connector parts whose notes credit the bench board they were
  // first sourced for: "Reused from <board>-POWER family."
  "scripts/seed-l103-parts.ts": { count: 2, context: /-POWER family\./ },
  // A DISCLOSURE guard, not a hex part: the uploader withholds any part built
  // around the board, because the academy disclosure policy keeps program
  // specifics off public surfaces. No v2 manifest part carries the name, so it
  // skips nothing today; it stays so a future carrier cannot publish the
  // board's footprint by accident. One comment line and the Set literal.
  "scripts/upload-printables.ts": {
    count: 2,
    context:
      /-POWER is a BioScale-BCI program test|^const WITHHELD_PARTS = new Set\(\["[^"]+-POWER"\]\);$/,
  },
  // A MEASUREMENT DATE, not a release reference: the day the Creality enforcer
  // battery ran, which the probe's "already measured" list cites.
  "scripts/hex-enforcer-probe.ts": {
    count: 1,
    context: /battery in `c:\\zzz\\probes` settled/,
  },
};

const ALLOWED_LINES: AllowedLines = {
  ...PUBLISHED_RECORD_LINES,
  ...FALSE_POSITIVES,
};

const SCANNED = /\.(ts|tsx|js|jsx|mjs|cjs|css|json|md|mdx|py)$/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (SCANNED.test(name)) out.push(full);
  }
  return out;
}

type Hit = { file: string; line: number; text: string };

function residue(): Hit[] {
  const hits: Hit[] = [];
  for (const full of SCANNED_DIRS.flatMap((d) => walk(join(ROOT, d)))) {
    const file = relative(ROOT, full).split(sep).join("/");
    const lines = readFileSync(full, "utf8").split(/\r?\n/);
    lines.forEach((text, i) => {
      if (V1_RESIDUE.test(text)) hits.push({ file, line: i + 1, text: text.trim() });
    });
  }
  return hits;
}

describe("no v1 residue in src/, scripts/ or tools/ (launch readiness 4.8)", () => {
  const hits = residue();

  it("matches the v1 names it is meant to match, and not bystanders", () => {
    // The pattern itself, so a typo in it cannot turn this whole file green.
    expect(V1_RESIDUE.test(`${V1_PART}-main`)).toBe(true);
    expect(V1_RESIDUE.test(`${V1_CARRIER.toUpperCase()} POWER`)).toBe(true);
    expect(V1_RESIDUE.test(`release ${V1_LAST_RELEASE}`)).toBe(true);
    expect(V1_RESIDUE.test(`"${V1_CAP}-single-m-solid"`)).toBe(true);
    expect(V1_RESIDUE.test("hex-main")).toBe(false);
    expect(V1_RESIDUE.test("hex-cap-edge-solid-m")).toBe(false);
    expect(V1_RESIDUE.test(`s${V1_CARRIER}2`)).toBe(false);
    expect(V1_RESIDUE.test(`${V1_LAST_RELEASE}0`)).toBe(false);
  });

  it("finds the published record, so the scan is really scanning", () => {
    // A walker that read nothing would pass the row below vacuously.
    expect(hits.some((h) => h.file === "src/lib/hex-published-record.ts")).toBe(true);
    // The same for scripts/, through a known false positive...
    expect(hits.some((h) => h.file === "scripts/seed-l103-parts.ts")).toBe(true);
    // ...and tools/ has no hit to find, so prove the walker reached it.
    expect(walk(join(ROOT, "tools")).length).toBeGreaterThan(0);
  });

  it("lists nothing outside the published record and the allowed lines", () => {
    const unexpected = hits.filter((h) => {
      if (PUBLISHED_RECORD_FILES.has(h.file)) return false;
      const allowed = ALLOWED_LINES[h.file];
      return !(allowed && allowed.context.test(h.text));
    });
    expect(unexpected.map((h) => `${h.file}:${h.line}: ${h.text}`)).toEqual([]);
  });

  it("holds each allowed file to its exact count", () => {
    for (const [file, allowed] of Object.entries(ALLOWED_LINES)) {
      expect(hits.filter((h) => h.file === file).length, file).toBe(allowed.count);
    }
  });
});
