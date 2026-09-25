// The support set decides the SHAPE of a download, not just its prose. For the
// v2 release it is UNKNOWN (TODO(4.7): the owner's calibration slice, 4.4, has
// not been turned into rows yet), and these rows pin that state explicitly so
// that nothing can read "no rows" as "no supports needed".
import { describe, expect, it } from "vitest";

import { HEX_PART_SLUGS } from "@/lib/hex-parts";
import {
  HEX_SUPPORT_DATA,
  NEEDS_SUPPORT_NAMES,
  NEEDS_SUPPORT_SLUGS,
  PART_REMEDY,
  SUPPORT_NOTE,
  SUPPORT_UNKNOWN,
  SUPPORT_UNKNOWN_NOTE,
  needsSupport,
} from "@/lib/hex-support";
import { slug } from "@/lib/r2";

describe("the v2 support data", () => {
  it("is explicitly UNKNOWN, owed by 4.7", () => {
    // THE GAP, STATED AS A TEST. When 4.7 lands the state becomes `measured`
    // and this row fails, which is when it should be rewritten to pin the
    // measured rows instead.
    expect(HEX_SUPPORT_DATA).toEqual({ state: "unknown", owedBy: "4.7" });
    expect(SUPPORT_UNKNOWN).toBe(true);
  });

  it("carries no guessed rows while unknown", () => {
    // No v1 row survives onto a v2 slug: a remedy nobody measured would paint
    // a tripwire and switch support on for a part on a guess.
    expect(NEEDS_SUPPORT_NAMES).toEqual([]);
    expect([...NEEDS_SUPPORT_SLUGS]).toEqual([]);
    expect(PART_REMEDY).toEqual({});
    expect(SUPPORT_NOTE).toEqual({});
    expect(needsSupport([...HEX_PART_SLUGS])).toBe(false);
  });

  it("has an unknown-state sentence that promises nothing", () => {
    expect(SUPPORT_UNKNOWN_NOTE).toMatch(/not yet checked/);
    expect(SUPPORT_UNKNOWN_NOTE).not.toMatch(/no supports needed/i);
    // ASCII only: it lands in a README read in Notepad and in 3MF metadata.
    expect(SUPPORT_UNKNOWN_NOTE).toMatch(/^[\x20-\x7e]+$/);
  });

  it("pairs each published name with its own slug", () => {
    // Through the REAL transform the uploader mints keys with. Vacuous while
    // the data is unknown; it bites the moment 4.7 adds the first row.
    expect(NEEDS_SUPPORT_NAMES.map(slug).sort()).toEqual(
      [...NEEDS_SUPPORT_SLUGS].sort(),
    );
  });

  it("names only parts in the live release", () => {
    // Membership, not shape: a row for a part the release does not ship would
    // silently never fire.
    const live = new Set<string>(HEX_PART_SLUGS);
    for (const s of NEEDS_SUPPORT_SLUGS) expect(live.has(s), s).toBe(true);
  });
});
