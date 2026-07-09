// PDF glyph fallback set (render-side, ZERO deps so it is safe in the prod bundle).
//
// The field-guide PDF's two body faces — Serif (Crimson Text) and Mono (Space
// Mono) — are missing a handful of technical glyphs (the ohm sign, pi, delta,
// the integral, approx, script-ell, ...). react-pdf has no automatic cross-family
// glyph fallback, so an absent glyph renders as a .notdef box. Saira ("Numeral")
// DOES carry these, so `library-pdf.tsx` substitutes any codepoint in this set
// with the Numeral face at the emit level (see `withSymbols`).
//
// This set is NOT hand-maintained by guesswork: it is the practical subset of the
// 94 codepoints that (Crimson OR Space Mono lacks) AND Saira has, over U+00A0..
// U+2300. The test `pdf-glyphs.test.ts` re-derives coverage from the font files
// with fontkit and FAILS if any string bound for the PDF (tool registry + lesson
// content) uses a body-missing glyph that is NOT in this set (add it here) or one
// that NO bundled font has (Sigma, lambda, theta, ... — pick a different glyph or
// bundle a font). That test is the guarantee this never regresses silently.
export const PDF_SAIRA_FALLBACK: ReadonlySet<number> = new Set([
  0x0394, // Δ  GREEK CAPITAL DELTA
  0x03a9, // Ω  GREEK CAPITAL OMEGA (ohm)
  0x03bc, // μ  GREEK SMALL MU
  0x03c0, // π  GREEK SMALL PI
  0x2126, // Ω  OHM SIGN
  0x2206, // ∆  INCREMENT
  0x220f, // ∏  N-ARY PRODUCT
  0x222b, // ∫  INTEGRAL
  0x2248, // ≈  ALMOST EQUAL TO
  0x2194, // ↔  LEFT RIGHT ARROW
  0x2195, // ↕  UP DOWN ARROW
  0x2113, // ℓ  SCRIPT SMALL L
  0x2116, // №  NUMERO SIGN
  0x212e, // ℮  ESTIMATED SYMBOL
  0x2153, // ⅓  VULGAR FRACTION ONE THIRD
  0x2154, // ⅔  VULGAR FRACTION TWO THIRDS
  0x215b, // ⅛  VULGAR FRACTION ONE EIGHTH
  0x215c, // ⅜  VULGAR FRACTION THREE EIGHTHS
  0x215d, // ⅝  VULGAR FRACTION FIVE EIGHTHS
  0x215e, // ⅞  VULGAR FRACTION SEVEN EIGHTHS
]);
