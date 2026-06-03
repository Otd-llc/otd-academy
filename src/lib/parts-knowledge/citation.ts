// Pure citation builder for parts-knowledge facts (design §5).
//
// Every VERIFIED fact emitted by the query layer MUST carry a non-null citation
// (an un-citable fact is not emittable as verified). `citationFor` is the single
// place the citation-string shape is pinned, so both the tool output and the
// answer contract render provenance identically.
//
// Pure + unit-testable: no DB, no I/O. Element anchor wins over the row-level
// anchor; if neither has a page, a degraded-but-non-null string is returned (the
// verify gate guarantees VERIFIED facts have a page in practice, so a verified
// fact always cites a page).

/** Minimal part shape the citation needs (an MPN to anchor the source). */
export interface CitablePart {
  mpn: string;
}

/** Row-level provenance fallback (the `PartFact` columns). */
export interface CitableFact {
  sourcePage?: number | null;
  sourceNote?: string | null;
}

/**
 * Element-level provenance anchor, living INSIDE `PartFact.data` on a pin /
 * curve / entry / bypass row. Preferred over the row-level anchor.
 */
export interface CitableElement {
  sourcePage?: number | null;
  sourceNote?: string | null;
}

/**
 * Build a non-null citation string for a fact (optionally for a specific
 * element). Precedence: the element anchor's page/note wins over the fact's
 * row-level anchor; each field resolves independently (an element page with no
 * element note still falls back to the row note).
 *
 * Format:
 *   - with a page:  `"<mpn> datasheet p.<page>"`  (+ `", <note>"` when present)
 *   - no page:      `"<mpn> datasheet"`           (degraded, still non-null)
 */
export function citationFor(
  part: CitablePart,
  fact: CitableFact,
  element?: CitableElement,
): string {
  // Field-granular precedence: element wins per-field, row is the fallback.
  const page = firstDefined(element?.sourcePage, fact.sourcePage);
  const note = firstNonEmpty(element?.sourceNote, fact.sourceNote);

  let citation = `${part.mpn} datasheet`;
  if (page != null) citation += ` p.${page}`;
  if (note) citation += `, ${note}`;
  return citation;
}

function firstDefined<T>(...values: Array<T | null | undefined>): T | undefined {
  for (const v of values) if (v != null) return v;
  return undefined;
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | undefined {
  for (const v of values) {
    if (v != null && v.trim().length > 0) return v;
  }
  return undefined;
}
