// 7.6 README pick A, owner's option 1 of 2026-09-28: a plated pack's README
// says where the build reopens -- for a SAVED drawing only, by its share code.
// An unsaved build's payload stays in a URL fragment and never reaches this
// route, so it gets no line.
import { describe, expect, it } from "vitest";
import {
  BUILD_CODE_RE,
  canonicalPackQuery,
  resolvePack,
} from "@/lib/hex-pack";
import { plateReadme } from "@/lib/hex-pack-readme";
import { SHARE_CODE_LENGTH } from "@/lib/hex-cluster";
import type { Placement } from "@/lib/hex-plate";
import { HEX_LICENSE, HEX_RELEASE } from "@/lib/hex-spec";

const CODE = "a1B2c3D4e5F6g7H8i9J0kL"; // 22 base-62 characters
const request = (build?: string | null) =>
  resolvePack({
    release: HEX_RELEASE,
    parts: "hex-main:2",
    plate: "256x256",
    build,
  });

describe("the pack request carries a saved drawing's code", () => {
  it("is the shape hex-cluster mints", () => {
    expect(CODE).toHaveLength(SHARE_CODE_LENGTH);
    expect(BUILD_CODE_RE.test(CODE)).toBe(true);
    expect(BUILD_CODE_RE.source).toContain(`{${SHARE_CODE_LENGTH}}`);
  });

  it("keeps a real code and writes it into the canonical URL after src", () => {
    const r = request(CODE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.request.build).toBe(CODE);
    expect(canonicalPackQuery({ ...r.request, src: "sheet" as never })).toMatch(
      new RegExp(`&src=sheet&build=${CODE}$`),
    );
  });

  it("drops anything that is not a code, so the redirect removes it", () => {
    for (const bad of [
      "v2s=eJzLSM3JyQcABiwCFQ",
      `${CODE}x`,
      "short",
      "a1B2c3D4e5F6g7H8i9J0k/",
      "",
    ]) {
      const r = request(bad);
      expect(r.ok, bad).toBe(true);
      if (r.ok) {
        expect(r.request.build, bad).toBeUndefined();
        expect(canonicalPackQuery(r.request)).not.toContain("build=");
      }
    }
  });
});

describe("the README says where the build reopens", () => {
  const at = (slug: string): Placement => ({
    slug,
    name: slug,
    box: { x0: 0, y0: 0, z0: 0, dx: 40, dy: 30, dz: 10 },
    x: 4,
    y: 4,
  });
  const base = {
    release: HEX_RELEASE,
    bed: { x: 256, y: 256 },
    plates: [[at("hex-main")]],
    credit: HEX_LICENSE.credit,
    specUrl: "https://academy.onethousanddrones.com/hex",
    stem: "Bench rig",
  };

  it("straight after the spec address, for a saved build", () => {
    const url = `https://academy.onethousanddrones.com/c/${CODE}`;
    const lines = plateReadme({ ...base, buildUrl: url }).split("\n");
    const spec = lines.indexOf(base.specUrl);
    expect(lines.slice(spec + 1, spec + 5)).toEqual([
      "",
      "This build, to reopen or change it:",
      `  ${url}`,
      "",
    ]);
  });

  it("says nothing of the kind for an unsaved build", () => {
    expect(plateReadme(base)).not.toMatch(/reopen/);
  });
});
