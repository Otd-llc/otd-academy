// The per-part byte table the pack budget runs on, as the 4.6 generator
// (hex-cluster `tools/gen_release_tables.py`) writes it.
import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  HEX_PART_BYTES,
  HEX_PART_BYTES_HASH,
  HEX_PART_BYTES_PROVISIONAL,
  HEX_PART_BYTES_RELEASE,
} from "@/lib/hex-part-bytes";
import { PART_SLUG_RE } from "@/lib/hex-pack";
import {
  PACK_BYTE_BUDGET,
  estimatePackBytes,
  estimatePlateBytes,
  formatMegabytes,
} from "@/lib/hex-pack-budget";
import { HEX_RELEASE } from "@/lib/hex-spec";
import type { Placement } from "@/lib/hex-plate";

/** The canonical text the hash is taken over. Spelled out HERE, independently
 *  of the file, because it is the cross-repo contract: the hex-cluster
 *  generator hashes the same text and commits the result. */
function canonicalText(table: typeof HEX_PART_BYTES): string {
  return Object.keys(table)
    .sort()
    .map((slug) => `${slug}\t${table[slug]["3mf"]}\t${table[slug].stl}\n`)
    .join("");
}

describe("the byte table", () => {
  it("matches its own committed content hash", () => {
    const hash = createHash("sha256")
      .update(canonicalText(HEX_PART_BYTES))
      .digest("hex");
    expect(hash).toBe(HEX_PART_BYTES_HASH);
  });

  it("has a positive whole number of bytes for both formats on every row", () => {
    for (const [slug, row] of Object.entries(HEX_PART_BYTES)) {
      expect(PART_SLUG_RE.test(slug), slug).toBe(true);
      for (const n of [row["3mf"], row.stl]) {
        expect(Number.isInteger(n) && n > 0, slug).toBe(true);
      }
    }
  });

  it("carries none of the parts owner decision 1.6 withholds", () => {
    for (const slug of [
      "pvc-wedge",
      "hex-cover-handle",
      "hex-acc-saddle",
      "hex-acc-saddle-half",
      // the C-clip parts
      "hex-acc-hose",
      "hex-acc-probe",
      "hex-acc-trellis",
    ]) {
      expect(HEX_PART_BYTES[slug], slug).toBeUndefined();
    }
  });

  it("is pinned to the release once it is no longer provisional", () => {
    // While provisional (a local build, not a release) there is no release to
    // pin to, and the flag says so. The 4.6 generator flips the flag, and from
    // then on a table measured from another release fails here.
    if (HEX_PART_BYTES_PROVISIONAL) {
      expect(HEX_PART_BYTES_RELEASE).toBeNull();
    } else {
      expect(HEX_PART_BYTES_RELEASE).toBe(HEX_RELEASE);
    }
  });
});

describe("the estimates", () => {
  const table = {
    a: { "3mf": 1_000, stl: 5_000 },
    b: { "3mf": 300, stl: 900 },
  };

  it("prices a 3MF pack as the sum of quantity times bytes", () => {
    expect(
      estimatePackBytes(
        [
          { slug: "a", qty: 3 },
          { slug: "b", qty: 2 },
        ],
        "3mf",
        table,
      ),
    ).toBe(3_600);
  });

  it("prices an STL pack by DISTINCT part, as the loose zip ships it", () => {
    expect(
      estimatePackBytes(
        [
          { slug: "a", qty: 3 },
          { slug: "b", qty: 2 },
        ],
        "stl",
        table,
      ),
    ).toBe(5_900);
  });

  it("answers null, never zero, for a part with no row", () => {
    expect(estimatePackBytes([{ slug: "zzz", qty: 1 }], "3mf", table)).toBeNull();
    expect(estimatePackBytes([{ slug: "zzz", qty: 1 }], "stl", table)).toBeNull();
  });

  it("prices a plate by the copies placed on it", () => {
    const at = (slug: string) =>
      ({ slug, name: slug, x: 0, y: 0, box: { x0: 0, y0: 0, z0: 0, dx: 1, dy: 1, dz: 1 } }) as Placement;
    expect(estimatePlateBytes([at("a"), at("a"), at("b")], table)).toBe(2_300);
    expect(estimatePlateBytes([at("zzz")], table)).toBeNull();
  });

  it("uses a decimal 8 MB budget and says megabytes the same way", () => {
    expect(PACK_BYTE_BUDGET).toBe(8_000_000);
    expect(formatMegabytes(PACK_BYTE_BUDGET)).toBe("8.0 MB");
    expect(formatMegabytes(137_501_500)).toBe("137.5 MB");
  });
});
