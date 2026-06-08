// Where a signed-in LEARNER goes when they hit "/" (the post-sign-in landing).
//
// First-timer (no enrollments): auto-enroll in the entry board (WROOM L1) and
// drop them straight into its first guide card — the "clear path from sign-up
// to first lesson." Returning learner: send them to their /learn home.
//
// The entry board is the curriculum root (published, zero prerequisites);
// completing it unlocks dependents via the DAG.
import { db } from "@/lib/db";

// INVARIANT: the entry board MUST stay `accessTier: PUBLIC`. The auto-enroll
// upsert below deliberately bypasses the PREMIUM entitlement gate in `enroll`
// (Phase 2) — if this board were ever retiered PREMIUM, every first-time learner
// would be silently enrolled with no entitlement. Keep it PUBLIC, or route this
// through `enroll`.
const ENTRY_BOARD_SLUG = "foundry-l1-01-wroom-breakout";

export async function learnerLandingPath(userId: string): Promise<string> {
  const enrollmentCount = await db.enrollment.count({ where: { userId } });
  if (enrollmentCount > 0) return "/learn";

  // First sign-in: auto-enroll in the entry board, then into card 1.
  const entry = await db.project.findUnique({
    where: { slug: ENTRY_BOARD_SLUG },
    select: {
      id: true,
      publishedRevisionId: true,
      publishedRevision: { select: { label: true } },
    },
  });
  if (!entry?.publishedRevisionId || !entry.publishedRevision) {
    // Entry board not open yet — fall back to the learner home rather than 404.
    return "/learn";
  }

  await db.enrollment.upsert({
    where: { userId_projectId: { userId, projectId: entry.id } },
    update: {},
    create: {
      userId,
      projectId: entry.id,
      revisionId: entry.publishedRevisionId,
    },
  });

  return `/projects/${ENTRY_BOARD_SLUG}/${encodeURIComponent(entry.publishedRevision.label)}/guide/REQUIREMENTS`;
}
