// Pure auto-demote decision for the PartFact gate (design §4).
//
// Extracted out of `part-facts.ts` so it can be a plain (non-"use server")
// module: a `"use server"` file may only export ASYNC functions, so the pure,
// synchronous `shouldDemote` cannot live there once that module is pulled into a
// client bundle's server graph (via the form wrappers). The action module
// imports `shouldDemote` from here; the unit tests import it from here too.

/**
 * The field-granular auto-demote decision. Returns `true` when the edit changed
 * the `data` (deep-equal) OR any of the four ROW provenance ANCHORS
 * (`partDatasheetId`, `sourcePage`, `sourceUrl`, `sourceKind`). `sourceNote` is
 * intentionally IGNORED — a cosmetic note change must not demote a verified
 * fact. Element-level anchors live inside `data`, so they're covered by the deep
 * `data` comparison.
 */
export interface DemoteRelevant {
  data: unknown;
  partDatasheetId: string | null;
  sourcePage: number | null;
  sourceUrl: string | null;
  sourceKind: string;
}

export function shouldDemote(
  stored: DemoteRelevant,
  next: DemoteRelevant,
): boolean {
  if (stored.partDatasheetId !== next.partDatasheetId) return true;
  if (stored.sourcePage !== next.sourcePage) return true;
  if (stored.sourceUrl !== next.sourceUrl) return true;
  if (stored.sourceKind !== next.sourceKind) return true;
  return !deepEqual(stored.data, next.data);
}

// Structural deep-equality for the JSON `data` blob. Stored data round-trips
// through Postgres JSON (object key order is not guaranteed), so we compare by
// value, key-order-independent. Sufficient for the JSON-serializable shapes the
// per-group Zod schemas admit (objects / arrays / primitives).
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (typeof a === "object" && typeof b === "object") {
    const ao = a as Record<string, unknown>;
    const bo = b as Record<string, unknown>;
    const ak = Object.keys(ao);
    const bk = Object.keys(bo);
    if (ak.length !== bk.length) return false;
    for (const k of ak) {
      if (!Object.prototype.hasOwnProperty.call(bo, k)) return false;
      if (!deepEqual(ao[k], bo[k])) return false;
    }
    return true;
  }
  return false;
}
