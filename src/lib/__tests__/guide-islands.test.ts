import { describe, it, expect } from "vitest";
import { scanIslands, RAIL_MIN_ISLANDS, deriveSetupRanges, deriveSectionRanges } from "@/lib/guide-islands";
import type { ContentBlock } from "@/lib/schemas/guide";

const co = (label: string): ContentBlock => ({ type: "callout", severity: "info", label, body: "x" });
const prose = (): ContentBlock => ({ type: "prose", md: "p" });

describe("scanIslands", () => {
  it("finds numbered-section callouts with anchor ids", () => {
    const blocks = [prose(), co("01 · The regulator"), prose(), co("02 · Decoupling & the module")];
    expect(scanIslands(blocks)).toEqual([
      { num: "01", title: "The regulator", blockIndex: 1, anchorId: "island-01" },
      { num: "02", title: "Decoupling & the module", blockIndex: 3, anchorId: "island-02" },
    ]);
  });
  it("ignores non-section callouts and other block types", () => {
    const blocks = [co("Check yourself"), co("Mode · do · Build it"), prose()];
    expect(scanIslands(blocks)).toEqual([]);
  });
  it("RAIL_MIN_ISLANDS shows the rail from 2 sections up (only 0/1 skip it)", () => {
    expect(RAIL_MIN_ISLANDS).toBe(2);
  });
});

describe("deriveSetupRanges", () => {
  it("derives a setup range from a Setup · callout to the next mode band", () => {
    const blocks = [
      co("Mode · orient · Meet the board"), prose(),
      co("Setup · Get KiCad + the starter open"), prose(), prose(),
      co("Mode · do · Build it, island by island"), co("01 · The regulator"),
    ];
    expect(deriveSetupRanges(blocks)).toEqual([{ start: 2, end: 5, title: "Get KiCad + the starter open" }]);
  });
  it("terminates at the next numbered section header", () => {
    const blocks = [co("Setup · Bench prep"), prose(), co("01 · The regulator"), prose()];
    expect(deriveSetupRanges(blocks)).toEqual([{ start: 0, end: 2, title: "Bench prep" }]);
  });
  it("runs to the end of the list when nothing terminates it", () => {
    const blocks = [prose(), co("Setup · Get set up"), prose(), prose()];
    expect(deriveSetupRanges(blocks)).toEqual([{ start: 1, end: 4, title: "Get set up" }]);
  });
  it("returns no ranges when there is no Setup · callout", () => {
    const blocks = [co("Mode · do · Build"), co("01 · The regulator"), prose()];
    expect(deriveSetupRanges(blocks)).toEqual([]);
  });

  // DOCUMENTED, NOT DESIRED. `isStructuralBreak` returns false for ANY non-callout
  // block, so a Do expressed as a block rather than a callout does not terminate a
  // Setup range. This matters once the signpost work moves `Draw it ·` callouts into
  // their own block type: they stop closing the region they used to close. Today
  // nothing changes (SCHEMATIC's one open range already swallows its Do block), but
  // nothing pinned it either. If a reviewer decides a Do block SHOULD close a setup
  // region, that is a deliberate change to isStructuralBreak with this test
  // inverted, not a silent drift.
  it("a Setup range still ends at a section header, so it nests inside a section", () => {
    // Load-bearing for deriveSectionRanges: because a setup range can never
    // straddle a section boundary, a section can WRAP its setup band without the
    // two derivations fighting over the same blocks.
    const ranges = deriveSetupRanges([
      co("01 · The regulator"),
      co("Setup · Bench prep"),
      prose(),
      co("02 · The USB port"),
    ]);
    expect(ranges).toEqual([{ start: 1, end: 3, title: "Bench prep" }]);
  });

  it("a non-callout block does not terminate a Setup range", () => {
    const ranges = deriveSetupRanges([
      co("Setup · Get KiCad open"),
      { type: "steps", ordered: true, items: ["wire it"] },
      co("01 · The regulator"),
    ]);
    expect(ranges[0]).toEqual({ start: 0, end: 2, title: "Get KiCad open" });
  });
});

describe("deriveSectionRanges", () => {
  it("runs a section from its header to the next section header", () => {
    const blocks = [
      co("01 · The regulator"), prose(), prose(),
      co("02 · The USB port"), prose(),
    ];
    expect(deriveSectionRanges(blocks)).toEqual([
      { start: 0, end: 3, title: "The regulator" },
      { start: 3, end: 5, title: "The USB port" },
    ]);
  });

  it("terminates a section at the next mode band", () => {
    const blocks = [
      co("01 · The regulator"), prose(),
      co("Mode · check · Prove it"), prose(),
    ];
    expect(deriveSectionRanges(blocks)).toEqual([
      { start: 0, end: 2, title: "The regulator" },
    ]);
  });

  it("runs the last section to the end of the card", () => {
    const blocks = [prose(), co("03 · The LEDs"), prose(), prose()];
    expect(deriveSectionRanges(blocks)).toEqual([
      { start: 1, end: 4, title: "The LEDs" },
    ]);
  });

  // The nesting rule the wrap depends on: a Setup range opening inside a section
  // must stay INSIDE it, not cut it short.
  it("does not let a Setup callout terminate a section", () => {
    const blocks = [
      co("01 · The regulator"), prose(),
      co("Setup · Bench prep"), prose(),
      co("02 · The USB port"),
    ];
    expect(deriveSectionRanges(blocks)).toEqual([
      { start: 0, end: 4, title: "The regulator" },
      { start: 4, end: 5, title: "The USB port" },
    ]);
  });

  it("returns no ranges for a card with no numbered sections", () => {
    expect(deriveSectionRanges([prose(), co("Mode · do · Build")])).toEqual([]);
  });
});
