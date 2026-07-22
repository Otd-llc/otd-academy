"use server";

// All-Access Pass waitlist capture. The Pass isn't on sale yet (no provisioned
// Stripe price), so a waitlist is the only action. No auth required: anyone can
// leave an email. When a signed-in learner joins, we stamp their userId. The
// upsert on the unique email makes a repeat submit a no-op (no throw, no dup).
import { z } from "zod";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { capture } from "@/lib/analytics";
import { clientIp, ipCheckFor } from "@/lib/abuse-policy";
import { enforce } from "@/lib/abuse-limit";
import { defenseEnabled } from "@/lib/abuse-defense-flag";

const joinPassWaitlistSchema = z.object({ email: z.email() });

export async function joinPassWaitlist(input: unknown): Promise<{ ok: true }> {
  const { email } = joinPassWaitlistSchema.parse(input);

  // Same fail-open per-IP guard as joinWaitlist (shared bucket — same abuse
  // class): this was the one anonymous public write with no rate limit, an
  // arbitrary-email insert + telemetry-pollution loop.
  if (await defenseEnabled()) {
    const check = ipCheckFor("waitlist:ip:hour", clientIp(await headers()));
    if (check && !(await enforce([check], "open")).ok) {
      throw new Error("Too many requests. Please try again in a little while.");
    }
  }

  // Stamp the signed-in user's id when we have a session (best-effort; anon is
  // fine). The email is still the unique key.
  let userId: string | null = null;
  const session = await auth();
  if (session?.user?.email) {
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    userId = user?.id ?? null;
  }

  const prior = await db.passWaitlist.findUnique({
    where: { email },
    select: { id: true },
  });

  await db.passWaitlist.upsert({
    where: { email },
    update: userId ? { userId } : {},
    create: { email, userId },
  });

  // Funnel: `email_captured` — fire once on a new signup; best-effort; a no-op
  // when PostHog is unconfigured.
  if (!prior) {
    try {
      capture("email_captured", { source: "pass_waitlist", email }, userId ?? undefined);
    } catch {
      // best-effort
    }
  }

  return { ok: true };
}
