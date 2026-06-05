// src/lib/parts-list-url.ts
// Build a /parts URL by merging `patch` onto the current params. Any filter/search/
// sort change (a patch that doesn't itself set `page`) resets pagination to page 1 by
// dropping the page param. Empty/undefined values are omitted entirely.
type Params = Record<string, string | undefined>;

export function partsHref(current: Params, patch: Params): string {
  const next: Params = { ...current, ...patch };
  if (!("page" in patch)) delete next.page; // filter/search/sort change → page 1
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(next)) {
    if (v != null && v !== "") sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `/parts?${qs}` : "/parts";
}
