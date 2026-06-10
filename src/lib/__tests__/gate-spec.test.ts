// Unit tests for the single gate spec — the source of truth the gate logic
// (learner-gates), the gate widget, and the upload modal all read. One map so the
// three can't drift apart (the drift that silently hid the SCHEMATIC ERC upload).
// Pure, no DB.
import { describe, expect, test } from "vitest";
import type { Stage } from "@prisma/client";
import { gateSpec, gateArtifactHelp } from "@/lib/gate-spec";

const ARTIFACT_STAGES: Stage[] = ["SCHEMATIC", "LAYOUT"];
const QUIZ_ONLY_STAGES: Stage[] = [
  "REQUIREMENTS",
  "BOM_SOURCING",
  "DRC_GERBER",
  "ORDERING",
  "ASSEMBLY",
  "BRINGUP",
];

describe("gateSpec", () => {
  test("SCHEMATIC: quiz + ERC report, .rpt accept, erc validator", () => {
    const s = gateSpec("SCHEMATIC");
    expect(s.quiz).toBe(true);
    expect(s.artifact).not.toBeNull();
    expect(s.artifact?.subkind).toBe("ERC_REPORT");
    expect(s.artifact?.label).toBe("clean ERC report");
    expect(s.artifact?.accept).toContain(".rpt");
    expect(s.artifact?.validate).toBe("erc");
  });

  test("LAYOUT: layout file, presence-only (no validator yet)", () => {
    const s = gateSpec("LAYOUT");
    expect(s.artifact?.subkind).toBe("LAYOUT_FILE");
    expect(s.artifact?.accept).toContain(".kicad_pcb");
    expect(s.artifact?.validate).toBeNull();
  });

  test("quiz-only stages require a quiz and carry no artifact", () => {
    for (const stage of QUIZ_ONLY_STAGES) {
      const s = gateSpec(stage);
      expect(s.quiz).toBe(true);
      expect(s.artifact).toBeNull();
    }
  });
});

describe("gateArtifactHelp — no dead ends", () => {
  test("every artifact stage has matching how-to help with steps", () => {
    for (const stage of ARTIFACT_STAGES) {
      const help = gateArtifactHelp(stage);
      expect(help).toBeDefined();
      expect(help!.steps.length).toBeGreaterThan(0);
    }
  });

  test("quiz-only stages have no artifact help", () => {
    expect(gateArtifactHelp("REQUIREMENTS")).toBeUndefined();
  });
});
