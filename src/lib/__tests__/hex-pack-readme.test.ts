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
//
// THE SUPPORT DATA IS MEASURED (launch readiness 4.7), so every support row
// below runs against the REAL module: a part the slicer flagged is named once
// with its own sentence, and a box holding none of them says so.
import { describe, expect, it } from "vitest";

import { platePath } from "@/lib/hex-pack";
import {
  packNeedsSupport,
  packReadme,
  plateDescription,
  plateReadme,
} from "@/lib/hex-pack-readme";
import type { Placement } from "@/lib/hex-plate";
import { HEX_PART_SLUGS } from "@/lib/hex-parts";
import { HEX_PUBLISHED_RECORD_SLUGS } from "@/lib/hex-published-record";
import { HEX_LICENSE, HEX_RELEASE } from "@/lib/hex-spec";

const RELEASE = HEX_RELEASE;
const SPEC_URL = "https://academy.onethousanddrones.com/hex";
/** The build's name, as the zip entries spell it. NOT the fallback, so a README
 *  that ignored the stem it was handed would list files the archive does not
 *  hold rather than coincidentally agreeing with it. */
const STEM = "BENCH-2 POWER";
const BOX = { x0: 0, y0: 0, z0: 0, dx: 40, dy: 30, dz: 10 } as const;

/** A display spelling DIFFERENT from the slug. In v2 the published name IS the
 *  slug, so a fixture using it could not tell a README that names parts by
 *  `name` from one that names them by `slug`; the plate manifest must use the
 *  former, and this keeps the two distinguishable. */
const display = (slug: string) => slug.toUpperCase();

const at = (slug: string, name = display(slug)): Placement => ({
  slug,
  name,
  box: BOX,
  x: 4,
  y: 4,
});

const PLAIN_SLUG = "spike-acc-platform-lrg";
const CAP_SLUG = "hex-cap-edge-solid-m";
const PLAIN = () => at(PLAIN_SLUG);
const CAP = () => at(CAP_SLUG);

/** Printable ASCII plus newlines, and nothing else. */
const ASCII_ONLY = /^[\x20-\x7e\n]*$/;

/** Collapse the hard wrap, so a phrase can be asserted without pinning where
 *  the line happened to break. */
const flat = (s: string) => s.replace(/\s+/g, " ");

/** What a README says when nothing in the box needs a remedy. */
const NONE = "Supports and brim: none needed.";
/** Real v2 parts the 2026-10-01 slice flagged: one for support, one for a brim. */
const SUP = "hex-half-w";
const BRIM = "pvc-section-single";

it("uses real v2 slugs for its neutral fixtures", () => {
  expect(HEX_PART_SLUGS).toContain(PLAIN_SLUG);
  expect(HEX_PART_SLUGS).toContain(CAP_SLUG);
});

describe("packReadme -- the loose-file zip", () => {
  const base = {
    release: RELEASE,
    format: "stl" as const,
    parts: [
      { slug: CAP_SLUG, qty: 4 },
      { slug: PLAIN_SLUG, qty: 1 },
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

  it("says no supports or brim are needed when nothing in it is flagged", () => {
    const out = flat(packReadme(base));
    expect(out).toContain(NONE);
    expect(out).not.toMatch(/Supports and brim: (?!none needed)/);
    expect(out).not.toMatch(/not yet checked/);
  });

  it("is pure ASCII", () => {
    // Read in Notepad and in terminals as often as in a GUI, and the shared spec
    // it is composed from carries U+00B0 and en dashes.
    expect(ASCII_ONLY.test(packReadme(base))).toBe(true);
  });
});

describe("packNeedsSupport -- the question that decides the response SHAPE", () => {
  it("is true exactly when a flagged part is in the pack", () => {
    expect(packNeedsSupport([PLAIN_SLUG, CAP_SLUG])).toBe(false);
    expect(packNeedsSupport([])).toBe(false);
    expect(packNeedsSupport([CAP_SLUG, SUP, CAP_SLUG])).toBe(true);
    // A brim-only part too: its brim rides in the plate, and the README beside
    // it is what says so.
    expect(packNeedsSupport([BRIM])).toBe(true);
    // Not fooled by a shared prefix.
    expect(packNeedsSupport(["hex-half"])).toBe(false);
  });
});

describe("plateDescription -- the notes carried INSIDE the plate", () => {
  it("says none are needed on a plate with nothing flagged", () => {
    const d = flat(plateDescription([{ slug: PLAIN_SLUG, name: display(PLAIN_SLUG) }]));
    expect(d).toContain(NONE);
    expect(d).not.toMatch(/not yet checked/);
  });

  it("carries the orientation note too, which is true of every plate", () => {
    const d = plateDescription([{ slug: PLAIN_SLUG, name: display(PLAIN_SLUG) }]);
    expect(d).toContain("Orientation:");
    expect(flat(d)).toContain("keep every part flat on the bed");
  });

  it("is pure ASCII, because it is written into an XML attribute-free element", () => {
    expect(
      ASCII_ONLY.test(plateDescription([{ slug: CAP_SLUG, name: display(CAP_SLUG) }])),
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

  it("states the bed it was packed for and the plate count", () => {
    // Asserted on the PACKED-FOR sentence, not merely on the dimensions
    // appearing somewhere. A bare `toContain("350 x 350")` survives deleting
    // this line entirely, because the caveat paragraph further down names the
    // bed too.
    expect(flat(txt)).toContain("packed for a 350 x 350 mm bed");
    expect(flat(txt)).toContain("350 x 350");
    expect(flat(txt)).toContain("2 plates");
  });

  it("counts INSTANCES, not distinct parts", () => {
    expect(flat(txt)).toContain("6 parts on 2 plates");
  });

  it("lists each plate's contents with quantities", () => {
    expect(txt).toContain(`3 x ${display(PLAIN_SLUG)}`);
    expect(txt).toContain(`2 x ${display(CAP_SLUG)}`);
    expect(txt).toContain(`1 x ${display(CAP_SLUG)}`);
  });

  it("names each plate exactly as the zip entry is named", () => {
    expect(txt).toContain(`plates/${STEM}-plate-1-of-2.3mf`);
    expect(txt).toContain(`plates/${STEM}-plate-2-of-2.3mf`);
    expect(txt).toContain(platePath(1, 2, STEM));
    expect(txt).toContain(platePath(2, 2, STEM));
    expect(txt).not.toContain(platePath(0, 2, STEM));
  });

  it("names parts by their PUBLISHED spelling, matching the object list", () => {
    expect(txt).toContain(display(PLAIN_SLUG));
    expect(txt).not.toContain(PLAIN_SLUG);
  });

  it("says the arrangement is a starting point, not a guarantee", () => {
    expect(flat(txt).toLowerCase()).toContain("starting point");
    expect(flat(txt)).toContain("auto-arrange");
  });

  it("still promises the thing that IS true -- it fits the named bed", () => {
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

  it("says no supports or brim are needed, with nothing flagged on it", () => {
    expect(flat(txt)).toContain(NONE);
    expect(txt).not.toMatch(/Supports and brim: (?!none needed)/);
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
    const one = plateReadme({ ...base, plates: [[PLAIN()]] });
    expect(flat(one)).toContain("1 part on 1 plate,");
    expect(one).toContain(`plates/${STEM}-plate-1-of-1.3mf: 1 part`);
  });

  it("is pure ASCII", () => {
    expect(ASCII_ONLY.test(txt)).toBe(true);
  });

  it("wraps its prose, so a terminal does not cut a sentence in half", () => {
    // The credit line is EXEMPT and stays whole: it is the canonical attribution
    // a remixer copies verbatim, and a wrapped copy is a broken copy.
    for (const line of txt.split("\n")) {
      if (line === HEX_LICENSE.credit) continue;
      expect(line.length, line).toBeLessThanOrEqual(78);
    }
  });
});

/* ===========================================================================
   THE MEASURED ROWS, against the real 2026-10-01 slice.

   A flagged part is named once, carries the slicer sweep's own sentence, and
   the support-only slicer note appears beside a SUPPORT part and never beside
   a brim-only one.
   =========================================================================== */

describe("support and brim, from the measured slice", () => {
  it("names a flagged part by the name the zip entry uses (loose zip = slug)", () => {
    const out = packReadme({
      release: RELEASE,
      format: "stl",
      parts: [
        { slug: CAP_SLUG, qty: 1 },
        { slug: SUP, qty: 1 },
      ],
      credit: HEX_LICENSE.credit,
      specUrl: SPEC_URL,
    });
    expect(out).toContain(`Supports and brim: ${SUP}.`);
    expect(flat(out)).toContain(`${SUP}: needs support switched on`);
    expect(out).not.toContain(NONE);
  });

  it("gives each flagged part its OWN advice, never the other's", () => {
    const sup = flat(plateDescription([{ slug: SUP, name: display(SUP) }]));
    const brim = flat(plateDescription([{ slug: BRIM, name: display(BRIM) }]));
    expect(sup).toContain(`${display(SUP)}: needs support switched on`);
    expect(sup).not.toContain("give it a brim");
    expect(brim).toContain(`${display(BRIM)}: give it a brim`);
    expect(brim).not.toContain("needs support switched on");
  });

  it("carries the slicer note beside a support part, not a brim-only one", () => {
    const sup = flat(plateDescription([{ slug: SUP, name: display(SUP) }]));
    const brim = flat(plateDescription([{ slug: BRIM, name: display(BRIM) }]));
    expect(sup).toContain("PETG supports tear rather than snap");
    expect(brim).not.toContain("PETG supports tear rather than snap");
  });

  it("uses the PUBLISHED spelling on a plate, not the slug", () => {
    const d = plateDescription([{ slug: SUP, name: display(SUP) }]);
    expect(d).toContain(`Supports and brim: ${display(SUP)}.`);
    expect(d).not.toContain(SUP);
  });

  it("names a repeated flagged part ONCE, not once per copy", () => {
    // Asserted as INDEPENDENCE FROM THE COPY COUNT rather than a fixed number:
    // two plates differing ONLY in copies cannot differ in how often it is named.
    const base = {
      release: RELEASE,
      bed: { x: 350, y: 350 },
      credit: HEX_LICENSE.credit,
      specUrl: SPEC_URL,
      stem: STEM,
    };
    const flagged = () => at(BRIM);
    const once = plateReadme({ ...base, plates: [[PLAIN(), flagged()], [CAP()]] });
    const six = plateReadme({
      ...base,
      plates: [
        [PLAIN(), flagged(), flagged(), flagged(), flagged(), flagged(), flagged()],
        [CAP()],
      ],
    });
    const name = display(BRIM);
    const count = (s: string) => s.split(name).length - 1;
    expect(count(six)).toBe(count(once));
    expect(count(once)).toBeGreaterThan(0);
    expect(ASCII_ONLY.test(six)).toBe(true);
  });

  it("4.7 done-when: hex-main + a cover carry no v1 or carrier wording", () => {
    const txt = plateReadme({
      release: RELEASE,
      bed: { x: 350, y: 350 },
      plates: [[at("hex-main", "hex-main"), at("hex-main-cover", "hex-main-cover")]],
      credit: HEX_LICENSE.credit,
      specUrl: SPEC_URL,
      stem: STEM,
    });
    expect(flat(txt)).toContain(NONE);
    expect(txt).not.toMatch(/not yet checked/i);
    // No v1 part named anywhere in it: the published record is the v1 list.
    for (const v1 of HEX_PUBLISHED_RECORD_SLUGS) {
      expect(txt.toLowerCase(), v1).not.toContain(v1);
    }
  });
});
