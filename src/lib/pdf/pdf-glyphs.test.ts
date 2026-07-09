// Guardrail: no string bound for the field-guide PDF may use a glyph that would
// render as a .notdef box. Two failure modes, both caught here:
//   1. a glyph a body face lacks but Saira has, that is NOT yet in the render
//      fallback set  -> add its codepoint to pdf-fallback-set.ts, and
//   2. a glyph NO bundled font has (Sigma, lambda, theta, ...) -> the author must
//      pick a renderable character or a font must be bundled.
// Coverage is derived from the actual font files with fontkit, so this stays true
// if the fonts ever change. Content strings live in the DB; the tool-registry
// strings checked here are the ones the PDF `calculator` block renders inline
// (tool.title + tool.summary) and were the source of a real pi/ohm box.
import { describe, it, expect } from "vitest";

import { TOOLS } from "@/lib/tools/registry";
import { PDF_SAIRA_FALLBACK } from "@/lib/pdf/pdf-fallback-set";
import { pdfGlyphIssues, sairaHas } from "@/lib/pdf/pdf-glyph-coverage";

describe("PDF glyph coverage", () => {
  it("every PDF_SAIRA_FALLBACK codepoint is actually carried by Saira", () => {
    const notInSaira = [...PDF_SAIRA_FALLBACK]
      .filter((cp) => !sairaHas(cp))
      .map((cp) => `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`);
    // A codepoint in the fallback set that Saira lacks would still box after
    // substitution — the set must only contain glyphs Saira can draw.
    expect(notInSaira).toEqual([]);
  });

  it("tool registry title + summary render in the PDF without .notdef boxes", () => {
    const problems: string[] = [];
    for (const t of TOOLS) {
      for (const [field, text] of [
        ["title", t.title],
        ["summary", t.summary],
      ] as const) {
        for (const issue of pdfGlyphIssues(text, PDF_SAIRA_FALLBACK)) {
          problems.push(
            `${t.slug}.${field}: "${issue.char}" (${issue.codepoint}) — ${issue.kind}`,
          );
        }
      }
    }
    expect(problems).toEqual([]);
  });
});
