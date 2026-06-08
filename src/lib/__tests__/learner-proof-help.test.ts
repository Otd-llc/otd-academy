// Invariant: every stage that requires a learner proof artifact MUST ship a
// how-to (a plain-words requirement + ordered steps to produce/export it). A
// proof requirement with no guidance is a dead end for a beginner.
import { describe, it, expect } from "vitest";
import { Stage } from "@prisma/client";
import { learnerProofSubkind } from "@/lib/learner-gates";
import { proofHelp } from "@/lib/learner-proof-help";

describe("proofHelp", () => {
  it("has help for every stage that requires a proof artifact", () => {
    for (const stage of Object.values(Stage)) {
      const subkind = learnerProofSubkind(stage);
      if (!subkind) continue;
      const help = proofHelp(subkind);
      expect(help, `${stage} requires ${subkind} but has no how-to help`).toBeTruthy();
      expect(help!.requirement.length, `${subkind}.requirement`).toBeGreaterThan(0);
      expect(help!.howToTitle.length, `${subkind}.howToTitle`).toBeGreaterThan(0);
      expect(help!.steps.length, `${subkind}.steps`).toBeGreaterThan(0);
    }
  });

  it("returns a KiCad schematic how-to for SCHEMATIC_FILE", () => {
    const help = proofHelp("SCHEMATIC_FILE");
    expect(help?.requirement).toMatch(/schematic/i);
    expect(help?.steps.join(" ")).toMatch(/kicad/i);
  });

  it("returns a KiCad layout how-to for LAYOUT_FILE", () => {
    const help = proofHelp("LAYOUT_FILE");
    expect(help?.requirement).toMatch(/layout|pcb/i);
    expect(help?.steps.join(" ")).toMatch(/kicad/i);
  });

  it("returns undefined for a subkind with no learner how-to", () => {
    expect(proofHelp("BOM_EXPORT")).toBeUndefined();
  });
});
