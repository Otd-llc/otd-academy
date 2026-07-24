import { describe, expect, test } from "vitest";
import { sanitizeProse } from "@/lib/sanitize-prose";

describe("sanitizeProse", () => {
  test("preserves a literal < (KiCad hotkey / comparison), not &lt;", () => {
    expect(sanitizeProse("press `<` to place a via")).toBe("press `<` to place a via");
    expect(sanitizeProse("hold when Vout < 3.3 V")).toBe("hold when Vout < 3.3 V");
  });

  test("preserves > and & as real glyphs", () => {
    expect(sanitizeProse("Route ▸ Set Layer Pair, R > 10 kΩ, in & out")).toBe(
      "Route ▸ Set Layer Pair, R > 10 kΩ, in & out",
    );
  });

  test("leaves emphasis / code / [[term]] markers untouched for the inline renderer", () => {
    const md = "A **bold** run with `code`, a *nudge*, and a [[ground pour|plane]].";
    expect(sanitizeProse(md)).toBe(md);
  });

  test("still strips a real <script> tag (defense-in-depth)", () => {
    const out = sanitizeProse("before <script>alert(1)</script> after");
    expect(out).not.toContain("alert(1)");
    expect(out).not.toContain("<script");
  });

  test("strips unknown inline tag markup but keeps its text", () => {
    expect(sanitizeProse("a <b>bolded</b> word")).toBe("a bolded word");
  });

  test("a typed HTML entity collapses to its glyph (documented, harmless)", () => {
    // sanitize-html decodes the input `&lt;` to `<`, re-encodes, and we decode
    // back — so a typed entity becomes its glyph. Authors write `<`, not `&lt;`,
    // so this is a documented limitation, not a goal.
    expect(sanitizeProse("type &lt; here")).toBe("type < here");
  });
});
