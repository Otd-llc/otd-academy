// Motivation-based first-run goal options (owner decision 2026-07-06). Shared by
// the /start survey UI and the saveOnboardingGoal server action — this is a plain
// module (NOT "use server"), so it may export non-async values. Keys are what we
// persist on User.onboardingGoal; they feed personalization + lifecycle email
// segmentation.
export const ONBOARDING_GOAL_OPTIONS = [
  { key: "from_scratch", label: "Learn PCB design from scratch" },
  { key: "kicad_skills", label: "Sharpen my KiCad skills" },
  {
    key: "specific_project",
    label: "Build toward a specific project (drone, BCI, robotics)",
  },
  { key: "exploring", label: "Just exploring" },
] as const;

// The full set of persisted values, including the skip sentinel recorded when a
// learner dismisses the survey (so we don't re-ask every visit).
export const ONBOARDING_GOAL_KEYS = [
  "from_scratch",
  "kicad_skills",
  "specific_project",
  "exploring",
  "skipped",
] as const;

export type OnboardingGoalKey = (typeof ONBOARDING_GOAL_KEYS)[number];
