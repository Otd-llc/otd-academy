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

export function guideCardView(role: string | undefined): GuideCardView {
  const isAuthorView = role === "ADMIN";
  return { isAuthorView, isLearnerView: !isAuthorView };
}
