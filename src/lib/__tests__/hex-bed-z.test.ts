// The print bed's HEIGHT (Z). Owner, 2026-10-08: a part taller than the bed
// WARNS -- it stays in the pack and the README names it -- and a bed nobody set
// is 250 mm tall, which clears every part shipped. So the height lays nothing
// out; what it must get right is which parts it names, and that it changes
// nothing at all for a link or a visitor that never mentions it.
import { describe, expect, it } from "vitest";

import { CHANNEL, PROTOCOL_VERSION, parseMessage } from "@/lib/hex-embed-protocol";
import {
  BED_Z_MAX,
  BED_Z_MIN,
  DEFAULT_BED_Z,
  canonicalPackQuery,
  partsTallerThan,
  resolvePack,
  type PackRequest,
} from "@/lib/hex-pack";
import { packReadme, plateReadme } from "@/lib/hex-pack-readme";
import type { Placement } from "@/lib/hex-plate";
import { HEX_PART_SLUGS } from "@/lib/hex-parts";
import { HEX_PART_BOX } from "@/lib/hex-release-tables";
import { HEX_LICENSE, HEX_RELEASE } from "@/lib/hex-spec";
import { FALLBACK_BED_Z, normalizeBedZ } from "@/lib/print-bed";

const RELEASE = "2026-07-31";
const ONE = HEX_PART_SLUGS[0];
const flat = (s: string) => s.replace(/\s+/g, " ");

function ok(extra: Record<string, string> = {}): PackRequest {
  const r = resolvePack({ release: RELEASE, parts: ONE, ...extra });
  if (!r.ok) throw new Error(r.problem);
  return r.request;
}

/** The released parts, tallest first, by their printed height. */
const BY_HEIGHT = [...HEX_PART_SLUGS].sort(
  (a, b) => HEX_PART_BOX[b].dz - HEX_PART_BOX[a].dz,
);

describe("the bed height in a pack request", () => {
  it("defaults to 250, and 250 clears every part this release ships", () => {
    expect(DEFAULT_BED_Z).toBe(250);
    expect(FALLBACK_BED_Z).toBe(250);
    expect(ok().bedZ).toBe(DEFAULT_BED_Z);
    expect(HEX_PART_BOX[BY_HEIGHT[0]].dz).toBeLessThanOrEqual(DEFAULT_BED_Z);
  });

  it("reads `bedz=` and refuses anything but one integer in the grammar", () => {
    expect(ok({ bedz: "245" }).bedZ).toBe(245);
    expect(ok({ bedz: String(BED_Z_MIN) }).bedZ).toBe(BED_Z_MIN);
    expect(ok({ bedz: String(BED_Z_MAX) }).bedZ).toBe(BED_Z_MAX);
    for (const bad of ["49", "1001", "24.5", "-5", "245mm", "12345", " 245", "2e2"]) {
      expect(resolvePack({ release: RELEASE, parts: ONE, bedz: bad }), bad).toEqual({
        ok: false,
        problem: "bad-bed",
      });
    }
  });

  it("is in the canonical URL only when it is not the default, after the bed", () => {
    // Every link from before the height existed keeps its one spelling.
    expect(canonicalPackQuery(ok())).not.toContain("bedz=");
    expect(canonicalPackQuery(ok({ bedz: "250" }))).not.toContain("bedz=");
    expect(canonicalPackQuery(ok({ bedz: "245" }))).toMatch(/&plate=220x220&bedz=245(&|$)/);
  });
});

describe("the parts taller than the bed", () => {
  it("are exactly those whose PRINTED height exceeds it, tallest first", () => {
    const parts = BY_HEIGHT.slice(0, 12).map((slug) => ({ slug, qty: 1 }));
    const z = HEX_PART_BOX[BY_HEIGHT[5]].dz;
    const taller = partsTallerThan(parts, z);
    expect(taller.length).toBeGreaterThan(0);
    for (const t of taller) expect(t.heightMm).toBeGreaterThan(z);
    for (const p of parts) {
      const named = taller.some((t) => t.slug === p.slug);
      expect(named, p.slug).toBe(HEX_PART_BOX[p.slug].dz > z);
    }
    const heights = taller.map((t) => t.heightMm);
    expect(heights).toEqual([...heights].sort((a, b) => b - a));
  });

  it("are none at the default height", () => {
    const every = HEX_PART_SLUGS.map((slug) => ({ slug, qty: 1 }));
    expect(partsTallerThan(every, DEFAULT_BED_Z)).toEqual([]);
  });
});

describe("the README warns, and only when there is something to warn about", () => {
  const tall = BY_HEIGHT[0];
  const heightMm = HEX_PART_BOX[tall].dz;
  const z = heightMm - 1;
  const loose = (taller: { slug: string; heightMm: number }[]) =>
    packReadme({
      release: HEX_RELEASE,
      format: "stl",
      parts: [{ slug: tall, qty: 1 }],
      credit: HEX_LICENSE.credit,
      specUrl: "https://academy.onethousanddrones.com/hex",
      bedZ: z,
      taller,
    });

  it("names the part and its height, and says it is in the pack anyway", () => {
    const txt = flat(loose([{ slug: tall, heightMm }]));
    expect(txt).toContain("TALLER THAN YOUR PRINTER.");
    expect(txt).toContain(`taller than the ${z} mm build height`);
    expect(txt).toContain("They are included anyway.");
    expect(txt).toContain(`- ${tall}: ${heightMm} mm tall as printed`);
  });

  it("says nothing at all when no part is taller", () => {
    expect(loose([])).not.toContain("TALLER THAN YOUR PRINTER");
  });

  it("on a one-plate download, names only the tall parts on that plate", () => {
    const short = BY_HEIGHT[BY_HEIGHT.length - 1];
    const at = (slug: string): Placement => ({
      slug,
      name: slug.toUpperCase(),
      box: HEX_PART_BOX[slug],
      x: 4,
      y: 4,
    });
    const txt = (only: number) =>
      flat(
        plateReadme({
          release: HEX_RELEASE,
          bed: { x: 350, y: 350 },
          plates: [[at(tall)], [at(short)]],
          credit: HEX_LICENSE.credit,
          specUrl: "https://academy.onethousanddrones.com/hex",
          stem: "OTD-Hex-Cluster",
          only,
          bedZ: z,
          taller: [{ slug: tall, heightMm }],
        }),
      );
    // By the published name the plate manifest uses.
    expect(txt(1)).toContain(`- ${tall.toUpperCase()}: ${heightMm} mm tall as printed`);
    expect(txt(2)).not.toContain("TALLER THAN YOUR PRINTER");
  });
});

describe("the embed protocol carries the height beside the bed", () => {
  const msg = (type: string, extra: Record<string, unknown>) => ({
    channel: CHANNEL,
    protocolVersion: PROTOCOL_VERSION,
    type,
    bed: { x: 250, y: 250 },
    ...extra,
  });

  it("accepts it on every bed message, and still accepts its absence", () => {
    for (const type of ["set-bed", "bed-changed", "promote-bed"]) {
      expect(parseMessage(msg(type, {})), type).not.toBeNull();
      expect(parseMessage(msg(type, { bedZ: 245 })), type).toMatchObject({ bedZ: 245 });
    }
  });

  it("refuses the whole message when the height is present and malformed", () => {
    for (const bedZ of [24.5, 49, 1001, "245", null]) {
      expect(parseMessage(msg("bed-changed", { bedZ })), String(bedZ)).toBeNull();
    }
  });

  it("refuses a bed that carries the height INSIDE it, as before", () => {
    expect(parseMessage(msg("bed-changed", { bed: { x: 250, y: 250, z: 245 } }))).toBeNull();
  });
});

describe("the account's validator", () => {
  it("takes the endpoint's grammar, no floor, integers only", () => {
    expect(normalizeBedZ(245)).toBe(245);
    expect(normalizeBedZ(BED_Z_MIN)).toBe(BED_Z_MIN);
    for (const bad of [BED_Z_MIN - 1, BED_Z_MAX + 1, 24.5, NaN, "245", null, undefined]) {
      expect(normalizeBedZ(bad), String(bad)).toBeNull();
    }
  });
});
