// The generated release tables (launch readiness 4.6), held to their own
// content hash and to each other.
//
// `hex-release-tables.ts` and `hex-part-bytes.ts` are written by hex-cluster's
// `tools/gen_release_tables.py` from `tools/parts-licence.json` + the release
// manifest. That generator commits the same two hashes in its
// `tools/release-tables.lock.json`. Neither repo's CI reads the other; each
// asserts its own copy, and a person compares the two hashes when carrying a
// regenerated file across. So the job here is: a hand edit to either file goes
// red, and the two files agree about the release and the part list.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  HEX_PART_BYTES,
  HEX_PART_BYTES_PROVISIONAL,
  HEX_PART_BYTES_RELEASE,
} from "@/lib/hex-part-bytes";
import {
  HEX_PUBLISHED_RECORD_RELEASES,
  HEX_PUBLISHED_RECORD_SLUGS,
} from "@/lib/hex-published-record";
import {
  BED_FLOOR_MM,
  HEX_PART_BOX,
  HEX_PART_COUNT,
  HEX_PART_FAMILIES,
  HEX_PART_FAMILY,
  HEX_PART_NAME,
  HEX_PART_SLUGS,
  HEX_RELEASE_FILES,
  HEX_RELEASE_TABLES_HASH,
  HEX_TABLES_RELEASE,
} from "@/lib/hex-release-tables";
import { HEX_RELEASE } from "@/lib/hex-spec";

const FILE = join(process.cwd(), "src", "lib", "hex-release-tables.ts");

/** The generator's rule, spelled independently: sha256 of the file with LF line
 *  endings and the hash line's value blanked. Normalising CRLF matters on a
 *  Windows checkout with autocrlf, which would otherwise fail a correct file. */
function contentHash(text: string): string {
  const blanked = text
    .replace(/\r\n/g, "\n")
    .replace(
      /^export const HEX_RELEASE_TABLES_HASH = "[0-9a-f]*";$/m,
      'export const HEX_RELEASE_TABLES_HASH = "";',
    );
  return createHash("sha256").update(blanked, "utf8").digest("hex");
}

describe("the generated release tables", () => {
  it("match their own content hash, so a hand edit fails here", () => {
    const text = readFileSync(FILE, "utf8");
    expect(text).toMatch(/^export const HEX_RELEASE_TABLES_HASH = "[0-9a-f]{64}";$/m);
    expect(contentHash(text)).toBe(HEX_RELEASE_TABLES_HASH);
  });

  it("CONTROL: the hash rule does see a one-character edit", () => {
    // Without this, a contentHash() that ignored its input would pass the row
    // above forever.
    const text = readFileSync(FILE, "utf8");
    const edited = text.replace('"hex-main": { x0: -95.381', '"hex-main": { x0: -95.382');
    expect(edited).not.toBe(text);
    expect(contentHash(edited)).not.toBe(HEX_RELEASE_TABLES_HASH);
  });

  it("describe the release the app serves, as the byte table does", () => {
    expect(HEX_TABLES_RELEASE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(HEX_RELEASE).toBe(HEX_TABLES_RELEASE);
    expect(HEX_PART_BYTES_PROVISIONAL).toBe(false);
    expect(HEX_PART_BYTES_RELEASE).toBe(HEX_TABLES_RELEASE);
  });

  it("list each part once, sorted, and count them", () => {
    expect([...HEX_PART_SLUGS]).toEqual([...new Set(HEX_PART_SLUGS)].sort());
    expect(HEX_PART_COUNT).toBe(HEX_PART_SLUGS.length);
  });

  it("carry the same parts in every table, the byte table included", () => {
    const want = [...HEX_PART_SLUGS];
    expect(Object.keys(HEX_PART_BYTES).sort()).toEqual(want);
    expect(Object.keys(HEX_PART_BOX).sort()).toEqual(want);
    expect(Object.keys(HEX_PART_NAME).sort()).toEqual(want);
    expect(Object.keys(HEX_PART_FAMILY).sort()).toEqual(want);
  });

  it("give every part a family the list declares, and use every family", () => {
    const declared = new Set<string>(HEX_PART_FAMILIES);
    const used = new Set(Object.values(HEX_PART_FAMILY));
    for (const f of used) expect(declared.has(f), f).toBe(true);
    expect([...used].sort()).toEqual([...HEX_PART_FAMILIES]);
  });

  it("carry none of the parts owner decision 1.6 withholds", () => {
    for (const slug of [
      "pvc-wedge",
      "hex-cover-handle",
      // pipe cut from a bought stick, never a print (owner, 2026-09-28).
      // All three saddles are RELEASED the same day: their wall reasons were stale.
      "pvc-section-single",
      "pvc-section-double",
      // the C-clip parts
      "hex-acc-hose",
      "hex-acc-probe",
      "hex-acc-trellis",
    ]) {
      expect(HEX_PART_SLUGS as readonly string[], slug).not.toContain(slug);
    }
  });

  it("carry no v1 part: those are the published record, not the release", () => {
    const live = new Set<string>(HEX_PART_SLUGS);
    for (const slug of HEX_PUBLISHED_RECORD_SLUGS) {
      expect(live.has(slug), slug).toBe(false);
    }
  });

  it("state the 220 mm bed floor (decision 1.5)", () => {
    expect(BED_FLOOR_MM).toBe(220);
  });

  it("size the 3MF set as the sum of its members", () => {
    const sum = Object.values(HEX_PART_BYTES).reduce((n, r) => n + r["3mf"], 0);
    expect(HEX_RELEASE_FILES.set.contentBytes).toBe(sum);
    expect(HEX_RELEASE_FILES.set.members).toBe(HEX_PART_COUNT);
  });
});

describe("the published record", () => {
  it("keeps the 53 v1 rows and their three releases exactly as released", () => {
    // A record that can be edited is not a record. Pinned by content, so a
    // renamed, dropped or added row fails here.
    expect([...HEX_PUBLISHED_RECORD_RELEASES]).toEqual([
      "2026-07-31",
      "2026-08-03",
      "2026-08-17",
    ]);
    expect(HEX_PUBLISHED_RECORD_SLUGS).toHaveLength(53);
    const text = HEX_PUBLISHED_RECORD_SLUGS.map((s) => `${s}\n`).join("");
    expect(createHash("sha256").update(text).digest("hex")).toBe(
      "6bb2377102425bfac696f563a83d37458463f9b2885289ed5e65fa04086206df",
    );
  });
});
