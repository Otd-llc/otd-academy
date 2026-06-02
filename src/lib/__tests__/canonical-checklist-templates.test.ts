// Tests for the canonical checklist templates (Task 16.6).
//
// These templates are pure TypeScript-literal JSON; the materialize action
// (Task 16.7) turns them into real Checklist + ChecklistItem rows on demand.
// Pinning the shapes here keeps the labels stable for the gate predicates
// (Tasks 16.8 / 16.9) and downstream Wave 2 milestones.

import { describe, expect, test } from "vitest";
import { CANONICAL_TEMPLATES } from "@/lib/canonical-checklist-templates";

describe("canonical checklist templates", () => {
  test("REQUIREMENTS_REVIEW template has 4 canonical items", () => {
    const t = CANONICAL_TEMPLATES.REQUIREMENTS_REVIEW;
    expect(t.subkind).toBe("REQUIREMENTS_REVIEW");
    expect(t.stage).toBe("REQUIREMENTS");
    expect(t.items.length).toBe(4);
    expect(t.items.map((i) => i.label)).toEqual([
      expect.stringMatching(/WS2812 level-shift/i),
      expect.stringMatching(/Servo brownout/i),
      expect.stringMatching(/ADC1-only/i),
      expect.stringMatching(/Auto-shutoff/i),
    ]);
  });

  test("LAYOUT_REVIEW template has 2 canonical items", () => {
    const t = CANONICAL_TEMPLATES.LAYOUT_REVIEW;
    expect(t.subkind).toBe("LAYOUT_REVIEW");
    expect(t.stage).toBe("LAYOUT");
    expect(t.items.length).toBe(2);
    expect(t.items.map((i) => i.label)).toEqual([
      expect.stringMatching(/Antenna keep-out/i),
      expect.stringMatching(/Isolation barrier/i),
    ]);
  });

  // m17: STRIPBOARD_VALIDATION canonical template — gated at BOM_SOURCING
  // exit when project.requiresStripboard === true (proposal §3 #4).
  test("STRIPBOARD_VALIDATION template has 5 canonical items", () => {
    const t = CANONICAL_TEMPLATES.STRIPBOARD_VALIDATION;
    expect(t.subkind).toBe("STRIPBOARD_VALIDATION");
    expect(t.stage).toBe("BOM_SOURCING");
    expect(t.items.length).toBe(5);
    expect(t.items.map((i) => i.label)).toEqual([
      expect.stringMatching(/Topology validated/i),
      expect.stringMatching(/Shared rails identified/i),
      expect.stringMatching(/Power-rail track doubled/i),
      expect.stringMatching(/Firmware bring-up complete on stripboard/i),
      expect.stringMatching(/Bring-up measurements captured/i),
    ]);
  });
});
