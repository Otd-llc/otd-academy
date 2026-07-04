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

  it("seeds the provisioning / bench terms surfaced on REQUIREMENTS", () => {
    for (const t of ["KiCad starter", "exact BOM", "SMD rework"]) {
      expect(lookupTerm(t), `expected glossary to define "${t}"`).not.toBeNull();
    }
  });

  it("resolves the provisioning-term alias spellings used in guide content", () => {
    expect(lookupTerm("kicad starter project")).toEqual(lookupTerm("KiCad starter"));
    expect(lookupTerm("surface-mount rework")).toEqual(lookupTerm("SMD rework"));
    expect(lookupTerm("smd-rework setup")).toEqual(lookupTerm("SMD rework"));
  });

  it("carries a 'where it lives' stage pointer on the artifact terms", () => {
    const starter = lookupTerm("KiCad starter");
    expect(starter?.where?.stage).toBe("SCHEMATIC");
    expect(starter?.where?.label.length).toBeGreaterThan(0);

    const bom = lookupTerm("exact BOM");
    expect(bom?.where?.stage).toBe("BOM_SOURCING");
    expect(bom?.where?.label.length).toBeGreaterThan(0);

    // A general concept has no stage pointer.
    expect(lookupTerm("SMD rework")?.where).toBeUndefined();
  });

  it("every entry has a non-empty term and definition", () => {
    for (const entry of Object.values(GLOSSARY)) {
      expect(entry.term.length).toBeGreaterThan(0);
      expect(entry.def.length).toBeGreaterThan(0);
    }
  });

  it("every 'where' pointer names a real guide stage", () => {
    const STAGES = new Set([
      "REQUIREMENTS",
      "SCHEMATIC",
      "BOM_SOURCING",
      "LAYOUT",
      "DRC_GERBER",
      "ORDERING",
      "ASSEMBLY",
      "BRINGUP",
    ]);
    for (const entry of Object.values(GLOSSARY)) {
      if (entry.where) {
        expect(STAGES.has(entry.where.stage), `bad stage ${entry.where.stage}`).toBe(true);
      }
    }
  });
});
