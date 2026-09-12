// What a download's README has to say.
//
// It is the only thing in the box that is READ rather than sliced, and the only
// place three facts can be stated: which bed this was arranged for, what is on
// each plate and how many, and how much of the arrangement is actually a promise
// (measured answer: it is a starting point -- every slicer recentres the scene,
// and the user's own auto-arrange overrides us entirely). A README that
// overclaims the layout turns expected slicer behaviour into a bug report.
//
// Prose assertions run against a WHITESPACE-FLATTENED copy. The module hard-wraps
// at 72 columns because the reader is a terminal, so a phrase is free to land
// across a line break; asserting on the raw string would pin the wrap points and
// break on any edit to the sentence around them.
import { describe, expect, it } from "vitest";

import { platePath } from "@/lib/hex-pack";
import {
  packNeedsSupport,
  packReadme,
  plateDescription,
  plateReadme,
} from "@/lib/hex-pack-readme";
import type { Placement } from "@/lib/hex-plate";
import { HEX_LICENSE } from "@/lib/hex-spec";

const RELEASE = "2026-08-03";
const SPEC_URL = "https://academy.onethousanddrones.com/hex";
/** The build's name, as the zip entries spell it. NOT the fallback, so a README
 *  that ignored the stem it was handed would list files the archive does not
 *  hold rather than coincidentally agreeing with it. */
const STEM = "TB-1 POWER";
const BOX = { x0: 0, y0: 0, z0: 0, dx: 40, dy: 30, dz: 10 } as const;

const at = (slug: string, name: string): Placement => ({
  slug,
  name,
  box: BOX,
  x: 4,
  y: 4,
});

/** A part that needs NOTHING: 826 sq mm on the bed and no warning from the
 *  slicer. It used to be `hex-tb-main`, which the calibration sweep moved onto
 *  the support list along with the rest of the `base` family. A neutral fixture
 *  has to actually be neutral, or every row using it fails for a reason
 *  unrelated to what it asserts. */
const PLAIN = () => at("hex-tb-spike-platform-lrg", "Hex-TB-Spike-Platform-Lrg");
const CAP = () =>
  at("dovetail-cap-single-m-solid", "Dovetail-Cap-Single-M-Solid");
const SPIKE = () => at("hex-tb-spike-solid", "Hex-TB-Spike-Solid");

/** Printable ASCII plus newlines, and nothing else. */
const ASCII_ONLY = /^[\x20-\x7e\n]*$/;

/** Collapse the hard wrap, so a phrase can be asserted without pinning where
 *  the line happened to break. */
const flat = (s: string) => s.replace(/\s+/g, " ");

describe("packReadme -- the loose-file zip", () => {
  const base = {
    release: RELEASE,
    format: "stl" as const,
    // A BUILD WITH NOTHING TO WARN ABOUT, which is what most rows here need as
    // their neutral background. It used to lead with `hex-tb-main`, and that
    // stopped being neutral: the calibration sweep put the whole `base` family
    // on the support list, Main included. A fixture that quietly needs support
    // makes "says no supports are needed" fail for a reason that has nothing to
    // do with the sentence being tested.
    parts: [
      { slug: "dovetail-cap-single-m-solid", qty: 4 },
      { slug: "hex-tb-spike-platform-lrg", qty: 1 },
    ],
    credit: HEX_LICENSE.credit,
    specUrl: SPEC_URL,
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
    expect(out).toContain(SPEC_URL);
  });

  it("lists every part it contains", () => {
    const out = packReadme(base);
    for (const p of base.parts) expect(out).toContain(p.slug);
  });

  it("records the release, so a pack can be traced to its geometry", () => {
    expect(packReadme(base)).toContain(RELEASE);
  });

  it("does NOT print quantities -- the box holds one file per part", () => {
    // A loose zip has one mesh per named part however many were asked for, so
    // "4 x" would describe a box that does not exist. The plated README states
    // quantities because its box really does hold four.
    expect(packReadme(base)).not.toContain("4 x ");
  });

  it("states the print settings from the shared spec, not a copy of them", () => {
    // Transcribing them here would let /hex, the printed build sheet and the
    // archive drift apart on one dimension, which is the exact thing a
    // dimensioned spec exists to prevent.
    const out = packReadme(base);
    expect(out).toContain("Material: FDM PETG");
    expect(out).toContain("Design gap: 0.25 mm");
  });

  it("says no supports are needed when nothing in the box needs them", () => {
    expect(packReadme(base)).toContain("No supports needed");
  });

  it("names a spike as needing support, by the name the zip entry uses", () => {
    const out = packReadme({
      ...base,
      parts: [...base.parts, { slug: "hex-tb-spike-solid", qty: 1 }],
    });
    expect(out).toContain("Support required -- hex-tb-spike-solid.");
    expect(out).not.toContain("No supports needed");
  });

  it("is pure ASCII", () => {
    // Read in Notepad and in terminals as often as in a GUI, and the shared spec
    // it is composed from carries U+00B0 and en dashes.
    expect(ASCII_ONLY.test(packReadme(base))).toBe(true);
  });
});

describe("packNeedsSupport -- the question that decides the response SHAPE", () => {
  // Not a prose helper. A build that fits one plate normally ships as a bare
  // `.3mf` with no README, so this is what makes the route put a spike build in
  // an archive instead and keep the warning with it.
  it("says yes for either part that rests on a line", () => {
    expect(packNeedsSupport(["hex-tb-spike-solid"])).toBe(true);
    expect(packNeedsSupport(["hex-tb-spike-ball-joint"])).toBe(true);
  });

  it("says no for a build of flat-faced parts", () => {
    // The CONTROL. Without it, a predicate stuck at `true` passes every row
    // above -- and would zip every download, which is the thing this feature
    // exists to stop doing.
    // `hex-tb-main` used to stand here as the ordinary part. The calibration
    // sweep put the entire `base` family on the support list, Main included, so
    // it is no longer a control for "needs nothing" -- it is a positive case.
    expect(
      packNeedsSupport(["hex-tb-spike-platform-lrg", "dovetail-cap-single-m-solid"]),
    ).toBe(false);
    expect(packNeedsSupport([])).toBe(false);
  });

  it("finds a spike among many parts, not only as the first one", () => {
    expect(
      packNeedsSupport([
        "dovetail-cap-single-m-solid",
        "hex-tb-spike-solid",
        "dovetail-cap-single-m-solid",
      ]),
    ).toBe(true);
  });

  it("is not fooled by a name that merely starts the same way", () => {
    // Seven published slugs begin `hex-tb-spike-`, and five of them need
    // something. A `startsWith` here would tell people to brim a platform that
    // sits on 826 sq mm.
    //
    // `hex-tb-spike-ball-zip-single` USED TO BE ASSERTED false HERE, on the
    // premise that only the two line-resting spikes needed anything. Measuring
    // the real first-layer cross-section put it at 6.74 sq mm under an 11.6 mm
    // part, so the row was asserting the defect. The two platforms are kept
    // because they are measured at 826 and 250 sq mm, which is why they need
    // nothing -- their NAME is not the reason and never was.
    expect(packNeedsSupport(["hex-tb-spike-platform-lrg"])).toBe(false);
    expect(packNeedsSupport(["hex-tb-spike-platform-sm"])).toBe(false);
  });
});

describe("plateDescription -- the notes carried INSIDE the plate", () => {
  it("names the spike and says how to print it", () => {
    const d = plateDescription([
      { slug: "hex-tb-spike-platform-lrg", name: "Hex-TB-Spike-Platform-Lrg" },
      { slug: "hex-tb-spike-solid", name: "Hex-TB-Spike-Solid" },
    ]);
    expect(d).toContain("Support required -- Hex-TB-Spike-Solid.");
    // The part it names, and the remedy that suits THAT part. This one rests on
    // a line, so a brim is the useful thing.
    expect(flat(d)).toContain("Hex-TB-Spike-Solid rests on a thin line");
    expect(flat(d)).toContain("A brim is the useful thing here");
  });

  it("gives the two spikes DIFFERENT advice, because they have different problems", () => {
    // THE POINT OF THE 2026-08-16 REWRITE. Both parts used to get one shared
    // sentence ending "give them supports or a brim". Measured against the real
    // meshes at a 0.2 mm first layer, the ball joint has 0.87 sq mm of contact
    // and its shaft does not reach the plate at all -- so a brim, which needs a
    // perimeter to hold, is the one remedy that cannot work on it. Telling both
    // parts the same thing sent people to it anyway.
    const ball = flat(
      plateDescription([
        { slug: "hex-tb-spike-ball-joint", name: "Hex-TB-Spike-Ball-Joint" },
      ]),
    );
    const solid = flat(
      plateDescription([
        { slug: "hex-tb-spike-solid", name: "Hex-TB-Spike-Solid" },
      ]),
    );

    expect(ball).toContain("rests on the BALL, not the shaft");
    expect(ball).toContain("It needs supports.");
    expect(ball).toContain("A brim will not help it");

    expect(solid).toContain("A brim is the useful thing here");
    expect(solid).not.toContain("A brim will not help it");

    // Not merely different strings -- neither part's advice may appear on the
    // other's plate, which is what a shared sentence would produce again.
    expect(solid).not.toContain("rests on the BALL");
    expect(ball).not.toContain("rests on a thin line");
  });

  it("carries the one slicer note worth carrying, and no print profile", () => {
    // Both halves are counter-intuitive and cost a wasted plate to learn: a tree
    // has nowhere to build at this scale, and PETG supports tear rather than
    // snap, so less contact beats a wider gap. It stops there deliberately --
    // this file asserts no printer profile anywhere else either.
    const d = flat(
      plateDescription([
        { slug: "hex-tb-spike-solid", name: "Hex-TB-Spike-Solid" },
      ]),
    );
    expect(d).toContain("normal or snug beats tree or organic");
    expect(d).toContain("PETG supports tear rather than snap");
  });

  it("carries the orientation note too, which is true of every plate", () => {
    const d = plateDescription([{ slug: "hex-tb-spike-platform-lrg", name: "Hex-TB-Spike-Platform-Lrg" }]);
    expect(d).toContain("Orientation:");
    expect(flat(d)).toContain("keep every part flat on the bed");
  });

  it("says plainly when nothing needs support", () => {
    // The CONTROL: a description that always warned would satisfy the first row
    // and would train people to ignore it.
    const d = plateDescription([{ slug: "hex-tb-spike-platform-lrg", name: "Hex-TB-Spike-Platform-Lrg" }]);
    expect(d).toContain("No supports needed");
    expect(d).not.toContain("Support required");
  });

  it("uses the PUBLISHED spelling, matching the slicer's object list", () => {
    const d = plateDescription([
      { slug: "hex-tb-spike-solid", name: "Hex-TB-Spike-Solid" },
    ]);
    expect(d).toContain("Hex-TB-Spike-Solid");
    expect(d).not.toContain("hex-tb-spike-solid");
  });

  it("is pure ASCII, because it is written into an XML attribute-free element", () => {
    expect(
      ASCII_ONLY.test(
        plateDescription([
          { slug: "hex-tb-spike-solid", name: "Hex-TB-Spike-Solid" },
        ]),
      ),
    ).toBe(true);
  });
});

describe("plateReadme -- the plated zip", () => {
  const base = {
    release: RELEASE,
    bed: { x: 350, y: 350 },
    plates: [[PLAIN(), PLAIN(), PLAIN(), CAP(), CAP()], [CAP()]] as Placement[][],
    credit: HEX_LICENSE.credit,
    specUrl: SPEC_URL,
    stem: STEM,
  };
  const txt = plateReadme(base);
  const spiked = plateReadme({
    ...base,
    plates: [[PLAIN(), SPIKE(), SPIKE()], [CAP()]],
  });

  it("states the bed it was packed for and the plate count", () => {
    // The bed is the whole reason two people with the same build get different
    // files. A README that does not name it cannot be checked against the
    // printer it was meant for.
    //
    // Asserted on the PACKED-FOR sentence, not merely on the dimensions
    // appearing somewhere. A bare `toContain("350 x 350")` survives deleting
    // this line entirely, because the caveat paragraph further down names the
    // bed too -- measured, not assumed: that mutation survived the first draft
    // of this test.
    expect(flat(txt)).toContain("packed for a 350 x 350 mm bed");
    expect(flat(txt)).toContain("350 x 350");
    expect(flat(txt)).toContain("2 plates");
  });

  it("counts INSTANCES, not distinct parts", () => {
    // Six things to print, out of two distinct meshes. Calling this a "2 part"
    // pack would understate it threefold.
    expect(flat(txt)).toContain("6 parts on 2 plates");
  });

  it("lists each plate's contents with quantities", () => {
    expect(txt).toContain("3 x Hex-TB-Spike-Platform-Lrg");
    expect(txt).toContain("2 x Dovetail-Cap-Single-M-Solid");
    expect(txt).toContain("1 x Dovetail-Cap-Single-M-Solid");
  });

  it("names each plate exactly as the zip entry is named", () => {
    // Pinned as literals AND against the shared helper. The literals catch both
    // sides drifting together; the helper catches an off-by-one that would list
    // a plate 0 of 2 in a folder holding plates 1 and 2.
    expect(txt).toContain(`plates/${STEM}-plate-1-of-2.3mf`);
    expect(txt).toContain(`plates/${STEM}-plate-2-of-2.3mf`);
    expect(txt).toContain(platePath(1, 2, STEM));
    expect(txt).toContain(platePath(2, 2, STEM));
    expect(txt).not.toContain(platePath(0, 2, STEM));
  });

  it("names parts by their PUBLISHED spelling, matching the object list", () => {
    // A plate's objects carry their PUBLISHED spelling in the slicer's object
    // panel, so the manifest reads straight across to it. The slug would make
    // the reader translate, and it is a lossy projection of the name anyway.
    expect(txt).toContain("Hex-TB-Spike-Platform-Lrg");
    expect(txt).not.toContain("hex-tb-spike-platform-lrg");
  });

  it("says the arrangement is a starting point, not a guarantee", () => {
    // Measured: slicers recentre the scene, and a user's auto-arrange overrides
    // us entirely. Promising an exact layout would be a claim we cannot keep.
    expect(flat(txt).toLowerCase()).toContain("starting point");
    expect(flat(txt)).toContain("auto-arrange");
  });

  it("still promises the thing that IS true -- it fits the named bed", () => {
    // The caveat has to stop somewhere, or the file reads as "we arranged this,
    // who knows". The narrow promise is what the packer actually guarantees,
    // clearance included.
    expect(flat(txt)).toContain("fits the 350 x 350 mm bed");
    expect(flat(txt)).toContain("4 mm of clearance");
  });

  it("mentions the preset dialog so it does not read as an error", () => {
    expect(flat(txt)).toContain("printer preset");
    expect(flat(txt)).toContain("expected, not an error");
  });

  it("states the orientation, from the shared spec", () => {
    expect(txt).toContain("Orientation:");
    expect(flat(txt)).toContain("hex-face-down");
  });

  it("states the print settings from the shared spec", () => {
    expect(txt).toContain("Material: FDM PETG");
  });

  it("says no supports are needed when no spike is on any plate", () => {
    // The CONTROL for the test below: without it, a support note that ALWAYS
    // printed would satisfy "names the spike" and nothing would catch it.
    expect(txt).toContain("No supports needed");
    expect(txt).not.toContain("Support required");
  });

  it("names the spike parts as needing support when present", () => {
    expect(spiked).toContain("Support required -- Hex-TB-Spike-Solid.");
    expect(spiked).not.toContain("No supports needed");
  });

  it("names a repeated spike ONCE, not once per copy", () => {
    // "Hex-TB-Spike-Solid, Hex-TB-Spike-Solid" is what an undeduplicated filter
    // produces, and six of a part is entirely normal on a plate.
    //
    // Asserted as INDEPENDENCE FROM THE COPY COUNT rather than as a fixed
    // number. A literal count pins how many times the README happens to mention
    // the part today, which is a different fact and one that legitimately
    // changes: adding the per-part support note in 2026-08 moved it from 2 to 3
    // and failed this test for no defect at all. Two plates differing ONLY in
    // how many copies they hold cannot differ in how often the part is named.
    const once = plateReadme({ ...base, plates: [[PLAIN(), SPIKE()], [CAP()]] });
    const sixTimes = plateReadme({
      ...base,
      plates: [
        [PLAIN(), SPIKE(), SPIKE(), SPIKE(), SPIKE(), SPIKE(), SPIKE()],
        [CAP()],
      ],
    });
    const count = (s: string) => (s.match(/Hex-TB-Spike-Solid/g) ?? []).length;

    expect(count(sixTimes)).toBe(count(once));
    expect(count(spiked)).toBe(count(once));
    // And it is named at all -- an empty match would satisfy the equality above.
    expect(count(once)).toBeGreaterThan(0);
  });

  it("carries the CC BY credit", () => {
    expect(txt).toContain(HEX_LICENSE.credit);
    expect(txt).toContain("LICENSE.txt");
  });

  it("points at the spec page for individual files and the full set", () => {
    expect(txt).toContain(SPEC_URL);
    expect(flat(txt)).toContain("complete set, every format, and every part");
    expect(flat(txt)).toContain("individually");
  });

  it("records the release", () => {
    expect(txt).toContain(RELEASE);
  });

  it("gets the grammar right for a single plate holding a single part", () => {
    // "1 parts on 1 plates" is the kind of thing nobody writes a test for and
    // everybody notices in the box.
    const one = plateReadme({ ...base, plates: [[PLAIN()]] });
    expect(flat(one)).toContain("1 part on 1 plate,");
    expect(one).toContain(`plates/${STEM}-plate-1-of-1.3mf -- 1 part`);
  });

  it("is pure ASCII", () => {
    // The spec constants it composes carry U+00B0 ("240 degC") and en dashes
    // ("70-85"), so this fails the moment the fold is dropped.
    expect(ASCII_ONLY.test(txt)).toBe(true);
    expect(ASCII_ONLY.test(spiked)).toBe(true);
  });

  it("wraps its prose, so a terminal does not cut a sentence in half", () => {
    // Neither Notepad nor a terminal reflows. The longest thing in here is the
    // preset-dialog paragraph, 300-odd characters as one authored string.
    //
    // The credit line is EXEMPT and stays whole: it is the canonical attribution
    // a remixer copies verbatim, and a wrapped copy is a broken copy.
    for (const line of txt.split("\n")) {
      if (line === HEX_LICENSE.credit) continue;
      expect(line.length, line).toBeLessThanOrEqual(78);
    }
  });
});
