import { describe, it, expect } from "vitest";
import {
  applyCellDecoration,
  emptyCell,
  moveWithin,
  normalizeCell,
  resizeRows,
} from "@/lib/guide-table";

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

describe("normalizeCell", () => {
  it("strips optional keys from a plain cell", () => {
    const out = normalizeCell({ text: "a" });
    expect(out).toEqual({ text: "a" });
    expect(Object.keys(out)).toEqual(["text"]);
  });

  it("drops a stray tone from a ref/mpn cell", () => {
    const ref = normalizeCell({ text: "R12", decoration: "ref", tone: "gold" });
    expect(ref).toEqual({ text: "R12", decoration: "ref" });
    expect(Object.keys(ref)).toEqual(["text", "decoration"]);

    const mpn = normalizeCell({ text: "PN1", decoration: "mpn", tone: "blue" });
    expect(mpn).toEqual({ text: "PN1", decoration: "mpn" });
    expect(Object.keys(mpn)).toEqual(["text", "decoration"]);
  });

  it("keeps an existing tone on a badge cell", () => {
    const out = normalizeCell({ text: "NEW", decoration: "badge", tone: "blue" });
    expect(out).toEqual({ text: "NEW", decoration: "badge", tone: "blue" });
    expect(Object.keys(out)).toEqual(["text", "decoration", "tone"]);
  });

  it("injects tone 'gold' on a badge cell that has none", () => {
    const out = normalizeCell({ text: "NEW", decoration: "badge" });
    expect(out).toEqual({ text: "NEW", decoration: "badge", tone: "gold" });
    expect(Object.keys(out)).toEqual(["text", "decoration", "tone"]);
  });
});

describe("applyCellDecoration", () => {
  it("'' produces a plain {text} cell, dropping decoration and tone", () => {
    const out = applyCellDecoration(
      { text: "x", decoration: "badge", tone: "blue" },
      "",
    );
    expect(out).toEqual({ text: "x" });
    expect(Object.keys(out)).toEqual(["text"]);
  });

  it("'badge' defaults tone to 'gold' when absent", () => {
    const out = applyCellDecoration({ text: "x" }, "badge");
    expect(out).toEqual({ text: "x", decoration: "badge", tone: "gold" });
  });

  it("'badge' preserves an existing tone", () => {
    const out = applyCellDecoration(
      { text: "x", decoration: "badge", tone: "critical" },
      "badge",
    );
    expect(out).toEqual({ text: "x", decoration: "badge", tone: "critical" });
  });

  it("'ref'/'mpn' carry no tone, dropping any stray tone", () => {
    expect(applyCellDecoration({ text: "x", tone: "gold" }, "ref")).toEqual({
      text: "x",
      decoration: "ref",
    });
    expect(
      applyCellDecoration({ text: "x", decoration: "badge", tone: "gold" }, "mpn"),
    ).toEqual({ text: "x", decoration: "mpn" });
  });
});

describe("moveWithin", () => {
  it("swaps an element with its later neighbour (dir 1)", () => {
    expect(moveWithin(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
  });

  it("swaps an element with its earlier neighbour (dir -1)", () => {
    expect(moveWithin(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
  });

  it("returns an unchanged copy when moving the first element up", () => {
    const arr = ["a", "b", "c"];
    const out = moveWithin(arr, 0, -1);
    expect(out).toEqual(["a", "b", "c"]);
    expect(out).not.toBe(arr);
  });

  it("returns an unchanged copy when moving the last element down", () => {
    const arr = ["a", "b", "c"];
    const out = moveWithin(arr, 2, 1);
    expect(out).toEqual(["a", "b", "c"]);
    expect(out).not.toBe(arr);
  });

  it("does not mutate the input array", () => {
    const arr = ["a", "b", "c"];
    moveWithin(arr, 0, 1);
    expect(arr).toEqual(["a", "b", "c"]);
  });
});
