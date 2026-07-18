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

  it("lets an ADMIN downgrade to the learner view via the preview override (WI-3)", () => {
    expect(guideCardView("ADMIN", { previewAsLearner: true })).toEqual({
      isAuthorView: false,
      isLearnerView: true,
    });
  });

  it("ignores previewAsLearner:false for an admin (stays author view)", () => {
    expect(guideCardView("ADMIN", { previewAsLearner: false })).toEqual({
      isAuthorView: true,
      isLearnerView: false,
    });
  });

  it("NEVER lets a non-admin reach the author view, even with previewAsLearner spoofed", () => {
    // The override only ever DOWNGRADES — a learner (or anon) passing the flag stays
    // in the learner view; there is no param path to author tooling for a non-admin.
    expect(guideCardView("LEARNER", { previewAsLearner: true })).toEqual({
      isAuthorView: false,
      isLearnerView: true,
    });
    expect(guideCardView(undefined, { previewAsLearner: true })).toEqual({
      isAuthorView: false,
      isLearnerView: true,
    });
  });
});
