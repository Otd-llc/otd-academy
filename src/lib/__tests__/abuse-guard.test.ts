import { describe, it, expect } from "vitest";
import {
  isBotSubmission,
  HONEYPOT_FIELD,
  DWELL_FIELD,
  DWELL_MIN_MS,
} from "@/lib/abuse-guard";

describe("isBotSubmission", () => {
  it("flags a filled honeypot", () => {
    expect(isBotSubmission({ [HONEYPOT_FIELD]: "http://spam.example" })).toBe(true);
  });

  it("ignores an empty or whitespace honeypot", () => {
    expect(isBotSubmission({ [HONEYPOT_FIELD]: "" })).toBe(false);
    expect(isBotSubmission({ [HONEYPOT_FIELD]: "   " })).toBe(false);
    expect(isBotSubmission({})).toBe(false);
  });

  it("flags a dwell below the threshold", () => {
    expect(isBotSubmission({ [DWELL_FIELD]: String(DWELL_MIN_MS - 1) })).toBe(true);
    expect(isBotSubmission({ [DWELL_FIELD]: "0" })).toBe(true);
  });

  it("allows a dwell at or above the threshold", () => {
    expect(isBotSubmission({ [DWELL_FIELD]: String(DWELL_MIN_MS) })).toBe(false);
    expect(isBotSubmission({ [DWELL_FIELD]: "5000" })).toBe(false);
  });

  it("exempts an absent or empty dwell (fast path, no interaction — N3)", () => {
    expect(isBotSubmission({ [DWELL_FIELD]: "" })).toBe(false);
    expect(isBotSubmission({})).toBe(false);
  });

  it("ignores a non-numeric dwell", () => {
    expect(isBotSubmission({ [DWELL_FIELD]: "not-a-number" })).toBe(false);
  });

  it("flags a filled honeypot even when dwell is fine", () => {
    expect(
      isBotSubmission({ [HONEYPOT_FIELD]: "x", [DWELL_FIELD]: "9999" }),
    ).toBe(true);
  });
});
