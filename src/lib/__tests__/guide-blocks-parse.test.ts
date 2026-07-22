import { describe, it, expect } from "vitest";
import { parseGuideBlocks, parseBlockAt } from "@/lib/guide-blocks-parse";

const prose = (md: string) => ({ type: "prose", md });
const quiz = () => ({
  type: "quiz",
  questions: [{ q: "Question?", options: ["a", "b"], answer: 0 }],
});
// Missing `md` fails the prose branch → a malformed block.
const badProse = { type: "prose" };
// Unknown discriminator → fails the whole union.
const badType = { type: "not-a-block" };

describe("parseGuideBlocks", () => {
  it("keeps every valid block with identity storage indices, nothing dropped", () => {
    const raw = [prose("a"), quiz(), prose("b")];
    const { blocks, storageIndices, dropped } = parseGuideBlocks(raw);
    expect(blocks).toHaveLength(3);
    expect(storageIndices).toEqual([0, 1, 2]);
    expect(dropped).toEqual([]);
  });

  it("drops only the malformed block and keeps the rest (the whole point)", () => {
    const raw = [prose("a"), badProse, quiz()];
    const { blocks, storageIndices, dropped } = parseGuideBlocks(raw);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ type: "prose" });
    expect(blocks[1]).toMatchObject({ type: "quiz" });
    expect(dropped).toEqual([1]);
    // The surviving quiz kept its ORIGINAL storage index (2), not the renumbered 1,
    // so a capture write to blocks[storageIndex] hits the right block.
    expect(storageIndices).toEqual([0, 2]);
  });

  it("survives a malformed FIRST block", () => {
    const raw = [badType, quiz()];
    const { blocks, storageIndices, dropped } = parseGuideBlocks(raw);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: "quiz" });
    expect(storageIndices).toEqual([1]);
    expect(dropped).toEqual([0]);
  });

  it("degrades to empty on a non-array (matches today's blank-card floor)", () => {
    expect(parseGuideBlocks({ nope: true })).toEqual({
      blocks: [],
      storageIndices: [],
      dropped: [],
    });
    expect(parseGuideBlocks(null)).toEqual({
      blocks: [],
      storageIndices: [],
      dropped: [],
    });
  });

  it("caps survivors at 200 and reports the truncated tail as dropped", () => {
    const raw = Array.from({ length: 205 }, (_, i) => prose(`p${i}`));
    const { blocks, dropped } = parseGuideBlocks(raw);
    expect(blocks).toHaveLength(200);
    expect(dropped).toEqual([200, 201, 202, 203, 204]);
  });
});

describe("parseBlockAt", () => {
  const img = { type: "image", src: "/x.png", alt: "x" };

  it("returns the validated block at a raw storage index, past a malformed sibling", () => {
    const raw = [badProse, img];
    const block = parseBlockAt(raw, 1);
    expect(block).toMatchObject({ type: "image", src: "/x.png" });
  });

  it("returns null for an out-of-range index, a malformed block, or a non-array", () => {
    expect(parseBlockAt([img], 5)).toBeNull();
    expect(parseBlockAt([badProse], 0)).toBeNull();
    expect(parseBlockAt(null, 0)).toBeNull();
  });
});
