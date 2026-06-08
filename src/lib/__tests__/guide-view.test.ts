// View policy for a guide card: which audience sees which affordances.
// ADMINs author/QA the reference revision (Stage Gate footer + inline edit);
// everyone else is a learner who sees only their own progress overlay. The
// default for an unknown/absent role is the SAFE learner view — author tooling
// is opt-in, never leaked.
import { describe, it, expect } from "vitest";
import { guideCardView } from "@/lib/guide-view";

describe("guideCardView", () => {
  it("gives admins the author view, not the learner overlay", () => {
    expect(guideCardView("ADMIN")).toEqual({
      isAuthorView: true,
      isLearnerView: false,
    });
  });

  it("gives learners the learner overlay, not author tooling", () => {
    expect(guideCardView("LEARNER")).toEqual({
      isAuthorView: false,
      isLearnerView: true,
    });
  });

  it("defaults an unknown/absent role to the safe learner view (no author tooling)", () => {
    expect(guideCardView(undefined)).toEqual({
      isAuthorView: false,
      isLearnerView: true,
    });
  });
});
