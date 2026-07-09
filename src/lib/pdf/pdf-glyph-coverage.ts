// PDF glyph coverage — TEST/TOOLING ONLY. Imports fontkit (a devDependency) and
// reads the bundled PDF font files to decide, per codepoint, whether a string
// bound for the field-guide PDF will render or box.
//
// NEVER import this from render/runtime code: the render path uses the tiny
// zero-dep `PDF_SAIRA_FALLBACK` set (pdf-fallback-set.ts) instead. This module
// exists so `pdf-glyphs.test.ts` (and the seed --check) can PROVE that set stays
// complete and that no PDF-bound string uses a glyph no bundled font can draw.
import * as fontkitNs from "fontkit";
import path from "node:path";

// fontkit's entry is CJS, so the default export lands differently under tsx
// (esbuild) vs vitest (vite) interop. Normalize: prefer `.default`, fall back to
// the namespace object — both expose `openSync`.
const fontkit =
  (fontkitNs as unknown as { default?: typeof fontkitNs }).default ?? fontkitNs;

const DIR = path.join(process.cwd(), "src/lib/pdf/fonts");
// The two body faces the PDF renders prose/code in, plus the Saira fallback.
const crimson = fontkit.openSync(path.join(DIR, "CrimsonText-Regular.ttf"));
const mono = fontkit.openSync(path.join(DIR, "SpaceMono-Regular.ttf"));
const saira = fontkit.openSync(path.join(DIR, "SairaCondensed-Bold.ttf"));

// A codepoint is "body safe" when BOTH body faces can draw it (renders in place,
// no fallback needed).
export function bodySafe(cp: number): boolean {
  return crimson.hasGlyphForCodePoint(cp) && mono.hasGlyphForCodePoint(cp);
}
export function sairaHas(cp: number): boolean {
  return saira.hasGlyphForCodePoint(cp);
}

export type GlyphIssueKind = "needs-fallback-not-in-set" | "no-bundled-font";
export interface GlyphIssue {
  char: string;
  codepoint: string; // U+XXXX
  kind: GlyphIssueKind;
}

// Every char in `text` that would still box in the PDF given `fallbackSet`:
//  - body-unsafe AND in Saira but NOT in the render fallback set → add it there.
//  - body-unsafe AND in NO bundled font → author must avoid it or bundle a font.
export function pdfGlyphIssues(text: string, fallbackSet: ReadonlySet<number>): GlyphIssue[] {
  const issues: GlyphIssue[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x80 || bodySafe(cp)) continue;
    const codepoint = `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
    if (sairaHas(cp)) {
      if (!fallbackSet.has(cp)) issues.push({ char: ch, codepoint, kind: "needs-fallback-not-in-set" });
    } else {
      issues.push({ char: ch, codepoint, kind: "no-bundled-font" });
    }
  }
  return issues;
}
