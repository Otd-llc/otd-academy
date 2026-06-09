import { describe, it, expect } from "vitest";
import { composeGuide } from "@/lib/guide-templates/compose";
import { guideCardInputSchema } from "@/lib/schemas/guide";

const eeg = {
  slug: "l3-01-eeg-front-end",
  name: "L3.01 EEG front-end",
  track: "SENSE" as const,
  requiresStripboard: false,
  disciplineTaught: "8-ch ADS1299 AFE",
  level: "L3" as const,
};

describe("composeGuide", () => {
  it("produces 8 cards in stage order with ordinals 0..7", () => {
    const g = composeGuide(eeg);
    expect(g.cards).toHaveLength(8);
    expect(g.cards.map((c) => c.ordinal)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(g.cards[0]!.stage).toBe("REQUIREMENTS");
    expect(g.cards[7]!.stage).toBe("BRINGUP");
  });
  it("merges the isolation gotcha into the EEG LAYOUT card", () => {
    const layout = composeGuide(eeg).cards.find((c) => c.stage === "LAYOUT")!;
    expect(
      layout.contentBlocks.some((b) => /isolat/i.test((b as { label?: string }).label ?? "")),
    ).toBe(true);
  });
  it("falls back to neutral overlay when track is null", () => {
    const g = composeGuide({ ...eeg, track: null });
    expect(g.cards).toHaveLength(8); // no throw
  });
  it("validates every card against the schema", () => {
    // composeGuide should return cards that pass guideCardInputSchema
    const g = composeGuide(eeg);
    g.cards.forEach((c) => expect(guideCardInputSchema.safeParse(c).success).toBe(true));
  });
  it("L1 REQUIREMENTS card gates on the artifact, not the review checklist", () => {
    const req = composeGuide({ ...eeg, level: "L1" }).cards.find(
      (c) => c.stage === "REQUIREMENTS",
    )!;
    expect(req.completionRef).toEqual({
      kind: "artifact",
      subkinds: ["REQUIREMENTS_DOC"],
    });
  });
  it("non-L1 REQUIREMENTS card keeps the review-checklist ref", () => {
    const req = composeGuide(eeg).cards.find(
      (c) => c.stage === "REQUIREMENTS",
    )!;
    expect(req.completionRef).toEqual({
      kind: "revisionChecklist",
      subkind: "REQUIREMENTS_REVIEW",
    });
  });
});
