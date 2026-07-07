"use server";

// First-run onboarding actions. saveOnboardingGoal records the learner's answer
// to the /start goal survey (or the skip sentinel) and fires the funnel event.
// Requires only a signed-in user. This is a "use server" module, so it exports
// ONLY async functions — the option list + key tuple live in the plain
// `@/lib/onboarding-goals` module.
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { capture } from "@/lib/analytics";
import { ONBOARDING_GOAL_KEYS } from "@/lib/onboarding-goals";

const schema = z.object({ goal: z.enum(ONBOARDING_GOAL_KEYS) });

export async function saveOnboardingGoal(
  input: unknown,
): Promise<{ ok: true }> {
  const { goal } = schema.parse(input);
  const user = await requireUser();

  await db.user.update({
    where: { id: user.id },
    data: { onboardingGoal: goal, onboardingGoalAt: new Date() },
  });

  try {
    capture("onboarding_goal_selected", { goal }, user.id);
  } catch {
    // never block first-run on telemetry
  }

  return { ok: true };
}
