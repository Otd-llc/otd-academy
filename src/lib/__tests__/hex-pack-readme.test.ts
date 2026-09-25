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
// TWO SUPPORT STATES. The v2 support data is UNKNOWN until launch readiness 4.7
// (`hex-support.ts`), and the first half of this file pins what the README says
// in that state against the REAL module. The support MECHANISM -- a measured row
// names its part once, carries its own note, and turns off "No supports needed"
// -- is exercised in the second half against a FIXTURE measured table, because
// no real v2 row exists yet to exercise it with.
import { describe, expect, it, vi } from "vitest";

import { platePath } from "@/lib/hex-pack";
import {
  packNeedsSupport,
  packReadme,
  plateDescription,
  plateReadme,
} from "@/lib/hex-pack-readme";
import type { Placement } from "@/lib/hex-plate";
import { HEX_PART_SLUGS } from "@/lib/hex-parts";
import { HEX_LICENSE, HEX_RELEASE } from "@/lib/hex-spec";
import { SUPPORT_UNKNOWN_NOTE } from "@/lib/hex-support";

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

const UNKNOWN = flat(SUPPORT_UNKNOWN_NOTE);

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

  it("says supports are NOT YET CHECKED, never 'No supports needed'", () => {
    // TODO(4.7). Nobody has sliced the v2 parts for support warnings, so the
    // honest sentence is that it is unknown, not that nothing is needed.
    const out = flat(packReadme(base));
    expect(out).toContain(UNKNOWN);
    expect(out).not.toContain("No supports needed");
    expect(out).not.toContain("Support required");
  });

  it("is pure ASCII", () => {
    // Read in Notepad and in terminals as often as in a GUI, and the shared spec
    // it is composed from carries U+00B0 and en dashes.
    expect(ASCII_ONLY.test(packReadme(base))).toBe(true);
  });
});

describe("packNeedsSupport -- the question that decides the response SHAPE", () => {
  it("is false for every released part while the support data is unknown", () => {
    // Nothing is KNOWN to need a remedy, so nothing is archived for one; the
    // unknown state is stated in the text instead (above and below).
    expect(packNeedsSupport([...HEX_PART_SLUGS])).toBe(false);
    expect(packNeedsSupport([])).toBe(false);
  });
});

describe("plateDescription -- the notes carried INSIDE the plate", () => {
  it("says supports are not yet checked, and promises nothing", () => {
    const d = flat(plateDescription([{ slug: PLAIN_SLUG, name: display(PLAIN_SLUG) }]));
    expect(d).toContain(UNKNOWN);
    expect(d).not.toContain("No supports needed");
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

  it("says supports are not yet checked, never 'No supports needed'", () => {
    expect(flat(txt)).toContain(UNKNOWN);
    expect(txt).not.toContain("No supports needed");
    expect(txt).not.toContain("Support required");
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
    expect(one).toContain(`plates/${STEM}-plate-1-of-1.3mf -- 1 part`);
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
   THE MECHANISM, against a FIXTURE measured table.

   What 4.7's rows will drive: a flagged part is named once, carries its own
   note, and a measured build with nothing flagged says "No supports needed".
   The fixture slugs are deliberately not v2 slugs, so nothing here reads as a
   claim about a real part.
   =========================================================================== */

const LINE = "fx-rests-on-a-line";
const BALL = "fx-rests-on-a-ball";
const LINE_NOTE =
  "rests on a thin line. A brim is the useful thing here, and supports are optional.";
const BALL_NOTE =
  "rests on the BALL, not the shaft. It needs supports. A brim will not help it.";

async function measuredReadme(): Promise<typeof import("@/lib/hex-pack-readme")> {
  vi.resetModules();
  vi.doMock("@/lib/hex-support", async () => {
    const actual =
      await vi.importActual<typeof import("@/lib/hex-support")>("@/lib/hex-support");
    const rows = [
      { name: display(LINE), slug: LINE, support: true, brim: true, note: LINE_NOTE },
      { name: display(BALL), slug: BALL, support: true, brim: false, note: BALL_NOTE },
    ];
    const slugs: ReadonlySet<string> = new Set(rows.map((r) => r.slug));
    return {
      ...actual,
      HEX_SUPPORT_DATA: { state: "measured", source: "fixture", rows },
      SUPPORT_UNKNOWN: false,
      NEEDS_SUPPORT_NAMES: rows.map((r) => r.name),
      NEEDS_SUPPORT_SLUGS: slugs,
      PART_REMEDY: Object.fromEntries(
        rows.map((r) => [r.slug, { support: r.support, brim: r.brim }]),
      ),
      needsSupport: (list: readonly string[]) => list.some((s) => slugs.has(s)),
      SUPPORT_NOTE: Object.fromEntries(
        rows.flatMap((r) => [
          [r.slug, r.note],
          [r.name, r.note],
        ]),
      ),
    };
  });
  const mod = await import("@/lib/hex-pack-readme");
  vi.doUnmock("@/lib/hex-support");
  return mod;
}

describe("support mechanism, once the data is measured (fixture)", () => {
  it("says no supports are needed when nothing in the box is flagged", async () => {
    // The CONTROL: a note that ALWAYS printed would satisfy every row below.
    const m = await measuredReadme();
    const d = m.plateDescription([{ slug: PLAIN_SLUG, name: display(PLAIN_SLUG) }]);
    expect(d).toContain("No supports needed");
    expect(d).not.toContain("Support required");
    expect(flat(d)).not.toContain(UNKNOWN);
    expect(m.packNeedsSupport([PLAIN_SLUG, CAP_SLUG])).toBe(false);
  });

  it("answers the SHAPE question from the same rows", async () => {
    const m = await measuredReadme();
    expect(m.packNeedsSupport([LINE])).toBe(true);
    expect(m.packNeedsSupport([CAP_SLUG, BALL, CAP_SLUG])).toBe(true);
    // Not fooled by a shared prefix.
    expect(m.packNeedsSupport(["fx-rests-on-a"])).toBe(false);
  });

  it("names a flagged part by the name the zip entry uses (loose zip = slug)", async () => {
    const m = await measuredReadme();
    const out = m.packReadme({
      release: RELEASE,
      format: "stl",
      parts: [
        { slug: CAP_SLUG, qty: 1 },
        { slug: LINE, qty: 1 },
      ],
      credit: HEX_LICENSE.credit,
      specUrl: SPEC_URL,
    });
    expect(out).toContain(`Support required -- ${LINE}.`);
    expect(out).not.toContain("No supports needed");
  });

  it("gives each flagged part its OWN advice, never the other's", async () => {
    const m = await measuredReadme();
    const ball = flat(m.plateDescription([{ slug: BALL, name: display(BALL) }]));
    const line = flat(m.plateDescription([{ slug: LINE, name: display(LINE) }]));
    expect(ball).toContain(`${display(BALL)} rests on the BALL`);
    expect(ball).not.toContain("rests on a thin line");
    expect(line).toContain(`${display(LINE)} rests on a thin line`);
    expect(line).not.toContain("rests on the BALL");
  });

  it("carries the one slicer note worth carrying beside a flagged part", async () => {
    const m = await measuredReadme();
    const d = flat(m.plateDescription([{ slug: LINE, name: display(LINE) }]));
    expect(d).toContain("normal or snug beats tree or organic");
    expect(d).toContain("PETG supports tear rather than snap");
  });

  it("uses the PUBLISHED spelling on a plate, not the slug", async () => {
    const m = await measuredReadme();
    const d = m.plateDescription([{ slug: LINE, name: display(LINE) }]);
    expect(d).toContain(`Support required -- ${display(LINE)}.`);
    expect(d).not.toContain(LINE);
  });

  it("names a repeated flagged part ONCE, not once per copy", async () => {
    // Asserted as INDEPENDENCE FROM THE COPY COUNT rather than a fixed number:
    // two plates differing ONLY in copies cannot differ in how often it is named.
    const m = await measuredReadme();
    const base = {
      release: RELEASE,
      bed: { x: 350, y: 350 },
      credit: HEX_LICENSE.credit,
      specUrl: SPEC_URL,
      stem: STEM,
    };
    const flagged = () => at(LINE);
    const once = m.plateReadme({ ...base, plates: [[PLAIN(), flagged()], [CAP()]] });
    const six = m.plateReadme({
      ...base,
      plates: [
        [PLAIN(), flagged(), flagged(), flagged(), flagged(), flagged(), flagged()],
        [CAP()],
      ],
    });
    const name = display(LINE);
    const count = (s: string) => s.split(name).length - 1;
    expect(count(six)).toBe(count(once));
    expect(count(once)).toBeGreaterThan(0);
    expect(ASCII_ONLY.test(six)).toBe(true);
  });
});
