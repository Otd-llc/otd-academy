// View policy for a guide card. The guide page renders for two audiences from
// the same route, and they must NOT see each other's affordances:
//
//   - AUTHOR view (role ADMIN): the STAGE GATE footer (canonical review
//     checklists, commit/board widgets), inline edit-in-place, and the per-board
//     selector — the tooling for building/QA-ing the shared reference revision.
//   - LEARNER view (everyone else): only the per-enrollment overlay (YOUR TRACK
//     panel + quiz recording) over their own progress.
//
// Author tooling is opt-in: an unknown/absent role falls back to the learner
// view so author affordances are never leaked to a non-admin.
export interface GuideCardView {
  /** Show author tooling: STAGE GATE footer, edit-in-place, board selector. */
  isAuthorView: boolean;
  /** Show the per-enrollment learner overlay (YOUR TRACK + quiz recording). */
  isLearnerView: boolean;
}

export function guideCardView(
  role: string | undefined,
  opts: { previewAsLearner?: boolean } = {},
): GuideCardView {
  // Admin-only, downgrade-only preview override (WI-3): an ADMIN can opt INTO the
  // learner view to watch the learner overlay + XP fanfare land — they're otherwise
  // stuck in the author view and never see it as themselves. The override ONLY ever
  // DOWNGRADES: a non-admin can never reach the author view through it, so a spoofed
  // ?as=learner from anyone is harmless (they were already in the learner view).
  const isAdmin = role === "ADMIN";
  const isAuthorView = isAdmin && !opts.previewAsLearner;
  return { isAuthorView, isLearnerView: !isAuthorView };
}
