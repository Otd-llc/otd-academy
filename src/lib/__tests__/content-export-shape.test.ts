import { describe, it, expect } from "vitest";
import {
  serializeContentFile,
  safeSegment,
  contentPathFor,
  assertNoLabelCaseCollision,
} from "@/lib/content-export";

describe("serializeContentFile", () => {
  it("is byte-stable regardless of input key order", () => {
    const a = serializeContentFile({ slug: "x", blocks: [{ type: "prose", text: "hi" }] });
    const b = serializeContentFile({ blocks: [{ type: "prose", text: "hi" }], slug: "x" });
    expect(a).toBe(b);
  });

  it("sorts nested keys too, so a reordered block diffs empty", () => {
    const a = serializeContentFile({ b: { z: 1, a: 2 } });
    const b = serializeContentFile({ b: { a: 2, z: 1 } });
    expect(a).toBe(b);
  });

  it("ends with exactly one trailing newline", () => {
    const out = serializeContentFile({ slug: "x" });
    expect(out.endsWith("\n")).toBe(true);
    expect(out.endsWith("\n\n")).toBe(false);
  });

  // Object.keys(new Date()) is [], so the generic object branch would emit {}
  // and silently drop every authored timestamp.
  it("preserves Date values as ISO strings, not {}", () => {
    const out = serializeContentFile({ at: new Date("2026-07-28T00:00:00.000Z") });
    expect(out).toContain("2026-07-28T00:00:00.000Z");
    expect(out).not.toContain("{}");
  });

  it("preserves a Date nested inside an array", () => {
    const out = serializeContentFile([{ at: new Date("2026-01-02T03:04:05.000Z") }]);
    expect(out).toContain("2026-01-02T03:04:05.000Z");
  });

  it("leaves null and empty arrays intact", () => {
    expect(serializeContentFile({ a: null, b: [] })).toBe('{\n  "a": null,\n  "b": []\n}\n');
  });
});

describe("safeSegment", () => {
  it("accepts ordinary slugs, labels, and stage names", () => {
    for (const s of ["esp32-sensor-breakout", "v1", "A", "SCHEMATIC", "l1-01_x.y"]) {
      expect(safeSegment(s)).toBe(s);
    }
  });

  it("rejects anything that could escape the archive root", () => {
    for (const s of ["..", ".", "a/b", "../etc", "a\\b", "", "a b", "a:b"]) {
      expect(() => safeSegment(s)).toThrow(/unsafe path segment/);
    }
  });
});

describe("contentPathFor", () => {
  it("maps records to deterministic relative paths", () => {
    expect(contentPathFor.guide("esp32-sensor-breakout", "A")).toBe(
      "guides/esp32-sensor-breakout/A/_guide.json",
    );
    expect(contentPathFor.guideCard("esp32-sensor-breakout", "A", "SCHEMATIC")).toBe(
      "guides/esp32-sensor-breakout/A/SCHEMATIC.json",
    );
    expect(contentPathFor.miniLesson("what-is-a-via")).toBe("library/what-is-a-via.json");
    expect(contentPathFor.exam("esp32-sensor-breakout")).toBe(
      "exams/esp32-sensor-breakout.json",
    );
  });

  it("refuses a traversal attempt in any position", () => {
    expect(() => contentPathFor.guideCard("../etc", "A", "SCHEMATIC")).toThrow();
    expect(() => contentPathFor.guideCard("ok", "../..", "SCHEMATIC")).toThrow();
    expect(() => contentPathFor.miniLesson("a/b")).toThrow();
    expect(() => contentPathFor.exam("..")).toThrow();
  });
});

describe("assertNoLabelCaseCollision", () => {
  it("passes for distinct labels and for exact repeats", () => {
    expect(() =>
      assertNoLabelCaseCollision([
        { projectSlug: "p", label: "v1" },
        { projectSlug: "p", label: "v2" },
        { projectSlug: "p", label: "v1" },
        { projectSlug: "q", label: "V1" },
      ]),
    ).not.toThrow();
  });

  // Postgres keeps `v1` and `V1` as separate rows; Windows and macOS would merge
  // them into one directory and silently interleave two revisions' cards.
  it("throws when two labels on one project differ only by case", () => {
    expect(() =>
      assertNoLabelCaseCollision([
        { projectSlug: "p", label: "v1" },
        { projectSlug: "p", label: "V1" },
      ]),
    ).toThrow(/differ only by case/);
  });
});
