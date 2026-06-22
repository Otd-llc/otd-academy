import { describe, expect, it } from "vitest";
import { lookupTerm } from "@/lib/glossary";

describe("Embodied Motor Imagery (EMI) glossary term", () => {
  it("resolves the canonical term", () => {
    const entry = lookupTerm("Embodied Motor Imagery");
    expect(entry).not.toBeNull();
    expect(entry?.term).toBe("Embodied Motor Imagery");
  });

  it("resolves the EMI alias to the same canonical entry", () => {
    const canonical = lookupTerm("Embodied Motor Imagery");
    const aliased = lookupTerm("EMI");
    expect(aliased).not.toBeNull();
    expect(aliased).toBe(canonical);
  });

  it("does NOT resolve a loose variant (one-spelling enforcement)", () => {
    expect(lookupTerm("embodied imagery")).toBeNull();
  });

  // The definition is the LOCKED canonical text (EMI doc §2 / plan B1) — never
  // paraphrase. Guard the load-bearing phrasing so a future copy-edit can't
  // silently weaken the vocabulary moat.
  it("keeps the verbatim canonical definition", () => {
    const def = lookupTerm("Embodied Motor Imagery")?.def ?? "";
    expect(def).toContain("deeply-grooved, overtrained procedural movements");
    expect(def).toContain("high-signal, low-variance input for brain-computer control");
  });
});
