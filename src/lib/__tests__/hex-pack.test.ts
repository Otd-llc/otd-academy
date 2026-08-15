// What a custom pack request is allowed to ask for.
//
// The interesting cases are all refusals. This endpoint turns one request into
// one R2 read per named part, so the validation is what stands between a
// selection and an unbounded fan-out — and it is the only place a caller could
// learn which part names are real.
import { describe, expect, it } from "vitest";

import { HEX_PART_SLUGS, isHexPartSlug } from "@/lib/hex-parts";
import { HEX_PART_COUNT } from "@/lib/hex-spec";
import {
  MAX_PACK_INSTANCES,
  MAX_PACK_PARTS,
  packFilename,
  packReadme,
  resolvePack,
} from "@/lib/hex-pack";

const RELEASE = "2026-07-31";
const ONE = HEX_PART_SLUGS[0];
const TWO = HEX_PART_SLUGS[1];

describe("the published part list", () => {
  it("has exactly the number of parts the spec claims", () => {
    // Both are transcribed from the same manifest by different means, so a
    // re-cut that updates one and not the other is caught here rather than by
    // someone downloading a pack that is missing a part.
    expect(HEX_PART_SLUGS.length).toBe(HEX_PART_COUNT);
  });

  it("is slugs, not part names -- these have to match the R2 keys", () => {
    for (const s of HEX_PART_SLUGS) expect(s).toMatch(/^[a-z0-9][a-z0-9-]*$/);
  });

  it("has no duplicates", () => {
    expect(new Set(HEX_PART_SLUGS).size).toBe(HEX_PART_SLUGS.length);
  });

  it("does NOT contain the withheld part", () => {
    // TB-1-POWER is withheld on disclosure grounds: a carrier is shaped around
    // its board, so publishing it publishes that board's footprint.
    expect(HEX_PART_SLUGS.some((s) => s.includes("tb-1-power"))).toBe(false);
  });

  it("rejects a well-formed slug that is not one of ours", () => {
    expect(isHexPartSlug("hex-tb-main")).toBe(true);
    expect(isHexPartSlug("not-a-real-part")).toBe(false);
  });
});

describe("resolvePack", () => {
  it("accepts a real selection", () => {
    const r = resolvePack({
      release: RELEASE,
      format: "3mf",
      parts: `${ONE},${TWO}`,
    });
    expect(r.ok).toBe(true);
    if (r.ok)
      expect(r.request.parts).toEqual([
        { slug: ONE, qty: 1 },
        { slug: TWO, qty: 1 },
      ]);
  });

  it("defaults to 3mf, the format that carries units and part names", () => {
    const r = resolvePack({ release: RELEASE, parts: ONE });
    expect(r.ok && r.request.format).toBe("3mf");
  });

  it("refuses STEP, which is kept in CAD pose and would slice wrong", () => {
    expect(
      resolvePack({ release: RELEASE, format: "step", parts: ONE }),
    ).toEqual({
      ok: false,
      problem: "bad-format",
    });
  });

  it.each([
    ["traversal", "../../secrets"],
    ["an absolute key", "printables/2026-07-31/3mf/hex-tb-main"],
    ["a plausible invention", "hex-tb-main-v2"],
    ["empty-ish", " , , "],
  ])("refuses %s", (_why: string, parts: string) => {
    const r = resolvePack({ release: RELEASE, format: "3mf", parts });
    expect(r.ok).toBe(false);
  });

  it.each([
    ["not a date", "latest"],
    ["traversal", "../2026-07-31"],
    ["absent", ""],
  ])("refuses release %s", (_why: string, release: string) => {
    expect(resolvePack({ release, format: "3mf", parts: ONE })).toEqual({
      ok: false,
      problem: "bad-release",
    });
  });

  it("refuses an empty selection rather than building an empty zip", () => {
    expect(resolvePack({ release: RELEASE, format: "3mf", parts: "" })).toEqual(
      {
        ok: false,
        problem: "empty",
      },
    );
  });

  it("collapses duplicates instead of reading the same object twice", () => {
    // One LINE per slug, however many times it is named -- that is what keeps
    // the R2 fan-out equal to the number of distinct parts. The repeats are
    // carried as a quantity now rather than discarded.
    const r = resolvePack({
      release: RELEASE,
      format: "3mf",
      parts: `${ONE},${ONE},${TWO}`,
    });
    expect(r.ok && r.request.parts).toEqual([
      { slug: ONE, qty: 2 },
      { slug: TWO, qty: 1 },
    ]);
  });

  it("caps the fan-out at the real part count", () => {
    // Reachable only by repeating names, which dedupe -- so this is a guard
    // against a malformed request, not a limit a selection can hit.
    const many = Array.from({ length: MAX_PACK_PARTS + 1 }, (_, i) => `p${i}`);
    expect(
      resolvePack({ release: RELEASE, format: "3mf", parts: many.join(",") }),
    ).toEqual({
      ok: false,
      problem: "too-many",
    });
  });

  it("checks membership BEFORE size, so a spray is cheap to refuse", () => {
    // Ordering matters: an unknown name must cost a set lookup, never a read.
    const r = resolvePack({
      release: RELEASE,
      format: "3mf",
      parts: "nope-one,nope-two",
    });
    expect(r).toEqual({ ok: false, problem: "unknown-part" });
  });
});

describe("packFilename", () => {
  it("names a single part after it", () => {
    expect(packFilename([{ slug: ONE, qty: 1 }])).toBe(
      `hex-cluster-${ONE}.zip`,
    );
  });

  it("counts a multi-part pack", () => {
    expect(
      packFilename([
        { slug: ONE, qty: 1 },
        { slug: TWO, qty: 1 },
      ]),
    ).toBe("hex-cluster-2-parts.zip");
  });

  it("counts INSTANCES, not names -- six of one part is not a one-part pack", () => {
    // The number in the filename is what the person is about to print. Naming
    // it after the distinct count would call a six-cap pack "1-part".
    expect(packFilename([{ slug: ONE, qty: 6 }])).toBe(
      "hex-cluster-6-parts.zip",
    );
  });
});

describe("packReadme", () => {
  const base = {
    release: RELEASE,
    format: "3mf" as const,
    parts: [
      { slug: ONE, qty: 1 },
      { slug: TWO, qty: 1 },
    ],
    credit: "Hex Cluster by One Thousand Drones, LLC, licensed CC BY 4.0.",
    specUrl: "https://academy.onethousanddrones.com/hex",
    printLines: ["Material: FDM PETG"],
    supportNote: ["Every part here stands on a flat face."],
  };

  it("carries the credit -- a pack is a redistribution of a CC BY work", () => {
    // The one condition of the licence is that the attribution travels with the
    // files. Shipping a subset without it would be us breaking the terms we ask
    // every downstream remixer to keep, on our own work.
    expect(packReadme(base)).toContain(base.credit);
  });

  it("says plainly that it is a subset, and where the whole set is", () => {
    const out = packReadme(base);
    expect(out).toContain("SUBSET");
    expect(out).toContain(base.specUrl);
  });

  it("lists every part it contains", () => {
    const out = packReadme(base);
    for (const p of base.parts) expect(out).toContain(p.slug);
  });

  it("records the release, so a pack can be traced to its geometry", () => {
    expect(packReadme(base)).toContain(RELEASE);
  });
});

describe("quantities", () => {
  it("reads a bare slug as one", () => {
    const r = resolvePack({ release: RELEASE, parts: ONE });
    expect(r.ok && r.request.parts).toEqual([{ slug: ONE, qty: 1 }]);
  });

  it("reads slug:n", () => {
    const r = resolvePack({ release: RELEASE, parts: `${ONE}:3` });
    expect(r.ok && r.request.parts).toEqual([{ slug: ONE, qty: 3 }]);
  });

  it("sums a repeated slug rather than dropping one", () => {
    // The old code Set-deduped, which silently lost the second mention.
    const r = resolvePack({ release: RELEASE, parts: `${ONE}:2,${ONE}:3` });
    expect(r.ok && r.request.parts).toEqual([{ slug: ONE, qty: 5 }]);
  });

  it("refuses a zero, a negative, or a non-integer quantity", () => {
    for (const q of ["0", "-1", "1.5", "x"]) {
      expect(resolvePack({ release: RELEASE, parts: `${ONE}:${q}` }).ok).toBe(
        false,
      );
    }
  });

  it("refuses more than MAX_PACK_INSTANCES total items", () => {
    const r = resolvePack({
      release: RELEASE,
      parts: `${ONE}:${MAX_PACK_INSTANCES},${TWO}:1`,
    });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.problem).toBe("too-many");
  });
});

describe("the bed", () => {
  it("defaults to 220 square when absent", () => {
    const r = resolvePack({ release: RELEASE, parts: ONE });
    expect(r.ok && r.request.bed).toEqual({ x: 220, y: 220 });
  });

  it("reads WxH", () => {
    const r = resolvePack({ release: RELEASE, parts: ONE, plate: "350x350" });
    expect(r.ok && r.request.bed).toEqual({ x: 350, y: 350 });
  });

  it("refuses a bed outside the sane range, or a non-integer", () => {
    for (const p of [
      "0x100",
      "100x0",
      "40x40",
      "2000x2000",
      "350",
      "axb",
      "350x350x350",
    ]) {
      expect(resolvePack({ release: RELEASE, parts: ONE, plate: p }).ok).toBe(
        false,
      );
    }
  });

  it("says WHICH thing was malformed", () => {
    // The bed is the one field a person edits by hand in a URL. Answering
    // "bad-bed" rather than a generic refusal is not a leak: bed sizes are not
    // secrets, unlike which part names are real.
    expect(
      resolvePack({ release: RELEASE, parts: ONE, plate: "40x40" }),
    ).toEqual({ ok: false, problem: "bad-bed" });
  });
});
