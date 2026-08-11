// The feedback pageRef parser is the anti-farming guard: the XP award dedupes
// per (userId, pageRef), so anything this accepts is a thing someone can be paid
// for exactly once. It is worth over-testing.
import { describe, expect, test } from "vitest";
import { courseFeedbackRef, parseFeedbackRef } from "@/lib/feedback-ref";

describe("parseFeedbackRef — library refs", () => {
  test("accepts a library ref and returns the slug", () => {
    expect(parseFeedbackRef("library/what-is-a-resistor")).toEqual({
      kind: "library",
      slug: "what-is-a-resistor",
    });
  });

  test("rejects a library ref with no slug", () => {
    expect(parseFeedbackRef("library/")).toBeNull();
    expect(parseFeedbackRef("library")).toBeNull();
  });

  test("rejects a slug outside the allowed charset", () => {
    expect(parseFeedbackRef("library/Has_Caps")).toBeNull();
    expect(parseFeedbackRef("library/has spaces")).toBeNull();
    expect(parseFeedbackRef("library/../etc")).toBeNull();
  });
});

describe("parseFeedbackRef — course guide refs", () => {
  test("accepts a course stage ref", () => {
    expect(parseFeedbackRef("course/l1-01-wroom-breakout/SCHEMATIC")).toEqual({
      kind: "course",
      slug: "l1-01-wroom-breakout",
      stage: "SCHEMATIC",
    });
  });

  test("accepts every stage that has a guide card", () => {
    const stages = [
      "REQUIREMENTS",
      "BOM_SOURCING",
      "SCHEMATIC",
      "LAYOUT",
      "DRC_GERBER",
      "ORDERING",
      "ASSEMBLY",
      "BRINGUP",
    ];
    for (const s of stages) {
      expect(parseFeedbackRef(`course/l1-01-wroom-breakout/${s}`), s).not.toBeNull();
    }
  });

  test("rejects REVISION — a real Stage, but it has no guide card to comment on", () => {
    expect(parseFeedbackRef("course/l1-01-wroom-breakout/REVISION")).toBeNull();
  });

  test("rejects an unknown or lowercased stage", () => {
    expect(parseFeedbackRef("course/l1-01-wroom-breakout/schematic")).toBeNull();
    expect(parseFeedbackRef("course/l1-01-wroom-breakout/NOT_A_STAGE")).toBeNull();
  });

  test("rejects a missing stage segment", () => {
    expect(parseFeedbackRef("course/l1-01-wroom-breakout")).toBeNull();
    expect(parseFeedbackRef("course/l1-01-wroom-breakout/")).toBeNull();
  });
});

describe("parseFeedbackRef — everything else", () => {
  test("rejects unknown surfaces", () => {
    expect(parseFeedbackRef("admin/students")).toBeNull();
    expect(parseFeedbackRef("")).toBeNull();
    expect(parseFeedbackRef("/")).toBeNull();
  });

  test("rejects extra path segments rather than ignoring them", () => {
    // A prefix match would let `library/<real>/anything` mint unlimited distinct
    // refs against one real lesson, which is exactly the farming hole.
    expect(parseFeedbackRef("library/what-is-a-resistor/extra")).toBeNull();
    expect(parseFeedbackRef("course/l1-01-wroom-breakout/SCHEMATIC/extra")).toBeNull();
  });
});

describe("courseFeedbackRef", () => {
  test("round-trips through the parser", () => {
    const ref = courseFeedbackRef("l1-01-wroom-breakout", "BRINGUP");
    expect(ref).toBe("course/l1-01-wroom-breakout/BRINGUP");
    expect(parseFeedbackRef(ref)).toEqual({
      kind: "course",
      slug: "l1-01-wroom-breakout",
      stage: "BRINGUP",
    });
  });
});
