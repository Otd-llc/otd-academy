// The support set decides the SHAPE of a download, not just its prose. These
// guards are what stand between a re-cut and a bare `.3mf` that silently omits
// the one sentence preventing a failed print.
import { describe, expect, it } from "vitest";

import { HEX_PART_SLUGS, isHexPartSlug } from "@/lib/hex-parts";
import {
  NEEDS_SUPPORT_NAMES,
  NEEDS_SUPPORT_SLUGS,
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
    expect(needsSupport(["hex-tb-main", "dovetail-cap-single-m-solid"])).toBe(
      false,
    );
    expect(needsSupport([])).toBe(false);
  });

  it("does not quietly cover every spike", () => {
    // `hex-tb-spike-ball-platform-solid` and the platforms stand on a flat face.
    // Pinned because "it has spike in the name" is the obvious wrong rule, and
    // adopting it would archive downloads that need no archiving.
    const spikes = HEX_PART_SLUGS.filter((s) => s.includes("spike"));
    expect(spikes.length).toBeGreaterThan(NEEDS_SUPPORT_SLUGS.size);
    expect(needsSupport(["hex-tb-spike-platform-lrg"])).toBe(false);
  });
});
