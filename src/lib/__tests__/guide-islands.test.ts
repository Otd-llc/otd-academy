import { describe, it, expect } from "vitest";
import { scanIslands, RAIL_MIN_ISLANDS, deriveSetupRanges } from "@/lib/guide-islands";
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
});
