import { describe, it, expect } from "vitest";
import { parseTipAmountCents, TIP_MIN_CENTS, TIP_MAX_CENTS } from "@/lib/tips";

describe("parseTipAmountCents", () => {
  it("accepts the min, max, and an in-range amount", () => {
    expect(parseTipAmountCents(TIP_MIN_CENTS)).toBe(100);
    expect(parseTipAmountCents(TIP_MAX_CENTS)).toBe(50000);
    expect(parseTipAmountCents(500)).toBe(500);
  });
  it("rejects below the minimum", () => {
    expect(() => parseTipAmountCents(99)).toThrow();
  });
  it("rejects above the maximum", () => {
    expect(() => parseTipAmountCents(50001)).toThrow();
  });
  it("rejects non-integers", () => {
    expect(() => parseTipAmountCents(3.5)).toThrow();
  });
  it("rejects zero and negatives", () => {
    expect(() => parseTipAmountCents(0)).toThrow();
    expect(() => parseTipAmountCents(-100)).toThrow();
  });
  it("rejects non-numeric input", () => {
    expect(() => parseTipAmountCents("abc")).toThrow();
    expect(() => parseTipAmountCents(null)).toThrow();
  });
});
