// The support set decides the SHAPE of a download, not just its prose. These
// guards are what stand between a re-cut and a bare `.3mf` that silently omits
// the one sentence preventing a failed print.
import { describe, expect, it } from "vitest";

import { HEX_PART_SLUGS, isHexPartSlug } from "@/lib/hex-parts";
import {
  NEEDS_SUPPORT_NAMES,
  NEEDS_SUPPORT_SLUGS,
  PART_REMEDY,
  needsSupport,
} from "@/lib/hex-support";
import { slug } from "@/lib/r2";

describe("the support set", () => {
  it("pairs each published name with its own slug", () => {
    // Through the REAL transform the uploader mints keys with, not a copy of it.
    // The two spellings are written out by hand so this can be a check rather
    // than a tautology; if someone edits one list and not the other, this is
    // where it stops.
    expect(NEEDS_SUPPORT_NAMES.map(slug).sort()).toEqual(
      [...NEEDS_SUPPORT_SLUGS].sort(),
    );
  });

  it("names only parts that are actually published", () => {
    // A re-cut that renames or drops a spike leaves this set pointing at
    // nothing, and `needsSupport` would then answer false for a part that still
    // rests on a line. Membership, not shape: the slug grammar would happily
    // accept a name for a part we no longer ship.
    for (const s of NEEDS_SUPPORT_SLUGS) expect(isHexPartSlug(s)).toBe(true);
  });

  it("answers yes for a pack containing one, and no for one that does not", () => {
    expect(needsSupport(["hex-tb-main", "hex-tb-spike-solid"])).toBe(true);
    // `hex-tb-main` is NOT a neutral part any more -- the calibration sweep put
    // the whole `base` family on the list, Main included -- so the negative
    // case needs a part that genuinely needs nothing.
    expect(
      needsSupport(["hex-tb-spike-platform-lrg", "dovetail-cap-single-m-solid"]),
    ).toBe(false);
    expect(needsSupport([])).toBe(false);
  });

  it("does not quietly cover every spike", () => {
    // Pinned because "it has spike in the name" is the obvious wrong rule, and
    // adopting it would archive downloads that need no archiving.
    //
    // THIS USED TO COMPARE COUNTS -- `spikes.length > NEEDS_SUPPORT_SLUGS.size`
    // -- and that stopped meaning anything once the list gained two CORNERS, at
    // which point seven flagged parts sat against seven spike-named ones and the
    // row failed without a defect. A count is a proxy for the claim; these are
    // the claim. The parts below are excluded on a MEASURED first layer of 250
    // and 826 sq mm, which is the reason they need nothing, not their name.
    const spikes = HEX_PART_SLUGS.filter((s) => s.includes("spike"));
    expect(spikes.length).toBeGreaterThan(0);
    for (const stands of [
      "hex-tb-spike-platform-lrg",
      "hex-tb-spike-platform-sm",
    ]) {
      expect(spikes, `${stands} should be a real slug`).toContain(stands);
      expect(needsSupport([stands])).toBe(false);
    }
  });

  it("lists exactly the parts that need a remedy, and says which one", () => {
    // The list is a claim about the published meshes, so it is pinned to the
    // measurement that produced it rather than to itself. Five of these were
    // missing for a fortnight because the old facet-normal metric scored curved
    // contacts at zero; if a future re-cut changes a footprint, this row is
    // where the list and the meshes stop agreeing.
    // COLLECTED FROM THE SLICER, not derived. A calibration plate carrying all
    // 53 parts with no settings was opened in Creality Print and its warnings
    // written down; 25 parts asked for support -- the entire "base" family among
    // them, which is a family rule rather than a selection inside one. This row is where that reading
    // lives, so a re-cut that changes a pose and forgets to re-run the sweep
    // fails here rather than in someone's print.
    //
    // TWO CRITERIA, NOT ONE. A brim is decided by the FIRST LAYER; support is
    // decided by every layer above it. The corners carry 416.8 and 655.3 sq mm
    // of bed contact and need no brim at all, but Creality reports them as
    // having floating regions, so they need support. The ball joint is the
    // mirror image. A row that asserted only a footprint threshold could not
    // express either case.
    expect([...NEEDS_SUPPORT_SLUGS].sort()).toEqual(
      [
        "hex-tb-carrier-bot-parts-tray-lid",
        "hex-tb-carrier-parts-tray",
        "hex-tb-carrier-parts-tray-lid",
        "hex-tb-carrier-top-parts-tray-lid",
        "hex-tb-corner-f-solid",
        "hex-tb-corner-m-solid",
        "hex-tb-half-bot-1h",
        "hex-tb-half-bot-2h",
        "hex-tb-half-bot-3h",
        "hex-tb-half-bot-solid",
        "hex-tb-half-left-1h",
        "hex-tb-half-left-2h",
        "hex-tb-half-left-3h",
        "hex-tb-half-left-solid",
        "hex-tb-half-right-1h",
        "hex-tb-half-right-2h",
        "hex-tb-half-right-3h",
        "hex-tb-half-right-solid",
        "hex-tb-half-top-1h",
        "hex-tb-half-top-2h",
        "hex-tb-half-top-3h",
        "hex-tb-half-top-solid",
        "hex-tb-main",
        "hex-tb-spike-ball-joint",
        "hex-tb-spike-ball-zip-single",
        "hex-tb-spike-solid",
      ].sort(),
    );
    // and the remedies are not interchangeable
    expect(PART_REMEDY["hex-tb-corner-m-solid"]).toEqual({ support: true, brim: false });
    expect(PART_REMEDY["hex-tb-spike-ball-joint"]).toEqual({ support: true, brim: false });
    expect(PART_REMEDY["hex-tb-spike-ball-zip-single"]).toEqual({ support: false, brim: true });
  });
});
