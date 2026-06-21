// Returns the URL only when it is an http(s) link (or null otherwise), so a
// stored `javascript:`/`data:` URL can never reach an href on a public page.
// Datasheet URLs are admin-entered but now render on the anonymous-viewable BOM,
// so guard them at the render site (defense-in-depth — the schema's `z.url()`
// accepts non-http schemes). Pure + dependency-free.
export function httpUrlOrNull(url: string | null | undefined): string | null {
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}
