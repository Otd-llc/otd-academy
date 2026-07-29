// Pure serialization + path rules for the authored-content archive.
//
// Authored lesson content lives ONLY in the production database: GuideCard and
// MiniLesson `contentBlocks`, Exam `questions`, plus the prose scalars around
// them. None of it is in git. Neon's free plan keeps a short history window, so
// anything authored more than a few hours ago has no provider-side recovery
// path either.
//
// Two properties make the archive worth having, and both live in this file:
//
//   1. BYTE-STABILITY. Re-running the exporter with no content change must
//      produce an empty diff, so the archive's history is signal rather than
//      noise. That needs sorted keys, a fixed trailing newline, and Dates that
//      survive JSON.stringify.
//   2. PATH SAFETY. Slugs and revision labels are interpolated into file paths,
//      so a hostile or merely careless value must not escape the archive root.
//
// Kept pure -- no db, no fs -- so both are unit-tested without a database.

/**
 * Recursively sort object keys so output cannot depend on insertion order.
 *
 * The Date branch is FIRST and load-bearing: `Object.keys(new Date())` is `[]`,
 * so the generic object path would rebuild a Date as `{}` and silently drop
 * every timestamp in the archive (MiniLesson.lastVerifiedAt is authored data).
 */
function sortKeys(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(src).sort()) out[k] = sortKeys(src[k]);
    return out;
  }
  return value;
}

/** Deterministic JSON: sorted keys, 2-space indent, exactly one trailing newline. */
export function serializeContentFile(value: unknown): string {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`;
}

/**
 * Reject any segment that could escape the archive root when interpolated.
 *
 * Slugs and stage names are already tame, but `Revision.label` is free text and
 * a label containing `/` or `..` would write outside the archive.
 */
export function safeSegment(s: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(s) || s === "." || s === "..") {
    throw new Error(`unsafe path segment: ${JSON.stringify(s)}`);
  }
  return s;
}

/**
 * Where each record lands, RELATIVE to the archive root (CONTENT_ARCHIVE_DIR).
 * Forward slashes: these are archive paths, not OS paths.
 *
 * `_guide.json` sorts ahead of the stage files and carries the Guide-level prose
 * (title, track) that the cards hang off, so a restore can recreate a missing
 * Guide row rather than requiring one to already exist.
 */
export const contentPathFor = {
  guide: (projectSlug: string, revisionLabel: string) =>
    `guides/${safeSegment(projectSlug)}/${safeSegment(revisionLabel)}/_guide.json`,
  guideCard: (projectSlug: string, revisionLabel: string, stage: string) =>
    `guides/${safeSegment(projectSlug)}/${safeSegment(revisionLabel)}/${safeSegment(stage)}.json`,
  miniLesson: (slug: string) => `library/${safeSegment(slug)}.json`,
  exam: (projectSlug: string) => `exams/${safeSegment(projectSlug)}.json`,
};

/**
 * Case-collision guard for revision labels.
 *
 * `Revision.label` is case-preserving with only a case-INSENSITIVE uniqueness
 * index, so `v1` and `V1` are distinct rows in Postgres but the same directory
 * on Windows and macOS. Silently merging two revisions' cards would corrupt the
 * archive, so the exporter fails instead.
 */
export function assertNoLabelCaseCollision(
  pairs: { projectSlug: string; label: string }[],
): void {
  const seen = new Map<string, string>();
  for (const { projectSlug, label } of pairs) {
    const key = `${projectSlug}/${label.toLowerCase()}`;
    const prior = seen.get(key);
    if (prior !== undefined && prior !== label) {
      throw new Error(
        `revision labels "${prior}" and "${label}" on ${projectSlug} differ only by case; ` +
          `they would collide as one directory on a case-insensitive filesystem`,
      );
    }
    seen.set(key, label);
  }
}
