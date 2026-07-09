// Shared mapping between a field guide (a cluster key, or "combined" for the
// whole-library book) and its download route. Used by the lead-magnet flow: the
// modal sends a magic link whose post-verification redirect IS the PDF route, and
// auth.ts reads that path back out to brand the magic-link email for the guide.
import { clusterByKey } from "@/lib/library/clusters";

/** The gated PDF route for a guide. */
export function fieldGuidePdfPath(guide: string): string {
  return guide === "combined" ? "/library/field-guide/pdf" : `/library/field-guide/${guide}/pdf`;
}

/** The committed cover thumbnail (the field-guide book's page-1 render). */
export function fieldGuideCoverPath(guide: string): string {
  return `/field-guide-covers/${guide}.png`;
}

/**
 * If `path` is a field-guide PDF route (a magic-link callbackUrl), return the
 * guide key + a human label; otherwise null (a plain sign-in link). Ignores any
 * query string.
 */
export function guideFromPdfPath(path: string): { guide: string; label: string } | null {
  const clean = path.split("?")[0];
  if (clean === "/library/field-guide/pdf") {
    return { guide: "combined", label: "the OTD Reference Library" };
  }
  const m = clean.match(/^\/library\/field-guide\/([^/]+)\/pdf$/);
  if (!m) return null;
  const cluster = clusterByKey(m[1]);
  return cluster ? { guide: cluster.key, label: `the ${cluster.label} Field Guide` } : null;
}
