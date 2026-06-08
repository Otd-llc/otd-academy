import { describe, it, expect } from "vitest";
import { formatUsd } from "@/lib/format-money";

describe("formatUsd", () => {
  it("formats whole-dollar prices with two decimals", () => {
    expect(formatUsd(4900)).toBe("$49.00");
    expect(formatUsd(100)).toBe("$1.00");
  });

  it("formats sub-dollar and fractional-dollar amounts", () => {
    expect(formatUsd(99)).toBe("$0.99");
    expect(formatUsd(1234)).toBe("$12.34");
  });

  it("groups thousands", () => {
    expect(formatUsd(123456)).toBe("$1,234.56");
  });

  it("renders zero", () => {
    expect(formatUsd(0)).toBe("$0.00");
  });

  it("clamps negatives to zero", () => {
    expect(formatUsd(-500)).toBe("$0.00");
  });

  it("rounds non-integer cents and survives non-finite input", () => {
    expect(formatUsd(149.6)).toBe("$1.50");
    expect(formatUsd(Number.NaN)).toBe("$0.00");
    expect(formatUsd(Number.POSITIVE_INFINITY)).toBe("$0.00");
  });
});
