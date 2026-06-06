import { describe, it, expect } from "vitest";
import { lookupTerm, GLOSSARY } from "@/lib/glossary";

describe("glossary", () => {
  it("looks up a domain-jargon term and returns its entry", () => {
    const e = lookupTerm("ADC1");
    expect(e).not.toBeNull();
    expect(e!.term).toBe("ADC1");
    expect(typeof e!.def).toBe("string");
    expect(e!.def.length).toBeGreaterThan(0);
  });

  it("returns null for an unknown term", () => {
    expect(lookupTerm("definitely-not-a-real-term")).toBeNull();
  });

  it("is case-insensitive", () => {
    const lower = lookupTerm("adc1");
    const upper = lookupTerm("ADC1");
    expect(lower).not.toBeNull();
    expect(lower).toEqual(upper);
  });

  it("trims surrounding whitespace before lookup", () => {
    expect(lookupTerm("  SAC305  ")).not.toBeNull();
    expect(lookupTerm("  SAC305  ")).toEqual(lookupTerm("SAC305"));
  });

  it("returns null for empty / whitespace-only input", () => {
    expect(lookupTerm("")).toBeNull();
    expect(lookupTerm("   ")).toBeNull();
  });

  it("seeds the canonical domain-jargon terms", () => {
    for (const t of [
      "WL-CSP",
      "drag-tin",
      "SAC305",
      "ADC1",
      "ADC2",
      "RLD",
      "tombstoning",
      "ESP-NOW",
      "stripboard",
      "ENIG",
    ]) {
      expect(lookupTerm(t), `expected glossary to define "${t}"`).not.toBeNull();
    }
  });

  it("seeds canonical stage / gate terms from stages.ts", () => {
    // Stage names and gate concepts should be defined.
    for (const t of ["LAYOUT", "BRINGUP", "BOM sourcing", "exit gate"]) {
      expect(lookupTerm(t), `expected glossary to define "${t}"`).not.toBeNull();
    }
  });

  it("resolves alias spellings to a canonical entry", () => {
    // right-leg-drive is the long form of RLD.
    expect(lookupTerm("right-leg-drive")).not.toBeNull();
    expect(lookupTerm("right-leg-drive")).toEqual(lookupTerm("RLD"));
  });

  it("resolves long-form term spellings used in guide content", () => {
    // The guide deep-dives reference these by their full display names; the
    // canonical glossary keys are shorter, so aliases must bridge the gap or
    // the inline [[term]] silently degrades to plain text.
    expect(lookupTerm("dropout voltage")).toEqual(lookupTerm("dropout"));
    expect(lookupTerm("decoupling capacitor")).toEqual(lookupTerm("decoupling"));
  });

  it("seeds the guide deep-dive terms", () => {
    for (const t of ["E-series", "solder mask"]) {
      expect(lookupTerm(t), `expected glossary to define "${t}"`).not.toBeNull();
    }
  });

  it("seeds the KiCad schematic-capture terms (+ long-form aliases)", () => {
    for (const t of ["ERC", "PWR_FLAG", "net label", "power port", "no-connect"]) {
      expect(lookupTerm(t), `expected glossary to define "${t}"`).not.toBeNull();
    }
    expect(lookupTerm("electrical rules check")).toEqual(lookupTerm("ERC"));
    expect(lookupTerm("power flag")).toEqual(lookupTerm("PWR_FLAG"));
    expect(lookupTerm("no connect")).toEqual(lookupTerm("no-connect"));
  });

  it("every entry has a non-empty term and definition", () => {
    for (const entry of Object.values(GLOSSARY)) {
      expect(entry.term.length).toBeGreaterThan(0);
      expect(entry.def.length).toBeGreaterThan(0);
    }
  });
});
