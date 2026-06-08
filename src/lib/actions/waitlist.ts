"use server";

// Anonymous waitlist capture (Task B1). When a visitor hits a PREMIUM project's
// paywall, they can leave an email so we notify them when the course opens —
// the demand signal that precedes the Stripe checkout (Phase 3). There is NO
// auth here on purpose: anonymous capture is the whole point. The action refuses
// non-PREMIUM projects (only a premium paywall fronts a waitlist) and is
// idempotent on the [email, projectId] unique, so a repeat submit is a no-op.
import { z } from "zod";
import { db } from "@/lib/db";

const joinWaitlistSchema = z.object({
  email: z.email(),
  projectId: z.cuid(),
});

export async function joinWaitlist(input: unknown): Promise<{ ok: true }> {
  const { email, projectId } = joinWaitlistSchema.parse(input);

  const project = await db.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { accessTier: true },
  });
  if (project.accessTier !== "PREMIUM") {
    throw new Error("Waitlist signups are only available for premium courses.");
  }

  // Idempotent: `update: {}` leaves an existing signup (and its createdAt)
  // untouched, so re-submitting the same email neither throws nor duplicates.
  await db.waitlistSignup.upsert({
    where: { email_projectId: { email, projectId } },
    update: {},
    create: { email, projectId },
  });

  return { ok: true };
}
