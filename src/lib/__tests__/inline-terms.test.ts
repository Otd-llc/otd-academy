import { describe, it, expect } from "vitest";
import { parseInlineTerms } from "@/lib/inline-terms";

describe("parseInlineTerms", () => {
  it("returns a single text segment when there are no markers", () => {
    expect(parseInlineTerms("just plain prose")).toEqual([
      { kind: "text", value: "just plain prose" },
    ]);
  });

  it("returns an empty array for an empty string", () => {
    expect(parseInlineTerms("")).toEqual([]);
  });

  it("splits a single [[term]] into text + term + text", () => {
    expect(parseInlineTerms("each part has a [[refdes]] on it")).toEqual([
      { kind: "text", value: "each part has a " },
      { kind: "term", term: "refdes", label: "refdes" },
      { kind: "text", value: " on it" },
    ]);
  });

  it("supports a [[term|label]] display override", () => {
    expect(parseInlineTerms("the [[Rd|5.1 kΩ Rd]] resistors")).toEqual([
      { kind: "text", value: "the " },
      { kind: "term", term: "Rd", label: "5.1 kΩ Rd" },
      { kind: "text", value: " resistors" },
    ]);
  });

  it("handles multiple markers in one string", () => {
    const segs = parseInlineTerms("[[LDO]] feeds the [[decoupling]] caps");
    expect(segs).toEqual([
      { kind: "term", term: "LDO", label: "LDO" },
      { kind: "text", value: " feeds the " },
      { kind: "term", term: "decoupling", label: "decoupling" },
      { kind: "text", value: " caps" },
    ]);
  });

  it("emits no empty text segment when a marker is at the start or end", () => {
    expect(parseInlineTerms("[[refdes]]")).toEqual([
      { kind: "term", term: "refdes", label: "refdes" },
    ]);
  });

  it("trims whitespace inside the marker", () => {
    expect(parseInlineTerms("a [[  refdes  ]] b")).toEqual([
      { kind: "text", value: "a " },
      { kind: "term", term: "refdes", label: "refdes" },
      { kind: "text", value: " b" },
    ]);
  });

  it("leaves an unmatched [[ as literal text", () => {
    expect(parseInlineTerms("an array a[[2]] index")).toEqual([
      { kind: "text", value: "an array a" },
      { kind: "term", term: "2", label: "2" },
      { kind: "text", value: " index" },
    ]);
    // genuinely unmatched (no closing) stays literal
    expect(parseInlineTerms("open [[ but never closed")).toEqual([
      { kind: "text", value: "open [[ but never closed" },
    ]);
  });

  it("treats an empty-term marker as literal text", () => {
    expect(parseInlineTerms("x [[|label]] y")).toEqual([
      { kind: "text", value: "x [[|label]] y" },
    ]);
  });
});
