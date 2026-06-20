import { describe, it, expect } from "vitest";
import { summarizePrintableBom, type PrintableBomRow } from "@/lib/printable-bom";

const row = (refDes: string, qty: number): PrintableBomRow => ({
  refDes,
  qty,
  mpn: "X",
  manufacturer: "ACME",
  description: null,
  datasheetUrl: null,
  lifecycle: "ACTIVE",
});

describe("summarizePrintableBom", () => {
  it("sorts by refDes in natural order (C1 < R2 < R10)", () => {
    const out = summarizePrintableBom([row("R10", 1), row("R2", 1), row("C1", 1)]);
    expect(out.lines.map((l) => l.refDes)).toEqual(["C1", "R2", "R10"]);
  });

  it("sorts a comma-grouped refDes by its first token", () => {
    const out = summarizePrintableBom([row("R5,R6,R7,R8", 4), row("C2,C3", 2)]);
    expect(out.lines.map((l) => l.refDes)).toEqual(["C2,C3", "R5,R6,R7,R8"]);
  });

  it("totals line count and part count (sum of qty)", () => {
    const out = summarizePrintableBom([row("R1,R2", 2), row("C1", 1), row("U1", 1)]);
    expect(out.lineCount).toBe(3);
    expect(out.totalParts).toBe(4);
  });

  it("handles an empty BOM", () => {
    const out = summarizePrintableBom([]);
    expect(out).toEqual({ lines: [], lineCount: 0, totalParts: 0 });
  });
});
