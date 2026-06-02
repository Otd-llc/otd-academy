// Unit tests for the pure `splitTitle` helper behind PageHeader's bench-hero
// title rendering. The component itself (JSX) is verified by running the app
// (M9) since the vitest env is `node` with no DOM harness; only the pure
// title-splitting logic is exercised here.

import { describe, it, expect } from "vitest";
import { splitTitle } from "@/components/PageHeader";

describe("splitTitle", () => {
  it("splits a trailing accent word off a multi-word title", () => {
    expect(splitTitle("INVENTORY CHECK", "CHECK")).toEqual({
      head: "INVENTORY",
      accent: "CHECK",
    });
  });

  it("returns the whole title as head with null accent when no accentWord", () => {
    expect(splitTitle("REQUIREMENTS")).toEqual({
      head: "REQUIREMENTS",
      accent: null,
    });
  });

  it("treats an empty accentWord as no accent", () => {
    expect(splitTitle("LAYOUT", "")).toEqual({ head: "LAYOUT", accent: null });
    expect(splitTitle("LAYOUT", "   ")).toEqual({
      head: "LAYOUT",
      accent: null,
    });
  });

  it("falls back to whole-title head when accentWord is not a trailing suffix", () => {
    expect(splitTitle("INVENTORY CHECK", "INVENTORY")).toEqual({
      head: "INVENTORY CHECK",
      accent: null,
    });
    expect(splitTitle("INVENTORY CHECK", "MISSING")).toEqual({
      head: "INVENTORY CHECK",
      accent: null,
    });
  });

  it("handles an accent word spanning the final multiple words", () => {
    expect(splitTitle("DRC AND GERBER EXPORT", "GERBER EXPORT")).toEqual({
      head: "DRC AND",
      accent: "GERBER EXPORT",
    });
  });

  it("renders the whole title white (head, no accent) when accentWord equals the entire title — prevents an all-gold hero against the gold eyebrow", () => {
    expect(splitTitle("BRINGUP", "BRINGUP")).toEqual({
      head: "BRINGUP",
      accent: null,
    });
    // Case-insensitive whole-title match still degrades to all-white.
    expect(splitTitle("Layout", "layout")).toEqual({
      head: "Layout",
      accent: null,
    });
  });

  it("matches the accent word case-insensitively but preserves the original casing", () => {
    expect(splitTitle("Inventory Check", "check")).toEqual({
      head: "Inventory",
      accent: "Check",
    });
  });

  it("trims surrounding whitespace on the title", () => {
    expect(splitTitle("  LAYOUT REVIEW  ", "REVIEW")).toEqual({
      head: "LAYOUT",
      accent: "REVIEW",
    });
  });
});
