import { describe, it, expect } from "vitest";
import { scanIslands, RAIL_MIN_ISLANDS } from "@/lib/guide-islands";
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
  it("RAIL_MIN_ISLANDS gates 2-section cards", () => {
    expect(RAIL_MIN_ISLANDS).toBe(3);
  });
});
