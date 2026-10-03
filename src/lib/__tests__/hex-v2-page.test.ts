// Pins the v2 numbers /hex states, and the copy rules the page must keep.
//
// The derivations are asserted against the values the configurator's own tests
// pin (bs-explode src/hex/v2/lattice.test.ts: PITCH_MM 165.705), so a change
// to a var here that the CAD did not make fails loudly.
//
// The copy guards read the page SOURCE. They are the launch item's "done when"
// made permanent: no v1 name or number, no notify form, the pipe spec and the
// time caveat verbatim, and none of the brand rule's banned names.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  HEX_V2_FEMALE_BEARINGS,
  HEX_V2_JIGS,
  HEX_V2_MALE_BEARINGS,
  HEX_V2_PITCH_MM,
  HEX_V2_PRINT_PROFILE,
  HEX_V2_SET,
  HEX_V2_SLICERS,
  firstBuildTotals,
  hoursMinutes,
  printableProxyPath,
} from "@/lib/hex-v2-page";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf-8");
const PAGE = read("src/app/(chrome)/hex/page.tsx");
const OG = read("src/app/(chrome)/hex/opengraph-image.tsx");
const LOOP = read("src/components/hex/ThemedLoop.tsx");
const HERO = read("src/lib/hex-hero-film.ts");
const DATA = read("src/lib/hex-v2-page.ts");
const SURFACES = { page: PAGE, og: OG, loop: LOOP, hero: HERO, data: DATA };

describe("v2 geometry", () => {
  it("derives the 165.705 mm pitch from the vars", () => {
    expect(HEX_V2_PITCH_MM).toBeCloseTo(165.705, 3);
  });

  it("alternates the dovetails, each edge opposite the other gender", () => {
    expect([...HEX_V2_MALE_BEARINGS]).toEqual([30, 150, 270]);
    expect([...HEX_V2_FEMALE_BEARINGS]).toEqual([90, 210, 330]);
    for (const b of HEX_V2_MALE_BEARINGS) {
      expect(HEX_V2_FEMALE_BEARINGS).toContain((b + 180) % 360);
    }
  });
});

describe("v2 print profile (decision 1.4)", () => {
  const row = (label: string) =>
    HEX_V2_PRINT_PROFILE.find((r) => r.label === label)?.value;

  it("states PETG, 0.4, 0.20, 4 walls, 30% adaptive cubic, 220 bed", () => {
    expect(row("Material")).toBe("PETG");
    expect(row("Nozzle diameter")).toBe("0.4 mm");
    expect(row("Layer height")).toBe("0.20 mm");
    expect(row("Walls")).toBe("4");
    expect(row("Infill")).toBe("30% adaptive cubic");
    expect(row("Bed")).toBe("220 × 220 mm");
  });

  it("names the four slicers and nothing else", () => {
    expect([...HEX_V2_SLICERS]).toEqual([
      "Creality Print",
      "OrcaSlicer",
      "PrusaSlicer",
      "Cura",
    ]);
  });
});

describe("the first build", () => {
  it("totals two hex-main at the K2 Plus reference", () => {
    const t = firstBuildTotals();
    expect(t.minutes).toBe(794);
    expect(Math.round(t.grams)).toBe(511);
    expect(t.spools).toBeCloseTo(0.511, 3);
  });

  it("formats minutes as hours and minutes", () => {
    expect(hoursMinutes(397)).toBe("6 h 37 min");
    expect(hoursMinutes(36)).toBe("36 min");
    expect(hoursMinutes(794)).toBe("13 h 14 min");
  });
});

describe("downloads go through /api/printable", () => {
  it("builds a proxy path for every jig", () => {
    for (const j of HEX_V2_JIGS) {
      expect(printableProxyPath("2026-10-01", `3mf/${j.stem}.3mf`)).toBe(
        `/api/printable/2026-10-01/3mf/${j.stem}.3mf`,
      );
    }
    expect(HEX_V2_JIGS).toHaveLength(4);
  });

  it("labels the set zip with the size measured at publish (10.3)", () => {
    // The label must be the byte count rounded to decimal MB, so the two
    // cannot drift apart when the next measurement replaces them.
    expect(HEX_V2_SET.sizeLabel).toBe(
      `~${(HEX_V2_SET.sizeBytes / 1e6).toFixed(1)} MB`,
    );
    expect(HEX_V2_SET.sizeBytes).toBe(18_581_524);
    expect(HEX_V2_SET.sizeLabel).toBe("~18.6 MB");
    expect(HEX_V2_SET.sizeMeasured).toBe(true);
  });
});

describe("/hex copy rules", () => {
  it.each(Object.entries(SURFACES))(
    "%s carries no v1 name or number",
    (_name, src) => {
      expect(src).not.toMatch(/hex-tb|carrier|76\.20|across flats/i);
    },
  );

  it("does not render the notify form", () => {
    expect(PAGE).not.toMatch(/ReleaseNotify/);
  });

  it.each(Object.entries(SURFACES))(
    "%s names no banned brand or comparison",
    (_name, src) => {
      expect(src).not.toMatch(/bambu|\bA1\b|gridfinity|\bHSW\b|storage/i);
    },
  );

  it("has no em-dash anywhere on the page", () => {
    for (const src of [PAGE, DATA, LOOP, HERO]) expect(src).not.toContain("—");
  });

  it("states the pipe spec and the time caveat verbatim", () => {
    const flat = PAGE.replace(/\s+/g, " ");
    expect(flat).toContain(
      "3/4 in Sch 40, OD 26.67 mm (US). Metric 25/32 mm pipe does not fit.",
    );
    expect(flat).toContain(
      "K2 Plus reference, supports excluded, slower printers up to ~4×",
    );
  });

  it("takes its licence lines from HEX_LICENSE", () => {
    expect(PAGE).toMatch(/HEX_LICENSE\.credit/);
    expect(PAGE).not.toMatch(/licensed CC BY 4\.0\. Source:/);
  });
});

describe("the release the page links to", () => {
  it("is the generated release id, a real date, never a placeholder", async () => {
    const { HEX_V2_RELEASE } = await import("@/lib/hex-v2-page");
    const { HEX_RELEASE } = await import("@/lib/hex-spec");
    expect(HEX_V2_RELEASE).toBe(HEX_RELEASE);
    expect(HEX_V2_RELEASE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
