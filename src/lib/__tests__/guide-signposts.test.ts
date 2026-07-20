import { describe, it, expect } from "vitest";
import { MODE_VAR, MODE_TEXT, parseModeLabel, MODES } from "@/lib/guide-signposts";

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
