// The curated narrative reading order for the public Library / Field Guide.
//
// Both the /library index and the combined Field Guide PDF are sorted by this so
// the reading path is a single coherent arc — concept → signal → sensing →
// electronics → decode → payoff — rather than authoring order (createdAt) or
// freshness (updatedAt), neither of which reads as a lesson.
//
// The order was link-graph validated (2026-07-01): every deep lesson's back-links
// point to a concept that precedes it here, and no lesson references a later one
// as a prerequisite. `eeg-bci-guide` is the pillar (links to all 11 others); it
// sits at #3, after the two "what is" primers it back-links to.
//
// Slugs not listed here sort to the END, keeping their incoming order from the
// caller's query — so a freshly authored lesson still appears (newest-first on the
// index, authoring order in the book) until it's placed into the arc above.
export const LIBRARY_NARRATIVE_ORDER: readonly string[] = [
  // Act 1 — what & why
  "what-is-a-bci",
  "what-is-eeg",
  "eeg-bci-guide", // pillar / roadmap hub
  // Act 2 — the signal
  "eeg-frequency-bands",
  "motor-imagery-bci",
  // Act 3 — sensing
  "eeg-electrodes-10-20-system",
  "eeg-safety-and-isolation",
  // Act 4 — electronics
  "biopotential-afe",
  "ads1299-explained",
  "eeg-noise-and-right-leg-drive",
  // Act 5 — decode & payoff
  "eeg-classification-csp-eegnet",
  "control-a-drone-with-your-brain",
];

const rank = new Map(LIBRARY_NARRATIVE_ORDER.map((slug, i) => [slug, i]));

/**
 * Stable-sort rows into the curated narrative order. Listed slugs come first in
 * arc order; any slug not in the list sorts after them, preserving the relative
 * order it arrived in (so the caller's `orderBy` still governs unplaced lessons).
 */
export function byNarrativeOrder<T extends { slug: string }>(rows: T[]): T[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const ra = rank.get(a.row.slug) ?? Number.POSITIVE_INFINITY;
      const rb = rank.get(b.row.slug) ?? Number.POSITIVE_INFINITY;
      return ra - rb || a.index - b.index;
    })
    .map((entry) => entry.row);
}
