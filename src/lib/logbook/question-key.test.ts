import { describe, it, expect } from "vitest";
import { questionKey, guideKey } from "@/lib/logbook/question-key";

describe("guideKey", () => {
  it("builds a stable guide-scoped slug", () => {
    expect(guideKey("l1-01", "v1", "SCHEMATIC")).toBe("guide:l1-01:v1:SCHEMATIC");
  });
});

describe("questionKey", () => {
  it("uses the explicit id when present", () => {
    expect(questionKey("ohms-law", { id: "q-volts", q: "What is V?" })).toBe(
      "ohms-law#q-volts",
    );
  });
  it("falls back to a stable hash of the question text", () => {
    const a = questionKey("ohms-law", { q: "What is V?" });
    const b = questionKey("ohms-law", { q: "What is V?" });
    expect(a).toBe(b);
    expect(a).toMatch(/^ohms-law#h[0-9a-f]{8}$/);
  });
  it("differs when the text differs", () => {
    expect(questionKey("s", { q: "A" })).not.toBe(questionKey("s", { q: "B" }));
  });
});
