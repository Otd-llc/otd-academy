import { describe, it, expect } from "vitest";
import { emptyCell, resizeRows } from "@/lib/guide-table";

describe("resizeRows", () => {
  it("pads short rows with empty cells to the column count", () => {
    const out = resizeRows([[{ text: "a" }]], 3);
    expect(out).toEqual([[{ text: "a" }, { text: "" }, { text: "" }]]);
  });

  it("truncates long rows down to the column count", () => {
    const out = resizeRows([[{ text: "a" }, { text: "b" }, { text: "c" }]], 2);
    expect(out).toEqual([[{ text: "a" }, { text: "b" }]]);
  });

  it("leaves already-rectangular rows at the right width", () => {
    const out = resizeRows([[{ text: "a" }, { text: "b" }]], 2);
    expect(out).toEqual([[{ text: "a" }, { text: "b" }]]);
  });

  it("clamps a zero/negative column count to a minimum of 1", () => {
    expect(resizeRows([[{ text: "a" }, { text: "b" }]], 0)).toEqual([
      [{ text: "a" }],
    ]);
  });

  it("does not mutate the input rows", () => {
    const rows = [[{ text: "a" }]];
    const out = resizeRows(rows, 2);
    expect(rows).toEqual([[{ text: "a" }]]); // unchanged
    expect(out).not.toBe(rows);
    expect(out[0]).not.toBe(rows[0]);
  });

  it("preserves optional decoration/tone keys on kept cells", () => {
    const out = resizeRows(
      [[{ text: "x", decoration: "badge", tone: "gold" }]],
      2,
    );
    expect(out[0]?.[0]).toEqual({ text: "x", decoration: "badge", tone: "gold" });
    expect(out[0]?.[1]).toEqual({ text: "" });
  });

  it("emptyCell is a plain {text} cell with no optional keys", () => {
    expect(emptyCell()).toEqual({ text: "" });
    expect(Object.keys(emptyCell())).toEqual(["text"]);
  });
});
