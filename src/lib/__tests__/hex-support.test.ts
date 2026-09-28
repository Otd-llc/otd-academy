// The support set decides the SHAPE of a download, not just its prose. For the
// v2 release it is MEASURED (launch readiness 4.7): the rows come from the
// owner's calibration slice, generated into `hex-support-data.ts`, and these
// rows pin that every surface reads the same set.
import { describe, expect, it } from "vitest";

import { HEX_PART_SLUGS } from "@/lib/hex-parts";
import {
  HEX_SUPPORT_DATA,
  NEEDS_SUPPORT_NAMES,
  NEEDS_SUPPORT_SLUGS,
  PART_REMEDY,
  SUPPORT_NOTE,
  SUPPORT_SLICER_NOTE,
  needsSupport,
} from "@/lib/hex-support";
import { HEX_SUPPORT_ROWS } from "@/lib/hex-support-data";
import { slug } from "@/lib/r2";

describe("the v2 support data", () => {
  it("is MEASURED, from the generated slice", () => {
    expect(HEX_SUPPORT_DATA.state).toBe("measured");
    expect(HEX_SUPPORT_DATA.source).toBe("support-data-2026-10-01.json");
    expect(HEX_SUPPORT_DATA.rows.map((r) => r.slug)).toEqual(
      HEX_SUPPORT_ROWS.map((r) => r.slug),
    );
  });

  it("gives each listed part its own two flags and its own note", () => {
    expect(PART_REMEDY).toEqual({
      "25mm-ins-trinity-handle": { support: true, brim: false },
      "25mm-ins-zip": { support: true, brim: false },
      "hex-half-w": { support: true, brim: false },
      "hex-quarter-nw": { support: true, brim: false },
      "hex-quarter-sw": { support: true, brim: false },
      "hex-spike-stud": { support: false, brim: true },
    });
    for (const s of NEEDS_SUPPORT_SLUGS) expect(SUPPORT_NOTE[s], s).toBeTruthy();
  });

  it("answers needsSupport from the same set, brim-only parts included", () => {
    expect(needsSupport(["hex-main"])).toBe(false);
    expect(needsSupport(["hex-main", "hex-half-w"])).toBe(true);
    // A brim rides in the plate as a per-object setting; the README beside it
    // is what says so, so a brim-only part still pulls the plate into an archive.
    expect(needsSupport(["hex-spike-stud"])).toBe(true);
  });

  it("no longer carries the v1 spike measurement in the slicer note", () => {
    expect(SUPPORT_SLICER_NOTE).not.toMatch(/half a millimetre/);
    expect(SUPPORT_SLICER_NOTE).toMatch(/^[ -~]+$/);
  });

  it("pairs each published name with its own slug", () => {
    // Through the REAL transform the uploader mints keys with.
    expect(NEEDS_SUPPORT_NAMES.map(slug).sort()).toEqual(
      [...NEEDS_SUPPORT_SLUGS].sort(),
    );
  });

  it("names only parts in the live release", () => {
    // Membership, not shape: a row for a part the release does not ship would
    // silently never fire.
    const live = new Set<string>(HEX_PART_SLUGS);
    for (const s of NEEDS_SUPPORT_SLUGS) expect(live.has(s), s).toBe(true);
    expect(NEEDS_SUPPORT_NAMES).toHaveLength(6);
  });
});
