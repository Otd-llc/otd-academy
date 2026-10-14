// The generated support data (launch readiness 4.7), held to its own content
// hash and to the release it describes.
//
// `hex-support-data.ts` is written by `scripts/gen-hex-support-data.ts` from
// hex-cluster's `build/support-data-<release>.json` (the owner's slice, 4.4).
// That file lives outside this repo, so the suite cannot regenerate and compare;
// what it can do is refuse a hand edit (the hash) and refuse rows that disagree
// with the release, the print intent table, or themselves.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  INTENT_EVERY_PART,
  INTENT_EVERY_PART_DISPLAY,
} from "@/lib/hex-print-intent";
import { HEX_PART_SLUGS, HEX_TABLES_RELEASE } from "@/lib/hex-release-tables";
import { HEX_PRINT_PARAMS } from "@/lib/hex-spec";
import {
  HEX_SUPPORT_COUNTS,
  HEX_SUPPORT_DATA_HASH,
  HEX_SUPPORT_PROFILE,
  HEX_SUPPORT_ROWS,
  HEX_SUPPORT_SOURCE,
} from "@/lib/hex-support-data";

const FILE = join(process.cwd(), "src", "lib", "hex-support-data.ts");

/** The generator's rule, spelled independently: sha256 of the file with LF line
 *  endings and the hash line's value blanked. */
function contentHash(text: string): string {
  const blanked = text
    .replace(/\r\n/g, "\n")
    .replace(
      /^export const HEX_SUPPORT_DATA_HASH = "[0-9a-f]*";$/m,
      'export const HEX_SUPPORT_DATA_HASH = "";',
    );
  return createHash("sha256").update(blanked, "utf8").digest("hex");
}

describe("the generated support data", () => {
  it("matches its own content hash, so a hand edit fails here", () => {
    const text = readFileSync(FILE, "utf8");
    expect(text).toMatch(/^export const HEX_SUPPORT_DATA_HASH = "[0-9a-f]{64}";$/m);
    expect(contentHash(text)).toBe(HEX_SUPPORT_DATA_HASH);
  });

  it("CONTROL: the hash rule does see a one-character edit", () => {
    const text = readFileSync(FILE, "utf8");
    const edited = text.replace("brim: true", "brim: false");
    expect(edited).not.toBe(text);
    expect(contentHash(edited)).not.toBe(HEX_SUPPORT_DATA_HASH);
  });

  it("describes the release the tables describe", () => {
    expect(HEX_SUPPORT_SOURCE.format).toBe("otd-hex-support-data/1");
    expect(HEX_SUPPORT_SOURCE.release).toBe(HEX_TABLES_RELEASE);
    expect(HEX_SUPPORT_SOURCE.file).toBe(
      `support-data-${HEX_TABLES_RELEASE}.json`,
    );
  });

  it("carries the 2026-10-12 slice, as the owner cleared it: 4 support, 13 brim", () => {
    // Pinned by content, so a regenerated file that moves a part in or out of
    // either list shows up as this test failing, not as a quiet diff.
    // The COUNTS are the slice's: 716 sliced, 13 flagged for a brim. The ROWS are
    // released parts only, and the two PVC stubs are withheld (cut pipe, owner
    // 2026-09-28), so eleven brim rows remain. (2026-10-01: 297 sliced, 5
    // support, 3 brim; the 2026-10-10 cut added the drawers, tall parts and
    // socket caps, and every 2026-10-01 flag was still flagged. 2026-10-12
    // filled the ledge under the thickened cut wall: hex-half-w, hex-quarter-nw
    // and hex-quarter-sw at one to three storeys left the list, and nothing
    // joined it.) Then the OWNER CLEARED 62 of the 66 the slicer still flags
    // (2026-10-12, "Mark them anyway", not yet test-printed): every drawer body,
    // tub and plate, the trinity handle and the zip insert -- bridges and
    // channel roofs. Only the four socket bolt caps, printed face down by the
    // owner's rule, keep support.
    expect(HEX_SUPPORT_COUNTS).toEqual({ parts: 716, support: 4, brim: 13, both: 0 });
    expect(HEX_SUPPORT_ROWS.filter((r) => r.support).map((r) => r.slug)).toEqual([
      "hex-cap-edge-socket-bolt-f",
      "hex-cap-edge-socket-bolt-f-x2",
      "hex-cap-edge-socket-bolt-m",
      "hex-cap-edge-socket-bolt-m-x2",
    ]);
    expect(HEX_SUPPORT_ROWS.filter((r) => r.brim).map((r) => r.slug)).toEqual([
      "hex-drawer-long-plate-s-x3",
      "hex-drawer-runner-n",
      "hex-drawer-runner-n-x2",
      "hex-drawer-runner-n-x3",
      "hex-drawer-runner-s",
      "hex-drawer-runner-s-x2",
      "hex-drawer-runner-s-x3",
      "hex-drawer-slide-plate-n-x3",
      "hex-drawer-slide-plate-s-x2",
      "hex-drawer-slide-plate-s-x3",
      "hex-spike-stud",
    ]);
  });

  it("lists only flagged, released parts, once each, sorted", () => {
    const live = new Set<string>(HEX_PART_SLUGS);
    const slugs = HEX_SUPPORT_ROWS.map((r) => r.slug);
    expect(slugs).toEqual([...new Set(slugs)].sort());
    for (const r of HEX_SUPPORT_ROWS) {
      expect(live.has(r.slug), r.slug).toBe(true);
      expect(r.support || r.brim, r.slug).toBe(true);
    }
  });

  it("gives every row a plain-ASCII note that says what it needs", () => {
    for (const r of HEX_SUPPORT_ROWS) {
      expect(r.note, r.slug).toMatch(/^[\x20-\x7e]+$/);
      if (r.support) expect(r.note, r.slug).toMatch(/support/);
      if (r.brim) expect(r.note, r.slug).toMatch(/brim/);
    }
  });

  it("was sliced against the profile the plate carries (decision 1.4)", () => {
    // The slice is only evidence about a plate printed the same way. If the
    // intent table moves off 1.4, the support list stops describing it.
    expect(HEX_SUPPORT_PROFILE.material).toBe("PETG");
    expect(`${HEX_SUPPORT_PROFILE.infillDensityPct}%`).toBe(
      INTENT_EVERY_PART.sparse_infill_density,
    );
    expect(HEX_SUPPORT_PROFILE.infillPattern).toBe(
      INTENT_EVERY_PART_DISPLAY.sparse_infill_pattern,
    );
    expect(String(HEX_SUPPORT_PROFILE.walls)).toBe(INTENT_EVERY_PART.wall_loops);
    expect(HEX_PRINT_PARAMS.find((r) => r.label === "Layer")?.value).toBe(
      `${HEX_SUPPORT_PROFILE.layerMm.toFixed(2)} mm`,
    );
  });
});
