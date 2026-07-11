import { describe, it, expect } from "vitest";

import { readingMinutes } from "@/lib/library/reading-time";

const words = (n: number) => Array.from({ length: n }, () => "word").join(" ");

describe("readingMinutes", () => {
  it("floors at 1 minute for tiny content", () => {
    expect(readingMinutes([{ type: "prose", md: "one two three" }])).toBe(1);
  });

  it("sums words across the prose-bearing block fields at ~200 wpm", () => {
    const blocks = [
      { type: "heading", text: words(20) },
      { type: "prose", md: words(380) },
      { type: "callout", label: "Note", body: words(200) }, // 201
      { type: "steps", items: [words(100), words(100)] }, // 200
      { type: "table", columns: ["a", "b"], rows: [[{ text: words(50) }, { text: words(50) }]] }, // 102
      { type: "quiz", prompt: words(10), questions: [{ q: words(20), options: [words(10), words(10)], explain: words(20) }] }, // 70
    ];
    // 20 + 380 + 201 + 200 + 102 + 70 = 973 -> round(973 / 200) = 5
    expect(readingMinutes(blocks)).toBe(5);
  });

  it("ignores non-prose fields (urls, ids, enum keys)", () => {
    const blocks = [
      { type: "image", src: "https://example.com/x.png", caption: "one two" },
      { type: "sourceRef", label: "Ref", url: "https://a.b/c" },
      { type: "math", tex: "\\frac{V}{R}" },
    ];
    // only "one two" (2) + "Ref" (1) count -> 3 words -> 1 min
    expect(readingMinutes(blocks)).toBe(1);
  });

  it("is resilient to junk / non-array input", () => {
    expect(readingMinutes(null)).toBe(1);
    expect(readingMinutes({})).toBe(1);
    expect(readingMinutes("nope")).toBe(1);
    expect(readingMinutes(undefined)).toBe(1);
  });
});
