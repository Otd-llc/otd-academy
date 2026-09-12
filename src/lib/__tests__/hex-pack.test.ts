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
  BED_MAX,
  BED_MIN,
  DEFAULT_BED,
  MAX_PACK_INSTANCES,
  MAX_PACK_PARTS,
  PART_SLUG_RE,
  packFilename,
  platePath,
  resolvePack,
} from "@/lib/hex-pack";
import { PACK_NAME_FALLBACK } from "@/lib/hex-pack-name";

const RELEASE = "2026-07-31";
const ONE = HEX_PART_SLUGS[0];
const TWO = HEX_PART_SLUGS[1];
/** A build name, in the shape the configurator really produces: caps, spaces,
 *  and nothing that needs sanitising. Deliberately NOT the fallback, so a
 *  `platePath` that ignored its stem would fail rather than coincide. */
const STEM = "TB-1 POWER";

describe("the published part list", () => {
  it("has exactly the number of parts the spec claims", () => {
    // Both are transcribed from the same manifest by different means, so a
    // re-cut that updates one and not the other is caught here rather than by
    // someone downloading a pack that is missing a part.
    expect(HEX_PART_SLUGS.length).toBe(HEX_PART_COUNT);
  });

  it("is slugs, not part names -- these have to match the R2 keys", () => {
    // The pattern is IMPORTED, never transcribed. This test is the only thing
    // holding the grammar and the membership list to the same idea of what a
    // slug is; a local copy of the regex would agree with itself forever while
    // the real one drifted, and the symptom would be a published part the pack
    // endpoint refuses to name.
    for (const s of HEX_PART_SLUGS) expect(s).toMatch(PART_SLUG_RE);
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

  it("refuses well-formed names that are not published parts", () => {
    // These two pass the SHAPE check and are under both caps, so membership is
    // the only thing that can refuse them -- which is the point: a grammar
    // alone would let a caller spray plausible slugs and read existence off the
    // response. That membership runs before any R2 work is a property of the
    // ROUTE, not of this function, and there is no route test yet to assert it.
    const r = resolvePack({
      release: RELEASE,
      format: "3mf",
      parts: "nope-one,nope-two",
    });
    expect(r).toEqual({ ok: false, problem: "unknown-part" });
  });
});

describe("packFilename", () => {
  // The stem a request with no name resolves to, spelled through the constant
  // rather than transcribed: the fallback and the filename that carries it must
  // not be able to drift apart.
  const INSTANCES = { holds: "instances", stem: PACK_NAME_FALLBACK } as const;
  const FILES = { holds: "files", stem: PACK_NAME_FALLBACK } as const;

  it("names a single part after it", () => {
    expect(packFilename([{ slug: ONE, qty: 1 }], INSTANCES)).toBe(
      `${PACK_NAME_FALLBACK}-${ONE}.zip`,
    );
  });

  it("puts the BUILD's name in front, on both shapes", () => {
    // The point of the stem. A person who named their cluster gets a download
    // called after it, and the count -- which is what the box actually holds --
    // stays behind it rather than being replaced by it.
    const build = [
      { slug: ONE, qty: 6 },
      { slug: TWO, qty: 3 },
    ];
    expect(packFilename(build, { ...INSTANCES, stem: "TB-1 POWER" })).toBe(
      "TB-1 POWER-9-parts.zip",
    );
    expect(
      packFilename([{ slug: ONE, qty: 1 }], {
        ...INSTANCES,
        stem: "TB-1 POWER",
        ext: "3mf",
      }),
    ).toBe(`TB-1 POWER-${ONE}.3mf`);
  });

  it("counts a multi-part pack", () => {
    expect(
      packFilename(
        [
          { slug: ONE, qty: 1 },
          { slug: TWO, qty: 1 },
        ],
        INSTANCES,
      ),
    ).toBe(`${PACK_NAME_FALLBACK}-2-parts.zip`);
  });

  it("takes the extension, because a single plate is not a zip", () => {
    // A build that fits one bed ships as a bare .3mf. Named `.zip` it opens in
    // an archiver and shows the reader an XML file instead of their parts --
    // and a 3MF really is a zip underneath, so nothing would error.
    expect(
      packFilename([{ slug: ONE, qty: 1 }], { ...INSTANCES, ext: "3mf" }),
    ).toBe(`${PACK_NAME_FALLBACK}-${ONE}.3mf`);
    expect(
      packFilename([{ slug: ONE, qty: 6 }], { ...INSTANCES, ext: "3mf" }),
    ).toBe(`${PACK_NAME_FALLBACK}-6-parts.3mf`);
  });

  it("counts INSTANCES for a box that holds them -- six of one part is not a one-part pack", () => {
    // The number in the filename is what the person is about to print. Naming a
    // PLATE after the distinct count would call a six-cap plate "1-part".
    expect(packFilename([{ slug: ONE, qty: 6 }], INSTANCES)).toBe(
      `${PACK_NAME_FALLBACK}-6-parts.zip`,
    );
  });

  it("counts FILES for a box that holds one per name", () => {
    // THE DEFECT THIS PARAMETER EXISTS FOR. The loose zip holds one published
    // mesh per distinct part however many were asked for, so an instance count
    // on it named a box of one file "6-parts" while the README inside it said
    // one. Six of one name is ONE file, and one file gets named after itself.
    expect(packFilename([{ slug: ONE, qty: 6 }], FILES)).toBe(
      `${PACK_NAME_FALLBACK}-${ONE}.zip`,
    );
    expect(
      packFilename(
        [
          { slug: ONE, qty: 6 },
          { slug: TWO, qty: 3 },
        ],
        FILES,
      ),
    ).toBe(`${PACK_NAME_FALLBACK}-2-parts.zip`);
  });

  it("gives the SAME build two different names for two different boxes", () => {
    // Stated as one assertion because the two counts being different is the
    // whole reason the caller has to say which it means. A `holds` that were
    // ignored would make these equal and every other row here would still pass.
    const build = [
      { slug: ONE, qty: 6 },
      { slug: TWO, qty: 3 },
    ];
    expect(packFilename(build, INSTANCES)).toBe(`${PACK_NAME_FALLBACK}-9-parts.zip`);
    expect(packFilename(build, FILES)).toBe(`${PACK_NAME_FALLBACK}-2-parts.zip`);
  });
});

// `packReadme` moved to `hex-pack-readme.ts` alongside the plated one, and its
// tests moved with it -- see `hex-pack-readme.test.ts`.

describe("platePath", () => {
  it("names a plate one-based, with the total", () => {
    expect(platePath(1, 3, STEM)).toBe(`plates/${STEM}-plate-1-of-3.3mf`);
    expect(platePath(3, 3, STEM)).toBe(`plates/${STEM}-plate-3-of-3.3mf`);
  });

  it("is the ONE spelling the route and the README both use", () => {
    // Pinned as a literal on purpose. The zip entry and the README line are
    // written by different modules; if this string is ever edited, the literal
    // above is the thing that has to be edited deliberately, rather than one of
    // the two callers drifting and nobody noticing until someone opens the zip.
    expect(platePath(2, 10, STEM)).toBe(`plates/${STEM}-plate-2-of-10.3mf`);
  });

  it("carries the build's name onto the plate itself", () => {
    // The plate is the file that gets dragged OUT of the zip, which is exactly
    // where it loses the README and the folder. Two builds' `plate-1-of-3.3mf`
    // in one Downloads folder is a collision; these are not.
    expect(platePath(1, 3, "ALPHA")).not.toBe(platePath(1, 3, "BETA"));
    expect(platePath(1, 3, "ALPHA")).toContain("ALPHA");
  });

  it("keeps the plate ordinal AFTER the name, so a listing still sorts", () => {
    // `-plate-N-of-M` last is what keeps one build's plates adjacent and in
    // order in a directory listing. Leading with the ordinal would interleave
    // two builds extracted into the same folder.
    const paths = [1, 2, 3].map((i) => platePath(i, 3, STEM));
    expect([...paths].sort()).toEqual(paths);
  });
});

describe("the build's name, as a request field", () => {
  // Validated by `resolvePack` with every other field rather than at the point
  // it is written into a header -- see `hex-pack-name.test.ts` for the sanitiser
  // itself. What matters here is that the ROUTE'S grammar owns it, so the route
  // never handles the raw string.

  it("falls back when the caller names nothing", () => {
    for (const name of [undefined, null, ""]) {
      const r = resolvePack({ release: RELEASE, parts: ONE, name });
      expect(r.ok && r.request.stem).toBe(PACK_NAME_FALLBACK);
    }
  });

  it("carries a real name through to the request", () => {
    const r = resolvePack({ release: RELEASE, parts: ONE, name: "TB-1 POWER" });
    expect(r.ok && r.request.stem).toBe("TB-1 POWER");
  });

  it("REFUSES a name carrying a newline, rather than tidying it away", () => {
    // The header injection. `resolvePack` is the door, so this never reaches a
    // `Content-Disposition` builder that would have to be trusted to be the
    // second line of defence.
    expect(
      resolvePack({
        release: RELEASE,
        parts: ONE,
        name: "ok\r\nSet-Cookie: a=b",
      }),
    ).toEqual({ ok: false, problem: "bad-name" });
  });

  it("REFUSES a name longer than the field that could hold it", () => {
    expect(
      resolvePack({ release: RELEASE, parts: ONE, name: "A".repeat(121) }),
    ).toEqual({ ok: false, problem: "bad-name" });
  });

  it("CONTROL: exactly at the bound is accepted", () => {
    // Without this row, "121 is refused" passes just as well against a rule
    // that refuses every name, or one off by one in the other direction.
    const r = resolvePack({
      release: RELEASE,
      parts: ONE,
      name: "A".repeat(120),
    });
    expect(r.ok && r.request.stem).toBe("A".repeat(120));
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

  it("refuses a quantity with more digits than the cap can ever accept", () => {
    // `:0007` is seven and `:000...1` is one, so without a digit bound the same
    // pack has unlimited spellings. The response is cached `max-age=86400` keyed
    // on the URL, so each spelling is a fresh cache entry for identical bytes.
    for (const q of ["0000000001", "1000", "00250"]) {
      expect(resolvePack({ release: RELEASE, parts: `${ONE}:${q}` }).ok).toBe(
        false,
      );
    }
  });

  it("accepts EXACTLY MAX_PACK_INSTANCES -- the cap is inclusive", () => {
    // The rejection test below proves 251 is refused. Without this one, an
    // off-by-one that refused 250 too would pass the whole suite.
    const r = resolvePack({
      release: RELEASE,
      parts: `${ONE}:${MAX_PACK_INSTANCES}`,
    });
    expect(r.ok).toBe(true);
    expect(r.ok && r.request.parts).toEqual([
      { slug: ONE, qty: MAX_PACK_INSTANCES },
    ]);
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

  it("hands out a COPY of the default, never the shared constant", () => {
    // Two requests must not share one object. The resolved bed travels on to the
    // packer and the README, so a clamp or a normalisation added downstream
    // would otherwise write straight into the module-level default and change it
    // for every later request on the same warm serverless instance -- one user's
    // bed silently becoming everyone's, only under load, only in production.
    const a = resolvePack({ release: RELEASE, parts: ONE });
    const b = resolvePack({ release: RELEASE, parts: ONE });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.request.bed).not.toBe(b.request.bed);
    expect(a.request.bed).not.toBe(DEFAULT_BED);
    expect(a.request.bed).toEqual(DEFAULT_BED);
  });

  it("freezes the default, so a regression is a throw and not a mystery", () => {
    expect(Object.isFrozen(DEFAULT_BED)).toBe(true);
  });

  it("reads WxH", () => {
    const r = resolvePack({ release: RELEASE, parts: ONE, plate: "350x350" });
    expect(r.ok && r.request.bed).toEqual({ x: 350, y: 350 });
  });

  it("accepts both ENDS of the range -- the bounds are inclusive", () => {
    // The refusal list below only proves that values well outside the range are
    // refused. A `<=` where a `<` belongs would turn the smallest legitimate bed
    // into a 400 and still pass every other test here.
    for (const n of [BED_MIN, BED_MAX]) {
      const r = resolvePack({
        release: RELEASE,
        parts: ONE,
        plate: `${n}x${n}`,
      });
      expect(r.ok).toBe(true);
      expect(r.ok && r.request.bed).toEqual({ x: n, y: n });
    }
  });

  it("refuses a bed outside the sane range, or a non-integer", () => {
    for (const p of [
      "0x100",
      "100x0",
      "40x40",
      // The two values one step outside each bound, so an off-by-one is caught
      // from both directions rather than only by the far-away cases.
      `${BED_MIN - 1}x${BED_MIN - 1}`,
      `${BED_MAX + 1}x${BED_MAX + 1}`,
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
