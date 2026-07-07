-- First-run onboarding goal. `onboardingGoal` stores the motivation the learner
-- picked on the /start survey (or the skip sentinel); `onboardingGoalAt` is when
-- they answered. Both null = never answered. Feeds personalization + lifecycle
-- email segmentation. Additive, nullable, non-breaking.
ALTER TABLE "User" ADD COLUMN "onboardingGoal" TEXT;
ALTER TABLE "User" ADD COLUMN "onboardingGoalAt" TIMESTAMP(3);
