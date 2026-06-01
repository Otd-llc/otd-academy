// Unit tests for the R2 helpers (Task 10.2). Pure functions only — no
// network. The S3Client itself is exported as a singleton; that side
// effect is exercised indirectly via the createUploadUrl tests.
import { describe, expect, test } from "vitest";
import { artifactKey, slug } from "@/lib/r2";

describe("slug", () => {
  test("lowercases ASCII alnum + dot + dash and leaves them intact", () => {
    expect(slug("Foo.Bar-baz.pdf")).toBe("foo.bar-baz.pdf");
  });

  test("collapses whitespace runs to a single dash", () => {
    expect(slug("hello   world.pdf")).toBe("hello-world.pdf");
  });

  test("strips diacritics + non-ASCII to dashes", () => {
    // é, à, 漢 → outside [a-z0-9.-]; each maximal run of non-matching chars
    // collapses to one dash. "é" + "-" produces "--" (the original dash
    // survives because dash is in the class); "à漢" is a single run → "-".
    expect(slug("café-déjà漢.pdf")).toBe("caf--d-j-.pdf");
  });

  test("trims leading and trailing dashes", () => {
    expect(slug("   leading-and-trailing   ")).toBe("leading-and-trailing");
  });

  test("falls back to 'file' on empty input", () => {
    expect(slug("")).toBe("file");
  });

  test("falls back to 'file' on a name that slugifies to all dashes", () => {
    // Every char is non-alnum-dot-dash → collapses to "-" → trimmed to "" →
    // returns "file".
    expect(slug("***")).toBe("file");
  });
});

describe("artifactKey", () => {
  test("revision-scoped key includes the 'revisions/' folder", () => {
    const key = artifactKey(
      { kind: "revision", id: "rev_123" },
      "LAYOUT",
      "abc",
      "Schematic.kicad_sch",
    );
    // underscore is not in [a-z0-9.-] → collapsed to "-".
    expect(key).toBe("revisions/rev_123/LAYOUT/abc-schematic.kicad-sch");
  });

  test("build-scoped key includes the 'builds/' folder", () => {
    const key = artifactKey(
      { kind: "build", id: "bld_456" },
      "ORDERING",
      "xyz",
      "JLCPCB order.pdf",
    );
    expect(key).toBe("builds/bld_456/ORDERING/xyz-jlcpcb-order.pdf");
  });

  test("stage segment is whatever stage value is passed in", () => {
    expect(
      artifactKey(
        { kind: "revision", id: "r" },
        "REQUIREMENTS",
        "c",
        "doc.md",
      ),
    ).toBe("revisions/r/REQUIREMENTS/c-doc.md");
  });

  test("empty filename slug falls back to 'file'", () => {
    expect(
      artifactKey({ kind: "revision", id: "r" }, "LAYOUT", "c", ""),
    ).toBe("revisions/r/LAYOUT/c-file");
  });
});
