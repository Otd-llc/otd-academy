// Where to send a learner after `advanceEnrollment` succeeds. The next stage's
// guide card when that stage has one; otherwise the learn dashboard — advancing
// into the terminal REVISION stage completes the enrollment, and REVISION is not
// a guide card (see GUIDE_STAGES).
export function advanceTargetHref(
  toStage: string,
  guideStages: readonly string[],
  cardBaseHref: string,
  completedHref: string,
): string {
  return guideStages.includes(toStage)
    ? `${cardBaseHref}/${toStage}`
    : completedHref;
}
