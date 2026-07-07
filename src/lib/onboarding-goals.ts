// Motivation-based first-run goal options (owner decision 2026-07-06). Shared by
// the /start survey UI and the saveOnboardingGoal server action — this is a plain
// module (NOT "use server"), so it may export non-async values. Keys are what we
// persist on User.onboardingGoal; they feed personalization + lifecycle email
// segmentation.
//
// Copy is grounded in what is actually LIVE today: one published board (L1.01,
// free, end to end), the /library lessons + /glossary, and the /tools
// calculators. No option promises an unpublished board. Each subline points at a
// real, available surface.
export const ONBOARDING_GOAL_OPTIONS = [
  {
    key: "first_board",
    label: "Build a board",
    subline: "Design a real PCB end to end. Start with the free L1.01.",
  },
  {
    key: "kicad",
    label: "Sharpen KiCad",
    subline: "The build, plus the tools and reference around it.",
  },
  {
    key: "learn",
    label: "Learn the electronics",
    subline: "Short lessons, a glossary, calculators.",
  },
  {
    key: "exploring",
    label: "Curious",
    subline: "Just having a look.",
  },
] as const;

// The full set of persisted values, including the skip sentinel recorded when a
// learner dismisses the survey (so we don't re-ask every visit).
export const ONBOARDING_GOAL_KEYS = [
  "first_board",
  "kicad",
  "learn",
  "exploring",
  "skipped",
] as const;

export type OnboardingGoalKey = (typeof ONBOARDING_GOAL_KEYS)[number];
