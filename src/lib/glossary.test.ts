import { describe, expect, it } from "vitest";
import { lookupTerm } from "@/lib/glossary";

describe("glossary lookup", () => {
  it("resolves a canonical term (case-insensitive)", () => {
    const entry = lookupTerm("ENIG");
    expect(entry).not.toBeNull();
    expect(entry?.term).toBe("ENIG");
    expect(lookupTerm("enig")).toBe(entry);
  });

  it("resolves a long-form alias to its canonical entry", () => {
    const canonical = lookupTerm("RLD");
    const aliased = lookupTerm("right-leg-drive");
    expect(canonical).not.toBeNull();
    expect(aliased).toBe(canonical);
  });

  it("returns null for an unknown term (degrades to plain text)", () => {
    expect(lookupTerm("not-a-real-term-xyz")).toBeNull();
  });
});
