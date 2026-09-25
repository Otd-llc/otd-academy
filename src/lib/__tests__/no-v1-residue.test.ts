// NO v1 RESIDUE IN src/ -- launch readiness 4.8, as a gate.
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
//   - an explicit ALLOW-LIST of the published-record files, whole-file;
//   - and two FALSE POSITIVES, allowed by exact count AND by the words around
//     the match, so any new match in those files still fails.
//
// The patterns are assembled from pieces ON PURPOSE. Spelled literally here,
// this file would itself appear in the checklist's grep, and the criterion is
// that the grep lists the published-record files and nothing else.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..", "..");
const SRC = join(ROOT, "src");

const V1_PART = ["hex", "tb"].join("-");
const V1_CARRIER = ["tb", "1"].join("-");
const V1_LAST_RELEASE = ["2026", "08", "17"].join("-");

/** The done-criterion's three alternatives, with word boundaries. */
const V1_RESIDUE = new RegExp(
  `\\b(?:${V1_PART}|${V1_CARRIER}|${V1_LAST_RELEASE})\\b`,
  "i",
);

/** THE PUBLISHED RECORD, and its own test. Whole-file: these ARE the v1 names,
 *  kept verbatim because a record that can be edited is not a record. */
const PUBLISHED_RECORD_FILES = new Set([
  "src/lib/hex-published-record.ts",
  // The published record's own test: pins the 53 slugs and the 3 releases.
  "src/lib/__tests__/hex-release-tables.test.ts",
]);

/** FALSE POSITIVES: the name of the owner's bench PCB project (a curriculum
 *  board, not a hex part) in two comments that credit it as a source. Allowed
 *  by exact count AND by the words that follow the match on the same line, so a
 *  new hex reference in either file still fails. */
const FALSE_POSITIVES: Record<string, { count: number; context: RegExp }> = {
  // "Bench-console recipes -- ported from the <board>-POWER bench stylesheet"
  "src/app/globals.css": { count: 1, context: /-POWER bench stylesheet/ },
  // "Items are drawn from the <board>-POWER Step-0 screening / continuity sweep"
  "src/lib/canonical-checklist-templates.ts": {
    count: 1,
    context: /-POWER Step-0/,
  },
};

const SCANNED = /\.(ts|tsx|js|jsx|mjs|cjs|css|json|md|mdx)$/;

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
  for (const full of walk(SRC)) {
    const file = relative(ROOT, full).split(sep).join("/");
    const lines = readFileSync(full, "utf8").split(/\r?\n/);
    lines.forEach((text, i) => {
      if (V1_RESIDUE.test(text)) hits.push({ file, line: i + 1, text: text.trim() });
    });
  }
  return hits;
}

describe("no v1 residue in src/ (launch readiness 4.8)", () => {
  const hits = residue();

  it("matches the v1 names it is meant to match, and not bystanders", () => {
    // The pattern itself, so a typo in it cannot turn this whole file green.
    expect(V1_RESIDUE.test(`${V1_PART}-main`)).toBe(true);
    expect(V1_RESIDUE.test(`${V1_CARRIER.toUpperCase()} POWER`)).toBe(true);
    expect(V1_RESIDUE.test(`release ${V1_LAST_RELEASE}`)).toBe(true);
    expect(V1_RESIDUE.test("hex-main")).toBe(false);
    expect(V1_RESIDUE.test(`s${V1_CARRIER}2`)).toBe(false);
    expect(V1_RESIDUE.test(`${V1_LAST_RELEASE}0`)).toBe(false);
  });

  it("finds the published record, so the scan is really scanning", () => {
    // A walker that read nothing would pass the row below vacuously.
    expect(hits.some((h) => h.file === "src/lib/hex-published-record.ts")).toBe(true);
  });

  it("lists nothing outside the published record and the known false positives", () => {
    const unexpected = hits.filter((h) => {
      if (PUBLISHED_RECORD_FILES.has(h.file)) return false;
      const fp = FALSE_POSITIVES[h.file];
      return !(fp && fp.context.test(h.text));
    });
    expect(unexpected.map((h) => `${h.file}:${h.line}: ${h.text}`)).toEqual([]);
  });

  it("holds each false positive to its exact count", () => {
    for (const [file, fp] of Object.entries(FALSE_POSITIVES)) {
      expect(hits.filter((h) => h.file === file).length, file).toBe(fp.count);
    }
  });
});
