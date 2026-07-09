// Shared mapping between a field guide (a cluster key, or "combined" for the
// whole-library book) and the lead-magnet routes. The signup modal sends OAuth /
// magic-link to the /welcome landing (as the callbackUrl); /welcome auto-downloads
// the guide and funnels to L1.01; auth.ts reads the callbackUrl back to brand the
// magic-link email for the guide.
import { clusterByKey } from "@/lib/library/clusters";

/** Human label for a guide (a cluster key, or "combined"). */
export function fieldGuideLabel(guide: string): string {
  if (guide === "combined") return "the OTD Reference Library";
  const c = clusterByKey(guide);
  return c ? `the ${c.label} Field Guide` : "the field guide";
}

/** The gated PDF route for a guide. */
export function fieldGuidePdfPath(guide: string): string {
  return guide === "combined" ? "/library/field-guide/pdf" : `/library/field-guide/${guide}/pdf`;
}

/** The PDF URL that DOWNLOADS the guide (attachment) rather than opening inline. */
export function fieldGuidePdfDownloadUrl(guide: string): string {
  return `${fieldGuidePdfPath(guide)}?download=1`;
}

/** The committed cover thumbnail (the field-guide book's page-1 render). */
export function fieldGuideCoverPath(guide: string): string {
  return `/field-guide-covers/${guide}.png`;
}

/** The lead-magnet landing = the OAuth / magic-link post-signin target. */
export function fieldGuideWelcomePath(guide: string): string {
  return `/welcome?fg=${encodeURIComponent(guide)}`;
}

/**
 * If `url` is a lead-magnet welcome callbackUrl (`/welcome?fg=<guide>`), return
 * the guide key + label; otherwise null (a plain sign-in link). Accepts a path
 * or a full URL.
 */
export function guideFromWelcomeUrl(url: string): { guide: string; label: string } | null {
  let fg: string | null = null;
  try {
    fg = new URL(url, "http://x").searchParams.get("fg");
  } catch {
    return null;
  }
  if (!fg) return null;
  if (fg === "combined") return { guide: "combined", label: fieldGuideLabel("combined") };
  const c = clusterByKey(fg);
  return c ? { guide: c.key, label: fieldGuideLabel(c.key) } : null;
}
