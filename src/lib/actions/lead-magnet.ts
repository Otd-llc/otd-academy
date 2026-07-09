"use server";

// NOTE: a "use server" module may export ONLY async functions (no `export type`).

import { auth } from "@/auth";
import { db } from "@/lib/db";

// Mark a lead-magnet signup as onboarded so they SKIP the /start goal survey (they
// already told us why they're here by grabbing a field guide) and record which
// guide brought them, for segmentation. Idempotent: only sets the goal if the user
// has not already answered onboarding, so a returning reader keeps their real goal.
export async function claimLeadMagnet(guide: string): Promise<void> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return;
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, onboardingGoal: true },
  });
  if (!user || user.onboardingGoal) return;
  await db.user.update({
    where: { id: user.id },
    data: { onboardingGoal: `field-guide:${guide}`, onboardingGoalAt: new Date() },
  });
}
