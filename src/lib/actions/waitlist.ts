"use server";

// Anonymous waitlist capture. Two legitimate contexts leave an email so we
// notify them when a course opens — the demand signal that precedes checkout:
//   1. a PREMIUM project's paywall (the original Task B1 case), and
//   2. any UNPUBLISHED "coming soon" course on the skill tree (any tier — the
//      course doesn't exist yet, so a waitlist is the only action).
// There is NO auth here on purpose: anonymous capture is the whole point. The
// action refuses only published non-premium courses (those are already
// available, so a waitlist is meaningless) and is idempotent on the
// [email, projectId] unique, so a repeat submit is a no-op.
import { z } from "zod";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { capture } from "@/lib/analytics";
import { clientIp, ipCheckFor } from "@/lib/abuse-policy";
import { enforce } from "@/lib/abuse-limit";
import { defenseEnabled } from "@/lib/abuse-defense-flag";

const joinWaitlistSchema = z.object({
  email: z.email(),
  projectId: z.cuid(),
});

export async function joinWaitlist(input: unknown): Promise<{ ok: true }> {
  const { email, projectId } = joinWaitlistSchema.parse(input);

  // Tier 2 abuse limit (design §2, §8): per-IP, FAIL-OPEN (a waitlist row is
  // reversible, so an Upstash outage should not block signups). Throws on a deny
  // so the client form's catch surfaces it (no false success).
  if (await defenseEnabled()) {
    const check = ipCheckFor("waitlist:ip:hour", clientIp(await headers()));
    if (check && !(await enforce([check], "open")).ok) {
      throw new Error("Too many requests. Please try again in a little while.");
    }
  }

  const project = await db.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { accessTier: true, publishedRevisionId: true },
  });
  const isComingSoon = project.publishedRevisionId === null;
  if (!isComingSoon && project.accessTier !== "PREMIUM") {
    throw new Error(
      "Waitlist signups are for upcoming or premium courses only.",
    );
  }

  // Detect first-time signup so the funnel `email_captured` event fires once,
  // not on every idempotent re-submit.
  const prior = await db.waitlistSignup.findUnique({
    where: { email_projectId: { email, projectId } },
    select: { id: true },
  });

  // Idempotent: `update: {}` leaves an existing signup (and its createdAt)
  // untouched, so re-submitting the same email neither throws nor duplicates.
  await db.waitlistSignup.upsert({
    where: { email_projectId: { email, projectId } },
    update: {},
    create: { email, projectId },
  });

  // Funnel: `email_captured` — anonymous demand signal at the top of the funnel.
  // No user id here (capture falls back to an anonymous distinctId). Fire only
  // on a new signup; best-effort; no-op when PostHog is unconfigured.
  if (!prior) {
    try {
      // No raw email in props — PII stays out of analytics (the DB row holds it).
      capture("email_captured", { source: "waitlist", projectId });
    } catch {
      // best-effort
    }
  }

  return { ok: true };
}
