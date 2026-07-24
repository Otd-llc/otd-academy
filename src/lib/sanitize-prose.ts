import sanitizeHtml from "sanitize-html";

// Strip any author-typed tag markup from guide prose/callout markdown. This is
// NOT the XSS boundary: the renderer (`Inline` in components/guide/InlineText)
// emits every run as a React text / <code> / <strong> node, never
// dangerouslySetInnerHTML, so a stray char is inert. sanitize-html's side effect
// is that it entity-encodes bare `<` `>` `&`, which then surface LITERALLY as
// `&lt;` in the rendered text (e.g. KiCad's `<` hotkey, or "Vout < 3.3 V" in EE
// prose). Decode those three back to the real glyphs after stripping — React
// re-escapes them safely at the DOM. (`&amp;` is decoded last, the conventional
// single-pass order. A *typed* entity like `&lt;` collapses to its glyph `<`,
// which is fine: authors write `<`, not `&lt;`.)
export function sanitizeProse(md: string): string {
  const stripped = sanitizeHtml(md, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: "discard",
    nonTextTags: ["script", "style", "textarea", "noscript"],
  });
  return stripped
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
