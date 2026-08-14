// The carousel's rules are the owner's, and two of them are asymmetric on purpose,
// so they are worth pinning: a first cell keeps a full window by taking more of what
// is ahead, and a last cell spills into the next course rather than shrinking.

import { describe, expect, it } from "vitest";
import { combWindow, centreOffset, fitWindowCell, ghostAlpha, isLit, litBoxes, WINDOW } from "@/lib/comb-carousel";
import { placeSpine, SPINE_RATIO, SPINE_VSTEP } from "@/lib/comb-spine";

describe("combWindow", () => {
  it("centres on the current cell in the middle of a run", () => {
    const w = combWindow(9, 4);
    expect(w.lit).toEqual([3, 4, 5]);
    expect(w.current).toBe(4);
    expect(w.spill).toBe("none");
  });

  it("keeps a FULL window at the start rather than leaving a hole", () => {
    // The owner's rule: no previous means current plus the next two.
    const w = combWindow(9, 0);
    expect(w.lit).toEqual([0, 1, 2]);
    expect(w.lit).toHaveLength(WINDOW);
    expect(w.spill).toBe("none");
  });

  it("spills into the next course at the end rather than shrinking", () => {
    // The owner's rule: no next means previous plus the next course. The window stays
    // three wide and the caller is told to render a handover cell.
    const w = combWindow(9, 8);
    expect(w.lit).toEqual([6, 7, 8]);
    expect(w.spill).toBe("next-course");
  });

  it("does not wrap - a course is a sequence, not a loop", () => {
    // Wrapping would tell a learner on the last stage that the first one comes next.
    expect(combWindow(9, 8).lit).not.toContain(0);
    expect(combWindow(9, 0).lit).not.toContain(8);
  });

  it("shows everything when the run is no longer than the window", () => {
    expect(combWindow(3, 1).lit).toEqual([0, 1, 2]);
    expect(combWindow(2, 0).lit).toEqual([0, 1]);
    expect(combWindow(1, 0).lit).toEqual([0]);
  });

  it("clamps an out-of-range current instead of producing a bad window", () => {
    expect(combWindow(9, -3).lit).toEqual([0, 1, 2]);
    expect(combWindow(9, 99).lit).toEqual([6, 7, 8]);
  });

  it("survives an empty run", () => {
    const w = combWindow(0, 0);
    expect(w.lit).toEqual([]);
    expect(w.spill).toBe("none");
  });

  it("always lights exactly WINDOW cells on any run longer than the window", () => {
    for (let count = WINDOW + 1; count <= 12; count += 1) {
      for (let cur = 0; cur < count; cur += 1) {
        expect(combWindow(count, cur).lit).toHaveLength(WINDOW);
      }
    }
  });

  it("always includes the current cell", () => {
    for (let count = 1; count <= 12; count += 1) {
      for (let cur = 0; cur < count; cur += 1) {
        const w = combWindow(count, cur);
        expect(isLit(w, cur)).toBe(true);
      }
    }
  });
});

describe("centreOffset", () => {
  it("puts the current cell's centre on the viewport centre", () => {
    const cellW = 200;
    const h = cellW * SPINE_RATIO;
    const vstep = h * SPINE_VSTEP;
    const viewH = 1080;
    for (const cur of [0, 3, 8]) {
      const off = centreOffset(cur, cellW, viewH);
      // where the cell's centre lands once the run is slid
      const centre = off + cur * vstep + h / 2;
      expect(centre).toBeCloseTo(viewH / 2, 6);
    }
  });

  it("agrees with the spine's own placement", () => {
    // Derived from the same constants the layout uses, so a change to the nestle
    // ratio moves both together rather than leaving the carousel half a cell out.
    const cellW = 180;
    const { boxes } = placeSpine(6, cellW, cellW * 1.5);
    const viewH = 900;
    const cur = 4;
    const off = centreOffset(cur, cellW, viewH);
    const box = boxes[cur]!;
    expect(off + box.top + box.h / 2).toBeCloseTo(viewH / 2, 6);
  });
});

describe("fitWindowCell", () => {
  it("makes exactly `show` cells span the viewport", () => {
    const viewH = 600;
    for (const show of [3, 3.6, 5]) {
      const w = fitWindowCell(viewH, show);
      const h = w * SPINE_RATIO;
      const extent = h * (SPINE_VSTEP * (show - 1) + 1);
      expect(extent).toBeCloseTo(viewH, 6);
    }
  });

  it("fits the whole window, which sizing from the column width does not", () => {
    // The bug this exists to prevent: a cell sized to the column is far too big for a
    // short viewport, and the three cells the carousel is for do not fit in frame.
    const viewH = 520;
    const w = fitWindowCell(viewH);
    const { boxes } = placeSpine(9, w, w * 1.5);
    const win = combWindow(9, 4);
    const first = boxes[win.lit[0]!]!;
    const last = boxes[win.lit[win.lit.length - 1]!]!;
    const span = last.top + last.h - first.top;
    expect(span).toBeLessThanOrEqual(viewH);
  });

  it("survives a zero viewport", () => {
    expect(fitWindowCell(0)).toBe(0);
  });
});

describe("ghostAlpha", () => {
  it("is full inside the window", () => {
    const w = combWindow(9, 4);
    for (const i of w.lit) expect(ghostAlpha(w, i)).toBe(1);
  });

  it("falls away with distance rather than dropping to one flat value", () => {
    const w = combWindow(9, 4);
    const a2 = ghostAlpha(w, 2);
    const a0 = ghostAlpha(w, 0);
    expect(a2).toBeLessThan(1);
    expect(a0).toBeLessThan(a2);
  });

  it("never reaches zero, so the run keeps saying how long it is", () => {
    const w = combWindow(30, 15);
    for (let i = 0; i < 30; i += 1) expect(ghostAlpha(w, i)).toBeGreaterThan(0);
  });

  it("is monotonic outward from the window", () => {
    const w = combWindow(12, 6);
    let prev = 1;
    for (let i = 5; i >= 0; i -= 1) {
      const a = ghostAlpha(w, i);
      expect(a).toBeLessThanOrEqual(prev);
      prev = a;
    }
  });
});

describe("litBoxes", () => {
  it("keeps the ORIGINAL positions, so the perspective is unchanged", () => {
    const { boxes } = placeSpine(9, 200, 300);
    const w = combWindow(9, 4);
    const lit = litBoxes(boxes, w);
    expect(lit).toHaveLength(3);
    // Not re-placed from zero: cell 3 keeps the top the full run gave it.
    expect(lit[0]!.top).toBe(boxes[3]!.top);
    expect(lit[2]!.top).toBe(boxes[5]!.top);
  });

  it("preserves the spine's left/right lacing", () => {
    const { boxes } = placeSpine(9, 200, 300);
    const w = combWindow(9, 4);
    const lit = litBoxes(boxes, w);
    // Alternating cells sit half a width apart; slicing must not restart the stagger.
    expect(lit[0]!.left).toBe(boxes[3]!.left);
    expect(lit[1]!.left).toBe(boxes[4]!.left);
    expect(lit[0]!.left).not.toBe(lit[1]!.left);
  });
});
