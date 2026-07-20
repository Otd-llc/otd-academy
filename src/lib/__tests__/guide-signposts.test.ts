import { describe, it, expect } from "vitest";
import {
  MODE_VAR,
  MODE_TEXT,
  parseModeLabel,
  MODES,
  scanModeBands,
  parseAlertLabel,
  parseAsideLabel,
} from "@/lib/guide-signposts";
import type { ContentBlock } from "@/lib/schemas/guide";

describe("guide signposts: mode vocabulary", () => {
  it("resolves every mode colour through a CSS custom property", () => {
    for (const m of MODES) {
      expect(MODE_VAR[m], `${m} must be a var(), not a literal`).toMatch(
        /^var\(--color-[a-z-]+\)$/,
      );
    }
  });

  it("has a token utility class for every mode", () => {
    for (const m of MODES) expect(MODE_TEXT[m]).toMatch(/^text-/);
  });

  it("parses a mode label with a venue", () => {
    expect(parseModeLabel("Mode · do · in KiCad · Build it, island by island")).toEqual({
      mode: "do",
      venue: "in KiCad",
      title: "Build it, island by island",
    });
  });

  it("parses a mode label with no venue", () => {
    expect(parseModeLabel("Mode · check · Prove it")).toEqual({
      mode: "check",
      venue: null,
      title: "Prove it",
    });
  });

  it("keeps a multi-part title intact when a venue is present", () => {
    expect(parseModeLabel("Mode · do · at the bench · Solder it, heavy parts first")).toEqual({
      mode: "do",
      venue: "at the bench",
      title: "Solder it, heavy parts first",
    });
  });

  it("falls back to do for an unknown mode word", () => {
    expect(parseModeLabel("Mode · wibble · Something")?.mode).toBe("do");
  });

  it("returns null for a label that is not a mode band", () => {
    expect(parseModeLabel("01 · The regulator")).toBeNull();
  });
});

const band = (label: string): ContentBlock => ({
  type: "callout",
  severity: "info",
  label,
  body: "",
});

describe("guide signposts: band ordinals", () => {
  // THE MISREAD THIS PREVENTS: numbering across every band in the card made the
  // FIRST do band render `[ do 02 / 07 ]`, because it was the second band overall.
  // A number beside the word `do` is read as counting `do`s.
  it("numbers each mode separately, so the first do band is 01", () => {
    const blocks: ContentBlock[] = [
      { type: "prose", md: "intro" },
      band("Mode · orient · Meet the board"),
      band("Mode · do · in KiCad · Set up the board"),
      { type: "prose", md: "filler" },
      band("Mode · do · in KiCad · Place every part"),
      band("Mode · check · Prove it"),
      band("Mode · do · in KiCad · Route the copper"),
    ];
    const m = scanModeBands(blocks);
    expect(m.get(1)).toEqual({ ord: 1, of: 1 }); // the only orient band
    expect(m.get(2)).toEqual({ ord: 1, of: 3 }); // FIRST do band → 01, not 02
    expect(m.get(4)).toEqual({ ord: 2, of: 3 });
    expect(m.get(6)).toEqual({ ord: 3, of: 3 });
    expect(m.get(5)).toEqual({ ord: 1, of: 1 }); // the only check band
    expect(m.has(0)).toBe(false);
  });

  it("returns an empty map for a card with no bands", () => {
    expect(scanModeBands([{ type: "prose", md: "x" }]).size).toBe(0);
  });
});

describe("guide signposts: alert ladder", () => {
  it("parses a headlined gotcha", () => {
    expect(
      parseAlertLabel("Gotcha · an LDO without its output cap can oscillate", "warn"),
    ).toEqual({
      rung: "caution",
      word: "Gotcha",
      headline: "an LDO without its output cap can oscillate",
    });
  });

  it("parses a bare gotcha with no headline", () => {
    expect(parseAlertLabel("Gotcha", "warn")).toEqual({
      rung: "caution",
      word: "Gotcha",
      headline: null,
    });
  });

  it("promotes a critical severity to the warning rung", () => {
    const r = parseAlertLabel("Gotcha · a soldering iron never looks hot", "critical");
    expect(r?.rung).toBe("warning");
    expect(r?.word).toBe("Warning");
  });

  it("returns null for a label that is not an alert", () => {
    expect(parseAlertLabel("Check yourself", "info")).toBeNull();
  });

  it("accepts a Warning-prefixed label on a critical callout", () => {
    expect(parseAlertLabel("Warning · a soldering iron never looks hot", "critical")).toEqual({
      rung: "warning",
      word: "Warning",
      headline: "a soldering iron never looks hot",
    });
  });

  it("accepts a Note-prefixed label on an info callout", () => {
    expect(parseAlertLabel("Note · the WROOM carries its own decoupling", "info")?.rung).toBe(
      "note",
    );
  });

  it("does not claim a label that merely contains the word gotcha", () => {
    expect(parseAlertLabel("The gotcha with LDOs", "warn")).toBeNull();
  });

  // THE REGRESSION THAT MATTERS: defaultBlock("callout") emits label "Note".
  // If a bare rung word were claimed, every callout an author inserts would render
  // as a headline-less Note-rung alert.
  it("does not claim the editor's default callout label", () => {
    expect(parseAlertLabel("Note", "info")).toBeNull();
    expect(parseAlertLabel("Warning", "critical")).toBeNull();
  });

  it("does not claim a colon-separated label", () => {
    expect(parseAlertLabel("Caution: read first", "warn")).toBeNull();
    expect(
      parseAlertLabel("First power-on: a charger, not your laptop", "warn"),
    ).toBeNull();
  });
});

describe("guide signposts: asides", () => {
  it("parses a Keys aside", () => {
    expect(parseAsideLabel("Keys · The KiCad 10 keys you'll use")).toEqual({
      verb: "Keys",
      headline: "The KiCad 10 keys you'll use",
    });
  });

  // SetupBand owns this label (GuideBlocks.tsx never renders the block), so the
  // aside family must not claim it.
  it("does not claim a Setup label", () => {
    expect(parseAsideLabel("Setup · Get KiCad + the starter open")).toBeNull();
  });

  it("parses an Alternative aside", () => {
    expect(parseAsideLabel("Alternative · have hot air? Reflow them instead")).toEqual({
      verb: "Alternative",
      headline: "have hot air? Reflow them instead",
    });
  });

  it("does not claim a numbered section header", () => {
    expect(parseAsideLabel("01 · The regulator")).toBeNull();
  });

  it("does not claim a mode band", () => {
    expect(parseAsideLabel("Mode · do · in KiCad · Build it")).toBeNull();
  });

  it("does not claim an unknown verb", () => {
    expect(parseAsideLabel("Wibble · something")).toBeNull();
  });
});
