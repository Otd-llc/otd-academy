// Canonical URL helper for public lesson (guide card) pages.
//
// A lesson can be VIEWED at any revision label, but its canonical URL must
// always point at the project's PUBLISHED revision so crawlers consolidate
// ranking signals on one stable URL. When a project has no published revision
// there is no canonical lesson URL to advertise (returns null → callers omit
// `alternates.canonical`).

export function canonicalLessonPath(input: {
  slug: string;
  publishedLabel: string | null;
  stage: string;
}): string | null {
  if (!input.publishedLabel) return null;
  return `/projects/${input.slug}/${encodeURIComponent(input.publishedLabel)}/guide/${input.stage}`;
}
